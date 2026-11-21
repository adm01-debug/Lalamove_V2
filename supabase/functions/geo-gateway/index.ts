// Edge Function: geo-gateway
// Camada única de acesso a provedores de mapa (Mapbox hoje; Google quando GOOGLE_MAPS_SERVER_KEY existir).
// Lê geo_settings (provedor por função), respeita geo_budget, cacheia (geo_cache), mede (geo_usage) e
// aplica rate guard local. O front e as outras edges chamam só esta função — nunca o provedor direto.
// Plano: claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md (Bloco 2) · verify_jwt=true (config.toml)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";
import {
  ERROR_CODES, buildErrorBody, errorResponse, jsonResponse, parseJsonBody, resolveContractVersion, validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { MAPBOX_RATE_LIMITS, MapboxProvider } from "./providers/mapbox.ts";
import { GeoProviderError } from "./providers/types.ts";
import type { GeoFunction, GeoProvider, ProviderName, ProviderResult } from "./providers/types.ts";
import { callWithFailover } from "./failover.ts";
import { mergeSettings, ProviderResolver, ResolveError } from "./resolver.ts";
import type { BudgetRow, GeoSettingRow, QuotaRow } from "./resolver.ts";
import { CACHE_TTL_S, cacheGet, cacheKey, cachePut, meter, registerSession } from "./metering.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_SERVER_TOKEN") ?? Deno.env.get("MAPBOX_ACCESS_TOKEN") ?? "";
const GOOGLE_KEY = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const ACTION_FUNCTION: Record<string, GeoFunction> = {
  "autocomplete": "autocomplete", "place-details": "autocomplete", "geocode": "geocode", "reverse": "reverse",
  "route": "route", "matrix": "matrix", "static": "static", "snap": "snap",
  "isochrone": "isochrone", "optimization": "optimization", "tilequery": "tilequery", "count-map-load": "tiles",
};

// Rate limit por usuário (uid do JWT): autocomplete 60/min, demais 20/min — em memória por instância.
const USER_LIMITS: Partial<Record<GeoFunction, number>> = { autocomplete: 60, tiles: 120 };
const userBuckets = new Map<string, { minute: number; count: number }>();
function userAllowed(uid: string, fn: GeoFunction): boolean {
  const limit = USER_LIMITS[fn] ?? 20;
  const minute = Math.floor(Date.now() / 60_000);
  const key = `${uid}:${fn}`;
  const b = userBuckets.get(key);
  if (!b || b.minute !== minute) { userBuckets.set(key, { minute, count: 1 }); return true; }
  if (b.count >= limit) return false;
  b.count++; return true;
}

function uidFromJwt(req: Request): string {
  // verify_jwt=true já validou a assinatura; aqui só lemos o sub para o bucket por usuário
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.sub ?? payload.role ?? "anon");
  } catch { return "anon"; }
}

// Defaults da decisão D6 — usados só se geo_settings ainda não existir (migration #118 não aplicada).
export const DEFAULT_SETTINGS: GeoSettingRow[] = (["autocomplete", "geocode", "reverse", "route", "matrix", "static", "snap", "isochrone", "optimization", "tilequery"] as GeoFunction[])
  .map((fn) => ({ function: fn, provider: "mapbox", fallback_provider: "google", config: {} }));

const resolver: ProviderResolver = new ProviderResolver({
  loadSettings: async () => {
    const { data, error } = await db.from("geo_settings").select("function, provider, fallback_provider, config");
    if (error) { logger.error("[geo-gateway] geo_settings indisponível, usando defaults", error.message); return DEFAULT_SETTINGS; }
    return mergeSettings((data ?? []) as GeoSettingRow[], DEFAULT_SETTINGS);
  },
  loadBudget: async () => {
    const { data, error } = await db.rpc("geo_budget_status");
    if (error) { logger.error("[geo-gateway] geo_budget_status indisponível", error.message); return []; }
    return (data ?? []).map((r: Record<string, unknown>) => ({
      provider: r.provider, spent_usd: Number(r.spent_usd), limit_usd: Number(r.limit_usd),
      pct: Number(r.pct), blocked: !!r.blocked, warn: !!r.warn,
    })) as BudgetRow[];
  },
  loadQuota: async () => {
    const [{ data: prices }, { data: usage }] = await Promise.all([
      db.from("geo_price_list").select("provider, sku, free_quota_month"),
      db.from("geo_usage_month").select("provider, sku, count"),
    ]);
    return ((prices ?? []) as Array<{ provider: ProviderName; sku: string; free_quota_month: number }>).map((p) => ({
      provider: p.provider, sku: p.sku, free_quota_month: p.free_quota_month,
      used: ((usage ?? []) as Array<{ provider: string; sku: string; count: number }>)
        .filter((u) => u.provider === p.provider && u.sku === p.sku).reduce((a, u) => a + Number(u.count), 0),
    })) as QuotaRow[];
  },
  isConfigured: (p) => p === "mapbox" ? !!MAPBOX_TOKEN : !!GOOGLE_KEY,
  supports: (p, fn): boolean => p === "mapbox" ? mapbox.supports.has(fn as never) : false, // Google: Bloco 2 do plano Google
});

