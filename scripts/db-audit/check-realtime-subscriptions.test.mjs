import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  baselineDaPublicacao,
  evaluateRealtimeSubscriptions,
  extractRealtimeSubscriptions,
} from './check-realtime-subscriptions.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');

test('extracts direct channel and shared-hook subscriptions from TypeScript', () => {
  const result = extractRealtimeSubscriptions(`
    channel.on('postgres_changes' as never, { schema: 'public', table: 'messages' }, handler);
    import { useSupabaseRealtime } from '@/hooks/realtime/useSupabaseRealtime';
    useSupabaseRealtime({ channelName: 'notifications', table: 'notifications', onAll: handler });
  `);
  assert.deepEqual(result.subscriptions.sort(), ['public.messages', 'public.notifications']);
  assert.deepEqual(result.unresolved, []);
});

test('fails closed for dynamic schemas and object spreads', () => {
  for (const source of [
    `channel.on('postgres_changes', { schema, table: 'notifications' }, handler);`,
    `channel.on('postgres_changes', { schema: 'public', table: 'notifications', ...override }, handler);`,
    `channel.on('postgres_changes', { schema: 'public', table: 'notifications', ...overrideSchema }, handler);`,
  ]) {
    const result = extractRealtimeSubscriptions(source);
    assert.equal(result.subscriptions.length, 0);
    assert.equal(result.unresolved.length, 1);
  }
});

test('resolves const event aliases and bracket/bound on calls', () => {
  for (const source of [
    `const event = 'postgres_changes'; channel.on(event, { table: 'messages' }, handler);`,
    `channel['on']('postgres_changes', { table: 'messages' }, handler);`,
    `const subscribe = channel.on.bind(channel); subscribe('postgres_changes', { table: 'messages' }, handler);`,
  ]) {
    const result = extractRealtimeSubscriptions(source);
    assert.deepEqual(result.subscriptions, ['public.messages']);
    assert.deepEqual(result.unresolved, []);
  }
});

test('resolves imported wrapper aliases and namespaces', () => {
  for (const source of [
    `import { useSupabaseRealtime as subscribe } from '@/hooks/realtime/useSupabaseRealtime'; subscribe({ table: 'messages' });`,
    `import * as realtime from '@/hooks/realtime'; realtime.useSupabaseRealtime({ table: 'messages' });`,
    `import { useSupabaseRealtime } from '@/hooks/realtime/useSupabaseRealtime'; const subscribe = useSupabaseRealtime; subscribe({ table: 'messages' });`,
  ]) {
    const result = extractRealtimeSubscriptions(source);
    assert.deepEqual(result.subscriptions, ['public.messages']);
    assert.deepEqual(result.unresolved, []);
  }
});

test('fails closed for an alias of the canonical wrapper when an import is omitted', () => {
  const result = extractRealtimeSubscriptions(`
    const subscribe = useSupabaseRealtime;
    subscribe({ table: 'audit_logs' });
  `);
  assert.deepEqual(result.subscriptions, ['public.audit_logs']);
  assert.deepEqual(result.unresolved, []);
});

test('does not exempt an unrelated file with the wrapper basename', () => {
  const result = extractRealtimeSubscriptions(
    `channel.on('postgres_changes', { table }, handler);`,
    'src/unrelated/useSupabaseRealtime.ts',
  );
  assert.equal(result.unresolved.length, 1);
});

test('does not confuse a shadowed local function with the imported wrapper', () => {
  const result = extractRealtimeSubscriptions(`
    function useSupabaseRealtime(config) { return config; }
    useSupabaseRealtime({ table });
  `);
  assert.deepEqual(result.subscriptions, []);
  assert.deepEqual(result.unresolved, []);
});

test('fails closed when a subscription table is dynamic', () => {
  const result = extractRealtimeSubscriptions(`channel.on('postgres_changes', { schema: 'public', table }, handler);`);
  assert.equal(result.subscriptions.length, 0);
  assert.equal(result.unresolved.length, 1);
});

test('rejects code subscriptions absent from the reviewed publication baseline', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'realtime-subscriptions-'));
  fs.writeFileSync(path.join(root, 'valid.ts'), `channel.on('postgres_changes', { table: 'messages' }, handler);`);
  fs.writeFileSync(path.join(root, 'invalid.tsx'), `channel.on('postgres_changes', { table: 'audit_logs' }, handler);`);
  const result = evaluateRealtimeSubscriptions(root, ['public.messages']);
  assert.deepEqual(result.absentFromPublication, ['public.audit_logs']);
});

test('fails closed for a spread that precedes the properties and for a duplicated property', () => {
  for (const source of [
    `channel.on('postgres_changes', { ...override, schema: 'public', table: 'notifications' }, handler);`,
    `channel.on('postgres_changes', { table: 'messages', table: 'audit_logs' }, handler);`,
  ]) {
    const result = extractRealtimeSubscriptions(source);
    assert.equal(result.subscriptions.length, 0);
    assert.equal(result.unresolved.length, 1);
  }
});

test('resolves an event alias declared with a type assertion', () => {
  const result = extractRealtimeSubscriptions(
    `const event = 'postgres_changes' as const; channel.on(event, { table: 'messages' }, handler);`,
  );
  assert.deepEqual(result.subscriptions, ['public.messages']);
  assert.deepEqual(result.unresolved, []);
});

test('a publicacao vem das migrations e inclui ADD TABLE dentro de bloco DO $$', () => {
  const publicacao = baselineDaPublicacao(path.join(RAIZ, 'supabase/migrations'));
  assert.equal(publicacao.paraTodasAsTabelas, false);
  // report_presets so aparece dentro de `DO $$ ... IF NOT EXISTS ... END $$`
  // (20260712231421_...): e a prova de que o leitor nao apaga corpo dollar-quoted.
  assert.ok(publicacao.tabelas.includes('public.report_presets'), 'report_presets fora da lista');
  assert.ok(publicacao.tabelas.includes('public.lalamove_orders'), 'lalamove_orders fora da lista');
});

// ACHADO REGISTRADO (nao e divida do porte): estas quatro tabelas sao assinadas
// pelo front e nenhuma migration commitada as adiciona a publicacao
// supabase_realtime. Ou foram adicionadas fora do fluxo de migration (painel
// Supabase/Lovable) — o que so' da' para provar com DESTINO_URL — ou a
// assinatura e' morta: o canal conecta, `subscribe()` devolve SUBSCRIBED e
// nenhum evento chega. Corrigir e' decisao do dono (migration de ALTER
// PUBLICATION ou remocao da assinatura). O teste trava o conjunto: se aparecer
// UMA assinatura morta nova, ele falha.
const ASSINATURAS_MORTAS_CONHECIDAS = [
  'public.auth_logs',
  'public.blocked_ips',
  'public.mfa_sessions',
  'public.new_device_alerts',
];

test('nenhuma assinatura dinamica e nenhuma assinatura morta nova no repositorio', () => {
  const publicacao = baselineDaPublicacao(path.join(RAIZ, 'supabase/migrations'));
  const result = evaluateRealtimeSubscriptions(path.join(RAIZ, 'src'), publicacao.tabelas);
  assert.deepEqual(result.unresolved, [], 'assinatura com tabela/schema dinamico (fail-closed)');
  assert.deepEqual(result.absentFromPublication, ASSINATURAS_MORTAS_CONHECIDAS);
});
