import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { achatar, placeholders, comparar, carregarLocales, IDIOMA_REFERENCIA } from './check-i18n-parity.mjs';

const SCRIPT = fileURLToPath(new URL('./check-i18n-parity.mjs', import.meta.url));
const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

const mapa = (obj) => achatar(obj);

test('achatar transforma aninhamento em chaves pontuadas', () => {
  const m = mapa({ map: { actions: { settings: 'Ajustes', close: 'Fechar' } }, alertas: 'x' });
  assert.deepEqual([...m.keys()].sort(), ['alertas', 'map.actions.close', 'map.actions.settings']);
});

test('placeholders extrai nomes entre chaves duplas e ignora texto solto', () => {
  assert.deepEqual([...placeholders('Olá {{name}}, {{ count }} itens')], ['count', 'name']);
  assert.deepEqual([...placeholders('sem variável')], []);
});

test('locales em paridade passam', () => {
  const locales = {
    'pt-BR': mapa({ a: 'um', b: { c: 'dois' } }),
    en: mapa({ a: 'one', b: { c: 'two' } }),
    es: mapa({ a: 'uno', b: { c: 'dos' } }),
  };
  assert.deepEqual(comparar(locales), []);
});

test('chave faltando em en FALHA e a mensagem diz qual chave', () => {
  const locales = {
    'pt-BR': mapa({ a: 'um', b: 'dois' }),
    en: mapa({ a: 'one' }),
    es: mapa({ a: 'uno', b: 'dos' }),
  };
  const problemas = comparar(locales);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /^en: 1 chave\(s\) faltando — b$/u);
});

test('chave sobrando em es FALHA — paridade é nos dois sentidos', () => {
  const locales = {
    'pt-BR': mapa({ a: 'um' }),
    en: mapa({ a: 'one' }),
    es: mapa({ a: 'uno', extra: 'sobra' }),
  };
  const problemas = comparar(locales);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /^es: 1 chave\(s\) sobrando .* — extra$/u);
});

test('valor vazio FALHA — controle sem nome é pior que chave ausente', () => {
  const locales = {
    'pt-BR': mapa({ a: 'um', vazia: '' }),
    en: mapa({ a: 'one', vazia: '   ' }),
    es: mapa({ a: 'uno', vazia: 'vazio' }),
  };
  const problemas = comparar(locales);
  assert.equal(problemas.length, 2);
  assert.ok(problemas.every((p) => /"vazia" está vazio/u.test(p)));
});

test('placeholder divergente FALHA — interpolação imprimiria o literal', () => {
  const locales = {
    'pt-BR': mapa({ msg: 'Faltam {{count}} itens' }),
    en: mapa({ msg: 'Missing {{total}} items' }),
    es: mapa({ msg: 'Faltan {{count}} elementos' }),
  };
  const problemas = comparar(locales);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /^en: "msg" usa placeholders diferentes/u);
});

test('locale de referência ausente FALHA', () => {
  assert.match(comparar({ en: mapa({ a: 'x' }) })[0], /referência ausente/u);
});

test('os locales reais do repositório estão em paridade', () => {
  const locales = carregarLocales(RAIZ);
  assert.deepEqual(comparar(locales), []);
  assert.equal(locales[IDIOMA_REFERENCIA].size, locales.en.size);
});

test('o script roda de ponta a ponta e sai 0 no repositório real', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /3 locales em paridade/u);
});

test('o script sai 1 e lista o problema quando um locale divergir', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'i18n-'));
  const dir = join(tmp, 'src/i18n/locales');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pt-BR.json'), JSON.stringify({ a: 'um', b: 'dois' }));
  writeFileSync(join(dir, 'en.json'), JSON.stringify({ a: 'one' }));
  writeFileSync(join(dir, 'es.json'), JSON.stringify({ a: 'uno', b: 'dos' }));
  const r = spawnSync(process.execPath, [SCRIPT, '--raiz', tmp], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /1 problema/u);
  assert.match(r.stderr, /chave\(s\) faltando/u);
});