const mapbox: MapboxProvider = new MapboxProvider({
  token: MAPBOX_TOKEN,
  rateGuard: (api: string): boolean => resolver.rateGuard("mapbox", api, MAPBOX_RATE_LIMITS[api] ?? 300),
});

function getProvider(name: ProviderName): GeoProvider {
  if (name === "mapbox") return mapbox;
  throw new GeoProviderError("GEO_NOT_CONFIGURED", "Provedor Google ainda não implementado no gateway", 503);
}

/** Despacha a ação para o provedor; usado tanto na tentativa primária quanto no failover. */
async function runProvider(
  provider: GeoProvider,
  name: ProviderName,
  action: string,
  // deno-lint-ignore no-explicit-any
  body: any,
): Promise<ProviderResult<unknown>> {
  switch (action) {
    case "autocomplete": {
      const r = await provider.autocomplete(body);
      if (body.session_token && await registerSession(db, name, body.session_token)) r.units = 1; // 1 por sessão
      return r;
    }
    case "place-details": return await provider.placeDetails(body);
    case "geocode": return await provider.geocode(body);
    case "reverse": return await provider.reverse(body);
    case "route": return await provider.route(body);
    case "matrix": return await provider.matrix(body);
    case "static": return await provider.staticMap(body);
    case "snap":
      if (!provider.snap) throw new GeoProviderError("GEO_NOT_SUPPORTED", `snap não disponível em ${name}`, 501);
      return await provider.snap(body);
    case "isochrone": case "optimization": case "tilequery":
      if (!provider.raw) throw new GeoProviderError("GEO_NOT_SUPPORTED", `${action} não disponível em ${name}`, 501);
      return await provider.raw(action, body);
    default:
      throw new GeoProviderError("GEO_INVALID_INPUT", `action desconhecida: ${action}`, 422);
  }
}

/**
 * Etapa 75: emite `GEO_BUDGET_WARNING` quando o gasto do mês cruza `alert_at_pct`.
 * `warned_month` garante um alerta por provedor por mês — o update é condicional e
 * atômico, então chamadas concorrentes do gateway não duplicam o alerta.
 * Nunca lança: falha de alerta não pode derrubar a requisição de mapa.
 */
