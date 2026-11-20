#!/usr/bin/env node
/**
 * Smoke de pós-deploy da produção (Vercel, projeto `lalamove-v2`).
 *
 * Uso:
 *   node scripts/vercel/verify-production.mjs
 *   node scripts/vercel/verify-production.mjs --url=https://lalamove-v2.vercel.app
 *   node scripts/vercel/verify-production.mjs --bypass-token=<segredo>   # ou env
 *   node scripts/vercel/verify-production.mjs --strict-headers
 *
 * Códigos de saída: 0 = tudo que é obrigatório passou · 1 = falha real ·
 * 2 = entrada inválida · 3 = NÃO VERIFICADO (proteção do Vercel barrou) ·
 * 4 = NÃO VERIFICADO (rede inacessível). Nunca sai 0 sem ter medido.
 *
 * PORTADO do Zapp Web V2 (`scripts/vercel/verify-production.mjs`) e ADAPTADO,
 * porque o Zapp e o Lalamove publicam coisas diferentes:
 *
 *  - `/version.json` com `buildId` = SHA: o Zapp publica, este repo NÃO
 *    (não há `vercel.json`, nem `public/version.json`, nem `buildId` em lugar
 *    nenhum). Portar como obrigatório faria o smoke reprovar sempre por um
 *    arquivo que ninguém se propôs a publicar. Aqui ele é OPCIONAL: se existir,
 *    é validado; se não, aparece como informativo.
 *  - Headers de segurança (`x-frame-options: DENY`, `x-robots-tag`, ...): o Zapp
 *    os declara no `vercel.json`. Este repo não tem `vercel.json`, então nenhum
 *    é esperado hoje. São REPORTADOS por padrão e só reprovam com
 *    `--strict-headers` (use depois de configurá-los).
 *  - Entraram duas checagens que o Zapp não tinha e que importam aqui:
 *      · deep link (`/orders`) tem de devolver o SPA; sem `vercel.json` o
 *        fallback vem do preset `vite` do Vercel, e se ele falhar todo link
 *        direto cai em 404;
 *      · detecção da proteção de acesso do Vercel. `docs/agentes/deploy.md:14`
 *        registra `ssoProtection = all_except_custom_domains`: sem token de
 *        bypass, `*.vercel.app` responde a tela de login do Vercel. Sem essa
 *        detecção o smoke culparia o app por um 401 que é de infraestrutura.
 *
 * O token de bypass NUNCA é impresso — só a informação de que foi usado.
 */

const DEFAULT_URL = 'https://lalamove-v2.vercel.app';
const SHA = /^[0-9a-f]{40}$/u;
const ROTA_PROFUNDA = '/orders';
const TIMEOUT_MS = 15_000;

const HEADERS_RECOMENDADOS = [
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
];

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }),
);

const BASE_URL = String(args.url || process.env.SMOKE_BASE_URL || DEFAULT_URL).replace(/\/$/, '');
const BYPASS = typeof args['bypass-token'] === 'string'
  ? args['bypass-token']
  : process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
const STRICT_HEADERS = args['strict-headers'] === true;

if (!/^https?:\/\//.test(BASE_URL)) {
  console.error(`entrada invalida: --url precisa comecar com http(s):// (recebido "${BASE_URL}")`);
  process.exit(2);
}

let failures = 0;
let avisos = 0;

const ok = (label) => console.log(`  OK    ${label}`);
const aviso = (label) => { console.log(`  AVISO ${label}`); avisos++; };
const fail = (label, detail = '') => {
  console.error(`  FALHA ${label}${detail ? `: ${detail}` : ''}`);
  failures++;
};

/** Sai com motivo de NÃO VERIFICADO em vez de fingir resultado. */
function naoVerificado(codigo, titulo, linhas) {
  console.error(`\nNAO VERIFICADO — ${titulo}`);
  for (const l of linhas) console.error(`  ${l}`);
  process.exit(codigo);
}

