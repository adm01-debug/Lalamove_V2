// Testes do baseline de variaveis de ambiente do projeto Vercel lalamove-v2.
// Compativel com `node --test scripts/ci/*.unit.mjs`.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadBaseline, checkVars } from './vercel-env-baseline.mjs';

test('baseline JSON parses e tem os targets esperados', () => {
  const b = loadBaseline();
  assert.ok(b.production, 'target production ausente');
  assert.ok(b.preview, 'target preview ausente');
  assert.ok(b.development, 'target development ausente');
});

test('production tem vars obrigatórias de VITE_SUPABASE_*', () => {
  const b = loadBaseline();
  const req = new Set(b.production.required || []);
  assert.ok(req.has('VITE_SUPABASE_URL'), 'VITE_SUPABASE_URL deve ser obrigatória em production');
  assert.ok(req.has('VITE_SUPABASE_PUBLISHABLE_KEY'), 'VITE_SUPABASE_PUBLISHABLE_KEY deve ser obrigatória em production');
});

test('production forbidden_nonvite inclui chaves de servidor críticas', () => {
  const b = loadBaseline();
  const fn = b.production.forbidden_nonvite || [];
  // Os segredos que as Edge Functions deste repo realmente usam (Deno.env.get),
  // mais os genericos de IA que nunca devem aparecer num projeto de front.
  for (const k of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'EXTERNAL_SUPABASE_SERVICE_ROLE_KEY',
    'LALAMOVE_API_KEY',
    'LALAMOVE_API_SECRET',
    'MAPBOX_ACCESS_TOKEN',
    'BITRIX24_CLIENT_SECRET',
    'LOVABLE_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
  ]) {
    assert.ok(fn.includes(k), `${k} deve estar em forbidden_nonvite de production`);
  }
});

test('checkVars detecta var proibida', () => {
  const b = loadBaseline();
  const errors = checkVars(b, 'production', ['SUPABASE_SERVICE_ROLE_KEY']);
  assert.ok(errors.length > 0, 'deve reportar erro para var proibida');
  assert.ok(errors.some(e => e.includes('SUPABASE_SERVICE_ROLE_KEY')));
});

test('checkVars passa para conjunto de vars apenas obrigatórias', () => {
  const b = loadBaseline();
  const required = b.production.required || [];
  const errors = checkVars(b, 'production', required);
  assert.deepEqual(errors, [], 'vars obrigatórias e só elas devem passar sem erro');
});

test('nenhuma var obrigatória está também proibida (integridade do baseline)', () => {
  const b = loadBaseline();
  for (const target of ['production', 'preview', 'development']) {
    const tc = b[target] || {};
    const required = new Set(tc.required || []);
    const forbidden = new Set([...(tc.forbidden || []), ...(tc.forbidden_nonvite || [])]);
    for (const k of required) {
      assert.ok(
        !forbidden.has(k),
        `"${k}" está ao mesmo tempo em required e forbidden para target="${target}"`
      );
    }
  }
});

test('target preview tem subconjunto menor de obrigatórias que production', () => {
  const b = loadBaseline();
  assert.ok(
    (b.preview.required || []).length <= (b.production.required || []).length,
    'preview não deve exigir mais vars que production'
  );
});

test('forbidden cobre a forma VITE_* dos segredos de servidor (o que iria para o bundle)', () => {
  const b = loadBaseline();
  for (const target of ['production', 'preview']) {
    const forbidden = new Set(b[target].forbidden || []);
    for (const k of ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_LALAMOVE_API_SECRET', 'VITE_MAPBOX_ACCESS_TOKEN']) {
      assert.ok(forbidden.has(k), `${k} deve estar em forbidden de ${target}`);
    }
  }
});

test('as VITE_* que o src/ realmente le estao declaradas (required ou optional)', () => {
  const b = loadBaseline();
  const declaradas = new Set([...(b.production.required || []), ...(b.production.optional || [])]);
  // Medido em 2026-11-08 com grep de import.meta.env.VITE_* em src/.
  for (const k of [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_APP_VERSION',
    'VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY',
    'VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID',
    'VITE_GOOGLE_MAPS_BROWSER_KEY',
    'VITE_GOOGLE_MAPS_MAP_ID',
  ]) {
    assert.ok(declaradas.has(k), `${k} e lida em src/ e precisa estar no baseline de production`);
  }
});

test('checkVars acusa obrigatoria faltando', () => {
  const b = loadBaseline();
  const errors = checkVars(b, 'production', ['VITE_SUPABASE_URL']);
  assert.ok(errors.some((e) => e.includes('VITE_SUPABASE_PUBLISHABLE_KEY')), 'deve acusar a chave publica ausente');
});

test('checkVars acusa segredo de edge function presente no Vercel', () => {
  const b = loadBaseline();
  const errors = checkVars(b, 'production', [...b.production.required, 'LALAMOVE_API_SECRET']);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /LALAMOVE_API_SECRET/);
});

test('target desconhecido falha explicito (nao passa calado)', () => {
  const b = loadBaseline();
  assert.throws(() => checkVars(b, 'staging', []), /staging/);
});
