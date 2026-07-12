// ============================================================================
// Contract Layer — Validação de schema + formato único de erro para todas as
// Edge Functions e webhooks.
//
// Objetivos (Front-End/Back-End Sênior):
//  - Formato de erro 422 CONSISTENTE em TODOS os endpoints:
//      { error: { code, message, fields: [{ field, message, code }] }, meta }
//  - Versionamento de contrato (v1/v2) resolvido por header/query, com
//    compatibilidade retroativa garantida por testes.
//  - Helpers puros (sem I/O) para permitir testes de contrato determinísticos.
// ============================================================================

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ── Versionamento ───────────────────────────────────────────────────────────

export type ContractVersion = "v1" | "v2";

export const SUPPORTED_VERSIONS: readonly ContractVersion[] = ["v1", "v2"] as const;
export const DEFAULT_VERSION: ContractVersion = "v1";
/** Versões descontinuadas: ainda aceitas, mas sinalizadas via header Warning. */
export const DEPRECATED_VERSIONS: readonly ContractVersion[] = [] as const;

/**
 * Resolve a versão do contrato a partir de (em ordem de precedência):
 *   1. Header `x-contract-version`
 *   2. Query param `?v=` ou `?version=`
 *   3. DEFAULT_VERSION
 * Aceita valores como "v1", "1", "V2" de forma tolerante.
 */
export function resolveContractVersion(req: Request): ContractVersion {
  const url = safeUrl(req.url);
  const raw =
    req.headers.get("x-contract-version") ??
    url?.searchParams.get("v") ??
    url?.searchParams.get("version") ??
    "";

  const normalized = normalizeVersion(raw);
  return normalized ?? DEFAULT_VERSION;
}

export function normalizeVersion(raw: string): ContractVersion | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const candidate = (v.startsWith("v") ? v : `v${v}`) as ContractVersion;
  return SUPPORTED_VERSIONS.includes(candidate) ? candidate : null;
}

export function isDeprecated(version: ContractVersion): boolean {
  return DEPRECATED_VERSIONS.includes(version);
}

// ── Formato único de erro ─────────────────────────────────────────────────────

export interface ContractFieldError {
  field: string;
  message: string;
  code: string;
}

export interface ContractErrorBody {
  error: {
    code: string;
    message: string;
    fields: ContractFieldError[];
  };
  meta: {
    contractVersion: ContractVersion;
    timestamp: string;
  };
}

export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_JSON: "INVALID_JSON",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Converte um ZodError em lista de campos no formato único.
 * Cada issue vira { field, message, code } — `field` usa dot-notation.
 */
export function zodIssuesToFields(error: z.ZodError): ContractFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
    code: issue.code,
  }));
}

export function buildErrorBody(
  code: ErrorCode,
  message: string,
  fields: ContractFieldError[],
  version: ContractVersion,
): ContractErrorBody {
  return {
    error: { code, message, fields },
    meta: { contractVersion: version, timestamp: new Date().toISOString() },
  };
}

// ── Resultado de validação (puro, testável) ──────────────────────────────────

export type ContractResult<T> =
  | { ok: true; data: T; version: ContractVersion }
  | { ok: false; status: number; body: ContractErrorBody; version: ContractVersion };

/**
 * Valida `input` contra `schema` e retorna um resultado discriminado.
 * Falhas de validação usam SEMPRE status 422 e o formato único de erro.
 */
export function validateContract<T>(
  schema: z.ZodType<T>,
  input: unknown,
  version: ContractVersion = DEFAULT_VERSION,
): ContractResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data, version };
  }
  return {
    ok: false,
    status: 422,
    version,
    body: buildErrorBody(
      ERROR_CODES.VALIDATION_FAILED,
      "A validação do payload falhou. Verifique os campos informados.",
      zodIssuesToFields(parsed.error),
      version,
    ),
  };
}

// ── Helpers de Response (usados pelas Edge Functions) ─────────────────────────

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
  version?: ContractVersion,
): Response {
  const finalHeaders: Record<string, string> = {
    ...headers,
    "Content-Type": "application/json",
  };
  if (version) {
    finalHeaders["x-contract-version"] = version;
    if (isDeprecated(version)) {
      finalHeaders["Warning"] =
        `299 - "Contract version ${version} is deprecated and will be removed."`;
    }
  }
  return new Response(JSON.stringify(body), { status, headers: finalHeaders });
}

export function errorResponse(
  result: Extract<ContractResult<unknown>, { ok: false }>,
  headers: Record<string, string>,
): Response {
  return jsonResponse(result.body, result.status, headers, result.version);
}

/**
 * Lê e faz parse do corpo JSON com erro no formato único caso seja inválido.
 */
export async function parseJsonBody(
  req: Request,
  version: ContractVersion,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: number; body: ContractErrorBody; version: ContractVersion }
> {
  try {
    const text = await req.text();
    const value = text ? JSON.parse(text) : {};
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      status: 422,
      version,
      body: buildErrorBody(
        ERROR_CODES.INVALID_JSON,
        "Corpo da requisição não é um JSON válido.",
        [{ field: "(body)", message: "Malformed JSON", code: "invalid_json" }],
        version,
      ),
    };
  }
}

function safeUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
