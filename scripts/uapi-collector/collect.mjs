#!/usr/bin/env node
/**
 * Coletor das respostas da UAPI do Lalamove (carteira, extrato, cupons, frota).
 *
 * Por que existe: desde 24/11/2026 o gateway `br-uapi.lalamove.com` exige
 * assinatura por requisicao (`x-sign-js` + `x-javascript-fingerprinting`,
 * geradas pelo runtime de `web.lalamove.com`) e responde
 * `ret: 10010 "Gateway signature error"` para qualquer cliente de servidor.
 * A mesma chamada feita de dentro de uma pagina do site responde `ret: 0`.
 * Este script abre um Chromium headless, faz as chamadas nesse contexto e grava
 * o resultado em `public.lalamove_uapi_snapshot`; a edge `lalamove-uapi` usa
 * esse snapshot quando a chamada direta falha.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/uapi-collector/collect.mjs
 *   node scripts/uapi-collector/collect.mjs --login   [janela unica de login]
 *
 * Renovacao do token: este script e o unico caminho de renovacao possivel. O
 * gateway responde `ret 10010 "Gateway signature error"` a qualquer chamada de
 * servidor (inclusive a edge `lalamove-token-refresh`), entao renovar depende de
 * rodar dentro de uma pagina de `web.lalamove.com`.
 *
 * Duas fontes de token sao tentadas a cada coleta, nesta ordem:
 *  1. token que o site usa no perfil persistente (`UAPI_PROFILE_DIR`);
 *  2. `_m=refresh_token` com o refresh_token gravado em
 *     `lalamove_uapi_sessions` (a resposta traz um par novo).
 * Quando qualquer uma devolve um token diferente do do banco, ele e gravado
 * junto do `refresh_token` e de `last_refreshed_at`, e a janela de 24 h recomeca
 * sem intervencao humana. `--login` abre a janela uma unica vez (SMS/captcha sao
 * humanos) e grava o par access/refresh token — e dai que sai o refresh_token
 * que permite a renovacao automatica das coletas seguintes.
 *
 * Variaveis:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (obrigatorias)
 *   UAPI_PROFILE_DIR        perfil Chromium persistente (default: ~/.local/share/lalamove-uapi-collector/profile)
 *   UAPI_CITY_ID            cidade das consultas (default: city_id da sessao ativa, senao 21007)
 *   UAPI_DEVICE_ID          device_id enviado na query (default: UUID novo)
 *   SNAPSHOT_TTL_HOURS      validade do snapshot (default 6)
 *   UAPI_STATEMENT_MAX_PAGES    teto de paginas do extrato na varredura profunda (default 700)
 *   UAPI_STATEMENT_RECENT_PAGES paginas recentes do extrato coletadas em todo ciclo (default 30)
 *   UAPI_STATEMENT_SWEEP_HOURS  intervalo minimo entre varreduras profundas (default 24)
 *   UAPI_STATEMENT_DEEP_TTL_HOURS validade das paginas antigas do extrato (default 168)
 *   UAPI_SWEEP_STATE        arquivo com o resultado da ultima varredura profunda
 *                           (default: ~/.local/share/lalamove-uapi-collector/last-sweep.json)
 *   UAPI_COUPON_MAX_PAGES       teto de paginas de cupons (default 5)
 *   CHROMIUM_PATH           executavel do Chromium (default: playwright resolve sozinho)
 *   PLAYWRIGHT_ROOT         diretorio que contem node_modules/playwright, se o script
 *                           rodar fora da raiz do projeto
 *
 * Saida: uma linha por recurso coletado; codigo de saida 1 se nenhum recurso
 * foi gravado (token morto, gateway mudou de novo ou rede fora). Quando nada e
 * gravado o script tambem abre um alerta CRITICAL em `public.alerts` (dedup de
 * 6 h): snapshot parado nao avisa ninguem sozinho.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TTL_HOURS = Number(process.env.SNAPSHOT_TTL_HOURS || 6);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || undefined;
const LOGIN_MODE = process.argv.includes('--login');
const LOGIN_WAIT_MS = Number(process.env.UAPI_LOGIN_WAIT_MS || 15 * 60_000);
const PROFILE_DIR =
  process.env.UAPI_PROFILE_DIR ||
  path.join(homedir(), '.local/share/lalamove-uapi-collector/profile');
const SWEEP_STATE_PATH =
  process.env.UAPI_SWEEP_STATE ||
  path.join(homedir(), '.local/share/lalamove-uapi-collector/last-sweep.json');
// Lista de pedidos: o painel avanca por cursor, entao cada pagina coletada vira
// uma chave propria. Recibos sao buscados para os pedidos mais recentes.
const ORDER_PAGES = Number(process.env.UAPI_ORDER_PAGES || 3);
const RECEIPTS = Number(process.env.UAPI_RECEIPTS || 10);
// Extrato e cupons paginam por `page_no`: cada pagina precisa da propria chave no
// snapshot, senao o painel recebe erro do gateway ao avancar alem da ultima
// coletada. O numero de paginas nao vem do gateway (`total` e sentinela), entao
// a paginacao e dinamica — ver `PAGED_SOURCES` — e estes sao apenas os tetos.
// Cada pagina custa ~0,4 s: as 580 paginas do extrato (de 10/09/2024 ate hoje)
// saem em ~4 min, por isso so a janela recente entra em todo ciclo e o historico
// antigo entra na varredura profunda (ver `deepSweepDue`).
const PAGE_SIZE = 20;
const MAX_STATEMENT_PAGES = Number(process.env.UAPI_STATEMENT_MAX_PAGES || 700);
const RECENT_STATEMENT_PAGES = Number(process.env.UAPI_STATEMENT_RECENT_PAGES || 30);
const STATEMENT_SWEEP_HOURS = Number(process.env.UAPI_STATEMENT_SWEEP_HOURS || 24);
// Lancamento antigo nao muda: as paginas profundas ficam validas por uma semana
// em vez das 6 h da janela recente. A edge `lalamove-uapi` descarta o snapshot
// vencido (`expires_at > now`), entao TTL curto aqui e o que fazia o painel
// voltar a dar erro ao avancar para o historico.
const STATEMENT_DEEP_TTL_HOURS = Number(process.env.UAPI_STATEMENT_DEEP_TTL_HOURS || 168);
const MAX_COUPON_PAGES = Number(process.env.UAPI_COUPON_MAX_PAGES || 5);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// Metodo UAPI -> recurso gravado na tabela. Os que dependem de argumento
// carregam o argumento no nome (`get_fleet` favoritos=1 / bloqueados=2), porque
// a chave primaria da tabela e o proprio nome do recurso.
const TARGETS = [
  { resource: 'wallet_balance', method: 'wallet_balance', args: (city) => ({ city_id: city }) },
  { resource: 'get_fleet:1', method: 'get_fleet', args: () => ({ fleet_type_code: 1, page_no: 1, page_size: 50 }) },
  { resource: 'get_fleet:2', method: 'get_fleet', args: () => ({ fleet_type_code: 2, page_no: 1, page_size: 50 }) },
  { resource: 'get_user_info', method: 'get_user_info', args: () => ({}) },
  { resource: 'get_corporate', method: 'get_corporate', args: () => ({}) },
  {
    resource: 'city_info',
    method: 'city_info',
    args: (city) => ({
      city_id: city,
      fetch_spec_req: 1,
      fetch_vehicle_std: 1,
      fetch_vehicle_price: 1,
      revision: 57901,
    }),
  },
  { resource: 'get_laster_order', method: 'get_laster_order', args: () => ({}) },
];

// Extrato e cupons: o numero de paginas e descoberto na coleta. O gateway
// devolve `total: 99999` (sentinela) tanto no extrato quanto nos cupons, entao a
// unica regra confiavel e parar quando a pagina vier incompleta — menos itens que
// o `page_size` pedido — ou quando a pagina falhar. Antes disso o coletor
// gravava sempre 3 paginas e o historico mais antigo ficava sem snapshot.
// `recentPages` divide a coleta em duas: ate esse numero entra em todo ciclo
// (movimento novo aparece em 30 min); acima dele e historico imutavel e so entra
// na varredura profunda.
const PAGED_SOURCES = [
  {
    resource: 'wallet_flow_list',
    method: 'wallet_flow_list',
    args: (city, pageNo) => ({ city_id: city, trans_type: 1, page_no: pageNo, page_size: PAGE_SIZE }),
    items: (payload) => payload?.data?.flow_item_arr,
    maxPages: MAX_STATEMENT_PAGES,
    recentPages: RECENT_STATEMENT_PAGES,
    capEnv: 'UAPI_STATEMENT_MAX_PAGES',
  },
  {
    resource: 'coupon_list_web',
    method: 'coupon_list_web',
    args: (city, pageNo) => ({ city_id: city, page_no: pageNo, page_size: PAGE_SIZE }),
    items: (payload) => payload?.data?.list,
    maxPages: MAX_COUPON_PAGES,
    capEnv: 'UAPI_COUPON_MAX_PAGES',
  },
];

/** Numero da pagina a partir da chave do snapshot (`recurso:pN`; pagina 1 e a chave sem sufixo). */
function pageNumber(resource) {
  return Number(/:p(\d+)$/.exec(resource)?.[1] ?? 1);
}

