#!/usr/bin/env node
/**
 * Confirma que a PRODUÇÃO está servindo o build que você espera — com repetição,
 * para esperar a propagação do Vercel depois de um merge.
 *
 * Uso:
 *   node scripts/vercel/verify-release-targets.mjs --from-dist --attempts=30 --interval-ms=10000
 *   node scripts/vercel/verify-release-targets.mjs --expected-entry=assets/index-9f3a1c.js
 *   node scripts/vercel/verify-release-targets.mjs            # só identifica o que está no ar
 *
 * Códigos de saída: 0 = o alvo serve o build esperado · 1 = não serve · 2 =
 * entrada inválida · 3 = NÃO VERIFICADO (proteção do Vercel) · 4 = NÃO
 * VERIFICADO (host inalcançável). Nunca sai 0 sem ter medido.
 *
 * PORTADO do Zapp Web V2 (`scripts/vercel/verify-release-targets.mjs`) e
 * REESCRITO na identidade do release, porque o dado que o Zapp compara não
 * existe aqui:
 *
 *   - Zapp: dois alvos (`zapp-web-v2.vercel.app` e `zappweb.app.br`), cada um
 *     publicando `/version.json` com `buildId`/`gitSha`, comparado com o SHA da
 *     `main` (`--expected-sha`).
 *   - Lalamove: UM projeto Vercel (`lalamove-v2`, docs/agentes/deploy.md:10) e
 *     NENHUM `version.json` publicado — não há `vercel.json`, nem
 *     `public/version.json`, nem `buildId` no repo. Comparar SHA aqui seria
 *     comparar com um arquivo que ninguém gera.
 *
 * A identidade observável do release neste repo é o NOME DO BUNDLE DE ENTRADA
 * (`/assets/index-<hash>.js`): o Vite muda o hash a cada build. Então o alvo é
 * comparado com o entry do build local (`dist/index.html`, via `--from-dist`)
 * ou com um valor informado (`--expected-entry`). Isso responde exatamente a
 * pergunta que `docs/agentes/deploy.md:16` mostra ser crítica aqui: a produção
 * está congelada num deploy antigo porque os builds novos falham — e sem esta
 * checagem o merge "parece" ter subido.
 *
 * Quando `/version.json` passar a existir, ele é lido e reportado junto.
 */

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ENTRY = /^assets\/[A-Za-z0-9._-]+\.js$/u;
const SHA = /^[0-9a-f]{40}$/u;
const ARGUMENTOS = new Set(['target', 'expected-entry', 'from-dist', 'attempts', 'interval-ms', 'url', 'bypass-token']);
const REQUEST_TIMEOUT_MS = 15_000;

export const TARGETS = Object.freeze({
  prod: Object.freeze({
    label: 'Producao · alias Vercel',
    url: 'https://lalamove-v2.vercel.app',
  }),
});

/** Erro que significa "não deu para medir", não "está errado". */
export class ProtecaoVercelError extends Error {}

/** Host inalcançável: também é "não deu para medir". */
export class RedeIndisponivelError extends Error {}

/**
 * `fetch` falhando por rede (proxy, DNS, conexão recusada, timeout) chega como
 * TypeError genérico. Tratar isso como "o deploy está errado" seria inventar
 * conclusão — nesta sessão, por exemplo, o proxy de saída bloqueia
 * `lalamove-v2*.vercel.app` (docs/agentes/deploy.md:23).
 */
function ehFalhaDeRede(erro) {
  return erro instanceof TypeError
    || /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|timeout|aborted/iu.test(erro?.message ?? '');
}

