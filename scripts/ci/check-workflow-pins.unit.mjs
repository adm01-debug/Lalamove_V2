import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import {
  TOOLCHAIN_KEYS,
  TOOLCHAIN_PATH,
  findMutableActionRefs,
  findToolchainDrift,
  findUnauthorizedActionOwners,
  findUnpinnedImages,
  loadAllowedOwnerRepos,
  loadToolchain,
} from './check-workflow-pins.mjs';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const SHA = 'a'.repeat(40);

test('P1: tag é mutável e reprova; SHA de 40 hex passa', () => {
  const comTag = '      - uses: actions/checkout@v7\n';
  const v = findMutableActionRefs(comTag, 'ci.yml');
  assert.equal(v.length, 1);
  assert.equal(v[0].reference, 'actions/checkout@v7');
  assert.equal(v[0].line, 1);

  assert.deepEqual(findMutableActionRefs(`      - uses: actions/checkout@${SHA} # v7.0.0\n`), []);
});

test('P1: action local (./) e docker:// ficam fora da regra', () => {
  assert.deepEqual(findMutableActionRefs('      - uses: ./.github/actions/x\n'), []);
  assert.deepEqual(findMutableActionRefs('      - uses: docker://alpine:3\n'), []);
});

test('P2: owner/repo fora da allowlist reprova', () => {
  const permitidos = new Set(['actions/checkout']);
  const yaml = `      - uses: terceiro/acao@${SHA}\n      - uses: actions/checkout@${SHA}\n`;
  const v = findUnauthorizedActionOwners(yaml, 'ci.yml', permitidos);
  assert.equal(v.length, 1);
  assert.equal(v[0].ownerRepo, 'terceiro/acao');
});

test('P2: a allowlist do repo cobre todas as Actions usadas no ci.yml real', async () => {
  const permitidos = loadAllowedOwnerRepos(RAIZ);
  const ci = await import('node:fs').then((fs) =>
    fs.readFileSync(`${RAIZ}/.github/workflows/ci.yml`, 'utf8'),
  );
  assert.deepEqual(
    findUnauthorizedActionOwners(ci, 'ci.yml', permitidos).map((v) => v.ownerRepo),
    [],
  );
});

test('P3: *_IMAGE sem digest reprova; com digest passa; expressão é ignorada', () => {
  assert.equal(findUnpinnedImages('    PG_IMAGE: postgres:16\n')[0].image, 'postgres:16');
  assert.deepEqual(findUnpinnedImages(`    PG_IMAGE: postgres@sha256:${'b'.repeat(64)}\n`), []);
  assert.deepEqual(findUnpinnedImages('    PG_IMAGE: ${{ env.PG }}\n'), []);
});

test('P4: node-version diferente da fonte única reprova, igual passa', () => {
  const toolchain = { node: '22', deno: 'v1.x' };
  assert.deepEqual(findToolchainDrift("          node-version: '22'\n", 'ci.yml', toolchain), []);
  const v = findToolchainDrift("          node-version: '20'\n", 'ci.yml', toolchain);
  assert.equal(v.length, 1);
  assert.deepEqual([v[0].tool, v[0].value, v[0].expected], ['node', '20', '22']);
});

test('P4: ferramenta sem chave na fonte única reprova com "chave ausente"', () => {
  const v = findToolchainDrift('        run: npm i -D @playwright/test playwright@1.56.0\n', 'ci.yml', { node: '22' });
  assert.equal(v.length, 1);
  assert.equal(v[0].tool, 'playwright');
  assert.equal(v[0].expected, null);
});

test(`${TOOLCHAIN_PATH} existe e declara todas as chaves exigidas`, () => {
  const toolchain = loadToolchain(RAIZ);
  for (const key of TOOLCHAIN_KEYS) assert.equal(typeof toolchain[key], 'string');
});

test('fonte única ausente lança erro com o caminho no texto', () => {
  assert.throws(() => loadToolchain('/tmp/raiz-que-nao-existe'), /\.github\/toolchain\.json/);
});

test('ci.yml real não tem drift de toolchain (node 22 / deno v1.x)', async () => {
  const fs = await import('node:fs');
  const ci = fs.readFileSync(`${RAIZ}/.github/workflows/ci.yml`, 'utf8');
  assert.deepEqual(findToolchainDrift(ci, 'ci.yml', loadToolchain(RAIZ)), []);
});
