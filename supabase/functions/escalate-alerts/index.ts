import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logger } from "../_shared/logger.ts";
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const allowedOrigins = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((o) => o.trim()) || ["*"];

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PendingEscalation {
  alert_id: string;
  alert_type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  order_id: string | null;
  driver_id: string | null;
  created_at: string;
  escalation_after_seconds: number;
}

/**
 * Escalation worker.
 * Scheduled (pg_cron) invocation that finds unacknowledged CRITICAL/WARNING
 * alerts whose escalation window has elapsed and re-dispatches them through the
 * escalation recipients configured per alert type. Designed to be idempotent:
 * send-notification stamps `escalated_at`, and get_pending_escalations only
 * returns alerts that have not yet been escalated or acknowledged.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
    // Contrato de entrada (formato único de erro 422 + versão v1/v2):
    // supabase/functions/_shared/contract.ts e _shared/schemas.ts.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("escalate-alerts", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("escalate-alerts", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("get_pending_escalations");
    if (error) {
      logger.error("[Escalate] Failed to load pending escalations:", error);
      return new Response(
        JSON.stringify({ error: "Failed to load pending escalations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pending = (data ?? []) as PendingEscalation[];
    logger.log(`[Escalate] ${pending.length} alert(s) pending escalation`);

    const results: Array<{ alert_id: string; escalated: boolean; error?: string }> = [];

    for (const alert of pending) {
      try {
        const { error: invokeError } = await supabase.functions.invoke("send-notification", {
          body: {
            alert_id: alert.alert_id,
            type: alert.alert_type,
            severity: alert.severity,
            title: `[ESCALONADO] ${alert.title}`,
            message: `${alert.message}\n\n⏫ Este alerta não foi reconhecido dentro do prazo de ${alert.escalation_after_seconds}s e foi escalonado automaticamente.`,
            order_id: alert.order_id,
            driver_id: alert.driver_id,
            is_escalation: true,
          },
        });

        if (invokeError) {
          logger.error(`[Escalate] Failed for ${alert.alert_id}:`, invokeError);
          results.push({ alert_id: alert.alert_id, escalated: false, error: invokeError.message });
        } else {
          results.push({ alert_id: alert.alert_id, escalated: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        logger.error(`[Escalate] Exception for ${alert.alert_id}:`, e);
        results.push({ alert_id: alert.alert_id, escalated: false, error: msg });
      }
    }

    const escalated = results.filter((r) => r.escalated).length;
    logger.log(`[Escalate] Done: ${escalated}/${pending.length} escalated`);

    return new Response(
      JSON.stringify({ success: true, pending: pending.length, escalated, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    logger.error("[Escalate] Internal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