/**
 * Resultado da ultima varredura profunda. O snapshot sozinho nao diz ate onde a
 * varredura foi: se ela parou no teto de paginas ou numa falha, as paginas que
 * ficaram de fora so voltariam no intervalo da varredura seguinte.
 */
function readSweepState() {
  try {
    return JSON.parse(readFileSync(SWEEP_STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeSweepState(state) {
  try {
    writeFileSync(SWEEP_STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error(`aviso: nao gravou o estado da varredura (${String(err).slice(0, 120)})`);
  }
}

/**
 * A varredura profunda so roda quando o historico antigo do snapshot pode estar
 * fora do ar: paginas ausentes, vencidas, mais velhas que
 * `UAPI_STATEMENT_SWEEP_HOURS`, varredura anterior interrompida por falha ou
 * teto de paginas diferente do que a ultima varredura usou. Repassar centenas
 * de paginas a cada ciclo de 30 min nao muda nada — lancamento antigo nao muda —
 * e multiplica por 20 as chamadas ao gateway, que responde bloqueando o que
 * considera trafego suspeito.
 */
async function deepSweepDue(source, state) {
  if (!source.recentPages || source.recentPages >= source.maxPages) return true;
  // Teto diferente do da ultima varredura: pode existir historico que ela nao
  // tentou alcancar (teto aumentado depois dela).
  if (!state || state.cap !== source.maxPages) return true;
  // Varredura que parou numa falha deixou paginas de fora e nao volta sozinha.
  if (state.ended === 'failure') return true;
  try {
    const rows =
      (await sbFetch(
        `/rest/v1/lalamove_uapi_snapshot?select=resource,collected_at,expires_at&resource=like.${source.resource}:*&limit=2000`,
      )) ?? [];
    const deep = rows.filter((row) => pageNumber(row.resource) > source.recentPages);
    if (!deep.length) return true;
    const now = Date.now();
    // Pagina ja vencida tambem dispara: as primeiras varreduras depois de o TTL
    // profundo existir encontram o historico gravado com o TTL curto.
    if (deep.some((row) => Date.parse(row.expires_at) <= now)) return true;
    // Buraco dentro do trecho que a varredura disse ter coberto.
    const present = new Set(deep.map((row) => pageNumber(row.resource)));
    for (let pageNo = source.recentPages + 1; pageNo <= (state.deepestPage ?? 0); pageNo++) {
      if (!present.has(pageNo)) return true;
    }
    const oldest = Math.min(...deep.map((row) => Date.parse(row.collected_at)));
    return now - oldest > STATEMENT_SWEEP_HOURS * 3600_000;
  } catch (err) {
    // Sem a consulta nao da para saber se a varredura venceu; varrer e o lado
    // seguro: e disso que o painel depende para mostrar o historico.
    console.error(
      `aviso: varredura profunda forcada em ${source.resource} (${String(err).slice(0, 120)})`,
    );
    return true;
  }
}

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    // Rodando fora da raiz do projeto (ex.: worktree): usa o node_modules do repo.
    const root = process.env.PLAYWRIGHT_ROOT;
    if (!root) throw new Error('playwright nao encontrado; defina PLAYWRIGHT_ROOT');
    const mod = await import(pathToFileURL(path.join(root, 'node_modules/playwright/index.js')).href);
    return mod.chromium ?? mod.default?.chromium;
  }
}

async function sbFetch(pathname, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Lancamentos do extrato guardados pela propria identidade. O gateway pagina
// por posicao e a posicao muda quando a janela recente e refeita; com a chave do
// lancamento a edge monta a pagina sem repetir nem pular item.
function statementItemKey(item, city) {
  const dateTime = String(item?.date_time ?? '').trim();
  if (!dateTime) return null;
  return [
    Number(city) || '',
    dateTime,
    String(item?.amount ?? ''),
    String(item?.order_display_id ?? ''),
    String(item?.name ?? ''),
    String(item?.sub_name ?? ''),
    String(item?.user_fid ?? ''),
    String(item?.topup_tx_no ?? ''),
  ].join('|');
}

function occurredAtLocal(dateTime) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(dateTime ?? '').trim());
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}` : null;
}

async function saveStatementItems(items, city) {
  const lastSeenAt = new Date().toISOString();
  const rows = [];
  for (const item of items) {
    const itemKey = statementItemKey(item, city);
    const occurredAt = occurredAtLocal(item?.date_time);
    if (!itemKey || !occurredAt) continue;
    rows.push({
      item_key: itemKey,
      city_id: Number(city) || null,
      occurred_at_local: occurredAt,
      payload: item,
      last_seen_at: lastSeenAt,
    });
  }
  if (!rows.length) return;
  await sbFetch('/rest/v1/lalamove_uapi_statement_item?on_conflict=item_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

async function activeSession() {
  const rows = await sbFetch(
    '/rest/v1/lalamove_uapi_sessions?select=id,access_token,refresh_token,city_id,user_fid&is_active=eq.true&order=token_obtained_at.desc&limit=1',
  );
  return rows?.[0] ?? null;
}

async function saveSessionToken(session, token, refreshToken) {
  if (!session?.id) return;
  const now = new Date();
  const patch = {
    access_token: token,
    token_obtained_at: now.toISOString(),
    token_expires_at: new Date(now.getTime() + 24 * 3600_000).toISOString(),
    last_refreshed_at: now.toISOString(),
    refresh_method: 'browser_profile',
    is_active: true,
  };
  if (refreshToken) patch.refresh_token = refreshToken;
  await sbFetch(`/rest/v1/lalamove_uapi_sessions?id=eq.${session.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
}

/**
 * Coleta bem-sucedida = o token foi aceito pela UAPI. Sem refresh_token gravado
 * nao existe renovacao automatica, entao `last_refreshed_at` passa a registrar a
 * ultima verificacao real da sessao (e o watchdog mede a janela de 24 h a partir
 * dela). Com refresh_token, a coluna segue reservada ao refresh de token.
 */
async function touchSession(session) {
  if (!session?.id) return;
  await sbFetch(`/rest/v1/lalamove_uapi_sessions?id=eq.${session.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_refreshed_at: new Date().toISOString() }),
  });
}

function buildUrl(method, args, { token, deviceId, su }) {
  const params = new URLSearchParams({
    _m: method,
    _su: su,
    _t: String(Math.floor(Date.now() / 1000)),
    device_id: deviceId,
    version: '5.79.1',
    revision: '57901',
    device_type: 'web',
    os: 'web',
    args: JSON.stringify(args),
    token,
    hcountry: '20000',
    hlang: 'pt_br',
    is_ep: '1',
  });
  return `https://br-uapi.lalamove.com/index.php/?${params.toString()}`;
}

const UAPI_TOKEN_RE = /^[0-9a-f]{32}$/;

// O refresh_token so aparece em dois lugares: resposta do login/refresh e o
// `args` das chamadas que o site faz para a UAPI. Sem ele a renovacao automatica
// nao existe (o gateway bloqueia a chamada de fora do navegador).
function harvestRefreshTokens(node, out, depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) {
    for (const item of node) harvestRefreshTokens(item, out, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (/refresh_?token/i.test(key) && typeof value === 'string' && value.length >= 16) {
      out.add(value);
    } else {
      harvestRefreshTokens(value, out, depth + 1);
    }
  }
}

// Candidatos a token de sessao, na ordem em que o site os usa: URL das
// requisicoes da UAPI (fonte fiel), storage da pagina, cookies do perfil.
async function candidateTokens(page, context, capturedTokens) {
  const out = [...capturedTokens];

  try {
    const fromStorage = await page.evaluate(() => {
      const found = [];
      for (const store of [window.localStorage, window.sessionStorage]) {
        try {
          for (let i = 0; i < store.length; i++) {
            const value = store.getItem(store.key(i)) ?? '';
            found.push(...(value.match(/[0-9a-f]{32}/g) ?? []));
          }
        } catch {
          // storage bloqueado pela pagina
        }
      }
      return found;
    });
    out.push(...fromStorage);
  } catch {
    // pagina ainda navegando
  }

  try {
    for (const cookie of await context.cookies()) {
      out.push(...((cookie.name + cookie.value).match(/[0-9a-f]{32}/g) ?? []));
    }
  } catch {
    // contexto fechando
  }

  return [...new Set(out)].filter((token) => UAPI_TOKEN_RE.test(token));
}

async function tokenWorks(page, token, deviceId, su) {
  try {
    const raw = await page.evaluate(
      async (url) => (await fetch(url, { credentials: 'include' })).text(),
      buildUrl('get_user_info', {}, { token, deviceId, su }),
    );
    return JSON.parse(raw)?.ret === 0;
  } catch {
    return false;
  }
}

// Devolve o primeiro candidato que a UAPI aceita (ret 0).
async function resolveSiteToken(page, context, capturedTokens, { deviceId, su }) {
  const deadline = Date.now() + (LOGIN_MODE ? LOGIN_WAIT_MS : 20_000);
  let seen = 0;

  while (Date.now() < deadline) {
    const candidates = await candidateTokens(page, context, capturedTokens);
    seen = Math.max(seen, candidates.length);
    for (const token of candidates) {
      if (await tokenWorks(page, token, deviceId, su)) return token;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Sem token novo no perfil a coleta segue com o token do banco (normal no
  // modo automatico); o aviso so interessa quando o humano esta logando.
  if (seen && LOGIN_MODE) console.error(`nenhum dos ${seen} candidato(s) de token respondeu ret 0`);
  return null;
}

const ALERT_DEDUP_MS = 6 * 60 * 60 * 1000;

/**
 * Renova o token dentro da pagina (`_m=refresh_token`), a unica via que o WAF
 * aceita. Devolve `null` quando nao ha refresh_token gravado ou quando a UAPI
 * recusa (`10001` = refresh expirado -> so um novo `--login` resolve).
 */
async function renewSessionToken(page, session, { deviceId, su }) {
  const refreshToken = (session?.refresh_token ?? '').trim();
  if (refreshToken.length < 16) return null;

  try {
    const raw = await page.evaluate(
      async (url) => (await fetch(url, { credentials: 'include' })).text(),
      buildUrl('refresh_token', { refresh_token: refreshToken }, { token: session.access_token, deviceId, su }),
    );
    const parsed = JSON.parse(raw);
    if (parsed?.ret !== 0) {
      console.log(`renovacao por refresh_token recusada: ret ${parsed?.ret} ${parsed?.msg ?? ''}`.trim());
      return null;
    }
    const accessToken = parsed?.data?.token;
    if (!accessToken) return null;
    return {
      accessToken,
      refreshToken: parsed?.data?.raw?.refresh_token || refreshToken,
    };
  } catch (err) {
    console.error(`aviso: renovacao por refresh_token falhou (${String(err).slice(0, 200)})`);
    return null;
  }
}

/**
 * Coleta que nao grava nada e silenciosa: o snapshot simplesmente para de
 * atualizar ate vencer. O worker `lalamove-token-refresh` avisa quando ele
 * envelhece; este alerta chega antes e com o erro cru do gateway.
 */
async function notifyCollectorFailure(tokenOrigin, failures) {
  const title = 'Coleta UAPI falhou';
  try {
    const since = new Date(Date.now() - ALERT_DEDUP_MS).toISOString();
    const open = await sbFetch(
      `/rest/v1/alerts?select=id&type=eq.INTEGRATION_FAILURE&title=eq.${encodeURIComponent(title)}` +
        `&is_dismissed=eq.false&created_at=gte.${since}&limit=1`,
    );
    if (open && open.length) {
      console.log('alerta de falha da coleta ja aberto nas ultimas 6h: sem novo alerta');
      return;
    }
    await sbFetch('/rest/v1/alerts', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        type: 'INTEGRATION_FAILURE',
        severity: 'CRITICAL',
        title,
        message:
          'O coletor rodou e nao gravou nenhum recurso: carteira, extrato, cupons e frota ' +
          `param de atualizar e passam a dar erro quando o snapshot vencer. Token usado: ${tokenOrigin}. ` +
          `Falhas: ${failures.slice(0, 5).join(' | ') || 'nenhuma falha reportada'}`,
        metadata: { subtype: 'UAPI_COLLECTOR', token_origin: tokenOrigin, failures: failures.slice(0, 10) },
      }),
    });
    console.log('alerta de falha da coleta registrado');
  } catch (err) {
    console.error(`aviso: nao foi possivel registrar o alerta (${String(err).slice(0, 200)})`);
  }
}

async function main() {
  const session = await activeSession();
  if (!session?.access_token) {
    console.error('ERRO: nenhuma sessao UAPI ativa em lalamove_uapi_sessions');
    process.exit(3);
  }

  const city = Number(process.env.UAPI_CITY_ID || session.city_id || 21007);
  const deviceId = process.env.UAPI_DEVICE_ID || randomUUID();
  const su = `${Date.now()}ehll${Math.floor(Math.random() * 1e10)}`;

  console.log(`sessao UAPI: user_fid=${session.user_fid ?? '?'} cidade=${city}`);

  const chromium = await loadChromium();
  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: !LOGIN_MODE,
      executablePath: CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
  } catch (err) {
    // O perfil e unico: enquanto a janela de `--login` estiver aberta o Chromium
    // recusa a segunda instancia. Nao e falha de coleta — o snapshot ainda vale.
    if (/ProcessSingleton|already in use/.test(String(err))) {
      console.log('perfil do coletor em uso (login manual em andamento): coleta adiada');
      process.exit(0);
    }
    throw err;
  }

  // O proprio site chama a UAPI o tempo todo; essas requisicoes carregam o token
  // vivo da sessao e sao observadas aqui. O `args` das chamadas tambem carrega o
  // refresh_token, e a resposta de login/refresh e a outra fonte.
  const capturedTokens = new Set();
  const capturedRefreshTokens = new Set();
  context.on('request', (req) => {
    const url = req.url();
    const match = /[?&]token=([^&]+)/.exec(url);
    if (match) capturedTokens.add(decodeURIComponent(match[1]));
    const args = /[?&]args=([^&]+)/.exec(url);
    if (args) {
      try {
        harvestRefreshTokens(JSON.parse(decodeURIComponent(args[1])), capturedRefreshTokens);
      } catch {
        // args nao-JSON (alguns endpoints usam querystring simples)
      }
    }
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('response', (res) => {
    if (!res.url().includes('br-uapi.lalamove.com')) return;
    if (!/_m=(login|refresh_token|verify)/.test(res.url())) return;
    res
      .json()
      .then((body) => harvestRefreshTokens(body, capturedRefreshTokens))
      .catch(() => {});
  });

  const collected = [];
  const failed = [];
  let tokenOrigin = 'banco';

  try {
    // A pagina e o que injeta `x-sign-js`/`x-javascript-fingerprinting` no fetch.
    await page
      .goto(LOGIN_MODE ? 'https://web.lalamove.com/' : 'https://web.lalamove.com/login', {
        waitUntil: 'networkidle',
        timeout: 90000,
      })
      .catch(() => {});

    const siteToken = await resolveSiteToken(page, context, capturedTokens, { deviceId, su });

    if (LOGIN_MODE) {
      if (!siteToken) {
        console.error('ERRO: login nao detectado — nenhum token valido apareceu na sessao');
        await context.close().catch(() => {});
        process.exit(4);
      }
      await saveSessionToken(session, siteToken, [...capturedRefreshTokens].pop());
      await context.close().catch(() => {});
      console.log(`LOGIN OK: token da sessao gravado (${siteToken.slice(0, 8)}...)`);
      if (capturedRefreshTokens.size) {
        console.log('refresh_token gravado: renovacao automatica habilitada');
      } else {
        console.error(
          'aviso: refresh_token nao apareceu no login — a proxima expiracao do token vai exigir novo --login',
        );
      }
      process.exit(0);
    }

    let activeToken = session.access_token;
    if (siteToken && siteToken !== session.access_token) {
      await saveSessionToken(session, siteToken, [...capturedRefreshTokens].pop());
      activeToken = siteToken;
      tokenOrigin = 'site';
    } else {
      // Sem token novo no perfil: tenta renovar com o refresh_token do banco.
      const renewed = await renewSessionToken(page, session, { deviceId, su });
      if (renewed && renewed.accessToken !== session.access_token) {
        await saveSessionToken(session, renewed.accessToken, renewed.refreshToken);
        activeToken = renewed.accessToken;
        tokenOrigin = 'refresh_token';
        console.log('token renovado por refresh_token: validade de 24 h reiniciada');
      }
    }

    const collectResource = async (resource, method, args, token, ttlHours = TTL_HOURS) => {
      const url = buildUrl(method, args, { token, deviceId, su });
      let payload;
      try {
        const raw = await page.evaluate(
          async (u) => {
            const res = await fetch(u, { credentials: 'include' });
            return await res.text();
          },
          url,
        );
        payload = JSON.parse(raw);
      } catch (err) {
        failed.push(`${resource}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }

      if (payload?.ret !== 0) {
        failed.push(`${resource}: ret ${payload?.ret} ${payload?.msg ?? ''}`.trim());
        return null;
      }

      const now = new Date();
      await sbFetch('/rest/v1/lalamove_uapi_snapshot', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([
          {
            resource,
            payload,
            city_id: city,
            collected_at: now.toISOString(),
            expires_at: new Date(now.getTime() + ttlHours * 3600_000).toISOString(),
            updated_at: now.toISOString(),
            collected_by: 'browser-collector',
          },
        ]),
      });
      collected.push(resource);
      return payload;
    };

    for (const target of TARGETS) {
      await collectResource(target.resource, target.method, target.args(city), activeToken);
    }

    // Paginacao dinamica do extrato e dos cupons (ver PAGED_SOURCES).
    for (const source of PAGED_SOURCES) {
      // Historico antigo so entra na varredura profunda; o teto efetivo deste
      // ciclo e a janela recente quando a varredura nao venceu.
      const sweepState = readSweepState();
      const deepSweep = await deepSweepDue(source, sweepState);
      const cap = deepSweep ? source.maxPages : source.recentPages;
      let lastPage = 0;
      let oldest = '';
      // 'end' = o gateway terminou o historico; 'failure' = parou num erro;
      // 'cap' = parou no teto de paginas (pode existir historico mais antigo).
      let ended = 'cap';
      for (let pageNo = 1; pageNo <= cap; pageNo++) {
        const key = pageNo > 1 ? `${source.resource}:p${pageNo}` : source.resource;
        const payload = await collectResource(
          key,
          source.method,
          source.args(city, pageNo),
          activeToken,
          pageNo > source.recentPages ? STATEMENT_DEEP_TTL_HOURS : TTL_HOURS,
        );
        // Falha encerra a paginacao deste recurso: insistir nas paginas seguintes
        // so repete o mesmo erro e polui a lista de falhas.
        if (!payload) {
          ended = 'failure';
          break;
        }
        const items = source.items(payload);
        // Lista vazia e lista curta significam o mesmo aqui: fim do historico.
        if (!Array.isArray(items) || !items.length) {
          ended = 'end';
          break;
        }
        lastPage = pageNo;
        if (source.resource === 'wallet_flow_list') {
          // Guardar o lancamento nao pode derrubar a coleta do snapshot.
          await saveStatementItems(items, city).catch((error) =>
            console.error(`aviso: lancamentos do extrato nao salvos (pagina ${pageNo}): ${error.message}`),
          );
        }
        oldest = items[items.length - 1]?.date_time ?? oldest;
        if (items.length < PAGE_SIZE) {
          ended = 'end';
          break;
        }
        // O gateway nao informa o fim do historico: se a ultima pagina coletada
        // veio cheia, ainda existe historico mais antigo sem snapshot.
        if (pageNo === source.maxPages) {
          console.log(
            `aviso: ${source.resource} atingiu o teto de ${source.maxPages} paginas; ` +
              `historico mais antigo continua sem snapshot (ajuste ${source.capEnv})`,
          );
        }
      }
      if (!source.recentPages) {
        if (lastPage) {
          console.log(`${source.resource}: ${lastPage} pagina(s) ate ${oldest || 'sem data'}`);
        }
      } else if (deepSweep) {
        writeSweepState({
          cap: source.maxPages,
          deepestPage: lastPage,
          oldestDate: oldest || null,
          ended,
          sweptAt: new Date().toISOString(),
        });
        console.log(
          `${source.resource}: varredura profunda coletou ${lastPage} pagina(s) ` +
            `ate ${oldest || 'sem data'} (${ended})`,
        );
      } else {
        // O log do ciclo diz o que foi coletado agora; a cobertura do historico
        // e outra coisa e vem do estado da ultima varredura.
        console.log(
          `${source.resource}: ciclo coletou ${lastPage} pagina(s) ate ${oldest || 'sem data'}`,
        );
        if (sweepState?.deepestPage) {
          console.log(
            `${source.resource}: cobertura de ${sweepState.deepestPage} pagina(s) ate ` +
              `${sweepState.oldestDate ?? 'sem data'} (varredura de ${sweepState.sweptAt})`,
          );
        }
      }
    }

    // Pedidos: primeira pagina, paginas seguintes pelo cursor devolvido, e os
    // recibos dos pedidos mais recentes (a acao `download-receipt` usa o uuid).
    const orders = await collectResource(
      'order_list_new',
      'order_list_new',
      { limit: 20, last_id: '' },
      activeToken,
    );

    if (orders) {
      let cursor = orders?.data?.last_id;
      for (let page = 2; page <= ORDER_PAGES && cursor; page++) {
        const next = await collectResource(
          `order_list_new:${cursor}`,
          'order_list_new',
          { limit: 20, last_id: cursor },
          activeToken,
        );
        if (!next || String(next?.data?.is_end) === '1') break;
        cursor = next?.data?.last_id;
      }

      const uuids = (orders?.data?.order_base_info ?? [])
        .slice(0, RECEIPTS)
        .map((order) => order?.order_uuid)
        .filter(Boolean);
      for (const orderUuid of uuids) {
        await collectResource(
          `download_pdf_receipt:${orderUuid}`,
          'download_pdf_receipt',
          { order_uuid: orderUuid, type: 'order' },
          activeToken,
        );
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  // Sessao sem refresh_token so pode ser mantida pelo login manual: a cada
  // coleta confirmada, registra que o token continua vivo.
  if (collected.length && !(session.refresh_token ?? '').trim()) {
    await touchSession(session).catch((err) => {
      console.error(`aviso: heartbeat da sessao nao gravado (${String(err).slice(0, 120)})`);
    });
  }

  console.log(`gravados (${collected.length}): ${collected.join(', ') || '-'}`);
  console.log(`token: ${tokenOrigin}`);
  if (failed.length) console.log(`falhas (${failed.length}): ${failed.join(' | ')}`);
  if (!collected.length) await notifyCollectorFailure(tokenOrigin, failed);
  process.exit(collected.length ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});