function inteiro(name, value, { min, max }) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} deve ser inteiro entre ${min} e ${max}`);
  }
  return parsed;
}

function entrySeguro(valor, origem) {
  const limpo = String(valor).replace(/^\//, '');
  if (!ENTRY.test(limpo) || limpo.includes('..')) {
    throw new Error(`entry invalido em ${origem}: "${valor}"`);
  }
  return limpo;
}

/** Entry do build local: `<script src="/assets/index-xxxx.js">` de dist/index.html. */
export function entryDoDist(html, origem = 'dist/index.html') {
  const m = html.match(/\/assets\/[A-Za-z0-9._-]+\.js/u);
  if (!m) throw new Error(`nenhum /assets/*.js encontrado em ${origem}`);
  return entrySeguro(m[0], origem);
}

export function parseArgs(argv, { leitor = readFileSync, existe = existsSync } = {}) {
  const args = {};
  for (const item of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/u.exec(item);
    if (!match) throw new Error(`argumento invalido: ${item}`);
    if (!ARGUMENTOS.has(match[1])) throw new Error(`argumento desconhecido: --${match[1]}`);
    if (Object.hasOwn(args, match[1])) throw new Error(`argumento repetido: --${match[1]}`);
    args[match[1]] = match[2] ?? true;
  }

  const target = args.target ?? 'prod';
  if (!Object.hasOwn(TARGETS, target)) {
    throw new Error(`--target deve ser um de: ${Object.keys(TARGETS).join(', ')}`);
  }
  if (args['expected-entry'] && args['from-dist']) {
    throw new Error('use --expected-entry OU --from-dist, nao os dois');
  }

  let expectedEntry = null;
  if (args['expected-entry']) {
    expectedEntry = entrySeguro(args['expected-entry'], '--expected-entry');
  } else if (args['from-dist']) {
    const rel = args['from-dist'] === true ? 'dist/index.html' : String(args['from-dist']);
    const arquivo = path.resolve(RAIZ, rel);
    if (!arquivo.startsWith(RAIZ + path.sep)) throw new Error('--from-dist fora do repositorio');
    if (!existe(arquivo)) throw new Error(`--from-dist: ${rel} nao existe (rode o build antes)`);
    expectedEntry = entryDoDist(leitor(arquivo, 'utf8'), rel);
  }

  return {
    target,
    url: (args.url ? String(args.url) : TARGETS[target].url).replace(/\/$/, ''),
    expectedEntry,
    bypassToken: typeof args['bypass-token'] === 'string'
      ? args['bypass-token']
      : process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
    attempts: inteiro('--attempts', args.attempts ?? '1', { min: 1, max: 60 }),
    intervalMs: inteiro('--interval-ms', args['interval-ms'] ?? '0', { min: 0, max: 60_000 }),
  };
}

function ehProtecaoVercel(res, corpo = '') {
  if (![401, 403].includes(res.status)) return false;
  const cookies = (res.headers.get('set-cookie') || '').toLowerCase();
  return cookies.includes('_vercel_sso_nonce')
    || /vercel\.com\/sso|Authentication Required|_vercel_sso/iu.test(corpo)
    || !!res.headers.get('x-vercel-id');
}

async function resposta(fetchImpl, url, kind, timeoutMs, bypassToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'lalamove-release-targets/1',
        ...(bypassToken ? { 'x-vercel-protection-bypass': bypassToken } : {}),
      },
    });
    if (!res) throw new Error(`${kind} sem resposta`);
    if ([401, 403].includes(res.status)) {
      const corpo = await res.clone().text().catch(() => '');
      if (ehProtecaoVercel(res, corpo)) {
        throw new ProtecaoVercelError(
          `${kind} respondeu ${res.status} com a protecao de acesso do Vercel — use --bypass-token`,
        );
      }
    }
    if (res.status !== 200) throw new Error(`${kind} HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function umaTentativa({ url, expectedEntry, bypassToken, fetchImpl, nonce, requestTimeoutMs }) {
  const rootRes = await resposta(fetchImpl, `${url}/?verify=${nonce}`, 'SPA', requestTimeoutMs, bypassToken);
  const ct = rootRes.headers.get('content-type') || '';
  if (!/text\/html/iu.test(ct)) throw new Error(`SPA content-type inesperado: ${ct || '(ausente)'}`);
  const html = await rootRes.text();
  const servido = entryDoDist(html, 'resposta de /');

  if (expectedEntry && servido !== expectedEntry) {
    throw new Error(`no ar ainda esta ${servido}; esperado ${expectedEntry}`);
  }

  const assetRes = await resposta(fetchImpl, `${url}/${servido}`, `asset ${servido}`, requestTimeoutMs, bypassToken);
  const cache = assetRes.headers.get('cache-control') || '';

  let buildId = null;
  try {
    const vRes = await fetchImpl(`${url}/version.json?verify=${nonce}`, {
      cache: 'no-store',
      headers: bypassToken ? { 'x-vercel-protection-bypass': bypassToken } : {},
    });
    if (vRes?.status === 200) {
      const body = await vRes.json();
      if (SHA.test(body?.buildId ?? '')) buildId = body.buildId;
    }
  } catch { /* opcional: este repo nao publica version.json */ }

  return { url, entry: servido, cache, buildId };
}

