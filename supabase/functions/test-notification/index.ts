import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  resolveContractVersion,
  parseJsonBody,
  validateContract,
  errorResponse,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { whatsAppTestSender, WHATSAPP_TEST_MISSING_CONFIG } from "../_shared/channels/whatsapp-test.ts";
import { requireRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TestRequest {
  channel: 'whatsapp' | 'email' | 'slack' | 'bitrix24' | 'n8n';
  alertType: string;
  recipients?: string[];
  webhookUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const version = resolveContractVersion(req);
    trackContractUsage("test-notification", version);
    const parsedBody = await parseJsonBody(req, version);
    if (!parsedBody.ok) {
      return errorResponse(parsedBody, corsHeaders);
    }

    const validation = validateContract(
      getSchema("test-notification", version),
      parsedBody.value,
      version,
    );
    if (!validation.ok) {
      return errorResponse(validation, corsHeaders);
    }

    // Autorização antes de qualquer efeito colateral (o teste de I/O em CI chama
    // com a anon key esperando 422, por isso a validação de contrato vem antes).
    const auth = await requireRole(req, ["admin", "manager"], corsHeaders);
    if (auth.error) return auth.error;

    const { channel, alertType, recipients, webhookUrl } = validation.data as TestRequest;

    console.log(`[Test] Testing ${channel} notification for ${alertType}`);
    
    const testMessage = `🧪 TESTE - Alerta ${alertType}\n\nEsta é uma mensagem de teste do sistema de notificações.\n\nData/Hora: ${new Date().toLocaleString('pt-BR')}\nCanal: ${channel.toUpperCase()}`;

    let result: { success: boolean; message: string };

    switch (channel) {
      case 'whatsapp':
        result = await testWhatsApp(testMessage, recipients);
        break;
      case 'email':
        result = await testEmail(testMessage, alertType, recipients);
        break;
      case 'slack':
        result = await testSlack(testMessage, recipients);
        break;
      case 'bitrix24':
        result = await testBitrix24(testMessage, alertType);
        break;
      case 'n8n':
        result = await testN8N(testMessage, alertType, webhookUrl);
        break;
      default:
        result = { success: false, message: `Canal ${channel} não suportado` };
    }

    console.log(`[Test] ${channel} result:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Test] Error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testWhatsApp(message: string, recipients?: string[]): Promise<{ success: boolean; message: string }> {
  // O teste usa o mesmo remetente do despacho real (Zapp -> Evolution), senao
  // validar a entrega pelo painel nao prova nada sobre o canal que o motor usa.
  const sender = whatsAppTestSender();

  if (!sender) {
    return { success: false, message: WHATSAPP_TEST_MISSING_CONFIG };
  }

  if (!recipients || recipients.length === 0) {
    return { success: false, message: "Nenhum numero de WhatsApp configurado" };
  }

  const result = await sender.send(recipients[0], message);

  if (result.success) {
    const id = result.providerMessageId ? ` (id ${result.providerMessageId})` : "";
    return { success: true, message: `Mensagem de teste enviada via ${sender.name} para ${recipients[0]}${id}` };
  }

  const detail = [result.errorCode, result.action, result.error].filter(Boolean).join(" / ");
  return { success: false, message: `Erro no ${sender.name}: ${detail || "falha sem detalhe"}` };
}

async function testEmail(message: string, alertType: string, recipients?: string[]): Promise<{ success: boolean; message: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!resendApiKey) {
    return { 
      success: false, 
      message: "RESEND_API_KEY não configurado. Configure nas secrets do projeto." 
    };
  }

  if (!recipients || recipients.length === 0) {
    return { success: false, message: "Nenhum endereço de email configurado" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Alertas <onboarding@resend.dev>",
        to: recipients,
        subject: `[TESTE] Alerta: ${alertType}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>🧪 Teste de Notificação</h2>
            <p><strong>Tipo de Alerta:</strong> ${alertType}</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <hr style="margin: 20px 0;">
            <p style="color: #666;">Esta é uma mensagem de teste do sistema de alertas.</p>
          </div>
        `,
      }),
    });

    if (response.ok) {
      return { success: true, message: `Email de teste enviado para ${recipients.join(', ')}` };
    } else {
      const errorData = await response.json();
      return { success: false, message: `Erro Resend: ${errorData.message || 'Erro desconhecido'}` };
    }
  } catch (error: any) {
    return { success: false, message: `Erro ao conectar: ${error.message}` };
  }
}

async function testSlack(message: string, channels?: string[]): Promise<{ success: boolean; message: string }> {
  const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

  if (!slackWebhookUrl) {
    return { 
      success: false, 
      message: "SLACK_WEBHOOK_URL não configurado. Configure nas secrets do projeto." 
    };
  }

  try {
    const response = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message,
        channel: channels?.[0] || undefined,
      }),
    });

    if (response.ok) {
      return { success: true, message: `Mensagem de teste enviada para Slack${channels?.[0] ? ` (${channels[0]})` : ''}` };
    } else {
      const errorText = await response.text();
      return { success: false, message: `Erro Slack: ${errorText}` };
    }
  } catch (error: any) {
    return { success: false, message: `Erro ao conectar: ${error.message}` };
  }
}

async function testBitrix24(message: string, alertType: string): Promise<{ success: boolean; message: string }> {
  // Bitrix24 requires OAuth tokens - just check if configured
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.3");
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokens } = await supabase
    .from("bitrix24_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!tokens || tokens.length === 0) {
    return { 
      success: false, 
      message: "Nenhum token Bitrix24 configurado. Configure a integração OAuth primeiro." 
    };
  }

  const token = tokens[0];
  
  try {
    const response = await fetch(`https://${token.domain}/rest/task.item.add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth: token.access_token,
        fields: {
          TITLE: `[TESTE] Alerta: ${alertType}`,
          DESCRIPTION: message,
          RESPONSIBLE_ID: 1,
          PRIORITY: 1,
        },
      }),
    });

    if (response.ok) {
      return { success: true, message: "Tarefa de teste criada no Bitrix24" };
    } else {
      return { success: false, message: "Erro ao criar tarefa no Bitrix24. Token pode estar expirado." };
    }
  } catch (error: any) {
    return { success: false, message: `Erro ao conectar: ${error.message}` };
  }
}

async function testN8N(message: string, alertType: string, webhookUrl?: string): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl) {
    return { 
      success: false, 
      message: "Nenhuma URL de webhook N8N configurada" 
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "TEST",
        alertType,
        message,
        timestamp: new Date().toISOString(),
        isTest: true,
      }),
    });

    if (response.ok) {
      return { success: true, message: `Webhook N8N acionado com sucesso` };
    } else {
      return { success: false, message: `Erro ao chamar webhook: ${response.status} ${response.statusText}` };
    }
  } catch (error: any) {
    return { success: false, message: `Erro ao conectar: ${error.message}` };
  }
}
