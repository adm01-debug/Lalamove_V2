import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./verify-production.mjs', import.meta.url));
const SHA = 'a'.repeat(40);
const HEADERS_OK = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
};
const HTML = '<!doctype html><div id="root"></div><script type="module" src="/assets/app-abc123.js"></script>';

async function executar(handler, extraArgs = []) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const child = spawn(process.execPath, [SCRIPT, `--url=http://127.0.0.1:${port}`, ...extraArgs], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Garante que um segredo do ambiente real nao vaze para o caso de teste.
    env: { ...process.env, VERCEL_AUTOMATION_BYPASS_SECRET: '' },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (c) => { stdout += c; });
  child.stderr.setEncoding('utf8').on('data', (c) => { stderr += c; });
  const [code] = await once(child, 'close');
  server.close();
  await once(server, 'close');
  return { code, output: stdout + stderr };
}

function responder(res, status, headers, body) {
  res.writeHead(status, { ...HEADERS_OK, ...headers });
  res.end(body);
}

/** Produção saudável: SPA, bundle imutável, deep link e version.json válidos. */
function servidorSaudavel(req, res) {
  if (req.url === '/version.json') {
    responder(res, 200, { 'content-type': 'application/json' }, JSON.stringify({ buildId: SHA }));
    return;
  }
  if (req.url === '/assets/app-abc123.js') {
    responder(res, 200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' }, '');
    return;
  }
  responder(res, 200, { 'content-type': 'text/html' }, HTML);
}

test('aprova SPA com entry, cache imutavel, deep link e buildId SHA', async () => {
  const r = await executar(servidorSaudavel);
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /smoke passou/u);
  assert.match(r.output, /\/orders -> 200 com o SPA/u);
});

test('reprova deep link que nao cai no SPA (fallback quebrado)', async () => {
  const r = await executar((req, res) => {
    if (req.url === '/orders') { responder(res, 404, { 'content-type': 'text/html' }, 'not found'); return; }
    servidorSaudavel(req, res);
  });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /\/orders status 404/u);
  assert.match(r.output, /rewrite de fallback/u);
});

test('reprova SPA sem bundle JavaScript', async () => {
  const r = await executar((req, res) => {
    if (req.url === '/version.json') { responder(res, 404, {}, ''); return; }
    responder(res, 200, { 'content-type': 'text/html' }, '<!doctype html><title>sem bundle</title>');
  });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /SPA sem bundle JavaScript/u);
});

test('reprova buildId que nao seja SHA completo', async () => {
  const r = await executar((req, res) => {
    if (req.url === '/version.json') {
      responder(res, 200, { 'content-type': 'application/json' }, JSON.stringify({ buildId: 'not-a-sha' }));
      return;
    }
    servidorSaudavel(req, res);
  });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /esperado SHA completo/u);
});

test('version.json ausente e informativo, nao falha', async () => {
  const r = await executar((req, res) => {
    if (req.url === '/version.json') { responder(res, 404, { 'content-type': 'text/plain' }, 'nope'); return; }
    servidorSaudavel(req, res);
  });
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /\/version\.json nao publicado/u);
});

test('protecao do Vercel sai como NAO VERIFICADO (3), nunca como sucesso', async () => {
  const r = await executar((req, res) => {
    res.writeHead(401, {
      'content-type': 'text/html',
      'x-vercel-id': 'iad1::abc',
      'set-cookie': '_vercel_sso_nonce=xyz; Path=/; HttpOnly',
    });
    res.end('<html>Authentication Required</html>');
  });
  assert.equal(r.code, 3, r.output);
  assert.match(r.output, /NAO VERIFICADO/u);
  assert.match(r.output, /--bypass-token/u);
  assert.doesNotMatch(r.output, /smoke passou/u);
});

test('bypass-token e enviado no header e nunca impresso', async () => {
  const recebidos = [];
  const r = await executar((req, res) => {
    recebidos.push(req.headers['x-vercel-protection-bypass']);
    servidorSaudavel(req, res);
  }, ['--bypass-token=segredo-ultra-secreto']);
  assert.equal(r.code, 0, r.output);
  assert.ok(recebidos.every((v) => v === 'segredo-ultra-secreto'), 'header de bypass nao chegou em todas as requisicoes');
  assert.doesNotMatch(r.output, /segredo-ultra-secreto/u);
  assert.match(r.output, /bypass de protecao: sim \(valor nao impresso\)/u);
});

test('header de seguranca ausente e aviso por padrao e falha com --strict-headers', async () => {
  const semHeaders = (req, res) => {
    if (req.url === '/version.json') { res.writeHead(404); res.end(); return; }
    if (req.url === '/assets/app-abc123.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, immutable' });
      res.end('');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(HTML);
  };

  const brando = await executar(semHeaders);
  assert.equal(brando.code, 0, brando.output);
  assert.match(brando.output, /AVISO .*x-frame-options/u);

  const rigoroso = await executar(semHeaders, ['--strict-headers']);
  assert.equal(rigoroso.code, 1, rigoroso.output);
  assert.match(rigoroso.output, /FALHA .*x-frame-options/u);
});

test('cache sem immutable e aviso, nao falha', async () => {
  const r = await executar((req, res) => {
    if (req.url === '/assets/app-abc123.js') {
      responder(res, 200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=0, must-revalidate' }, '');
      return;
    }
    servidorSaudavel(req, res);
  });
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /Cache-Control sem "immutable"/u);
});

test('host inalcancavel sai como NAO VERIFICADO (4)', async () => {
  // Porta fechada em loopback: conexao recusada, nao "app com defeito".
  const child = spawn(process.execPath, [SCRIPT, '--url=http://127.0.0.1:9'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.setEncoding('utf8').on('data', (c) => { out += c; });
  child.stderr.setEncoding('utf8').on('data', (c) => { out += c; });
  const [code] = await once(child, 'close');
  assert.equal(code, 4, out);
  assert.match(out, /nao foi possivel alcancar a producao/u);
});

test('url sem esquema e entrada invalida (2)', async () => {
  const child = spawn(process.execPath, [SCRIPT, '--url=lalamove-v2.vercel.app'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stderr.setEncoding('utf8').on('data', (c) => { out += c; });
  const [code] = await once(child, 'close');
  assert.equal(code, 2, out);
  assert.match(out, /entrada invalida/u);
});