export async function verificarAlvo({
  target = 'prod',
  url = TARGETS.prod.url,
  expectedEntry = null,
  bypassToken = '',
  attempts = 1,
  intervalMs = 0,
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
  nowImpl = () => Date.now(),
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  if (!Object.hasOwn(TARGETS, target)) return { ok: false, target, error: 'alvo invalido' };
  let error = 'falha desconhecida';
  let protegido = false;
  let inalcancavel = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const nonce = `${nowImpl()}-${attempt}`;
      const result = await umaTentativa({
        url, expectedEntry, bypassToken, fetchImpl, nonce, requestTimeoutMs,
      });
      return { ok: true, target, attempt, expectedEntry, ...result };
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'falha nao identificada';
      if (cause instanceof ProtecaoVercelError) { protegido = true; break; }
      // Rede pode ser transitoria: repete, mas guarda o motivo para o veredito.
      inalcancavel = cause instanceof RedeIndisponivelError || ehFalhaDeRede(cause);
      if (attempt < attempts) await sleepImpl(intervalMs);
    }
  }
  return { ok: false, target, url, attempts, expectedEntry, protegido, inalcancavel, error };
}

export function resumoMarkdown(result) {
  const config = TARGETS[result.target];
  const lines = [
    `### ${config?.label ?? result.target}`,
    '',
    `- URL: ${result.url ?? config?.url ?? 'desconhecida'}`,
  ];
  if (result.ok) {
    lines.push(`- Entry no ar: \`${result.entry}\``, `- Tentativa: ${result.attempt}`);
    if (result.expectedEntry) lines.push(`- Entry esperado: \`${result.expectedEntry}\` (confere)`);
    else lines.push('- Entry esperado: nao informado (so identificacao)');
    if (result.buildId) lines.push(`- buildId: \`${result.buildId}\``);
    lines.push(`- Cache do asset: \`${result.cache || '(ausente)'}\``, '- Resultado: OK');
  } else if (result.protegido) {
    lines.push(`- Resultado: NAO VERIFICADO — ${result.error}`);
  } else if (result.inalcancavel) {
    lines.push(`- Resultado: NAO VERIFICADO — host inalcancavel: ${result.error}`);
  } else {
    lines.push(`- Resultado: FALHOU — ${result.error}`);
  }
  return `${lines.join('\n')}\n`;
}

async function principal(argv = process.argv.slice(2), env = process.env) {
  let options;
  try { options = parseArgs(argv); } catch (error) {
    console.error(`release-targets: ${error.message}`);
    return 2;
  }
  const result = await verificarAlvo(options);
  const summary = resumoMarkdown(result);
  console.log(summary.trimEnd());
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (result.ok) return 0;
  if (result.protegido) return 3;
  return result.inalcancavel ? 4 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await principal();
}
