import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SLOW_QUERY_THRESHOLD_MS = 3000;
const VERY_SLOW_QUERY_THRESHOLD_MS = 8000;

interface QueryPayload {
  operation: "select" | "insert" | "update" | "delete" | "rpc";
  table?: string;
  rpc_name?: string;
  select?: string;
  filters?: Record<string, unknown>;
  body?: unknown;
  limit?: number;
  offset?: number;
  order?: { column: string; ascending?: boolean };
  count_mode?: "exact" | "planned" | "estimated";
}

interface TelemetryData {
  operation: string;
  table_name: string | null;
  rpc_name: string | null;
  duration_ms: number;
  record_count: number | null;
  query_limit: number | null;
  query_offset: number | null;
  count_mode: string | null;
  severity: string;
  error_message: string | null;
  user_id: string | null;
}

export function classifySeverity(durationMs: number, errorMessage: string | null): string {
  if (errorMessage) return "error";
  if (durationMs >= VERY_SLOW_QUERY_THRESHOLD_MS) return "very_slow";
  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) return "slow";
  return "normal";
}

export function buildTelemetry(
  payload: QueryPayload,
  durationMs: number,
  recordCount: number | null,
  errorMessage: string | null,
  userId: string | null,
): TelemetryData {
  const severity = classifySeverity(durationMs, errorMessage);
  return {
    operation: payload.operation,
    table_name: payload.table || null,
    rpc_name: payload.rpc_name || null,
    duration_ms: Math.round(durationMs),
    record_count: recordCount,
    query_limit: payload.limit ?? null,
    query_offset: payload.offset ?? null,
    count_mode: payload.count_mode ?? null,
    severity,
    error_message: errorMessage,
    user_id: userId,
  };
}

function emitStructuredLog(telemetry: TelemetryData): void {
  const icon = telemetry.severity === "very_slow" ? "🔴"
    : telemetry.severity === "slow" ? "🟡"
    : telemetry.severity === "error" ? "❌"
    : "✅";

  const target = telemetry.rpc_name || telemetry.table_name || "unknown";
  const line = `${icon} [telemetry] ${telemetry.operation}:${target} ${telemetry.duration_ms}ms` +
    ` | records=${telemetry.record_count ?? "-"}` +
    ` limit=${telemetry.query_limit ?? "-"}` +
    ` offset=${telemetry.query_offset ?? "-"}` +
    ` count=${telemetry.count_mode ?? "-"}`;

  if (telemetry.severity === "very_slow") {
    console.warn(`⚠️ VERY SLOW QUERY: ${line}`);
  } else if (telemetry.severity === "slow") {
    console.warn(`⚠️ SLOW QUERY: ${line}`);
  } else if (telemetry.severity === "error") {
    console.error(`${line} error=${telemetry.error_message}`);
  } else {
    console.info(line);
  }
}

// deno-lint-ignore no-explicit-any
export async function emitTelemetry(
  supabaseLocal: any,
  telemetry: TelemetryData,
): Promise<void> {
  emitStructuredLog(telemetry);

  if (telemetry.severity === "normal") return;

  try {
    supabaseLocal
      .from("query_telemetry")
      .insert(telemetry as unknown as Record<string, unknown>)
      .then(({ error: insertErr }: { error: { message: string } | null }) => {
        if (insertErr) console.warn("[telemetry-persist] Insert failed:", insertErr.message);
      });
  } catch (err) {
    console.error("Failed to persist telemetry:", err);
  }
}

// deno-lint-ignore no-explicit-any
async function executeExternalQuery(
  externalClient: any,
  payload: QueryPayload,
): Promise<{ data: unknown; count: number | null; error: string | null }> {
  if (payload.operation === "rpc" && payload.rpc_name) {
    const { data, error } = await externalClient.rpc(
      payload.rpc_name,
      (payload.body as Record<string, unknown>) || {},
    );
    return {
      data,
      count: Array.isArray(data) ? data.length : null,
      error: error?.message || null,
    };
  }

  if (!payload.table) {
    return { data: null, count: null, error: "Missing table name" };
  }

  if (payload.operation === "select") {
    let query = externalClient
      .from(payload.table)
      .select(payload.select || "*", {
        count: payload.count_mode || undefined,
      });

    if (payload.filters) {
      for (const [col, val] of Object.entries(payload.filters)) {
        query = query.eq(col, val as string | number | boolean);
      }
    }
    if (payload.order) {
      query = query.order(payload.order.column, {
        ascending: payload.order.ascending ?? true,
      });
    }
    if (payload.limit) query = query.limit(payload.limit);
    if (payload.offset) query = query.range(payload.offset, payload.offset + (payload.limit || 100) - 1);

    const { data, count, error } = await query;
    return {
      data,
      count: count ?? (Array.isArray(data) ? data.length : null),
      error: error?.message || null,
    };
  }

  if (payload.operation === "insert") {
    const { data, error } = await externalClient
      .from(payload.table)
      .insert(payload.body as Record<string, unknown>)
      .select();
    return {
      data,
      count: Array.isArray(data) ? data.length : null,
      error: error?.message || null,
    };
  }

  if (payload.operation === "update") {
    if (!payload.filters || Object.keys(payload.filters).length === 0) {
      return { data: null, count: null, error: "Update requires filters" };
    }
    let query = externalClient
      .from(payload.table)
      .update(payload.body as Record<string, unknown>);
    for (const [col, val] of Object.entries(payload.filters)) {
      query = query.eq(col, val as string | number | boolean);
    }
    const { data, error } = await query.select();
    return {
      data,
      count: Array.isArray(data) ? data.length : null,
      error: error?.message || null,
    };
  }

  if (payload.operation === "delete") {
    if (!payload.filters || Object.keys(payload.filters).length === 0) {
      return { data: null, count: null, error: "Delete requires filters" };
    }
    let query = externalClient.from(payload.table).delete();
    for (const [col, val] of Object.entries(payload.filters)) {
      query = query.eq(col, val as string | number | boolean);
    }
    const { data, error } = await query.select();
    return {
      data,
      count: Array.isArray(data) ? data.length : null,
      error: error?.message || null,
    };
  }

  return { data: null, count: null, error: `Unknown operation: ${payload.operation}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseLocal = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Validate JWT by getting user
    const { data: { user }, error: userError } = await supabaseLocal.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Parse payload
    const payload: QueryPayload = await req.json();
    if (!payload.operation) {
      return new Response(JSON.stringify({ error: "Missing operation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // External DB client
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
    if (!externalUrl || !externalKey) {
      return new Response(
        JSON.stringify({ error: "External database not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const externalClient = createClient(externalUrl, externalKey);

    // Execute with timing
    const startTime = performance.now();
    const result = await executeExternalQuery(externalClient, payload);
    const durationMs = performance.now() - startTime;

    // Build and emit telemetry
    const telemetry = buildTelemetry(
      payload,
      durationMs,
      result.count,
      result.error,
      userId,
    );

    // Use service role for telemetry insert (bypass RLS)
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await emitTelemetry(supabaseService, telemetry);

    const responseBody = {
      data: result.data,
      count: result.count,
      error: result.error,
      telemetry: {
        duration_ms: telemetry.duration_ms,
        severity: telemetry.severity,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: result.error ? 422 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("external-db-bridge error:", err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
