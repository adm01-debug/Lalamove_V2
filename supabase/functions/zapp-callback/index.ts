/**
 * Etapa 96 do plano de mensageria: edge `zapp-callback`.
 *
 * Recebe os tres eventos do Zapp (etapas 15, 16 e 68), verifica a assinatura
 * HMAC com janela anti-replay e grava no ledger `notification_messages`.
 * Responde 2xx rapido: o Zapp reenfileira em qualquer nao-2xx, e um erro nosso
 * de banco nao pode virar uma fila de retentativas identicas.
 *
 * Tambem expoe a rota de leitura do cartao do pedido (etapa 67), autenticada
 * pela mesma chave: `GET .../zapp-callback?order_id=<uuid>`.
 *
 * O `serve()` roda no import, entao toda a logica testavel vive em
 * `security.ts`, `payload.ts` e `ledger.ts`; aqui fica so o cabeamento HTTP.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";
import { verifyCallbackSignature } from "./security.ts";
import { parseCallback } from "./payload.ts";
import { applyCallback, type LedgerClient } from "./ledger.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("ZAPP_CALLBACK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    logger.error("[zapp-callback] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
    return json({ error: "server_misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const ledger = supabase as unknown as LedgerClient;

  // ── Etapa 67: leitura do cartao do pedido ────────────────────────────────
  if (req.method === "GET") {
    const auth = req.headers.get("authorization") ?? "";
    const apiKey = req.headers.get("x-zapp-key") ?? "";
    if (!secret || (apiKey !== secret && auth !== `Bearer ${secret}`)) {
      return json({ error: "unauthorized" }, 401);
    }
    const orderId = new URL(req.url).searchParams.get("order_id");
    if (!orderId) return json({ error: "order_id_obrigatorio" }, 400);
    const { data, error } = await supabase
      .from("notification_messages")
      .select("id,event,role,direction,channel,status,body_preview,created_at,metadata")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      logger.error("[zapp-callback] falha ao ler ledger:", error.message);
      return json({ error: "query_falhou" }, 500);
    }
    return json({ messages: data ?? [] });
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // A assinatura cobre o corpo cru - ler o texto ANTES de qualquer parse.
  const rawBody = await req.text();

  const verified = await verifyCallbackSignature({
    secret,
    rawBody,
    header: req.headers.get("x-zapp-signature"),
  });
  if (!verified.valid) {
    // 401 sem detalhe do motivo no corpo: o motivo vai para o log, nao para o
    // chamador (quem forjou a assinatura nao precisa de dica).
    logger.error("[zapp-callback] assinatura rejeitada:", verified.reason);
    return json({ error: "unauthorized" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "json_invalido" }, 400);
  }

  const write = parseCallback(payload);
  if (write.ignore) {
    // 200 de proposito: evento que nao sabemos tratar nao pode ser reenviado
    // eternamente. Fica registrado no log para diagnostico.
    logger.log("[zapp-callback] evento ignorado:", write.ignoreReason);
    return json({ ok: true, ignored: write.ignoreReason });
  }

  const senderPhone = typeof (payload as Record<string, unknown>)?.from === "string"
    ? String((payload as Record<string, unknown>).from)
    : null;

  const result = await applyCallback({ client: ledger, write, senderPhone });
  logger.log("[zapp-callback]", result.outcome, result.reason ?? "");
  return json({ ok: true, outcome: result.outcome, message_id: result.messageId });
});