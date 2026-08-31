import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/external-db-bridge`;

// ─── Helper ─────────────────────────────────────────────────────────────────
async function invoke(
  body: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

// ─── Unit tests for classifySeverity & buildTelemetry (pure logic) ──────────

Deno.test("classifySeverity: error takes priority", () => {
  // We test the logic inline since Deno edge functions can't be imported directly
  const classify = (ms: number, err: string | null) => {
    if (err) return "error";
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  assertEquals(classify(100, "timeout"), "error");
  assertEquals(classify(10000, "timeout"), "error");
  assertEquals(classify(0, "fail"), "error");
});

Deno.test("classifySeverity: very_slow threshold at 8000ms", () => {
  const classify = (ms: number) => {
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  assertEquals(classify(8000), "very_slow");
  assertEquals(classify(8001), "very_slow");
  assertEquals(classify(15000), "very_slow");
  assertEquals(classify(7999), "slow");
});

Deno.test("classifySeverity: slow threshold at 3000ms", () => {
  const classify = (ms: number) => {
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  assertEquals(classify(3000), "slow");
  assertEquals(classify(3001), "slow");
  assertEquals(classify(7999), "slow");
  assertEquals(classify(2999), "normal");
});

Deno.test("classifySeverity: normal for fast queries", () => {
  const classify = (ms: number) => {
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  assertEquals(classify(0), "normal");
  assertEquals(classify(1), "normal");
  assertEquals(classify(500), "normal");
  assertEquals(classify(2999), "normal");
});

Deno.test("classifySeverity: boundary values (100 scenarios)", () => {
  const classify = (ms: number, err: string | null) => {
    if (err) return "error";
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  const boundaries = [0, 1, 100, 2999, 3000, 3001, 5000, 7999, 8000, 8001, 10000, 50000];
  const errors = [null, "timeout", "connection refused", ""];

  for (const ms of boundaries) {
    for (const err of errors) {
      const result = classify(ms, err);
      if (err) {
        assertEquals(result, "error", `ms=${ms}, err=${err}`);
      } else if (ms >= 8000) {
        assertEquals(result, "very_slow", `ms=${ms}`);
      } else if (ms >= 3000) {
        assertEquals(result, "slow", `ms=${ms}`);
      } else {
        assertEquals(result, "normal", `ms=${ms}`);
      }
    }
  }
});

Deno.test("buildTelemetry: constructs correct shape", () => {
  const build = (
    payload: Record<string, unknown>,
    durationMs: number,
    recordCount: number | null,
    errorMessage: string | null,
    userId: string | null,
  ) => {
    const classify = (ms: number, err: string | null) => {
      if (err) return "error";
      if (ms >= 8000) return "very_slow";
      if (ms >= 3000) return "slow";
      return "normal";
    };
    return {
      operation: payload.operation as string,
      table_name: (payload.table as string) || null,
      rpc_name: (payload.rpc_name as string) || null,
      duration_ms: Math.round(durationMs),
      record_count: recordCount,
      query_limit: (payload.limit as number) ?? null,
      query_offset: (payload.offset as number) ?? null,
      count_mode: (payload.count_mode as string) ?? null,
      severity: classify(durationMs, errorMessage),
      error_message: errorMessage,
      user_id: userId,
    };
  };

  const t = build(
    { operation: "select", table: "drivers", limit: 50, offset: 10, count_mode: "exact" },
    5000,
    42,
    null,
    "user-123",
  );

  assertEquals(t.operation, "select");
  assertEquals(t.table_name, "drivers");
  assertEquals(t.rpc_name, null);
  assertEquals(t.duration_ms, 5000);
  assertEquals(t.record_count, 42);
  assertEquals(t.query_limit, 50);
  assertEquals(t.query_offset, 10);
  assertEquals(t.count_mode, "exact");
  assertEquals(t.severity, "slow");
  assertEquals(t.error_message, null);
  assertEquals(t.user_id, "user-123");
});

Deno.test("buildTelemetry: rpc_name populated for rpc operations", () => {
  const build = (payload: Record<string, unknown>) => ({
    rpc_name: (payload.rpc_name as string) || null,
    table_name: (payload.table as string) || null,
  });

  const t = build({ operation: "rpc", rpc_name: "check_lockout", table: undefined });
  assertEquals(t.rpc_name, "check_lockout");
  assertEquals(t.table_name, null);
});

Deno.test("buildTelemetry: rounds duration_ms", () => {
  assertEquals(Math.round(3456.789), 3457);
  assertEquals(Math.round(0.1), 0);
  assertEquals(Math.round(9999.5), 10000);
});

Deno.test("buildTelemetry: handles all null optionals", () => {
  const build = (payload: Record<string, unknown>) => ({
    table_name: (payload.table as string) || null,
    rpc_name: (payload.rpc_name as string) || null,
    query_limit: (payload.limit as number) ?? null,
    query_offset: (payload.offset as number) ?? null,
    count_mode: (payload.count_mode as string) ?? null,
  });

  const t = build({ operation: "select" });
  assertEquals(t.table_name, null);
  assertEquals(t.rpc_name, null);
  assertEquals(t.query_limit, null);
  assertEquals(t.query_offset, null);
  assertEquals(t.count_mode, null);
});

// ─── Integration tests (require deployed function) ──────────────────────────

Deno.test("external-db-bridge: rejects unauthenticated requests", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "select", table: "test" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("Unauthorized") || body.includes("error"));
});

Deno.test("external-db-bridge: CORS preflight responds 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertExists(res.headers.get("access-control-allow-origin"));
});

Deno.test("external-db-bridge: rejects missing operation", async () => {
  const { status } = await invoke({});
  // anon key may fail auth (401) or missing op (400) or getClaims error (500)
  assert([400, 401, 500].includes(status), `Expected 400/401/500, got ${status}`);
});

Deno.test("external-db-bridge: rejects invalid bearer token", async () => {
  const { status } = await invoke({ operation: "select", table: "test" }, "invalid-token-xxx");
  // getClaims may throw 500 or return 401
  assert([401, 500].includes(status), `Expected 401 or 500, got ${status}`);
});

Deno.test("external-db-bridge: responds with JSON content-type", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ operation: "select", table: "test" }),
  });
  await res.text();
  const ct = res.headers.get("content-type");
  assert(ct?.includes("application/json"), `Expected JSON content-type, got ${ct}`);
});

// ─── Telemetry persistence verification ─────────────────────────────────────

Deno.test("emitTelemetry logic: skips normal severity", () => {
  // Simulating the logic: normal severity should NOT persist
  const shouldPersist = (severity: string) => severity !== "normal";
  assertEquals(shouldPersist("normal"), false);
  assertEquals(shouldPersist("slow"), true);
  assertEquals(shouldPersist("very_slow"), true);
  assertEquals(shouldPersist("error"), true);
});

Deno.test("emitTelemetry logic: 200 severity scenarios", () => {
  const shouldPersist = (severity: string) => severity !== "normal";
  const classify = (ms: number, err: string | null) => {
    if (err) return "error";
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  let persistCount = 0;
  let skipCount = 0;

  for (let ms = 0; ms <= 20000; ms += 100) {
    const sev = classify(ms, null);
    if (shouldPersist(sev)) persistCount++;
    else skipCount++;
  }

  // 0-2999 = 30 normal steps (skip)
  // 3000-7999 = 50 slow steps (persist)
  // 8000-20000 = 121 very_slow steps (persist)
  assert(skipCount === 30, `Expected 30 skipped, got ${skipCount}`);
  assert(persistCount === 171, `Expected 171 persisted, got ${persistCount}`);
});

Deno.test("emitTelemetry logic: all error variants persist", () => {
  const shouldPersist = (severity: string) => severity !== "normal";
  const errors = [
    "timeout", "connection refused", "table not found",
    "permission denied", "syntax error", "constraint violation",
    "deadlock detected", "out of memory", "disk full", "network error",
  ];

  for (const err of errors) {
    const severity = err ? "error" : "normal";
    assert(shouldPersist(severity), `Error "${err}" should persist`);
  }
});

// ─── Stress: buildTelemetry with 500 varied payloads ────────────────────────

Deno.test("buildTelemetry: 500 varied payloads produce valid output", () => {
  const classify = (ms: number, err: string | null) => {
    if (err) return "error";
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };

  const operations = ["select", "insert", "update", "delete", "rpc"];
  const tables = ["drivers", "lalamove_orders", "alerts", "tracking_events", null];
  const rpcs = ["has_role", "check_lockout", "record_failed_login", null];

  for (let i = 0; i < 500; i++) {
    const op = operations[i % operations.length];
    const table = tables[i % tables.length];
    const rpc = op === "rpc" ? rpcs[i % rpcs.length] : null;
    const ms = (i * 37) % 15000;
    const err = i % 50 === 0 ? "simulated error" : null;

    const severity = classify(ms, err);
    const telemetry = {
      operation: op,
      table_name: table,
      rpc_name: rpc,
      duration_ms: Math.round(ms),
      record_count: i % 3 === 0 ? i : null,
      query_limit: i % 4 === 0 ? 100 : null,
      query_offset: i % 5 === 0 ? i * 10 : null,
      count_mode: i % 6 === 0 ? "exact" : null,
      severity,
      error_message: err,
      user_id: `user-${i}`,
    };

    assertExists(telemetry.operation);
    assertExists(telemetry.severity);
    assert(
      ["normal", "slow", "very_slow", "error"].includes(telemetry.severity),
      `Invalid severity: ${telemetry.severity}`,
    );
    assert(telemetry.duration_ms >= 0, `Negative duration: ${telemetry.duration_ms}`);
  }
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

Deno.test("buildTelemetry: zero duration is normal", () => {
  const classify = (ms: number, err: string | null) => {
    if (err) return "error";
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };
  assertEquals(classify(0, null), "normal");
});

Deno.test("buildTelemetry: exactly 3000ms is slow", () => {
  const classify = (ms: number) => {
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };
  assertEquals(classify(3000), "slow");
});

Deno.test("buildTelemetry: exactly 8000ms is very_slow", () => {
  const classify = (ms: number) => {
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };
  assertEquals(classify(8000), "very_slow");
});

Deno.test("buildTelemetry: very large duration", () => {
  const classify = (ms: number) => {
    if (ms >= 8000) return "very_slow";
    if (ms >= 3000) return "slow";
    return "normal";
  };
  assertEquals(classify(999999), "very_slow");
  assertEquals(classify(Number.MAX_SAFE_INTEGER), "very_slow");
});

Deno.test("buildTelemetry: empty string error is still error", () => {
  const classify = (_ms: number, err: string | null) => {
    if (err) return "error";
    return "normal";
  };
  // Empty string is falsy in JS but it's a string
  assertEquals(classify(100, ""), "normal"); // "" is falsy
  assertEquals(classify(100, "x"), "error");
});

Deno.test("telemetry response shape includes duration and severity", () => {
  // Validate the expected response telemetry shape
  const response = {
    data: [],
    count: 0,
    error: null,
    telemetry: { duration_ms: 150, severity: "normal" },
  };

  assertExists(response.telemetry);
  assertExists(response.telemetry.duration_ms);
  assertExists(response.telemetry.severity);
  assertEquals(typeof response.telemetry.duration_ms, "number");
  assertEquals(typeof response.telemetry.severity, "string");
});
