import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logger } from "../_shared/logger.ts";
import {
  resolveContractVersion,
  parseJsonBody,
  validateContract,
  errorResponse,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { missingTemplateVars, renderTemplate, type TemplateVars } from "../_shared/template.ts";
import {
  QUIET_HOURS_ALERT_TYPES,
  isWithinQuietHours,
  nextAllowedTime,
  type QuietHours,
} from "./quiet-hours.ts";
import { zappChannelFromEnv } from "../_shared/channels/zapp.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// verify_jwt=true so a valid JWT is required, but that includes ordinary
// authenticated users, not just internal service_role callers. metadata.recipients
// lets the caller pick an arbitrary destination, so it must be restricted to
// service_role (the other edge functions that call send-notification already use it).
function isServiceRoleCaller(req: Request): boolean {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch { return false; }
}

/** Arredonda o resultado de um envio para o status persistido em `order_geo_events`. */
function geoDeliveryStatus(results: Array<{ success: boolean }>): string {
  if (results.length === 0) return "no_recipient";
  return results.some(r => r.success) ? "sent" : "failed";
}

/** Carrega a janela de horário permitido (`geo_defaults`, linha única `id=true`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadQuietHours(supabase: any): Promise<QuietHours | null> {
  const { data, error } = await supabase
    .from("geo_defaults")
    .select("quiet_hours_start, quiet_hours_end, quiet_hours_tz")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    start: String(data.quiet_hours_start),
    end: String(data.quiet_hours_end),
    tz: data.quiet_hours_tz,
  };
}

interface NotificationRequest {
  alert_id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  order_id?: string;
  driver_id?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const version = resolveContractVersion(req);
    trackContractUsage("send-notification", version);
    const parsedBody = await parseJsonBody(req, version);
    if (!parsedBody.ok) {
      return errorResponse(parsedBody, corsHeaders);
    }

    const validation = validateContract(
      getSchema("send-notification", version),
      parsedBody.value,
      version,
    );
    if (!validation.ok) {
      logger.error("[Notification] Invalid request body:", validation.body.error.fields);
      return errorResponse(validation, corsHeaders);
    }

    const { alert_id, type, severity, title, message, order_id, driver_id } =
      validation.data as {
        alert_id: string;
        type: string;
        severity: "INFO" | "WARNING" | "CRITICAL";
        title: string;
        message: string;
        order_id?: string | null;
        driver_id?: string | null;
      };
    const extra = validation.data as {
      metadata?: Record<string, unknown> | null;
      dedup_key?: string | null;
      skip_dedup?: boolean | null;
      is_escalation?: boolean | null;
    };
    const metadata = extra.metadata;
    const isEscalation = extra.is_escalation === true;

    logger.log(`[Notification] Sending ${severity} alert: ${type}${isEscalation ? " (ESCALATION)" : ""}`);

    // ── Deduplication ──────────────────────────────────────────────────────
    // Escalations always bypass dedup (they are intentional re-sends).
    if (!isEscalation && extra.skip_dedup !== true) {
      const dedupKey = extra.dedup_key ||
        `${type}:${order_id ?? driver_id ?? "global"}:${severity}`;
      const { data: dedupRows, error: dedupError } = await supabase.rpc(
        "claim_alert_notification",
        { p_dedup_key: dedupKey, p_alert_type: type, p_window_seconds: 300 },
      );
      if (dedupError) {
        logger.error("[Notification] Dedup RPC failed, proceeding:", dedupError);
      } else {
        const claim = Array.isArray(dedupRows) ? dedupRows[0] : dedupRows;
        if (claim && claim.should_send === false) {
          logger.log(`[Notification] Suppressed by dedup: ${dedupKey} (x${claim.occurrence_count})`);
          await recordGeoEventStatus(supabase, metadata, "skipped");
          return new Response(
            JSON.stringify({
              success: true,
              suppressed: true,
              dedup_key: dedupKey,
              occurrence_count: claim.occurrence_count,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // ── Horário de silêncio (D3) ────────────────────────────────────────────
    // Alertas geo-disparados para o fornecedor/cliente não saem fora de
    // 07:00-20:00 America/Sao_Paulo (docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md,
    // etapa 58). Em vez de descartar, reenfileira em job_queue para o próximo
    // horário permitido — o cron `process-job-queue` (1 min) chama este mesmo
    // endpoint de novo quando `next_retry_at` vencer. `metadata.always_send`
    // (motorista chegou, gravado por `geo_emit_event`) e escalonamento
    // (`is_escalation`) sempre furam a janela.
    if (QUIET_HOURS_ALERT_TYPES.has(type) && metadata?.always_send !== true && !isEscalation) {
      const quietHours = await loadQuietHours(supabase);
      if (quietHours && !isWithinQuietHours(new Date(), quietHours)) {
        const runAt = nextAllowedTime(new Date(), quietHours);
        const { error: deferError } = await supabase.from("job_queue").insert({
          type: "notification",
          payload: { alert_id, type, severity, title, message, order_id, driver_id, metadata },
          priority: 3,
          max_attempts: 3,
          dedup_key: `deferred:${alert_id}`,
          next_retry_at: runAt.toISOString(),
          metadata: { source: "send-notification:quiet_hours", deferred_from: new Date().toISOString() },
        });
        // 23505 = já existe reenvio pendente para este alerta (dedup_key) — não é erro.
        if (deferError && (deferError as { code?: string }).code !== "23505") {
          logger.error("[Notification] Falha ao reenfileirar fora do horário de silêncio:", deferError);
        } else {
          logger.log(`[Notification] ${type} fora do horário de silêncio — reenfileirado para ${runAt.toISOString()}`);
        }
        await recordGeoEventStatus(supabase, metadata, "deferred");
        return new Response(
          JSON.stringify({ success: true, deferred: true, run_at: runAt.toISOString() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const results: Array<{ channel: string; success: boolean; error?: string }> = [];

    // Dispatch a single channel to a single recipient, logging the outcome.
    const dispatch = async (
      channel: string,
      recipient: string,
      effectiveMessage: string = message,
    ): Promise<{ success: boolean; error?: string }> => {
      let result: { success: boolean; error?: string };
      switch (channel) {
        case "whatsapp":
          result = await sendWhatsApp(recipient, severity, title, effectiveMessage, order_id, driver_id);
          break;
        case "email":
          result = await sendEmail(recipient, severity, title, effectiveMessage, order_id, driver_id);
          break;
        case "slack":
          result = await sendSlack(recipient, severity, title, effectiveMessage, order_id, driver_id);
          break;
        case "n8n":
          result = await sendN8NWebhook(recipient, { type, severity, title, message: effectiveMessage, order_id, driver_id, metadata });
          break;
        default:
          result = { success: false, error: `Unsupported channel: ${channel}` };
      }
      results.push({ channel: `${channel}:${recipient}`, ...result });
      await recordNotificationLog(supabase, alert_id, channel, recipient, result.success, result.error);
      return result;
    };

    // Get alert configurations for this type. Fetch all rows (not just
    // is_enabled=true) so we can tell "channel explicitly disabled" apart
    // from "no config exists for this type" below.
    const { data: allConfigsForType, error: configsError } = await supabase
      .from('alert_configurations')
      .select('*')
      .eq('alert_type', type);

    if (configsError) {
      logger.error(`[Notification] Failed to load alert_configurations for ${type}:`, configsError);
    }

    const configRows = (allConfigsForType ?? []) as Array<Record<string, unknown>>;
    const notifyFieldByChannel: Record<string, string> = {
      whatsapp: 'notify_whatsapp',
      email: 'notify_email',
      slack: 'notify_slack',
      bitrix24: 'notify_bitrix24_task',
      n8n: 'notify_n8n_webhook',
    };
    // A channel is "explicitly disabled" when configs exist for this alert type
    // but none of them has it enabled — distinct from no config existing at all.
    const isChannelDisabled = (channel: string): boolean => {
      const field = notifyFieldByChannel[channel];
      if (!field || configRows.length === 0) return false;
      return !configRows.some((c) => c.is_enabled === true && c[field] === true);
    };

    // ── Variáveis de template (etapa 67 do plano Google) ───────────────────
    // `geo_evaluate_tracking` grava em metadata tudo que o template precisa
    // (order_ref, driver_*, share_link, endereços, distance_m, eta_min) e o
    // nome do contato em metadata.recipients[0].name. Sem isso o operador
    // editava `alert_configurations.message_template` na UI e o texto enviado
    // continuava sendo o do trigger.
    const templateVars: TemplateVars = {};
    if (metadata && typeof metadata === 'object') {
      const md = metadata as Record<string, unknown>;
      for (const key of [
        'order_ref', 'driver_name', 'driver_plate', 'share_link',
        'pickup_address', 'delivery_address', 'static_map_url',
      ]) {
        const v = md[key];
        if (typeof v === 'string' || typeof v === 'number') templateVars[key as never] = v as never;
      }
      if (typeof md.distance_m === 'number') templateVars.distance_m = md.distance_m;
      if (typeof md.eta_min === 'number') templateVars.eta_min = md.eta_min;
      const r0 = Array.isArray(md.recipients) ? md.recipients[0] : null;
      if (r0 && typeof r0 === 'object') {
        const role = (r0 as Record<string, unknown>).role;
        const name = (r0 as Record<string, unknown>).name;
        if (typeof name === 'string' && name) {
          if (role === 'delivery_contact') templateVars.delivery_contact_name = name;
          else templateVars.pickup_contact_name = name;
        }
      }
    }

    // Template de nivel de tipo, usado nos destinatarios ad-hoc (metadata.recipients),
    // que nao tem linha de config propria para consultar.
    const typeTemplate = configRows
      .map((c) => c.message_template)
      .find((t): t is string => typeof t === 'string' && t.trim() !== '') ?? null;
    const adHocMessage = typeTemplate ? renderTemplate(typeTemplate, templateVars) : message;

    // Ad-hoc recipients supplied by the caller (e.g. the geo-foundation
    // trigger notifying an order's pickup/delivery contact, or
    // check-driver-alerts notifying a supplier). Independent of
    // alert_configurations, since these recipients vary per request and
    // have no reason to live in a static per-type config row — but an
    // operator-disabled channel still wins over an ad-hoc recipient.
    // Contract: metadata.recipients = [{ channel: string, to: string, ... }]
    const metadataRecipients = isServiceRoleCaller(req) && Array.isArray(metadata?.recipients)
      ? metadata.recipients
      : [];
    for (const r of metadataRecipients) {
      if (r && typeof r === 'object' && typeof (r as Record<string, unknown>).channel === 'string' && typeof (r as Record<string, unknown>).to === 'string') {
        const channel = (r as { channel: string }).channel;
        if (isChannelDisabled(channel)) {
          logger.log(`[Notification] Ad-hoc recipient skipped: ${channel} disabled by alert_configurations for ${type}`);
          continue;
        }
        await dispatch(channel, (r as { to: string }).to, adHocMessage);
      } else if (r && typeof r === 'object') {
        // Sem `to` (o trigger geo grava `to: null` quando o pedido não tem
        // telefone de contato): não há como enviar, mas o descarte precisa ser
        // visível — antes ele era silencioso e o alerta morria sem rastro.
        logger.log(`[Notification] Ad-hoc recipient ignored (no destination): ${JSON.stringify(r)}`);
      }
    }

    const configs = configRows.filter((c) => c.is_enabled);

    if (!configs || configs.length === 0) {
      logger.log(`[Notification] No active configurations for: ${type}`);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      // Sem linha ativa em alert_configurations o alerta não sai por canal nenhum.
      // Antes isso retornava success:true sem deixar rastro e o alerta morria em
      // silêncio em `alerts` (foi o caso de 1.306 INTEGRATION_FAILURE sem entrega).
      if (successCount === 0) {
        await recordNotificationLog(
          supabase,
          alert_id,
          'none',
          '',
          false,
          `Sem canal de notificação ativo em alert_configurations para ${type}`,
        );
      }
      await recordGeoEventStatus(supabase, metadata, geoDeliveryStatus(results));
      return new Response(
        JSON.stringify({ success: true, message: 'No notification channels configured', results, summary: { sent: successCount, failed: failCount } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const config of configs) {
      const cfg = config as {
        notify_whatsapp?: boolean;
        whatsapp_numbers?: string[];
        notify_email?: boolean;
        email_addresses?: string[];
        notify_slack?: boolean;
        slack_channels?: string[];
        notify_bitrix24_task?: boolean;
        bitrix24_user_ids?: number[];
        notify_n8n_webhook?: boolean;
        n8n_webhook_url?: string;
        escalation_email_addresses?: string[];
        escalation_whatsapp_numbers?: string[];
        escalation_slack_channels?: string[];
        fallback_channel?: string | null;
        fallback_recipients?: string[];
        message_template?: string | null;
      };

      // Template editado pelo operador vence o texto montado pelo trigger.
      // Placeholder sem valor é preservado (renderTemplate) e logado abaixo,
      // para o operador ver o gap em vez de receber "undefined" no WhatsApp.
      let effectiveMessage = message;
      if (typeof cfg.message_template === 'string' && cfg.message_template.trim() !== '') {
        effectiveMessage = renderTemplate(cfg.message_template, templateVars);
        const missing = missingTemplateVars(cfg.message_template, templateVars);
        if (missing.length > 0) {
          logger.log(`[Notification] Template de ${type} sem valor para: ${missing.join(', ')}`);
        }
      }

      // On escalation, prefer escalation recipients (fall back to normal ones).
      const whatsappNumbers = isEscalation
        ? (cfg.escalation_whatsapp_numbers?.length ? cfg.escalation_whatsapp_numbers : (cfg.whatsapp_numbers ?? []))
        : (cfg.whatsapp_numbers ?? []);
      const emailAddresses = isEscalation
        ? (cfg.escalation_email_addresses?.length ? cfg.escalation_email_addresses : (cfg.email_addresses ?? []))
        : (cfg.email_addresses ?? []);
      const slackChannels = isEscalation
        ? (cfg.escalation_slack_channels?.length ? cfg.escalation_slack_channels : (cfg.slack_channels ?? []))
        : (cfg.slack_channels ?? []);

      let anyAttempted = false;
      let anySucceeded = false;

      // WhatsApp
      if (cfg.notify_whatsapp && whatsappNumbers.length > 0) {
        for (const number of whatsappNumbers) {
          anyAttempted = true;
          const r = await dispatch("whatsapp", number, effectiveMessage);
          anySucceeded = anySucceeded || r.success;
        }
      }

      // Email
      if (cfg.notify_email && emailAddresses.length > 0) {
        for (const email of emailAddresses) {
          anyAttempted = true;
          const r = await dispatch("email", email, effectiveMessage);
          anySucceeded = anySucceeded || r.success;
        }
      }

      // Slack
      if (cfg.notify_slack && slackChannels.length > 0) {
        for (const channel of slackChannels) {
          anyAttempted = true;
          const r = await dispatch("slack", channel, effectiveMessage);
          anySucceeded = anySucceeded || r.success;
        }
      }

      // Bitrix24
      const bitrixUserIds = cfg.bitrix24_user_ids ?? [];
      if (cfg.notify_bitrix24_task && bitrixUserIds.length > 0) {
        anyAttempted = true;
        const result = await sendBitrix24Task(supabase, bitrixUserIds, severity, title, effectiveMessage, order_id);
        results.push({ channel: 'bitrix24', ...result });
        await recordNotificationLog(supabase, alert_id, 'bitrix24', bitrixUserIds.join(','), result.success, result.error);
        anySucceeded = anySucceeded || result.success;
      }

      // N8N Webhook
      if (cfg.notify_n8n_webhook && cfg.n8n_webhook_url) {
        anyAttempted = true;
        const r = await dispatch("n8n", cfg.n8n_webhook_url, effectiveMessage);
        anySucceeded = anySucceeded || r.success;
      }

      // ── Fallback channel ────────────────────────────────────────────────
      // When every configured channel failed (or none was configured but a
      // fallback exists), attempt the contingency channel so alerts are not lost.
      const needFallback = (anyAttempted && !anySucceeded) || (!anyAttempted);
      if (needFallback && cfg.fallback_channel) {
        const fallbackRecipients = cfg.fallback_recipients ?? [];
        if (fallbackRecipients.length > 0) {
          logger.log(`[Notification] Triggering fallback channel: ${cfg.fallback_channel}`);
          for (const recipient of fallbackRecipients) {
            await dispatch(cfg.fallback_channel, recipient, effectiveMessage);
          }
        } else {
          logger.log('[Notification] Fallback channel set but no recipients configured');
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Configuração ativa, porém nenhum canal com destinatário (ex.: notify_whatsapp
    // ligado e whatsapp_numbers vazio, e-mail/slack/n8n desligados): nada foi
    // enviado. Registra o motivo em alerts_sent para o alerta não sumir sem rastro.
    if (successCount === 0 && failCount === 0) {
      await recordNotificationLog(
        supabase,
        alert_id,
        'none',
        '',
        false,
        `Configuração ativa para ${type} sem canal com destinatário — nada foi enviado`,
      );
    }

    // Mark the alert as escalated so the escalation worker does not re-process it.
    if (isEscalation) {
      await supabase
        .from('alerts')
        .update({ escalated_at: new Date().toISOString(), escalation_level: 1 })
        .eq('id', alert_id);
    }

    logger.log(`[Notification] Done: ${successCount} sent, ${failCount} failed`);

    await recordGeoEventStatus(supabase, metadata, geoDeliveryStatus(results));

    return new Response(
      JSON.stringify({ success: true, escalation: isEscalation, results, summary: { sent: successCount, failed: failCount } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    
  } catch (error: unknown) {
    logger.error("Notification Internal Error:", error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Contrato com o trigger geo (`geo_emit_event`): o evento nasce com
// `notification_status='queued'` e nada o atualizava — ficava "queued" para
// sempre, mesmo depois de o send-notification rodar. Fechamos o ciclo aqui,
// só quando o chamador informou `geo_event_id` no metadata (caminho do trigger).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordGeoEventStatus(
  supabase: any,
  metadata: Record<string, unknown> | null | undefined,
  status: string
): Promise<void> {
  const geoEventId = metadata?.geo_event_id;
  if (typeof geoEventId !== "string") return;
  try {
    await supabase
      .from("order_geo_events")
      .update({ notification_status: status, notified_at: new Date().toISOString() })
      .eq("id", geoEventId)
      .eq("notification_status", "queued");
  } catch (e) {
    logger.error("Failed to update order_geo_events status:", e);
  }
}

// Record notification in DB - using any for supabase client to avoid type conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordNotificationLog(
  supabase: any,
  alertId: string,
  channel: string,
  recipient: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from('alerts_sent').insert({
      alert_id: alertId,
      channel,
      recipient,
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
      error_message: errorMessage,
    });
  } catch (e) {
    logger.error('Failed to record notification:', e);
  }
}

// Keep original function for compatibility
async function recordNotification(
  supabase: ReturnType<typeof createClient>,
  alertId: string,
  channel: string,
  recipient: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await recordNotificationLog(supabase, alertId, channel, recipient, success, errorMessage);
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '🚨';
    case 'WARNING': return '⚠️';
    case 'INFO': return 'ℹ️';
    default: return '📢';
  }
}

// WhatsApp via Evolution API
async function sendWhatsApp(
  number: string,
  severity: string,
  title: string,
  message: string,
  orderId?: string,
  driverId?: string
): Promise<{ success: boolean; error?: string }> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "lalamove";
  
  // Etapa 69 do plano Google Maps: o Zapp (WhatsApp Web da Promo Brindes) entra
  // como canal preferencial quando `ZAPP_API_URL`/`ZAPP_API_KEY` existem. Sem os
  // secrets o factory devolve null e o Evolution continua sendo o caminho —
  // nenhum dos dois configurado é o único caso de falha.
  const zapp = zappChannelFromEnv();
  if (zapp) {
    const emoji = getSeverityEmoji(severity);
    const text = `${emoji} *${title}*\n\n${message}\n\n` +
      (orderId ? `📦 *Pedido:* ${orderId}\n` : '') +
      (driverId ? `🚗 *Motorista:* ${driverId}\n` : '') +
      `\n⏰ ${new Date().toLocaleString('pt-BR')}`;
    const zappResult = await zapp.sendText(number, text);
    if (zappResult.success) {
      logger.log(`[WhatsApp] Sent via Zapp to ${number.replace(/\D/g, '')}`);
    } else {
      logger.error('[WhatsApp] Erro no Zapp:', zappResult.error);
    }
    return zappResult;
  }

  if (!evolutionUrl || !evolutionKey) {
    logger.log('[WhatsApp] Evolution API not configured');
    return { success: false, error: 'Evolution API not configured' };
  }
  
  try {
    const emoji = getSeverityEmoji(severity);
    const formattedNumber = number.replace(/\D/g, '');
    
    const text = `${emoji} *${title}*\n\n${message}\n\n` +
      (orderId ? `📦 *Pedido:* ${orderId}\n` : '') +
      (driverId ? `🚗 *Motorista:* ${driverId}\n` : '') +
      `\n⏰ ${new Date().toLocaleString('pt-BR')}`;
    
    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
      body: JSON.stringify({ number: formattedNumber, text }),
    });
    
    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.statusText}`);
    }
    
    logger.log(`[WhatsApp] Sent to ${formattedNumber}`);
    return { success: true };
  } catch (error: any) {
    logger.error('[WhatsApp] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Email via Resend
async function sendEmail(
  email: string,
  severity: string,
  title: string,
  message: string,
  orderId?: string,
  driverId?: string
): Promise<{ success: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  
  if (!resendKey) {
    logger.log('[Email] Resend API not configured');
    return { success: false, error: 'Resend API not configured' };
  }
  
  try {
    const colorMap: Record<string, string> = {
      'CRITICAL': '#dc2626',
      'WARNING': '#f59e0b',
      'INFO': '#3b82f6',
    };
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${colorMap[severity] || '#3b82f6'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${getSeverityEmoji(severity)} ${title}</h1>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; line-height: 1.6; margin: 0 0 16px 0;">${message}</p>
          ${orderId ? `<p style="color: #6b7280; margin: 4px 0;"><strong>Pedido:</strong> ${orderId}</p>` : ''}
          ${driverId ? `<p style="color: #6b7280; margin: 4px 0;"><strong>Motorista:</strong> ${driverId}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">Enviado em: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>
    `;
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || 'Alertas <noreply@resend.dev>',
        to: [email],
        subject: `[${severity}] ${title}`,
        html,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Resend error: ${response.statusText}`);
    }
    
    logger.log(`[Email] Sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    logger.error('[Email] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Slack webhook
async function sendSlack(
  webhookUrl: string,
  severity: string,
  title: string,
  message: string,
  orderId?: string,
  driverId?: string
): Promise<{ success: boolean; error?: string }> {
  let url = webhookUrl;
  if (!url.startsWith('http')) {
    url = Deno.env.get("SLACK_WEBHOOK_URL") || '';
  }
  
  if (!url) {
    logger.log('[Slack] Webhook URL not configured');
    return { success: false, error: 'Slack webhook not configured' };
  }
  
  try {
    const colorMap: Record<string, string> = {
      'CRITICAL': '#dc2626',
      'WARNING': '#f59e0b',
      'INFO': '#3b82f6',
    };
    
    const payload = {
      attachments: [{
        color: colorMap[severity] || '#6b7280',
        title: `${getSeverityEmoji(severity)} ${title}`,
        text: message,
        fields: [
          ...(orderId ? [{ title: 'Pedido', value: orderId, short: true }] : []),
          ...(driverId ? [{ title: 'Motorista', value: driverId, short: true }] : []),
          { title: 'Severidade', value: severity, short: true },
        ],
        footer: 'Sistema de Alertas Lalamove',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Slack error: ${response.statusText}`);
    }
    
    logger.log('[Slack] Message sent');
    return { success: true };
  } catch (error: any) {
    logger.error('[Slack] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Bitrix24 Task
async function sendBitrix24Task(
  supabase: any,
  userIds: number[],
  severity: string,
  title: string,
  message: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: tokenData } = await supabase
      .from('bitrix24_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!tokenData) {
      return { success: false, error: 'Bitrix24 not connected' };
    }
    
    const token = tokenData as { access_token: string; domain: string };
    const priorityMap: Record<string, number> = { 'CRITICAL': 2, 'WARNING': 1, 'INFO': 0 };
    
    const taskData = {
      fields: {
        TITLE: `[${severity}] ${title}`,
        DESCRIPTION: message + (orderId ? `\n\nPedido: ${orderId}` : ''),
        RESPONSIBLE_ID: userIds[0] || 1,
        ACCOMPLICES: userIds.slice(1),
        PRIORITY: priorityMap[severity] || 0,
        DEADLINE: new Date(Date.now() + (severity === 'CRITICAL' ? 3600000 : 86400000)).toISOString(),
      },
    };
    
    const response = await fetch(
      `https://${token.domain}/rest/tasks.task.add?auth=${token.access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Bitrix24 error: ${response.statusText}`);
    }
    
    logger.log('[Bitrix24] Task created');
    return { success: true };
  } catch (error: any) {
    logger.error('[Bitrix24] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// N8N Webhook
async function sendN8NWebhook(
  webhookUrl: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: 'N8N webhook URL not configured' };
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, timestamp: new Date().toISOString(), source: 'lalamove-alerts' }),
    });
    
    if (!response.ok) {
      throw new Error(`N8N error: ${response.statusText}`);
    }
    
    logger.log('[N8N] Webhook sent');
    return { success: true };
  } catch (error: any) {
    logger.error('[N8N] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}
