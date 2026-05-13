import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BitrixTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  domain: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    switch (action) {
      case "get_auth_url": {
        const clientId = Deno.env.get("BITRIX24_CLIENT_ID");
        const domain = params.domain;
        
        if (!clientId) {
          return new Response(
            JSON.stringify({ error: "BITRIX24_CLIENT_ID not configured" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const redirectUri = `${supabaseUrl}/functions/v1/bitrix24-sync?action=oauth_callback`;
        const authUrl = `https://${domain}/oauth/authorize/?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        return new Response(
          JSON.stringify({ auth_url: authUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "oauth_callback": {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const domain = url.searchParams.get("domain") || params.domain;
        
        if (!code) {
          return new Response("Authorization code missing", { status: 400 });
        }

        const clientId = Deno.env.get("BITRIX24_CLIENT_ID");
        const clientSecret = Deno.env.get("BITRIX24_CLIENT_SECRET");
        
        const tokenResponse = await fetch(`https://${domain}/oauth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId!,
            client_secret: clientSecret!,
            code: code,
          }),
        });

        const tokens = await tokenResponse.json();
        
        if (tokens.error) {
          return new Response(JSON.stringify({ error: tokens.error }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
        
        await supabase.from("bitrix24_tokens").upsert({
          domain: domain,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        }, { onConflict: "domain" });

        return new Response(
          `<html><body><script>window.close(); window.opener?.postMessage('bitrix24_connected', '*');</script>Connected! You can close this window.</body></html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      case "refresh_token": {
        const { data: tokenData } = await supabase
          .from("bitrix24_tokens")
          .select("*")
          .single();

        if (!tokenData) {
          return new Response(
            JSON.stringify({ error: "No tokens found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const clientId = Deno.env.get("BITRIX24_CLIENT_ID");
        const clientSecret = Deno.env.get("BITRIX24_CLIENT_SECRET");

        const tokenResponse = await fetch(`https://${tokenData.domain}/oauth/token/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId!,
            client_secret: clientSecret!,
            refresh_token: tokenData.refresh_token,
          }),
        });

        const tokens = await tokenResponse.json();
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        await supabase.from("bitrix24_tokens").update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
        }).eq("id", tokenData.id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "sync_order": {
        const { orderId, dealId } = params;
        
        const { data: tokenData } = await supabase
          .from("bitrix24_tokens")
          .select("*")
          .single();

        if (!tokenData) {
          return new Response(
            JSON.stringify({ error: "Bitrix24 not connected" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if token needs refresh
        if (new Date(tokenData.expires_at) < new Date()) {
          await fetch(`${supabaseUrl}/functions/v1/bitrix24-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "refresh_token" }),
          });
        }

        const { data: order } = await supabase
          .from("lalamove_orders")
          .select("*, drivers(*)")
          .eq("id", orderId)
          .single();

        if (!order) {
          return new Response(
            JSON.stringify({ error: "Order not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: stageMapping } = await supabase
          .from("bitrix24_stage_mappings")
          .select("*")
          .eq("lalamove_status", order.status)
          .single();

        // Update deal in Bitrix24
        const dealFields: Record<string, string | number> = {
          STAGE_ID: stageMapping?.bitrix_stage_id || "NEW",
          TITLE: `Pedido ${order.lalamove_id} - ${order.customer_name}`,
          UF_CRM_LALAMOVE_ID: order.lalamove_id,
          UF_CRM_PICKUP_ADDRESS: order.pickup_address,
          UF_CRM_DELIVERY_ADDRESS: order.delivery_address,
          UF_CRM_VEHICLE_TYPE: order.vehicle_type,
          UF_CRM_TOTAL_COST: order.total_cost,
          UF_CRM_CURRENCY: order.currency,
          UF_CRM_STATUS: order.status,
          UF_CRM_DRIVER_NAME: (order.drivers as { name?: string } | null)?.name || "",
          UF_CRM_DRIVER_PHONE: (order.drivers as { phone?: string } | null)?.phone || "",
          UF_CRM_SCHEDULED_AT: order.scheduled_at,
          UF_CRM_ESTIMATED_DELIVERY: order.estimated_delivery || "",
          UF_CRM_ACTUAL_DELIVERY: order.actual_delivery || "",
          UF_CRM_DISTANCE: order.distance_meters || 0,
          UF_CRM_SHARE_LINK: order.share_link || "",
        };

        const updateResponse = await fetch(
          `https://${tokenData.domain}/rest/crm.deal.update?` +
          new URLSearchParams({
            auth: tokenData.access_token,
            id: dealId.toString(),
            fields: JSON.stringify(dealFields),
          })
        );

        const updateResult = await updateResponse.json();

        // Create activity
        const activityResponse = await fetch(
          `https://${tokenData.domain}/rest/crm.activity.add?` +
          new URLSearchParams({
            auth: tokenData.access_token,
            fields: JSON.stringify({
              OWNER_TYPE_ID: 2, // Deal
              OWNER_ID: dealId,
              TYPE_ID: 2, // Task
              SUBJECT: `Status atualizado: ${order.status}`,
              DESCRIPTION: `Pedido Lalamove ${order.lalamove_id} atualizado para status ${order.status}`,
              RESPONSIBLE_ID: 1,
              COMPLETED: "Y",
            }),
          })
        );

        const activityResult = await activityResponse.json();

        // Save sync record
        await supabase.from("bitrix24_sync").upsert({
          order_id: orderId,
          deal_id: dealId,
          sync_status: updateResult.result ? "success" : "error",
          last_error: updateResult.error_description || null,
          synced_fields: dealFields,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "order_id" });

        // Save activity record
        if (activityResult.result) {
          await supabase.from("bitrix24_activities").insert({
            order_id: orderId,
            deal_id: dealId,
            activity_id: activityResult.result,
            activity_type: "status_update",
            subject: `Status atualizado: ${order.status}`,
          });
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            deal_updated: updateResult.result,
            activity_created: activityResult.result 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_connection_status": {
        const { data: tokenData } = await supabase
          .from("bitrix24_tokens")
          .select("domain, expires_at")
          .single();

        return new Response(
          JSON.stringify({ 
            connected: !!tokenData,
            domain: tokenData?.domain,
            expires_at: tokenData?.expires_at,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get_deals": {
        const { data: tokenData } = await supabase
          .from("bitrix24_tokens")
          .select("*")
          .single();

        if (!tokenData) {
          return new Response(
            JSON.stringify({ error: "Bitrix24 not connected" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const response = await fetch(
          `https://${tokenData.domain}/rest/crm.deal.list?` +
          new URLSearchParams({
            auth: tokenData.access_token,
            select: JSON.stringify(["ID", "TITLE", "STAGE_ID", "DATE_CREATE"]),
            order: JSON.stringify({ DATE_CREATE: "DESC" }),
          })
        );

        const result = await response.json();

        return new Response(
          JSON.stringify({ deals: result.result || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disconnect": {
        await supabase.from("bitrix24_tokens").delete().neq("id", "");
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Bitrix24 sync error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred during Bitrix24 synchronization" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