async function warnBudgetOnce(provider: ProviderName, budget: BudgetRow | undefined): Promise<void> {
  if (!budget?.warn) return;
  const month = new Date().toISOString().slice(0, 10).slice(0, 7) + "-01";
  const { data: claimed, error: claimError } = await db
    .from("geo_budget")
    .update({ warned_month: month })
    .eq("provider", provider)
    .is("warned_month", null)
    .select("provider");
  // Caminho idempotente: já avisado neste mês (ou em outro) — não reemite.
  let claimedRow = claimed?.[0];
  if (!claimedRow && !claimError) {
    const { data: again } = await db
      .from("geo_budget")
      .update({ warned_month: month })
      .eq("provider", provider)
      .lt("warned_month", month)
      .select("provider");
    claimedRow = again?.[0];
  }
  if (claimError || !claimedRow) return;

  const { error } = await db.from("alerts").insert({
    type: "GEO_BUDGET_WARNING",
    severity: budget.pct >= 100 ? "CRITICAL" : "WARNING",
    title: `Orçamento geo de ${provider} em ${budget.pct}%`,
    message: `Gasto de US$ ${budget.spent_usd.toFixed(2)} de US$ ${budget.limit_usd.toFixed(2)} em ${provider}.` +
      (budget.blocked
        ? " Limite atingido: novas chamadas a este provedor falham até o próximo mês ou até o limite ser elevado."
        : " Ao atingir 100% com hard_stop ativo, as chamadas a este provedor param."),
    metadata: {
      provider,
      pct: budget.pct,
      spent_usd: budget.spent_usd,
      limit_usd: budget.limit_usd,
      blocked: budget.blocked,
      month,
    },
  });
  if (error) logger.error("[geo-gateway] falha ao gravar alerta de orçamento", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const version = resolveContractVersion(req);
  trackContractUsage("geo-gateway", version);

  const parsed = await parseJsonBody(req, version);
  if (!parsed.ok) return errorResponse(parsed, corsHeaders);
  const validation = validateContract(getSchema("geo-gateway", version), parsed.value, version);
  if (!validation.ok) return errorResponse(validation, corsHeaders);

  // deno-lint-ignore no-explicit-any
  const body = validation.data as any;
  const action = body.action as string;
  const uid = uidFromJwt(req);

  try {
    // ── status ─────────────────────────────────────────────────────────────
    if (action === "provider-status") {
      await resolver.refresh(true);
      const providers: ProviderName[] = ["mapbox", "google"];
      const status = providers.map((p) => ({
        provider: p,
        configured: p === "mapbox" ? !!MAPBOX_TOKEN : !!GOOGLE_KEY,
        implemented: p === "mapbox",
        budget: resolver.budgetOf(p) ?? null,
      }));
      const settings = (["tiles", "autocomplete", "geocode", "reverse", "route", "matrix", "static", "snap", "validate", "isochrone", "optimization", "tilequery"] as GeoFunction[])
        .map((fn) => ({ function: fn, ...(resolver.setting(fn) ?? { provider: "off", fallback_provider: null, config: {} }) }));
      return jsonResponse({ providers: status, settings }, 200, corsHeaders, version);
    }

    const fn = ACTION_FUNCTION[action];
    if (!userAllowed(uid, fn)) {
      return jsonResponse(buildErrorBody(ERROR_CODES.RATE_LIMITED, "Muitas requisições; aguarde 1 minuto.", [], version), 429, corsHeaders, version);
    }

    // ── map load (sem chamada externa) ─────────────────────────────────────
    if (action === "count-map-load") {
      await meter(db, body.provider, "tiles", body.provider === "mapbox" ? "map_load" : "dynamic_maps", 1);
      return jsonResponse({ ok: true }, 200, corsHeaders, version);
    }

    const { provider: name, reason } = await resolver.resolve(fn, body.provider);
    const provider = getProvider(name);
    // Etapa 75: avisa o dono antes do bloqueio duro por orçamento.
    await warnBudgetOnce(name, resolver.budgetOf(name));
    const headers: Record<string, string> = { ...corsHeaders, "X-Geo-Provider": name, "X-Geo-Resolve": reason };

    // ── cache ──────────────────────────────────────────────────────────────
    const ttl = CACHE_TTL_S[name][fn] ?? 0;
    const { action: _a, provider: _p, session_token: _s, ...cacheable } = body;
    const key = ttl > 0 ? await cacheKey(name, fn, cacheable) : null;
    if (key) {
      const hit = await cacheGet<unknown>(db, key);
      if (hit) return jsonResponse(hit, 200, { ...headers, "X-Geo-Cache": "HIT" }, version);
    }

    // ── chamada ao provedor (com failover em runtime) ──────────────────────
    const outcome = await callWithFailover(fn, name, {
      resolver,
      getProvider,
      run: (p, pname) => runProvider(p, pname, action, body),
      log: (msg, meta) => logger.error(msg, meta),
    });
    const result = outcome;
    const usedProvider = outcome.provider;
    if (outcome.fallback) {
      headers["X-Geo-Provider"] = usedProvider;
      headers["X-Geo-Fallback"] = `${outcome.fallback.from}:${outcome.fallback.code}`;
    }

    // Etapa 75: avisa o dono antes do bloqueio duro por orçamento. Roda sobre o provedor
    // que de fato atendeu — com failover o primário pode não ter sido usado.
    await warnBudgetOnce(usedProvider, resolver.budgetOf(usedProvider));

    await meter(db, usedProvider, fn, result.sku, result.units);
    // A chave é derivada do provedor que respondeu: cachear a resposta do fallback sob a chave do
    // primário ficaria inalcançável e poderia servir resposta de um provedor para outro.
    const writeKey = usedProvider === name ? key : (ttl > 0 ? await cacheKey(usedProvider, fn, cacheable) : null);
    if (writeKey) await cachePut(db, writeKey, usedProvider, fn, result.data, ttl);
    if (result.downgraded) headers["X-Geo-Downgraded"] = result.downgraded;
    headers["X-Geo-Sku"] = result.sku;
    headers["X-Geo-Cache"] = key ? "MISS" : "BYPASS";
    return jsonResponse(result.data, 200, headers, version);
  } catch (err) {
    if (err instanceof GeoProviderError) {
      const h: Record<string, string> = { ...corsHeaders };
      if (err.retryAfterMs) h["Retry-After"] = String(Math.ceil(err.retryAfterMs / 1000));
      const code = err.status === 429 ? ERROR_CODES.RATE_LIMITED : err.status < 500 ? ERROR_CODES.VALIDATION_FAILED : ERROR_CODES.INTERNAL_ERROR;
      return jsonResponse(buildErrorBody(code, err.message, [{ field: "(geo)", message: err.message, code: err.code }], version), err.status, h, version);
    }
    if (err instanceof ResolveError) {
      return jsonResponse(buildErrorBody(err.status === 429 ? ERROR_CODES.RATE_LIMITED : ERROR_CODES.INTERNAL_ERROR, err.message, [{ field: "(geo)", message: err.message, code: "GEO_UNAVAILABLE" }], version), err.status, corsHeaders, version);
    }
    logger.error("[geo-gateway]", err);
    return jsonResponse(buildErrorBody(ERROR_CODES.INTERNAL_ERROR, "Erro interno no geo-gateway", [], version), 500, corsHeaders, version);
  }
});