async function buscar(caminho) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${caminho}`, {
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'cache-control': 'no-cache',
        'user-agent': 'lalamove-smoke/1',
        ...(BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** A resposta é a barreira de acesso do Vercel, não o app? */
function ehProtecaoVercel(res, corpo = '') {
  if (![401, 403].includes(res.status)) return false;
  const cookies = (res.headers.get('set-cookie') || '').toLowerCase();
  return cookies.includes('_vercel_sso_nonce')
    || /vercel\.com\/sso|Authentication Required|_vercel_sso/i.test(corpo)
    || !!res.headers.get('x-vercel-id');
}

function conferirHeaders(headers, caminho) {
  for (const [key, esperado] of HEADERS_RECOMENDADOS) {
    const valor = headers.get(key);
    const problema = !valor
      ? `header ausente: ${key}`
      : (!valor.toLowerCase().includes(esperado.toLowerCase())
        ? `${key}: esperado "${esperado}", obtido "${valor}"`
        : null);
    if (!problema) { ok(`${caminho} ${key}: ${valor}`); continue; }
    // Sem vercel.json neste repo, nenhum header desses está configurado:
    // reprovar por padrão tornaria o smoke inútil. Vira falha com --strict-headers.
    if (STRICT_HEADERS) fail(`${caminho} — ${problema}`);
    else aviso(`${caminho} — ${problema} (nao ha vercel.json neste repo)`);
  }
}

async function checarRaiz() {
  console.log('\n[1] / (SPA root)');
  let res;
  try {
    res = await buscar('/');
  } catch (e) {
    naoVerificado(4, 'nao foi possivel alcancar a producao', [
      `GET ${BASE_URL}/ falhou: ${e.message}`,
      'sem rede ate o host (proxy de saida, DNS ou deploy fora do ar) nao ha o que medir.',
    ]);
  }
  const corpo = await res.text();
  if (ehProtecaoVercel(res, corpo)) {
    naoVerificado(3, 'a protecao de acesso do Vercel barrou o smoke', [
      `GET ${BASE_URL}/ respondeu ${res.status} com a tela de login do Vercel.`,
      'docs/agentes/deploy.md:14 registra ssoProtection = all_except_custom_domains.',
      'rode com --bypass-token=<segredo> (ou env VERCEL_AUTOMATION_BYPASS_SECRET),',
      'gerado em Vercel > Project > Settings > Deployment Protection > Protection Bypass.',
    ]);
  }
  if (res.status !== 200) { fail('/ status', String(res.status)); return null; }
  if (!/text\/html/i.test(res.headers.get('content-type') || '')) {
    fail('/ content-type', res.headers.get('content-type') || '(ausente)');
    return null;
  }
  ok(`/ -> 200 (${corpo.length} bytes de HTML)`);
  conferirHeaders(res.headers, '/');

  const entry = corpo.match(/\/assets\/[^"' >]+\.js/u);
  if (!entry) {
    fail('/ SPA sem bundle JavaScript em /assets/');
    return null;
  }
  ok(`/ entry: ${entry[0]}`);
  return entry[0];
}

async function checarAsset(assetPath) {
  console.log('\n[2] /assets/* (bundle e cache)');
  if (!assetPath) { fail('sem entry para conferir (a raiz falhou)'); return; }
  let res;
  try {
    res = await buscar(assetPath);
  } catch (e) {
    fail(`${assetPath} fetch`, e.message);
    return;
  }
  if (res.status !== 200) { fail(`${assetPath} status`, String(res.status)); return; }
  ok(`${assetPath} -> 200`);
  const cc = res.headers.get('cache-control') || '';
  if (cc.toLowerCase().includes('immutable')) ok(`${assetPath} Cache-Control: ${cc}`);
  // Asset de nome com hash deveria ser imutável; sem vercel.json quem decide é
  // o preset do Vercel, então isto é aviso, não falha.
  else aviso(`${assetPath} Cache-Control sem "immutable": "${cc || '(ausente)'}"`);
}

async function checarDeepLink() {
  console.log(`\n[3] ${ROTA_PROFUNDA} (fallback de SPA)`);
  let res;
  try {
    res = await buscar(ROTA_PROFUNDA);
  } catch (e) {
    fail(`${ROTA_PROFUNDA} fetch`, e.message);
    return;
  }
  if (res.status !== 200) {
    fail(
      `${ROTA_PROFUNDA} status ${res.status}`,
      'link direto nao devolve o SPA — o rewrite de fallback nao esta valendo',
    );
    return;
  }
  const corpo = await res.text();
  if (!/<div id="root"|\/assets\/[^"' >]+\.js/u.test(corpo)) {
    fail(`${ROTA_PROFUNDA} devolveu 200 mas nao parece o SPA`);
    return;
  }
  ok(`${ROTA_PROFUNDA} -> 200 com o SPA`);
}

async function checarVersionJson() {
  console.log('\n[4] /version.json (opcional neste repo)');
  let res;
  try {
    res = await buscar('/version.json');
  } catch (e) {
    aviso(`/version.json fetch: ${e.message}`);
    return;
  }
  if (res.status === 404) {
    console.log('  INFO  /version.json nao publicado (este repo nao gera o arquivo) — sem identidade de release no runtime');
    return;
  }
  if (res.status !== 200) { aviso(`/version.json status ${res.status}`); return; }
  let body;
  try { body = await res.json(); } catch { fail('/version.json nao e JSON valido'); return; }
  if (!SHA.test(body?.buildId ?? '')) fail('/version.json buildId ausente ou invalido (esperado SHA completo)');
  else ok(`/version.json buildId="${body.buildId}"`);
}

console.log(`\nSmoke de pos-deploy — ${BASE_URL}`);
console.log(`bypass de protecao: ${BYPASS ? 'sim (valor nao impresso)' : 'nao'}`);
console.log('-'.repeat(60));

const entry = await checarRaiz();
await checarAsset(entry);
await checarDeepLink();
await checarVersionJson();

console.log('\n' + '-'.repeat(60));
if (failures === 0) {
  console.log(`OK — smoke passou${avisos ? ` com ${avisos} aviso(s)` : ''}.`);
  process.exit(0);
} else {
  console.error(`FALHOU — ${failures} check(s) com erro, ${avisos} aviso(s).`);
  process.exit(1);
}
