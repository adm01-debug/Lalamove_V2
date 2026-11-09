import test from 'node:test';
import assert from 'node:assert/strict';

import { coletarPins, commitDaTag, resolverExecutavel, verificarPins } from './check-workflow-pins-resolvem.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

test('coleta pins únicos e agrupa os arquivos onde cada um aparece', () => {
  const pins = coletarPins([
    ['ci.yml', `      - uses: actions/checkout@${SHA_A} # v7.0.0\n`],
    ['outro.yml', `      - uses: actions/checkout@${SHA_A} # v7.0.0\n`],
    ['outro.yml', `      - uses: actions/setup-node@${SHA_B} # v7.1.0\n`],
  ]);
  assert.equal(pins.length, 2);
  assert.deepEqual([...pins[0].arquivos].sort(), ['ci.yml', 'outro.yml']);
  assert.equal(pins[0].tag, 'v7.0.0');
});

test('tag anotada: vale o SHA "peeled" (^{}), não o do objeto da tag', () => {
  const saida = [`${SHA_A}\trefs/tags/v1.0.0`, `${SHA_B}\trefs/tags/v1.0.0^{}`].join('\n');
  assert.equal(commitDaTag(saida, 'v1.0.0'), SHA_B);
  assert.equal(commitDaTag(`${SHA_A}\trefs/tags/v1.0.0`, 'v1.0.0'), SHA_A);
  assert.equal(commitDaTag('', 'v1.0.0'), null);
});

test('pin que não é o commit da tag reprova nomeando o SHA real', async () => {
  const pins = coletarPins([['ci.yml', `      - uses: actions/checkout@${SHA_A} # v7.0.0\n`]]);
  const problemas = await verificarPins(pins, async () => `${SHA_B}\trefs/tags/v7.0.0`);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], new RegExp(`pin ${SHA_A} ≠ commit real da tag ${SHA_B}`));
});

test('pin sem comentário de versão reprova — não há tag para conferir', async () => {
  const pins = coletarPins([['ci.yml', `      - uses: actions/checkout@${SHA_A}\n`]]);
  const problemas = await verificarPins(pins, async () => {
    throw new Error('não deveria consultar a rede');
  });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /pin sem comentário/);
});

test('tag inexistente e erro de consulta geram problemas distintos', async () => {
  const pins = coletarPins([['ci.yml', `      - uses: actions/checkout@${SHA_A} # v99.0.0\n`]]);
  assert.match((await verificarPins(pins, async () => ''))[0], /a tag não existe/);
  assert.match(
    (await verificarPins(pins, async () => {
      throw new Error('rede fora');
    }))[0],
    /não foi possível consultar a tag \(rede fora\)/,
  );
});

test('pin correto passa', async () => {
  const pins = coletarPins([['ci.yml', `      - uses: actions/checkout@${SHA_A} # v7.0.0\n`]]);
  assert.deepEqual(await verificarPins(pins, async () => `${SHA_A}\trefs/tags/v7.0.0`), []);
});

test('resolverExecutavel acha o git e recusa comando inexistente', () => {
  assert.match(resolverExecutavel('git'), /\/git$/);
  assert.throws(() => resolverExecutavel('binario-que-nao-existe-xyz'), /nao encontrado no PATH/);
});
