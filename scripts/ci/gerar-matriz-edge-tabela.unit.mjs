import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extrairTabelas, montarMatriz, renderizar } from './gerar-matriz-edge-tabela.mjs';

const SCRIPT = fileURLToPath(new URL('./gerar-matriz-edge-tabela.mjs', import.meta.url));
const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

function criarFuncoesFalsas() {
  const dir = mkdtempSync(path.join(tmpdir(), 'edge-matriz-'));
  mkdirSync(path.join(dir, 'fn-a'));
  mkdirSync(path.join(dir, 'fn-b'));
  mkdirSync(path.join(dir, '_shared'));
  writeFileSync(
    path.join(dir, 'fn-a', 'index.ts'),
    "await sb.from('orders').select();\nawait sb\n  .from(\"tracking_events\").insert({});\nawait sb.storage.from('pod_bucket').upload('k', new Blob());\n",
  );
  writeFileSync(path.join(dir, 'fn-a', 'index.test.ts'), "sb.from('ignorada')");
  writeFileSync(path.join(dir, 'fn-b', 'index.ts'), "sb.from('orders'); sb.from('profiles');");
  writeFileSync(path.join(dir, '_shared', 'x.ts'), "sb.from('shared_nao_conta')");
  return dir;
}

test('extrai tabela de .from() e ignora storage.from()', () => {
  assert.deepEqual([...extrairTabelas("sb.from('a'); sb.storage.from('b');")], ['a']);
});

test('matriz de 2 funções falsas lista as tabelas certas (teste e _shared fora)', () => {
  assert.deepEqual([...montarMatriz(criarFuncoesFalsas())], [
    ['fn-a', ['orders', 'tracking_events']],
    ['fn-b', ['orders', 'profiles']],
  ]);
});

test('markdown cruza função x tabela nos dois sentidos', () => {
  const md = renderizar(montarMatriz(criarFuncoesFalsas()));
  assert.match(md, /\| `fn-a` \| `orders`, `tracking_events` \|/);
  assert.match(md, /\| `orders` \| `fn-a`, `fn-b` \|/);
  assert.doesNotMatch(md, /ignorada|shared_nao_conta|pod_bucket/);
});

test('função sem tabela aparece com "—"', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'edge-matriz-'));
  mkdirSync(path.join(dir, 'fn-c'));
  writeFileSync(path.join(dir, 'fn-c', 'index.ts'), 'export default () => new Response("ok");');
  assert.match(renderizar(montarMatriz(dir)), /\| `fn-c` \| — \|/);
});

test('--check sai 0 no repositório real depois de gerar', () => {
  assert.equal(spawnSync(process.execPath, [SCRIPT], { cwd: RAIZ, encoding: 'utf8' }).status, 0);
  const r = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
});

test('as 27 funções reais do repo entram na matriz', () => {
  const matriz = montarMatriz(path.join(RAIZ, 'supabase/functions'));
  assert.ok(matriz.has('lalamove-webhook'));
  assert.ok(matriz.has('job-worker'));
  assert.ok(!matriz.has('_shared'));
});
