import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logger } from "../_shared/logger.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NewDeviceAlertRequest {
  userId: string;
  userEmail: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  browser?: string;
  os?: string;
  locationCity?: string;
  locationCountry?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const deviceAlertSchema = z.object({
      userId: z.string().uuid().or(z.string()),
      userEmail: z.string().email(),
      deviceFingerprint: z.string(),
      ipAddress: z.string(),
      userAgent: z.string(),
      browser: z.string().optional().nullable(),
      os: z.string().optional().nullable(),
      locationCity: z.string().optional().nullable(),
      locationCountry: z.string().optional().nullable(),
    });

    const bodyResult = deviceAlertSchema.safeParse(await req.json().catch(() => ({})));
    if (!bodyResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      userId,
      userEmail,
      deviceFingerprint,
      ipAddress,
      userAgent,
      browser,
      os,
      locationCity,
      locationCountry,
    } = bodyResult.data;

    logger.log(`Checking device for user ${userId}, fingerprint: ${deviceFingerprint}`);

    // Check if device is known
    const { data: isKnown } = await supabase.rpc("is_known_device", {
      _user_id: userId,
      _fingerprint: deviceFingerprint,
    });

    if (isKnown) {
      logger.log("Device is known, updating last seen");
      
      // Update last seen
      await supabase
        .from("user_devices")
        .update({ 
          last_seen_at: new Date().toISOString(),
          ip_address: ipAddress 
        })
        .eq("user_id", userId)
        .eq("device_fingerprint", deviceFingerprint);

      return new Response(
        JSON.stringify({ message: "Device is known", isNewDevice: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    logger.log("New device detected, registering and sending alert");

    // Register new device
    const { data: newDevice, error: deviceError } = await supabase
      .from("user_devices")
      .insert({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        ip_address: ipAddress,
        user_agent: userAgent,
        browser: browser || "Unknown",
        os: os || "Unknown",
        location_city: locationCity,
        location_country: locationCountry,
        is_trusted: false,
      })
      .select()
      .single();

    if (deviceError) {
      logger.error("Error registering device:", deviceError);
      throw deviceError;
    }

    // Create alert record
    const { error: alertError } = await supabase.from("new_device_alerts").insert({
      user_id: userId,
      device_id: newDevice.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      email_sent: false,
    });

    if (alertError) {
      logger.error("Error creating alert record:", alertError);
    }

    // Send email notification
    const loginTime = new Date().toLocaleString("pt-BR", { 
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short"
    });

    const locationInfo = locationCity && locationCountry 
      ? `${locationCity}, ${locationCountry}` 
      : "Localização desconhecida";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
          .alert-box h2 { color: #dc2626; margin: 0 0 10px 0; font-size: 18px; }
          .device-info { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .device-info table { width: 100%; border-collapse: collapse; }
          .device-info td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .device-info td:first-child { color: #6b7280; width: 140px; }
          .device-info td:last-child { color: #111827; font-weight: 500; }
          .device-info tr:last-child td { border-bottom: none; }
          .cta { text-align: center; margin: 30px 0; }
          .cta a { display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; }
          .footer { background: #f9fafb; padding: 20px 30px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Alerta de Segurança</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <h2>⚠️ Novo dispositivo detectado</h2>
              <p>Detectamos um login na sua conta a partir de um dispositivo que não reconhecemos.</p>
            </div>
            
            <p>Se foi você, pode ignorar este email. Caso contrário, recomendamos que altere sua senha imediatamente.</p>
            
            <div class="device-info">
              <table>
                <tr>
                  <td>📅 Data/Hora:</td>
                  <td>${loginTime}</td>
                </tr>
                <tr>
                  <td>🌐 Navegador:</td>
                  <td>${browser || "Desconhecido"}</td>
                </tr>
                <tr>
                  <td>💻 Sistema:</td>
                  <td>${os || "Desconhecido"}</td>
                </tr>
                <tr>
                  <td>📍 Localização:</td>
                  <td>${locationInfo}</td>
                </tr>
                <tr>
                  <td>🔢 Endereço IP:</td>
                  <td>${ipAddress}</td>
                </tr>
              </table>
            </div>
            
            <div class="cta">
              <a href="#">Verificar Atividade da Conta</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">
              Dica: Ative a autenticação em dois fatores (MFA) para aumentar a segurança da sua conta.
            </p>
          </div>
          <div class="footer">
            <p>Este é um email automático de segurança. Por favor, não responda.</p>
            <p>© ${new Date().getFullYear()} Lalamove Guardian</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const emailResponse = await resend.emails.send({
        from: "Lalamove Guardian <onboarding@resend.dev>",
        to: [userEmail],
        subject: "🔐 Alerta: Novo dispositivo detectado na sua conta",
        html: emailHtml,
      });

      logger.log("Email sent successfully:", emailResponse);

      // Update alert record
      await supabase
        .from("new_device_alerts")
        .update({ email_sent: true, sent_at: new Date().toISOString() })
        .eq("device_id", newDevice.id);

    } catch (emailError) {
      logger.error("Error sending email:", emailError);
    }

    // Log auth event
    await supabase.from("auth_logs").insert({
      user_id: userId,
      event_type: "new_device_login",
      ip_address: ipAddress,
      user_agent: userAgent,
      success: true,
      metadata: {
        device_id: newDevice.id,
        browser,
        os,
        location_city: locationCity,
        location_country: locationCountry,
      },
    });

    return new Response(
      JSON.stringify({ 
        message: "New device registered and alert sent", 
        isNewDevice: true,
        deviceId: newDevice.id 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    logger.error("Error in new-device-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
