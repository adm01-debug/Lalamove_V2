import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  buildErrorBody,
  ERROR_CODES,
  jsonResponse,
  parseJsonBody,
  resolveContractVersion,
} from "../_shared/contract.ts";
import { resolveProvider } from "./_resolver.ts";
import type { GeoRequest } from "./_types.ts";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-contract-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const version = resolveContractVersion(req);

  const parsed = await parseJsonBody(req, version);
  if (!parsed.ok) return jsonResponse(parsed.body, parsed.status, CORS, version);

  const body = parsed.value as GeoRequest;

  if (!body.action) {
    return jsonResponse(
      buildErrorBody(
        ERROR_CODES.VALIDATION_FAILED,
        "action é obrigatório",
        [{ field: "action", message: "Campo ausente", code: "required" }],
        version,
      ),
      422,
      CORS,
      version,
    );
  }

  try {
    const provider = resolveProvider(body.provider);
    const { action, provider: _p, ...params } = body;
    const result = await provider.handle(action, params, req);

    return jsonResponse(result, 200, {
      ...CORS,
      "X-Geo-Provider": provider.name,
      ...(result.cached ? { "X-Geo-Cache": "HIT" } : {}),
    }, version);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno no geo-gateway";
    const isClientError = message.includes("não suportada") ||
      message.includes("não implementada") ||
      message.includes("obrigatório");
    return jsonResponse(
      buildErrorBody(ERROR_CODES.INTERNAL_ERROR, message, [], version),
      isClientError ? 400 : 500,
      CORS,
      version,
    );
  }
});
