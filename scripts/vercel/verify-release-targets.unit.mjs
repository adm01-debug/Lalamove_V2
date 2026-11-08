/**
 * Prova do verificador de release sem rede: `verificarAlvo` recebe `fetchImpl`,
 * `sleepImpl` e `nowImpl` injetados, então as tentativas e o header de bypass
 * são observáveis sem bater em produção.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TARGETS,
  entryDoDist,
  parseArgs,
  resumoMarkdown,
  verificarAlvo,
} from './verify-release-targets.mjs';

const HTML = (entry) => `<!doctype html><div id="root"></div><script type="module" src="/${entry}"></script>`;

/** fetch falso: mapa de caminho (sem querystring) -> resposta. */
function fakeFetch(rotas, registro = []) {
  return async (url, init = {}) => {
    const u = new URL(url);
    registro.push({ caminho: u.pathname, headers: init.headers ?? {} });
    const r = rotas[u.pathname];
    if (!r) return { status: 404, headers: new Headers(), text: async () => '', clone() { return this; } };
    const headers = new Headers(r.headers ?? {});
    const corpo = r.body ?? '';
    return {
      status: r.status ?? 200,
      headers,
      text: async () => corpo,
      json: async () => JSON.parse(corpo),
      clone() { return this; },
    };
  };
}

test('parseArgs tem alvo padrao e recusa entrada esquisita', () => {
  assert.equal(parseArgs([]).target, 'prod');
  assert.equal(parseArgs([]).url, TARGETS.prod.url);
  assert.throws(() => parseArgs(['--target=v9']), /--target deve ser um de: prod/u);
  assert.throws(() => parseArgs(['--desconhecido=1']), /argumento desconhecido/u);
  assert.throws(() => parseArgs(['--attempts=0']), /--attempts deve ser inteiro/u);
  assert.throws(() => parseArgs(['--expected-entry=../segredo.js']), /entry invalido/u);
  assert.throws(
    () => parseArgs(['--expected-entry=assets/a.js', '--from-dist']),
    /nao os dois/u,
  );
});

test('parseArgs le o entry do dist local', () => {
  const opts = parseArgs(['--from-dist=dist/index.html'], {
    existe: () => true,
    leitor: () => HTML('assets/index-9f3a1c.js'),
  });
  assert.equal(opts.expectedEntry, 'assets/index-9f3a1c.js');
});

test('parseArgs avisa quando o dist nao existe em vez de seguir sem alvo', () => {
  assert.throws(
    () => parseArgs(['--from-dist'], { existe: () => false, leitor: () => '' }),
    /nao existe \(rode o build antes\)/u,
  );
});

test('entryDoDist explode em HTML sem bundle', () => {
  assert.throws(() => entryDoDist('<html></html>', 'fixture'), /nenhum \/assets\/\*\.js/u);
});

test('aprova quando o entry no ar e o esperado', async () => {
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    expectedEntry: 'assets/index-abc.js',
    fetchImpl: fakeFetch({
      '/': { headers: { 'content-type': 'text/html' }, body: HTML('assets/index-abc.js') },
      '/assets/index-abc.js': { headers: { 'cache-control': 'public, immutable' } },
      '/version.json': { status: 404 },
    }),
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.entry, 'assets/index-abc.js');
  assert.equal(r.attempt, 1);
  assert.match(resumoMarkdown(r), /Resultado: OK/u);
});

test('reprova deploy antigo e repete pelas tentativas pedidas', async () => {
  const esperas = [];
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    expectedEntry: 'assets/index-novo.js',
    attempts: 3,
    intervalMs: 500,
    sleepImpl: async (ms) => { esperas.push(ms); },
    fetchImpl: fakeFetch({
      '/': { headers: { 'content-type': 'text/html' }, body: HTML('assets/index-antigo.js') },
    }),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /no ar ainda esta assets\/index-antigo\.js; esperado assets\/index-novo\.js/u);
  assert.deepEqual(esperas, [500, 500], 'deveria esperar entre as tentativas, menos depois da ultima');
  assert.match(resumoMarkdown(r), /Resultado: FALHOU/u);
});

test('sem entry esperado, so identifica o que esta no ar', async () => {
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    fetchImpl: fakeFetch({
      '/': { headers: { 'content-type': 'text/html' }, body: HTML('assets/index-xyz.js') },
      '/assets/index-xyz.js': { headers: { 'cache-control': 'public, immutable' } },
      '/version.json': {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ buildId: 'b'.repeat(40) }),
      },
    }),
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.buildId, 'b'.repeat(40));
  assert.match(resumoMarkdown(r), /nao informado \(so identificacao\)/u);
});

test('protecao do Vercel marca NAO VERIFICADO e nao gasta as tentativas', async () => {
  const esperas = [];
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    attempts: 5,
    intervalMs: 100,
    sleepImpl: async (ms) => { esperas.push(ms); },
    fetchImpl: fakeFetch({
      '/': {
        status: 401,
        headers: { 'content-type': 'text/html', 'x-vercel-id': 'iad1::a' },
        body: 'Authentication Required',
      },
    }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.protegido, true);
  assert.deepEqual(esperas, [], 'proteccao nao e falha transitoria: nao repete');
  assert.match(resumoMarkdown(r), /NAO VERIFICADO/u);
});

test('bypass-token vai no header de todas as requisicoes', async () => {
  const registro = [];
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    bypassToken: 'segredo',
    fetchImpl: fakeFetch({
      '/': { headers: { 'content-type': 'text/html' }, body: HTML('assets/index-abc.js') },
      '/assets/index-abc.js': { headers: { 'cache-control': 'immutable' } },
      '/version.json': { status: 404 },
    }, registro),
  });
  assert.equal(r.ok, true, r.error);
  assert.ok(registro.length >= 2);
  for (const req of registro) {
    assert.equal(req.headers['x-vercel-protection-bypass'], 'segredo', `sem bypass em ${req.caminho}`);
  }
});

test('host inalcancavel vira NAO VERIFICADO, nao "deploy errado"', async () => {
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    attempts: 2,
    intervalMs: 0,
    sleepImpl: async () => {},
    fetchImpl: async () => { throw new TypeError('fetch failed'); },
  });
  assert.equal(r.ok, false);
  assert.equal(r.inalcancavel, true);
  assert.notEqual(r.protegido, true, 'rede fora nao e protecao do Vercel');
  assert.match(resumoMarkdown(r), /NAO VERIFICADO — host inalcancavel/u);
});

test('content-type que nao e HTML reprova (nao mede a pagina errada)', async () => {
  const r = await verificarAlvo({
    url: 'https://exemplo.test',
    fetchImpl: fakeFetch({
      '/': { headers: { 'content-type': 'application/json' }, body: '{}' },
    }),
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /content-type inesperado/u);
});
