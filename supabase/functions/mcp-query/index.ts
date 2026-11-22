// ============================================================================
// mcp-query — introspecção e diagnóstico de banco para administradores.
//
// Modelo de segurança (mesmo padrão do external-db-bridge / migrate-helper):
//  1. Exige `Authorization: Bearer <JWT>` válido (validado em código, pois a
//     função sobe com verify_jwt = false como as demais do projeto).
//  2. Exige papel `admin` ou grant ativo em `mcp_diagnostics_grants` via RPC
//     `can_run_db_diagnostics` — default-deny.
//  3. NÃO existe SQL cru, NÃO existe leitura de tabelas de negócio e NÃO existe
//     acesso ao schema `auth`. O único caminho para o banco é a RPC
//     `mcp_introspect`, que aceita apenas operações de uma allowlist fixa.
//  4. Toda chamada é registrada em `query_telemetry` com o `user_id` do
//     administrador — trilha de auditoria de quem consultou o quê.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

/** Operações aceitas — espelham exatamente a allowlist de `mcp_introspect`. */
const ALLOWED_OPERATIONS = [
  "connection_info",
  "list_tables",
  "list_columns",
  "list_views",
  "list_enums",
  "list_extensions",
  "list_indexes",
  "list_functions",
  "list_triggers",
  "list_policies",
  "constraints",
  "relationships",
  "sequences",
  "migrations",
  "db_stats",
  "active_queries",
  "slow_queries",
  "locks",
  "disk_usage",
  "table_bloat",
  "index_usage",
  "seq_scans",
  "duplicate_indexes",
  "column_stats",
  "pg_settings",
] as const;

type Operation = typeof ALLOWED_OPERATIONS[number];

/** Parâmetros aceitos. Qualquer campo extra enviado pelo cliente é descartado. */
interface IntrospectParams {
  schema?: string;
  table?: string;
  column?: string;
  filter?: string;
  limit?: number;
}

interface RequestBody {
  operation?: unknown;
  params?: unknown;
}

const SLOW_MS = 3000;
const VERY_SLOW_MS = 8000;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isOperation(value: unknown): value is Operation {
  return typeof value === "string" &&
    (ALLOWED_OPERATIONS as readonly string[]).includes(value);
}

/**
 * Normaliza os parâmetros: apenas campos conhecidos, tipos coagidos e
 * comprimentos limitados. Identificadores nunca viram SQL — são comparados
 * como valores dentro da função do banco.
 */
function sanitizeParams(raw: unknown): IntrospectParams {
  if (typeof raw !== "object" || raw === null) return {};
  const src = raw as Record<string, unknown>;
  const out: IntrospectParams = {};

  const str = (v: unknown): string | undefined => {
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : undefined;
  };

  const schema = str(src.schema);
  if (schema) out.schema = schema;
  const table = str(src.table);
  if (table) out.table = table;
  const column = str(src.column);
  if (column) out.column = column;
  const filter = str(src.filter);
  if (filter) out.filter = filter;

  const limit = Number(src.limit);
  if (Number.isFinite(limit)) {
    out.limit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  }

  return out;
}

function classifySeverity(durationMs: number, hasError: boolean): string {
  if (hasError) return "error";
  if (durationMs >= VERY_SLOW_MS) return "very_slow";
  if (durationMs >= SLOW_MS) return "slow";
  return "normal";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ── 1. Autenticação ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return json({ error: "unauthorized" }, 401);
  }

  // ── 2. Autorização: admin ou grant de diagnóstico ────────────────────────
  const { data: canRun, error: roleError } = await supabase.rpc(
    "can_run_db_diagnostics",
    {
      _user_id: user.id,
    },
  );
  if (roleError) {
    console.error("[mcp-query] permission check failed:", roleError.message);
    return json({ error: "Falha ao verificar permissões" }, 500);
  }
  if (canRun !== true) {
    return json(
      { error: "forbidden: requer papel admin ou concessão de diagnóstico" },
      403,
    );
  }

  // ── 3. Validação de entrada (contrato: 422 no formato único + v1/v2) ─────
  const contractVersion = resolveContractVersion(req);
  trackContractUsage("mcp-query", contractVersion);
  const parsedBody = await parseJsonBody(req, contractVersion);
  if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
  const contract = validateContract(
    getSchema("mcp-query", contractVersion),
    parsedBody.value,
    contractVersion,
  );
  if (!contract.ok) return errorResponse(contract, corsHeaders);
  const body = contract.data as RequestBody;

  const operation: Operation = body.operation as Operation;
  const params = sanitizeParams(body.params);

  // ── 4. Execução (único caminho: RPC de allowlist) ────────────────────────
  const start = performance.now();
  const { data, error } = await supabase.rpc("mcp_introspect", {
    p_operation: operation,
    p_params: params,
  });
  const durationMs = Math.round(performance.now() - start);

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const severity = classifySeverity(durationMs, Boolean(error));

  // ── 5. Telemetria auditável (fire-and-forget, com user_id) ───────────────
  void supabase
    .from("query_telemetry")
    .insert({
      operation: `mcp-query:${operation}`,
      rpc_name: "mcp_introspect",
      table_name: params.table ?? null,
      duration_ms: durationMs,
      record_count: error ? null : rows.length,
      query_limit: params.limit ?? null,
      severity,
      error_message: error?.message ?? null,
      user_id: user.id,
    })
    .then(({ error: insertError }) => {
      if (insertError) {
        console.warn("[mcp-query] telemetria falhou:", insertError.message);
      }
    });

  if (error) {
    console.error(`[mcp-query] ${operation} falhou: ${error.message}`);
    return json({ error: error.message, operation }, 422);
  }

  return json({
    operation,
    rows,
    count: rows.length,
    telemetry: { duration_ms: durationMs, severity },
  });
});
