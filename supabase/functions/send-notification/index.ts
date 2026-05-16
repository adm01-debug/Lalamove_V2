import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    
    const notificationSchema = z.object({
      alert_id: z.string().uuid().or(z.string()),
      type: z.string(),
      severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
      title: z.string(),
      message: z.string(),
      order_id: z.string().optional().nullable(),
      driver_id: z.string().optional().nullable(),
      metadata: z.record(z.any()).optional().nullable(),
    });

    const bodyResult = notificationSchema.safeParse(await req.json().catch(() => ({})));
    
    if (!bodyResult.success) {
      console.error("[Notification] Invalid request body:", bodyResult.error.format());
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { alert_id, type, severity, title, message, order_id, driver_id, metadata } = bodyResult.data;
    
    console.log(`[Notification] Sending ${severity} alert: ${type}`);
    
    // Get alert configurations for this type
    const { data: configs } = await supabase
      .from('alert_configurations')
      .select('*')
      .eq('alert_type', type)
      .eq('is_enabled', true);
    
    if (!configs || configs.length === 0) {
      console.log(`[Notification] No active configurations for: ${type}`);
      return new Response(
        JSON.stringify({ success: true, message: 'No notification channels configured' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const results: Array<{ channel: string; success: boolean; error?: string }> = [];
    
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
      };
      // WhatsApp
      const whatsappNumbers = cfg.whatsapp_numbers ?? [];
      if (cfg.notify_whatsapp && whatsappNumbers.length > 0) {
        for (const number of whatsappNumbers) {
          const result = await sendWhatsApp(number, severity, title, message, order_id, driver_id);
          results.push({ channel: `whatsapp:${number}`, ...result });
          await recordNotificationLog(supabase, alert_id, 'whatsapp', number, result.success, result.error);
        }
      }
      
      // Email
      const emailAddresses = cfg.email_addresses ?? [];
      if (cfg.notify_email && emailAddresses.length > 0) {
        for (const email of emailAddresses) {
          const result = await sendEmail(email, severity, title, message, order_id, driver_id);
          results.push({ channel: `email:${email}`, ...result });
          await recordNotificationLog(supabase, alert_id, 'email', email, result.success, result.error);
        }
      }
      
      // Slack
      const slackChannels = cfg.slack_channels ?? [];
      if (cfg.notify_slack && slackChannels.length > 0) {
        for (const channel of slackChannels) {
          const result = await sendSlack(channel, severity, title, message, order_id, driver_id);
          results.push({ channel: `slack:${channel}`, ...result });
          await recordNotificationLog(supabase, alert_id, 'slack', channel, result.success, result.error);
        }
      }
      
      // Bitrix24
      const bitrixUserIds = cfg.bitrix24_user_ids ?? [];
      if (cfg.notify_bitrix24_task && bitrixUserIds.length > 0) {
        const result = await sendBitrix24Task(supabase, bitrixUserIds, severity, title, message, order_id);
        results.push({ channel: 'bitrix24', ...result });
        await recordNotificationLog(supabase, alert_id, 'bitrix24', bitrixUserIds.join(','), result.success, result.error);
      }
      
      // N8N Webhook
      if (cfg.notify_n8n_webhook && cfg.n8n_webhook_url) {
        const result = await sendN8NWebhook(cfg.n8n_webhook_url, { type, severity, title, message, order_id, driver_id, metadata });
        results.push({ channel: 'n8n', ...result });
        await recordNotificationLog(supabase, alert_id, 'n8n', cfg.n8n_webhook_url, result.success, result.error);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`[Notification] Done: ${successCount} sent, ${failCount} failed`);
    
    return new Response(
      JSON.stringify({ success: true, results, summary: { sent: successCount, failed: failCount } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("Notification Internal Error:", error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during notification dispatch' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
    console.error('Failed to record notification:', e);
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
  
  if (!evolutionUrl || !evolutionKey) {
    console.log('[WhatsApp] Evolution API not configured');
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
    
    console.log(`[WhatsApp] Sent to ${formattedNumber}`);
    return { success: true };
  } catch (error: any) {
    console.error('[WhatsApp] Error:', error);
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
    console.log('[Email] Resend API not configured');
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
    
    console.log(`[Email] Sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Error:', error);
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
    console.log('[Slack] Webhook URL not configured');
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
    
    console.log('[Slack] Message sent');
    return { success: true };
  } catch (error: any) {
    console.error('[Slack] Error:', error);
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
    
    console.log('[Bitrix24] Task created');
    return { success: true };
  } catch (error: any) {
    console.error('[Bitrix24] Error:', error);
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
    
    console.log('[N8N] Webhook sent');
    return { success: true };
  } catch (error: any) {
    console.error('[N8N] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}
