// ============================================================================
// telemetry-csp-report — coletor das violações de Content-Security-Policy.
//
// Chamado pelo navegador via `report-uri` do header
// `Content-Security-Policy-Report-Only` de `vercel.json`. É público por
// natureza: o navegador não anexa JWT em relatório de CSP, daí
// `verify_jwt = false` em `supabase/config.toml`.
//
// Garantias:
//  - corpo limitado a 8 KB (acima disso: 413), nada é persistido (sem DDL);
//  - limite por IP em memória (120/min) para não inundar o log;
//  - payload inválido nunca vira erro para o navegador (sempre 204);
//  - o log leva apenas diretiva, disposição, host bloqueado e caminho.
// ============================================================================

import { createRateLimiter, MAX_BODY_BYTES, summarize } from "./report.ts";

const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

const acceptReports = createRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

const noContent = (): Response => new Response(null, { status: 204 });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!acceptReports(ip)) return new Response(null, { status: 429 });

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  for (const summary of summarize(body)) {
    console.warn(`[csp_report] ${JSON.stringify(summary)}`);
  }

  return noContent();
});