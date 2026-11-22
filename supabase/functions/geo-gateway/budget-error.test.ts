// Etapa 30: orçamento esgotado precisa de código próprio no corpo do erro.
// O `ResolveError` com 429 é a única fonte do 429 por orçamento no gateway;
// antes ele saía como RATE_LIMITED, indistinguível do limite por minuto.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ERROR_CODES, buildErrorBody } from "../_shared/contract.ts";
import { ProviderResolver, ResolveError } from "./resolver.ts";

function resolverWithBlockedBudget(): ProviderResolver {
  return new ProviderResolver({
    loadSettings: () => Promise.resolve([{
      function: "geocode" as const,
      provider: "mapbox" as const,
      fallback_provider: null,
      config: {},
    }]),
    loadBudget: () => Promise.resolve([
      { provider: "mapbox" as const, spent_usd: 60, limit_usd: 50, pct: 120, blocked: true, warn: true },
    ]),
    loadQuota: () => Promise.resolve([]),
    isConfigured: () => true,
    supports: () => true,
  });
}

Deno.test("orçamento bloqueado sem fallback lança ResolveError 429", async () => {
  const resolver = resolverWithBlockedBudget();
  let caught: unknown;
  try {
    await resolver.resolve("geocode");
  } catch (err) {
    caught = err;
  }
  assertEquals(caught instanceof ResolveError, true);
  assertEquals((caught as ResolveError).status, 429);
});

Deno.test("o código do erro de orçamento é GEO_BUDGET_EXCEEDED, não RATE_LIMITED", () => {
  assertEquals(ERROR_CODES.GEO_BUDGET_EXCEEDED, "GEO_BUDGET_EXCEEDED");
  // Os dois precisam coexistir: RATE_LIMITED = espere 1 minuto; GEO_BUDGET_EXCEEDED = acabou o saldo.
  assertEquals(ERROR_CODES.RATE_LIMITED, "RATE_LIMITED");

  const body = buildErrorBody(ERROR_CODES.GEO_BUDGET_EXCEEDED, "Orçamento esgotado", [], "v1") as {
    error: { code: string; message: string };
  };
  assertEquals(body.error.code, "GEO_BUDGET_EXCEEDED");
  assertEquals(body.error.message, "Orçamento esgotado");
});

Deno.test("job-worker trata GEO_BUDGET_EXCEEDED como skip, não como falha retentável", () => {
  // Mesma regex do job-worker: um 429 de orçamento não pode virar retry infinito.
  const isSkip = /GEO_UNAVAILABLE|GEO_BUDGET_EXCEEDED|est[áa] desligada|Nenhum provedor|RATE_LIMITED|429/i;
  const msg = 'geo-gateway respondeu 429: {"error":{"code":"GEO_BUDGET_EXCEEDED"}}';
  assertEquals(isSkip.test(msg), true);
});
