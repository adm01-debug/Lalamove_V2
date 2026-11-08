import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  checksObrigatorios,
  classificar,
  confirmarCandidato,
  decidir,
  estadoDoCheck,
  nomesParaConferir,
  resolverDesconhecidos,
} from './fila-merge.mjs';

const SCRIPT = fileURLToPath(new URL('./fila-merge.mjs', import.meta.url));
const SEM_OBRIGATORIOS = checksObrigatorios(); // [] neste repo: main sem branch protection

const check = (name, conclusion, extra = {}) => ({
  name,
  status: 'COMPLETED',
  conclusion,
  startedAt: '2026-11-08T10:00:00Z',
  ...extra,
});

const pr = (extra = {}) => ({
  number: 1,
  isDraft: false,
  isCrossRepository: false,
  baseRefName: 'main',
  headRefOid: 'a'.repeat(40),
  autoMergeRequest: { enabledAt: '2026-11-08T10:00:00Z' },
  mergeStateStatus: 'BEHIND',
  statusCheckRollup: [check('test', 'SUCCESS')],
  ...extra,
});

test('sem branch protection a lista de obrigatórios é vazia e vale o rollup inteiro', () => {
  assert.deepEqual(SEM_OBRIGATORIOS, []);
  assert.deepEqual(
    nomesParaConferir(pr({ statusCheckRollup: [check('a', 'SUCCESS'), check('b', 'FAILURE')] }), []),
    ['a', 'b'],
  );
  assert.deepEqual(nomesParaConferir(pr(), ['so-este']), ['so-este']);
});

test('estado do check: run repetido vale o mais recente; cancelado é pendente', () => {
  const rollup = [check('test', 'FAILURE'), check('test', 'SUCCESS', { startedAt: '2026-11-08T11:00:00Z' })];
  assert.equal(estadoDoCheck(rollup, 'test'), 'passou');
  assert.equal(estadoDoCheck([check('test', 'CANCELLED')], 'test'), 'pendente');
  assert.equal(estadoDoCheck([check('test', 'TIMED_OUT')], 'test'), 'falhou');
  assert.equal(estadoDoCheck([], 'test'), 'pendente');
  assert.equal(estadoDoCheck([{ context: 'legacy', state: 'FAILURE' }], 'legacy'), 'falhou');
});

test('fail-closed: qualquer check vermelho bloqueia a PR', () => {
  assert.equal(classificar(pr({ statusCheckRollup: [check('qualquer', 'FAILURE')] }), SEM_OBRIGATORIOS), 'bloqueada');
});

test('draft, sem auto-merge, base diferente de main e conflito ficam fora', () => {
  for (const extra of [
    { isDraft: true },
    { autoMergeRequest: null },
    { baseRefName: 'develop' },
    { mergeStateStatus: 'DIRTY' },
  ]) {
    assert.equal(classificar(pr(extra), SEM_OBRIGATORIOS), 'fora', JSON.stringify(extra));
  }
});

test('fork atrasada fica fora; fork em dia conta como em voo', () => {
  assert.equal(classificar(pr({ isCrossRepository: true, mergeStateStatus: 'BEHIND' }), SEM_OBRIGATORIOS), 'fora');
  assert.equal(classificar(pr({ isCrossRepository: true, mergeStateStatus: 'CLEAN' }), SEM_OBRIGATORIOS), 'em-voo');
});

test('uma PR em voo segura todas as outras', () => {
  const d = decidir([pr({ number: 1, mergeStateStatus: 'CLEAN' }), pr({ number: 2 })], SEM_OBRIGATORIOS);
  assert.deepEqual([d.acao, d.emVoo], ['esperar', [1]]);
});

test('sem ninguém em voo, a fila é FIFO por enabledAt (empate pelo número)', () => {
  const d = decidir([
    pr({ number: 5, autoMergeRequest: { enabledAt: '2026-11-08T12:00:00Z' } }),
    pr({ number: 3, autoMergeRequest: { enabledAt: '2026-11-08T09:00:00Z' } }),
    pr({ number: 4, autoMergeRequest: { enabledAt: '2026-11-08T09:00:00Z' } }),
  ], SEM_OBRIGATORIOS);
  assert.deepEqual([d.acao, d.pr, d.fila, d.restantes], ['atualizar', 3, [3, 4, 5], [4, 5]]);
});

test('fila vazia devolve "nada" e lista as bloqueadas', () => {
  const d = decidir([pr({ number: 9, statusCheckRollup: [check('test', 'FAILURE')] })], SEM_OBRIGATORIOS);
  assert.deepEqual([d.acao, d.bloqueadas], ['nada', [9]]);
});

test('confirmarCandidato só autoriza o primeiro da fila não recusado', () => {
  const d = decidir([
    pr({ number: 3, autoMergeRequest: { enabledAt: '2026-11-08T09:00:00Z' } }),
    pr({ number: 4, autoMergeRequest: { enabledAt: '2026-11-08T10:00:00Z' } }),
  ], SEM_OBRIGATORIOS);
  assert.ok(confirmarCandidato(d, 3));
  assert.ok(!confirmarCandidato(d, 4));
  assert.ok(confirmarCandidato(d, 4, [3]));
  assert.ok(!confirmarCandidato({ acao: 'esperar', emVoo: [1] }, 3));
});

test('UNKNOWN é resolvido por comparação direta; erro mantém o estado conservador', async () => {
  const [atras] = await resolverDesconhecidos([pr({ mergeStateStatus: 'UNKNOWN' })], async () => 3);
  assert.equal(atras.mergeStateStatus, 'BEHIND');
  const [emDia] = await resolverDesconhecidos([pr({ mergeStateStatus: 'UNKNOWN' })], async () => 0);
  assert.equal(emDia.mergeStateStatus, 'UNKNOWN');
  const [erro] = await resolverDesconhecidos([pr({ mergeStateStatus: 'UNKNOWN' })], async () => {
    throw new Error('sem rede');
  });
  assert.equal(erro.mergeStateStatus, 'UNKNOWN');
});

test('sem GITHUB_REPOSITORY o CLI sai 2 sem chamar o gh', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /GITHUB_REPOSITORY ausente/);
});

test('o script não tem nenhuma escrita no GitHub (merge/update/approve)', async () => {
  const fonte = await import('node:fs').then((fs) => fs.readFileSync(fileURLToPath(new URL('./fila-merge.mjs', import.meta.url)), 'utf8'));
  for (const proibido of ['pr merge', 'pr review', 'update-branch', '--method PUT', '--method POST']) {
    assert.ok(!fonte.includes(proibido), `fila-merge é somente leitura: achei "${proibido}"`);
  }
});
