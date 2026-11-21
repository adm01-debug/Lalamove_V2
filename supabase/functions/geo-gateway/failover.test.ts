import { assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { callWithFailover, isFailoverWorthy } from "./failover.ts";
import { GeoProviderError } from "./providers/types.ts";
import type { GeoProvider, ProviderName, ProviderResult } from "./providers/types.ts";

const okResult = (data: unknown): ProviderResult<unknown> => ({ data, sku: "directions", units: 1 });

function deps(opts: {
  primaryError?: unknown;
  fallbackError?: unknown;
  alt?: ProviderName | null;
  primaryName?: ProviderName;
}) {
  const calls: ProviderName[] = [];
  const logs: string[] = [];
  return {
    calls,
    logs,
    value: {
      resolver: { failoverFor: () => Promise.resolve(opts.alt === undefined ? "google" as ProviderName : opts.alt) },
      getProvider: (name: ProviderName) => ({ name }) as GeoProvider,
      run: (p: GeoProvider) => {
        calls.push(p.name);
        if (p.name === (opts.primaryName ?? "mapbox") && opts.primaryError) return Promise.reject(opts.primaryError);
        if (p.name !== (opts.primaryName ?? "mapbox") && opts.fallbackError) return Promise.reject(opts.fallbackError);
        return Promise.resolve(okResult({ provider: p.name }));
      },
      log: (m: string) => { logs.push(m); },
    },
  };
}

Deno.test("primário OK: nenhum fallback é consultado e o provedor é o primário", async () => {
  const d = deps({});
  const r = await callWithFailover("route", "mapbox", d.value);
  assertEquals(r.provider, "mapbox");
  assertEquals(r.fallback, undefined);
  assertEquals(d.calls, ["mapbox"]);
});

Deno.test("primário 5xx → fallback responde em UMA chamada e o header aponta o fallback", async () => {
  const d = deps({ primaryError: new GeoProviderError("GEO_PROVIDER_ERROR", "Mapbox 500", 502) });
  const r = await callWithFailover("route", "mapbox", d.value);
  assertEquals(r.provider, "google");
  assertEquals(r.fallback?.from, "mapbox");
  assertEquals(r.fallback?.to, "google");
  assertEquals(r.fallback?.code, "GEO_PROVIDER_ERROR");
  assertEquals(d.calls, ["mapbox", "google"]);
});

Deno.test("primário 5xx sem alternativo usável → erro ORIGINAL sobe", async () => {
  const original = new GeoProviderError("GEO_PROVIDER_ERROR", "Mapbox 500", 502);
  const d = deps({ primaryError: original, alt: null });
  const e = await assertRejects(() => callWithFailover("route", "mapbox", d.value), GeoProviderError);
  assertEquals(e.message, "Mapbox 500");
  assertEquals(e.status, 502);
  assertEquals(d.calls, ["mapbox"]);
});

Deno.test("entrada inválida NÃO troca de provedor (a falha se repetiria no outro)", async () => {
  const d = deps({ primaryError: new GeoProviderError("GEO_INVALID_INPUT", "coordenada inválida", 422) });
  const e = await assertRejects(() => callWithFailover("geocode", "mapbox", d.value), GeoProviderError);
  assertEquals(e.code, "GEO_INVALID_INPUT");
  assertEquals(d.calls, ["mapbox"]);
});

Deno.test("fallback também falha → erro original sobe e a falha do fallback é registrada", async () => {
  const d = deps({
    primaryError: new GeoProviderError("GEO_PROVIDER_ERROR", "Mapbox 500", 502),
    fallbackError: new GeoProviderError("GEO_RATE_LIMITED", "Google 429", 429),
  });
  const e = await assertRejects(() => callWithFailover("route", "mapbox", d.value), GeoProviderError);
  assertEquals(e.message, "Mapbox 500");
  assertEquals(d.calls, ["mapbox", "google"]);
  assertEquals(d.logs.includes("[geo-gateway] fallback tambem falhou"), true);
});

Deno.test("credencial revogada (GEO_NOT_CONFIGURED) e rate limit entram em failover; erro de rede também", () => {
  assertEquals(isFailoverWorthy(new GeoProviderError("GEO_NOT_CONFIGURED", "401", 502)), true);
  assertEquals(isFailoverWorthy(new GeoProviderError("GEO_RATE_LIMITED", "429", 429)), true);
  assertEquals(isFailoverWorthy(new DOMException("aborted", "AbortError")), true);
  assertEquals(isFailoverWorthy(new GeoProviderError("GEO_NOT_FOUND", "sem resultado", 404)), false);
  assertEquals(isFailoverWorthy(new GeoProviderError("GEO_NO_ROUTE", "sem rota", 422)), false);
});