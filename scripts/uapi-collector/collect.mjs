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
 *
 * Variaveis:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (obrigatorias)
 *   UAPI_CITY_ID            cidade das consultas (default: city_id da sessao ativa, senao 21007)
 *   UAPI_DEVICE_ID          device_id enviado na query (default: UUID novo)
 *   SNAPSHOT_TTL_HOURS      validade do snapshot (default 6)
 *   CHROMIUM_PATH           executavel do Chromium (default: playwright resolve sozinho)
 *   PLAYWRIGHT_ROOT         diretorio que contem node_modules/playwright, se o script
 *                           rodar fora da raiz do projeto
 *
 * Saida: uma linha por recurso coletado; codigo de saida 1 se nenhum recurso
 * foi gravado (token morto, gateway mudou de novo ou rede fora).
 */

import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TTL_HOURS = Number(process.env.SNAPSHOT_TTL_HOURS || 6);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || undefined;
// Lista de pedidos: o painel avanca por cursor, entao cada pagina coletada vira
// uma chave propria. Recibos sao buscados para os pedidos mais recentes.
const ORDER_PAGES = Number(process.env.UAPI_ORDER_PAGES || 3);
const RECEIPTS = Number(process.env.UAPI_RECEIPTS || 5);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERRO: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

// Metodo UAPI -> recurso gravado na tabela. Os que dependem de argumento
// carregam o argumento no nome (`get_fleet` favoritos=1 / bloqueados=2), porque
// a chave primaria da tabela e o proprio nome do recurso.
const TARGETS = [
  { resource: 'wallet_balance', method: 'wallet_balance', args: (city) => ({ city_id: city }) },
  { resource: 'wallet_flow_list', method: 'wallet_flow_list', args: (city) => ({ city_id: city, trans_type: 1, page_no: 1, page_size: 20 }) },
  { resource: 'wallet_flow_list:p2', method: 'wallet_flow_list', args: (city) => ({ city_id: city, trans_type: 1, page_no: 2, page_size: 20 }) },
  { resource: 'coupon_list_web', method: 'coupon_list_web', args: (city) => ({ city_id: city, page_no: 1, page_size: 20 }) },
  { resource: 'coupon_list_web:p2', method: 'coupon_list_web', args: (city) => ({ city_id: city, page_no: 2, page_size: 20 }) },
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

async function activeSession() {
  const rows = await sbFetch(
    '/rest/v1/lalamove_uapi_sessions?select=access_token,city_id,user_fid&is_active=eq.true&order=token_obtained_at.desc&limit=1',
  );
  return rows?.[0] ?? null;
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
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const collected = [];
  const failed = [];

  try {
    const context = await browser.newContext({
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    // A pagina e o que injeta `x-sign-js`/`x-javascript-fingerprinting` no fetch.
    await page
      .goto('https://web.lalamove.com/login', { waitUntil: 'networkidle', timeout: 90000 })
      .catch(() => {});

    const collectResource = async (resource, method, args, token) => {
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
            expires_at: new Date(now.getTime() + TTL_HOURS * 3600_000).toISOString(),
            updated_at: now.toISOString(),
            collected_by: 'browser-collector',
          },
        ]),
      });
      collected.push(resource);
      return payload;
    };

    for (const target of TARGETS) {
      await collectResource(target.resource, target.method, target.args(city), session.access_token);
    }

    // Pedidos: primeira pagina, paginas seguintes pelo cursor devolvido, e os
    // recibos dos pedidos mais recentes (a acao `download-receipt` usa o uuid).
    const orders = await collectResource(
      'order_list_new',
      'order_list_new',
      { limit: 20, last_id: '' },
      session.access_token,
    );

    if (orders) {
      let cursor = orders?.data?.last_id;
      for (let page = 2; page <= ORDER_PAGES && cursor; page++) {
        const next = await collectResource(
          `order_list_new:${cursor}`,
          'order_list_new',
          { limit: 20, last_id: cursor },
          session.access_token,
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
          session.access_token,
        );
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log(`gravados (${collected.length}): ${collected.join(', ') || '-'}`);
  if (failed.length) console.log(`falhas (${failed.length}): ${failed.join(' | ')}`);
  process.exit(collected.length ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});