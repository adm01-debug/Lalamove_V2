import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  agregar,
  coletarJobs,
  coletarRuns,
  corpoDoKpi,
  duracaoMinutos,
  maisLentos,
  paginaTemMais,
  runsNaJanela,
  tabela,
  tabelaLentos,
} from './actions-kpi.mjs';

const SCRIPT = fileURLToPath(new URL('./actions-kpi.mjs', import.meta.url));
const AGORA = Date.parse('2026-11-08T12:00:00Z');
const horasAtras = (h) => new Date(AGORA - h * 3600_000).toISOString();

const run = (extra = {}) => ({
  id: 1,
  name: 'CI/CD',
  conclusion: 'success',
  run_started_at: horasAtras(1),
  updated_at: horasAtras(0.5),
  ...extra,
});

test('duração vem dos carimbos; carimbo inválido ou invertido conta 0', () => {
  assert.equal(duracaoMinutos(run()), 30);
  assert.equal(duracaoMinutos({ run_started_at: 'x', updated_at: horasAtras(0) }), 0);
  assert.equal(duracaoMinutos({ run_started_at: horasAtras(0), updated_at: horasAtras(1) }), 0);
});

test('janela corta run antigo', () => {
  const runs = [run(), run({ id: 2, run_started_at: new Date(AGORA - 8 * 86400_000).toISOString() })];
  assert.deepEqual(runsNaJanela(runs, { janelaDias: 7, agora: AGORA }).map((r) => r.id), [1]);
});

test('agrega por workflow com taxas de cancelamento e falha', () => {
  const runs = [
    run({ name: 'CI/CD' }),
    run({ name: 'CI/CD', conclusion: 'failure' }),
    run({ name: 'CI/CD', conclusion: 'cancelled' }),
    run({ name: 'Contexto', conclusion: 'timed_out' }),
  ];
  const [ci, contexto] = agregar(runs, { agora: AGORA });
  assert.deepEqual(
    [ci.workflow, ci.runs, ci.cancelados, ci.falhas, ci.taxaFalha, ci.taxaCancelamento, ci.minutos],
    ['CI/CD', 3, 1, 1, 33.3, 33.3, 90],
  );
  assert.deepEqual([contexto.workflow, contexto.falhas, contexto.taxaFalha], ['Contexto', 1, 100]);
});

test('paginação continua só enquanto a página está cheia E dentro da janela', () => {
  const cheiaRecente = new Array(100).fill(run());
  assert.ok(paginaTemMais(cheiaRecente, { agora: AGORA }));
  assert.ok(!paginaTemMais(new Array(99).fill(run()), { agora: AGORA }));
  const cheiaVelha = new Array(100).fill(run({ run_started_at: new Date(AGORA - 30 * 86400_000).toISOString() }));
  assert.ok(!paginaTemMais(cheiaVelha, { agora: AGORA }));
});

test('coletarRuns pagina sem rede e para na página incompleta', async () => {
  const paginas = [new Array(100).fill(run()), [run({ id: 2 })]];
  let chamadas = 0;
  const runs = await coletarRuns({
    repo: 'a/b',
    token: 'x',
    agora: AGORA,
    pedir: async () => ({ workflow_runs: paginas[chamadas++] ?? [] }),
  });
  assert.equal(chamadas, 2);
  assert.equal(runs.length, 101);
});

test('coletarJobs busca por run e herda o nome do workflow', async () => {
  const jobs = await coletarJobs([run({ id: 5, name: 'CI/CD' })], {
    repo: 'a/b',
    token: 'x',
    pedir: async () => ({ jobs: [{ name: 'build', started_at: horasAtras(1), completed_at: horasAtras(0.75) }] }),
  });
  assert.deepEqual(jobs.map((j) => [j.name, j.workflow_name]), [['build', 'CI/CD']]);
});

test('ranking dos mais lentos sai dos jobs reais, não vazio', () => {
  const jobs = [
    { name: 'e2e', workflow_name: 'CI/CD', started_at: horasAtras(2), completed_at: horasAtras(1) },
    { name: 'test', workflow_name: 'CI/CD', started_at: horasAtras(1), completed_at: horasAtras(0.9) },
  ];
  assert.deepEqual(maisLentos(jobs).map((l) => [l.job, l.minutos]), [['e2e', 60], ['test', 6]]);
  assert.match(tabelaLentos(maisLentos(jobs)), /\| e2e \| CI\/CD \| 60 \|/);
  assert.equal(tabelaLentos([]), '_nenhum job registrado na janela_');
});

test('corpo do KPI junta tabela por workflow e ranking de jobs', () => {
  const corpo = corpoDoKpi([run()], [{ name: 'build', started_at: horasAtras(1), completed_at: horasAtras(0.5) }], {
    agora: AGORA,
  });
  assert.match(corpo, /## KPI do GitHub Actions — 7 dias/);
  assert.match(corpo, /Total: \*\*1\*\* runs, \*\*30\*\* minutos\./);
  assert.match(corpo, /### 5 jobs mais lentos/);
});

test('tabela com agregado vazio ainda traz cabeçalho e total zero', () => {
  assert.match(tabela([]), /Total: \*\*0\*\* runs, \*\*0\*\* minutos\./);
});

test('sem GITHUB_REPOSITORY/GH_TOKEN o CLI sai 2 sem tocar a rede', () => {
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /GITHUB_REPOSITORY e GH_TOKEN/);
});
