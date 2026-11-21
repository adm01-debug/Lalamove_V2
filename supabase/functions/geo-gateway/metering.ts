// Cache (geo_cache), medição (geo_usage_increment) e registro de sessões de autocomplete.
// Recebe um client Supabase service_role; nunca lança — falha de medição não derruba a resposta.
import type { GeoFunction, ProviderName } from "./providers/types.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

/** TTL por (provider, função). 0 = não cacheia. Mapbox temporário não pode ser retido (termos) → 0. */
export const CACHE_TTL_S: Record<ProviderName, Partial<Record<GeoFunction, number>>> = {
  mapbox: { route: 600, static: 7 * 86400, isochrone: 3600 },
  google: { geocode: 30 * 86400, reverse: 30 * 86400, route: 600, static: 7 * 86400 },
};

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export function cacheKey(provider: ProviderName, fn: GeoFunction, req: unknown): Promise<string> {
  // hora arredondada entra na chave de rota (trânsito muda)
  const bucket = fn === "route" ? Math.floor(Date.now() / 600_000) : 0;
  return sha256(`${provider}|${fn}|${bucket}|${stableStringify(req)}`);
}

export async function cacheGet<T>(db: Db, key: string): Promise<T | null> {
  try {
    const { data } = await db.from("geo_cache").select("response, expires_at").eq("key", key).maybeSingle();
    if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.response as T;
  } catch { return null; }
}

export async function cachePut(db: Db, key: string, provider: ProviderName, fn: GeoFunction, response: unknown, ttlS: number) {
  if (ttlS <= 0) return;
  try {
    await db.from("geo_cache").upsert({
      key, provider, function: fn, response,
      expires_at: new Date(Date.now() + ttlS * 1000).toISOString(),
    });
  } catch { /* medição best-effort */ }
}

export async function meter(db: Db, provider: ProviderName, fn: GeoFunction, sku: string, units: number) {
  if (units <= 0) return;
  try {
    await db.rpc("geo_usage_increment", { p_provider: provider, p_function: fn, p_sku: sku, p_count: units });
  } catch (e) { console.error("[geo-gateway] geo_usage_increment falhou", e); }
}

/**
 * Sessão de autocomplete: conta 1 na primeira vez que um session_token aparece (durável entre instâncias
 * via geo_cache, chave "session:<provider>:<token>", TTL 10 min).
 */
export async function registerSession(db: Db, provider: ProviderName, sessionToken: string): Promise<boolean> {
  try {
    const key = `session:${provider}:${sessionToken}`;
    const { data } = await db.from("geo_cache").select("key").eq("key", key).maybeSingle();
    if (data) return false;
    const { error } = await db.from("geo_cache").insert({
      key, provider, function: "autocomplete", response: {},
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    return !error; // conflito concorrente → já contado
  } catch { return false; }
}
