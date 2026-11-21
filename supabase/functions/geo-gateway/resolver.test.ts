import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { mergeSettings, ProviderResolver, ResolveError } from "./resolver.ts";
import type { BudgetRow, GeoSettingRow, QuotaRow } from "./resolver.ts";

function make(opts: { settings: GeoSettingRow[]; budget?: BudgetRow[]; quota?: QuotaRow[]; configured?: string[] }) {
  return new ProviderResolver({
    loadSettings: () => Promise.resolve(opts.settings),
    loadBudget: () => Promise.resolve(opts.budget ?? []),
    loadQuota: () => Promise.resolve(opts.quota ?? []),
    isConfigured: (p) => (opts.configured ?? ["mapbox"]).includes(p),
    supports: (p, fn) => p === "mapbox" ? fn !== "validate" : fn !== "isochrone",
  });
}
const S = (fn: string, provider: string, fallback: string | null = null) => ({ function: fn, provider, fallback_provider: fallback, config: {} }) as GeoSettingRow;

Deno.test("primário configurado é escolhido; Google sem chave cai para fallback Mapbox", async () => {
  const r = make({ settings: [S("route", "mapbox"), S("geocode", "google", "mapbox")] });
  assertEquals((await r.resolve("route")).provider, "mapbox");
  const g = await r.resolve("geocode");
  assertEquals(g.provider, "mapbox"); assertEquals(g.reason, "fallback");
});

Deno.test("orçamento estourado: fallback usável assume; sem fallback → 429", async () => {
  const blocked = { provider: "mapbox", spent_usd: 60, limit_usd: 50, pct: 120, blocked: true, warn: true } as BudgetRow;
  const r = make({ settings: [S("route", "mapbox", "google"), S("matrix", "mapbox")], budget: [blocked], configured: ["mapbox", "google"] });
  const ok = await r.resolve("route");
  assertEquals(ok.provider, "google"); assertEquals(ok.reason, "fallback");
  const e = await assertRejects(() => r.resolve("matrix"), ResolveError);
  assertEquals(e.status, 429);
});

Deno.test("off → 503 com mensagem clara; validate só existe no Google", async () => {
  const r = make({ settings: [S("snap", "off"), S("validate", "mapbox", "google")], configured: ["mapbox", "google"] });
  const e = await assertRejects(() => r.resolve("snap"), ResolveError);
  assertEquals(e.status, 503);
  assertEquals((await r.resolve("validate")).provider, "google");
});

Deno.test("auto: escolhe quem tem cota grátis; empate → mapbox; sem cota → o primeiro usável", async () => {
  const quota: QuotaRow[] = [
    { provider: "mapbox", sku: "directions", free_quota_month: 100000, used: 100000 },
    { provider: "google", sku: "routes_compute_routes", free_quota_month: 10000, used: 10 },
  ];
  const r = make({ settings: [S("route", "auto"), S("geocode", "auto")], quota, configured: ["mapbox", "google"] });
  const a = await r.resolve("route");
  assertEquals(a.provider, "google"); assertEquals(a.reason, "primary:auto:free-quota");
  const b = await r.resolve("geocode"); // sem linhas de quota → Infinity para ambos → mapbox
  assertEquals(b.provider, "mapbox");
});

Deno.test("forced: usa o provedor pedido ou falha sem fallback", async () => {
  const r = make({ settings: [S("route", "mapbox")], configured: ["mapbox"] });
  assertEquals((await r.resolve("route", "mapbox")).reason, "forced");
  await assertRejects(() => r.resolve("route", "google"), ResolveError);
});

Deno.test("rateGuard: bloqueia acima do limite no mesmo minuto e libera no próximo", () => {
  let t = 0;
  const r = new ProviderResolver({
    loadSettings: () => Promise.resolve([]), loadBudget: () => Promise.resolve([]), loadQuota: () => Promise.resolve([]),
    isConfigured: () => true, supports: () => true, now: () => t,
  });
  for (let i = 0; i < 30; i++) assertEquals(r.rateGuard("mapbox", "matrix:driving-traffic", 30), true);
  assertEquals(r.rateGuard("mapbox", "matrix:driving-traffic", 30), false);
  t = 61_000;
  assertEquals(r.rateGuard("mapbox", "matrix:driving-traffic", 30), true);
});

Deno.test("mergeSettings: funcao sem linha em geo_settings usa o default e nao vira off", () => {
  // Regressao: isochrone/optimization/tilequery nao tem seed em geo_settings. Sem o
  // merge com os defaults o resolver devolve `off` e essas acoes respondem 503.
  const dbRows: GeoSettingRow[] = [{ function: "route", provider: "mapbox", fallback_provider: "google", config: {} }];
  const defaults: GeoSettingRow[] = [
    { function: "route", provider: "mapbox", fallback_provider: "mapbox", config: {} },
    { function: "isochrone", provider: "mapbox", fallback_provider: "google", config: {} },
  ];
  const merged = mergeSettings(dbRows, defaults);

  assertEquals(merged.find((r) => r.function === "isochrone")?.provider, "mapbox");
  // a linha do banco continua com prioridade sobre o default
  assertEquals(merged.find((r) => r.function === "route")?.fallback_provider, "google");
  assertEquals(merged.length, 2);
});

Deno.test("failoverFor: usa o fallback declarado, ignora o primário e exige usável", async () => {
  const r = make({ settings: [S("route", "mapbox", "google"), S("geocode", "mapbox")], configured: ["mapbox", "google"] });
  assertEquals(await r.failoverFor("route", "mapbox"), "google");
  assertEquals(await r.failoverFor("geocode", "mapbox"), "google");
});

Deno.test("failoverFor: sem alternativa configurada devolve null (erro original sobe)", async () => {
  const r = make({ settings: [S("route", "mapbox", "google")], configured: ["mapbox"] });
  assertEquals(await r.failoverFor("route", "mapbox"), null);
});

Deno.test("failoverFor: alternativa com orçamento estourado não é usada", async () => {
  const blocked = { provider: "google", spent_usd: 60, limit_usd: 50, pct: 120, blocked: true, warn: true } as BudgetRow;
  const r = make({ settings: [S("route", "mapbox", "google")], budget: [blocked], configured: ["mapbox", "google"] });
  assertEquals(await r.failoverFor("route", "mapbox"), null);
});

Deno.test("failoverFor: função sem suporte no Google (isochrone) não aceita o Google", async () => {
  const r = make({ settings: [S("isochrone", "mapbox", "google")], configured: ["mapbox", "google"] });
  assertEquals(await r.failoverFor("isochrone", "mapbox"), null);
});
