// Etapa 96 do plano Google Maps — testes do alarme de integração.
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  ERROR_RATE_MIN_SAMPLES,
  ERROR_RATE_THRESHOLD,
  evaluateProviderErrors,
  releaseAlertSlot,
  shouldAlert,
} from "./error-monitor.ts";

Deno.test("shouldAlert: taxa abaixo do limite não dispara", () => {
  const d = shouldAlert({ total: 100, errors: 4 });
  assertEquals(d.fire, false);
  assertEquals(d.pct, 4);
});

Deno.test("shouldAlert: taxa exatamente no limite não dispara (é > 5%, não >=)", () => {
  assertEquals(shouldAlert({ total: 100, errors: 5 }).fire, false);
});

Deno.test("shouldAlert: taxa acima do limite dispara", () => {
  const d = shouldAlert({ total: 100, errors: 6 });
  assertEquals(d.fire, true);
  assertEquals(d.pct, 6);
  assertEquals(d.errors, 6);
  assertEquals(d.total, 100);
});

Deno.test("shouldAlert: amostra pequena não dispara mesmo com 100% de erro", () => {
  const d = shouldAlert({ total: ERROR_RATE_MIN_SAMPLES - 1, errors: ERROR_RATE_MIN_SAMPLES - 1 });
  assertEquals(d.fire, false);
  assertEquals(d.pct, 100);
});

Deno.test("shouldAlert: amostra no mínimo dispara", () => {
  const d = shouldAlert({ total: ERROR_RATE_MIN_SAMPLES, errors: ERROR_RATE_MIN_SAMPLES });
  assertEquals(d.fire, true);
});

Deno.test("shouldAlert: janela vazia não dispara e não divide por zero", () => {
  const d = shouldAlert({ total: 0, errors: 0 });
  assertEquals(d.fire, false);
  assertEquals(d.pct, 0);
});

Deno.test("shouldAlert: percentual é arredondado a 2 casas", () => {
  // 1/3 = 33.333...%  -> 33.33
  assertEquals(shouldAlert({ total: 30, errors: 10 }).pct, 33.33);
});

Deno.test("shouldAlert: limite é o dobro do plano quando o provedor está muito pior", () => {
  const d = shouldAlert({ total: 40, errors: 20 });
  assertEquals(d.fire, true);
  assertEquals(d.pct, 50);
  assertEquals(ERROR_RATE_THRESHOLD, 0.05);
});

// ── evaluateProviderErrors com banco falso ────────────────────────────────────
// O falso imita o subset do query builder do supabase-js usado pelo módulo:
// `from(t).select(...)` devolve contagens; `insert`/`update`/`delete` em `geo_cache`
// e `alerts` são registrados. Nenhuma chamada de rede.
interface FakeState {
  counts: { total: number; errors: number };
  alertRows: Record<string, unknown>[];
  cacheRows: Map<string, { expires_at: string }>;
  writes: string[];
}

function fakeDb(state: FakeState) {
  // deno-lint-ignore no-explicit-any
  const table = (name: string): any => {
    // deno-lint-ignore no-explicit-any
    const chain: any = {};
    const filters: string[] = [];
    chain.select = () => chain;
    chain.eq = (col: string) => { filters.push(`eq:${col}`); return chain; };
    chain.gte = () => chain;
    chain.lt = (col: string) => { filters.push(`lt:${col}`); return chain; };
    chain.head = true;
    chain.then = (resolve: (v: unknown) => void) => {
      if (name === "query_telemetry") {
        const isErrors = filters.includes("eq:severity");
        resolve({ count: isErrors ? state.counts.errors : state.counts.total, data: null });
        return;
      }
      if (name === "geo_cache") {
        resolve({ data: null, error: { code: "23505" } });
        return;
      }
      resolve({ data: null, error: null });
    };
    // O supabase-js real devolve um builder que também é "awaitable" e tem `.select()`,
    // porque o código faz `.insert(row).select("key")`.
    const result = (data: unknown[] | null, error: unknown) => {
      const payload = { data, error };
      // deno-lint-ignore no-explicit-any
      const builder: any = {
        select: () => Promise.resolve(payload),
        then: (resolve: (v: unknown) => void) => resolve(payload),
      };
      return builder;
    };
    chain.insert = (row: Record<string, unknown>) => {
      state.writes.push(`${name}:insert`);
      if (name === "alerts") state.alertRows.push(row);
      if (name === "geo_cache") {
        const key = String(row.key);
        if (state.cacheRows.has(key)) return result(null, { code: "23505" });
        state.cacheRows.set(key, { expires_at: String(row.expires_at) });
        return result([{ key }], null);
      }
      return result([{ key: "x" }], null);
    };
    chain.update = () => {
      state.writes.push(`${name}:update`);
      return result([], null);
    };
    chain.delete = () => {
      state.writes.push(`${name}:delete`);
      // deno-lint-ignore no-explicit-any
      const ok: any = { eq: () => Promise.resolve({ data: null, error: null }) };
      return ok;
    };
    return chain;
  };
  return { from: table };
}

function freshState(total: number, errors: number): FakeState {
  return { counts: { total, errors }, alertRows: [], cacheRows: new Map(), writes: [] };
}

Deno.test("evaluateProviderErrors: taxa normal não grava alerta", async () => {
  const state = freshState(100, 2);
  const out = await evaluateProviderErrors(fakeDb(state), "google", "geocode");
  assertEquals(out, "skipped");
  assertEquals(state.alertRows.length, 0);
});

Deno.test("evaluateProviderErrors: taxa alta grava INTEGRATION_FAILURE com metadados", async () => {
  const state = freshState(100, 30);
  const out = await evaluateProviderErrors(fakeDb(state), "mapbox", "geocode");
  assertEquals(out, "error");
  assertEquals(state.alertRows.length, 1);
  const row = state.alertRows[0];
  assertEquals(row.type, "INTEGRATION_FAILURE");
  assertEquals(row.severity, "WARNING");
  const meta = row.metadata as Record<string, unknown>;
  assertEquals(meta.provider, "mapbox");
  assertEquals(meta.total, 100);
  assertEquals(meta.errors, 30);
  assertEquals(meta.error_rate_pct, 30);
});

Deno.test("evaluateProviderErrors: >=50% é CRITICAL", async () => {
  const state = freshState(100, 60);
  await evaluateProviderErrors(fakeDb(state), "google", "route");
  assertEquals(state.alertRows[0].severity, "CRITICAL");
});

Deno.test("evaluateProviderErrors: cooldown impede segundo alerta", async () => {
  const state = freshState(100, 30);
  const db = fakeDb(state);
  await evaluateProviderErrors(db, "google", "geocode");
  const second = await evaluateProviderErrors(db, "google", "geocode");
  assertEquals(second, "skipped");
  assertEquals(state.alertRows.length, 1);
  assertEquals(state.cacheRows.size, 1);
});

Deno.test("evaluateProviderErrors: provedores têm slots independentes", async () => {
  const state = freshState(100, 30);
  const db = fakeDb(state);
  await evaluateProviderErrors(db, "google", "geocode");
  await evaluateProviderErrors(db, "mapbox", "geocode");
  assertEquals(state.alertRows.length, 2);
  assertEquals(state.cacheRows.size, 2);
});

Deno.test("releaseAlertSlot apaga o registro de cooldown", async () => {
  const state = freshState(0, 0);
  await releaseAlertSlot(fakeDb(state), "google");
  assertEquals(state.writes.includes("geo_cache:delete"), true);
});
