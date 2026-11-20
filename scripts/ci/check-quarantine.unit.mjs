import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { carregarQuarentena, hojeISO, specsEmQuarentena, validar } from './check-quarantine.mjs';

const SCRIPT = fileURLToPath(new URL('./check-quarantine.mjs', import.meta.url));
const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const HOJE = '2026-11-08';

const item = (extra = {}) => ({
  spec: 'e2e/mfa.e2e.ts', // existe de verdade neste repositório
  motivo: 'flaky conhecido no fluxo de MFA',
  issue: 123,
  prazo: '2026-12-01',
  ...extra,
});

test('hojeISO devolve data sem fuso do ambiente', () => {
  assert.equal(hojeISO(new Date('2026-11-08T23:59:00Z')), '2026-11-08');
  assert.match(hojeISO(), /^\d{4}-\d{2}-\d{2}$/u);
});

test('item válido e futuro passa', () => {
  assert.deepEqual(validar([item()], { raiz: RAIZ, hoje: HOJE }), []);
});

test('prazo vencido FALHA — é a razão de existir do verificador', () => {
  const problemas = validar([item({ prazo: '2026-11-07' })], { raiz: RAIZ, hoje: HOJE });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /prazo vencido em 2026-11-07/);
  assert.match(problemas[0], /#123/, 'a mensagem tem de dizer qual issue acompanha');
});

test('item no próprio dia ainda vale (vencido é o dia seguinte)', () => {
  assert.deepEqual(validar([item({ prazo: HOJE })], { raiz: RAIZ, hoje: HOJE }), []);
});

test('item sem motivo e sem issue não entra — quarentena não é esconderijo', () => {
  const problemas = validar([{ spec: 'e2e/mfa.e2e.ts', prazo: '2026-12-01' }], { raiz: RAIZ, hoje: HOJE });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /item sem motivo, issue/);
});

test('prazo em formato livre reprova', () => {
  assert.match(validar([item({ prazo: '01/12/2026' })], { raiz: RAIZ, hoje: HOJE })[0], /não está em AAAA-MM-DD/);
});

test('spec fora do recorte do playwright (e2e/*.e2e.ts) reprova', () => {
  const problemas = validar([item({ spec: 'src/lib/utils.test.ts' })], { raiz: RAIZ, hoje: HOJE });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /fora do recorte do playwright\.config\.ts/);
});

test('spec inexistente reprova', () => {
  assert.match(
    validar([item({ spec: 'e2e/nao-existe.e2e.ts' })], { raiz: RAIZ, hoje: HOJE })[0],
    /não existe no repositório/,
  );
});

test('arquivo ausente não é erro: devolve aviso e lista vazia', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quarentena-'));
  const { itens, avisos } = await carregarQuarentena(dir);
  assert.deepEqual(itens, []);
  assert.match(avisos[0], /não existe — nada em quarentena/);
});

test('carrega e ordena os specs de um quarantine.js real', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'quarentena-'));
  mkdirSync(join(dir, 'e2e'));
  writeFileSync(join(dir, 'e2e', 'rbac.e2e.ts'), '');
  writeFileSync(
    join(dir, 'e2e', 'quarantine.js'),
    "export const quarentena = [{ spec: 'e2e/rbac.e2e.ts', motivo: 'x', issue: 1, prazo: '2099-01-01' }];\n",
  );
  const { itens } = await carregarQuarentena(dir);
  assert.deepEqual(specsEmQuarentena(itens), ['e2e/rbac.e2e.ts']);
  assert.deepEqual(validar(itens, { raiz: dir, hoje: HOJE }), []);
});

test('CLI no repositório real: sem e2e/quarantine.js sai 0 com aviso', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /check-quarantine: OK/);
});
