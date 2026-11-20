import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  CI_YML,
  JOBS_DE_GATE,
  blocosDeJob,
  verificar,
  violacoesDeArtifact,
  violacoesDeDuplicacao,
  violacoesDeGate,
} from './workflow-invariants.mjs';
import { jobOf, stepsOf, valueOf } from './workflow-test-support.mjs';

const SCRIPT = fileURLToPath(new URL('./workflow-invariants.mjs', import.meta.url));
const CI = readFileSync(CI_YML, 'utf8');

test('I1: todos os jobs de gate declarados existem no ci.yml real', () => {
  const jobs = blocosDeJob(CI);
  for (const id of JOBS_DE_GATE) assert.ok(jobs.has(id), `job de gate ausente no ci.yml: ${id}`);
});

test('I1: job de gate renomeado é denunciado pelo nome', () => {
  const problemas = violacoesDeGate(CI, ['typecheck-que-nao-existe']);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /I1: job de gate 'typecheck-que-nao-existe' não existe/);
});

test('I2: always() no nível do job é violação; !cancelled() não é', () => {
  const comAlways = ['jobs:', '  build:', '    if: always()', '    runs-on: ubuntu-latest'].join('\n');
  assert.match(violacoesDeGate(comAlways, ['build'])[0], /I2: job 'build' usa always\(\)/);

  const comCancelled = ['jobs:', '  build:', "    if: ${{ !cancelled() }}", '    runs-on: ubuntu-latest'].join('\n');
  assert.deepEqual(violacoesDeGate(comCancelled, ['build']), []);
});

test('I3: comando caro em dois jobs é violação', () => {
  const yaml = [
    'jobs:',
    '  test:',
    '    steps:',
    '      - run: npx vitest run',
    '  outro:',
    '    steps:',
    '      - run: npx vitest run --coverage',
  ].join('\n');
  const problemas = violacoesDeDuplicacao(yaml, ['npx vitest run']);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /aparece em 2 jobs \(test, outro\)/);
});

test('I4: upload-artifact sem if: é violação, com if: passa', () => {
  const semIf = [
    'jobs:',
    '  build:',
    '    steps:',
    '      - uses: actions/upload-artifact@v7',
    '        with:',
    '          name: dist',
    '          path: dist/',
  ].join('\n');
  assert.match(violacoesDeArtifact(semIf)[0], /I4: upload-artifact 'dist' não tem/);

  const comIf = semIf.replace(
    '      - uses: actions/upload-artifact@v7',
    ['      - if: ${{ !cancelled() }}', '        uses: actions/upload-artifact@v7'].join('\n'),
  );
  assert.deepEqual(violacoesDeArtifact(comIf), []);
});

test('ci.yml real cumpre todos os invariantes', () => {
  assert.deepEqual(verificar(CI), []);
});

test('o upload do relatório Playwright é o único artifact e tem guard de cancelamento', () => {
  const e2e = jobOf(CI, 'e2e');
  const uploads = stepsOf(e2e).filter((s) => /actions\/upload-artifact/.test(s));
  assert.equal(uploads.length, 1, 'mudou a quantidade de artifacts do job e2e');
  assert.match(valueOf(uploads[0], 'if'), /!cancelled\(\)/);
});

test('CLI sai 0 no ci.yml real e 1 em YAML violado', () => {
  const ok = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(ok.status, 0, `${ok.stdout}${ok.stderr}`);
  assert.match(ok.stdout, /^OK:/);

  const ruim = spawnSync(process.execPath, [SCRIPT, 'nao-existe.yml'], { encoding: 'utf8' });
  assert.equal(ruim.status, 1);
  assert.match(ruim.stderr, /não foi possível ler/);
});
