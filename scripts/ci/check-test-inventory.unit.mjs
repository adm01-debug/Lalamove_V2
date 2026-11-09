import test from 'node:test';
import assert from 'node:assert/strict';

import {
  casaPadrao,
  orfaosDeno,
  orfaosNode,
  padroesNodeDeWorkflow,
  suitesCobertasPorImport,
  suitesNodeNoDisco,
} from './check-test-inventory.mjs';

test('T2: caminho dentro de bloco run: conta; em comentário, nome de etapa ou env: não conta', () => {
  const yaml = [
    'jobs:',
    '  node:',
    '    steps:',
    '      - name: roda scripts/ci/nome-de-etapa.unit.mjs',
    '        env:',
    '          SUITE: scripts/ci/no-env.unit.mjs',
    '        run: |',
    '          node --test scripts/ci/vale.unit.mjs',
    '          # node --test scripts/ci/comentada.unit.mjs',
    '',
    '          node --test scripts/ci/depois-da-linha-vazia.unit.mjs',
  ].join('\n');
  assert.deepEqual(padroesNodeDeWorkflow(yaml), [
    'scripts/ci/depois-da-linha-vazia.unit.mjs',
    'scripts/ci/vale.unit.mjs',
  ]);
});

test('T2: glob `*` não atravessa barra; `**` atravessa', () => {
  assert.ok(casaPadrao('scripts/ci/a.unit.mjs', 'scripts/ci/*.unit.mjs'));
  assert.ok(!casaPadrao('scripts/ci/sub/a.unit.mjs', 'scripts/ci/*.unit.mjs'));
  assert.ok(casaPadrao('scripts/ci/sub/a.unit.mjs', 'scripts/**/*.unit.mjs'));
  assert.ok(casaPadrao('scripts/ci/a.unit.mjs', 'scripts/ci/a.unit.mjs'));
});

test('T2: suíte sem padrão que a cubra é órfã; allowlist a remove', () => {
  const suites = ['scripts/ci/a.unit.mjs', 'scripts/ci/b.unit.mjs'];
  assert.deepEqual(orfaosNode(suites, ['scripts/ci/a.unit.mjs']), ['scripts/ci/b.unit.mjs']);
  assert.deepEqual(orfaosNode(suites, ['scripts/ci/a.unit.mjs'], new Set(['scripts/ci/b.unit.mjs'])), []);
});

test('T2: import estático de agregador coberto cobre a importada; import dinâmico não', () => {
  const suites = ['scripts/ci/agregador.unit.mjs', 'scripts/ci/filha.unit.mjs', 'scripts/ci/solta.unit.mjs'];
  const fontes = {
    'scripts/ci/agregador.unit.mjs': "import './filha.unit.mjs';\nawait import('./solta.unit.mjs');\n",
    'scripts/ci/filha.unit.mjs': '',
    'scripts/ci/solta.unit.mjs': '',
  };
  const cobertas = suitesCobertasPorImport(suites, ['scripts/ci/agregador.unit.mjs'], (f) => fontes[f]);
  assert.ok(cobertas.has('scripts/ci/filha.unit.mjs'));
  assert.ok(!cobertas.has('scripts/ci/solta.unit.mjs'), 'import dinâmico não deve contar como cobertura');
});

test('as suítes Node deste diretório aparecem no inventário do disco', () => {
  const suites = suitesNodeNoDisco();
  assert.ok(suites.includes('scripts/ci/check-test-inventory.unit.mjs'));
  assert.ok(suites.includes('scripts/ci/commit-msg-lint.unit.mjs'));
});

test('T1 (achado real): supabase/functions/external-db-bridge/index.test.ts está órfão no ci.yml', () => {
  // O ci.yml cita só contract.test.ts, lalamove-webhook/security.test.ts e
  // contract.integration.test.ts. Este teste documenta o achado; consertar o ci.yml é
  // tarefa do dono (há PR aberta no arquivo).
  assert.ok(orfaosDeno().includes('supabase/functions/external-db-bridge/index.test.ts'));
});
