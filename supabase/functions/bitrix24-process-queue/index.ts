import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing Bitrix24 sync queue...");

    // Get pending sync records
    const { data: pendingSyncs, error: fetchError } = await supabase
      .from("bitrix24_sync")
      .select("*, lalamove_orders(*, drivers(*))")
      .eq("sync_status", "pending")
      .limit(10);

    if (fetchError) {
      console.error("Error fetching pending syncs:", fetchError);
      throw fetchError;
    }

    if (!pendingSyncs || pendingSyncs.length === 0) {
      console.log("No pending syncs found");
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending syncs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingSyncs.length} pending syncs`);

    // Get Bitrix24 token
    const { data: tokenData, error: tokenError } = await supabase
      .from("bitrix24_tokens")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error("No Bitrix24 token found, marking syncs as error");
      
      // Mark all as error - no token configured
      for (const sync of pendingSyncs) {
        await supabase
          .from("bitrix24_sync")
          .update({ 
            sync_status: "error", 
            last_error: "Bitrix24 not connected" 
          })
          .eq("id", sync.id);
      }
      
      return new Response(
        JSON.stringify({ processed: 0, error: "Bitrix24 not connected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log("Token expired, refreshing...");
      
      const clientId = Deno.env.get("BITRIX24_CLIENT_ID");
      const clientSecret = Deno.env.get("BITRIX24_CLIENT_SECRET");

      if (!clientId || !clientSecret) {
        console.error("Missing Bitrix24 credentials");
        return new Response(
          JSON.stringify({ error: "Missing Bitrix24 credentials" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenResponse = await fetch(`https://${tokenData.domain}/oauth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenData.refresh_token,
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error("Token refresh failed:", tokens.error);
        return new Response(
          JSON.stringify({ error: "Token refresh failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      
      await supabase.from("bitrix24_tokens").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      }).eq("id", tokenData.id);

      tokenData.access_token = tokens.access_token;
    }

    // Get stage mappings
    const { data: stageMappings } = await supabase
      .from("bitrix24_stage_mappings")
      .select("*");

    const stageMap = new Map(
      stageMappings?.map(m => [m.lalamove_status, m.bitrix_stage_id]) || []
    );

    let processed = 0;
    let errors = 0;

    // Process each pending sync
    for (const sync of pendingSyncs) {
      try {
        const order = sync.lalamove_orders;
        if (!order) {
          console.log(`No order found for sync ${sync.id}`);
          await supabase
            .from("bitrix24_sync")
            .update({ sync_status: "error", last_error: "Order not found" })
            .eq("id", sync.id);
          errors++;
          continue;
        }

        console.log(`Processing sync for order ${order.lalamove_id}, deal ${sync.deal_id}`);

        const dealFields: Record<string, unknown> = {
          STAGE_ID: stageMap.get(order.status) || "NEW",
          TITLE: `Pedido ${order.lalamove_id} - ${order.customer_name}`,
          UF_CRM_LALAMOVE_ID: order.lalamove_id,
          UF_CRM_PICKUP_ADDRESS: order.pickup_address,
          UF_CRM_DELIVERY_ADDRESS: order.delivery_address,
          UF_CRM_VEHICLE_TYPE: order.vehicle_type,
          UF_CRM_TOTAL_COST: order.total_cost,
          UF_CRM_CURRENCY: order.currency,
          UF_CRM_STATUS: order.status,
          UF_CRM_DRIVER_NAME: order.drivers?.name || "",
          UF_CRM_DRIVER_PHONE: order.drivers?.phone || "",
          UF_CRM_SCHEDULED_AT: order.scheduled_at,
          UF_CRM_ESTIMATED_DELIVERY: order.estimated_delivery || "",
          UF_CRM_ACTUAL_DELIVERY: order.actual_delivery || "",
          UF_CRM_DISTANCE: order.distance_meters || 0,
          UF_CRM_SHARE_LINK: order.share_link || "",
        };

        // Update deal in Bitrix24
        const updateResponse = await fetch(
          `https://${tokenData.domain}/rest/crm.deal.update`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              auth: tokenData.access_token,
              id: sync.deal_id,
              fields: dealFields,
            }),
          }
        );

        const updateResult = await updateResponse.json();
        console.log(`Deal update result:`, updateResult);

        // Create activity for status change
        const activityResponse = await fetch(
          `https://${tokenData.domain}/rest/crm.activity.add`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              auth: tokenData.access_token,
              fields: {
                OWNER_TYPE_ID: 2,
                OWNER_ID: sync.deal_id,
                TYPE_ID: 2,
                SUBJECT: `Status atualizado: ${order.status}`,
                DESCRIPTION: `Pedido Lalamove ${order.lalamove_id} atualizado automaticamente para status ${order.status}`,
                RESPONSIBLE_ID: 1,
                COMPLETED: "Y",
              },
            }),
          }
        );

        const activityResult = await activityResponse.json();
        console.log(`Activity create result:`, activityResult);

        // Update sync record
        await supabase
          .from("bitrix24_sync")
          .update({
            sync_status: updateResult.result ? "success" : "error",
            last_error: updateResult.error_description || null,
            synced_fields: dealFields,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", sync.id);

        // Save activity if created
        if (activityResult.result) {
          await supabase.from("bitrix24_activities").insert({
            order_id: order.id,
            deal_id: sync.deal_id,
            activity_id: activityResult.result,
            activity_type: "auto_status_update",
            subject: `Status atualizado: ${order.status}`,
          });
        }

        processed++;
      } catch (syncError) {
        console.error(`Error processing sync ${sync.id}:`, syncError);
        
        await supabase
          .from("bitrix24_sync")
          .update({ 
            sync_status: "error", 
            last_error: syncError instanceof Error ? syncError.message : "Unknown error" 
          })
          .eq("id", sync.id);
        
        errors++;
      }
    }

    console.log(`Processed ${processed} syncs, ${errors} errors`);

    return new Response(
      JSON.stringify({ processed, errors, total: pendingSyncs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Queue processing error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
