import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveContractVersion,
  parseJsonBody,
  validateContract,
  errorResponse,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const version = resolveContractVersion(req);
    trackContractUsage("route-analyzer", version);
    const parsedBody = await parseJsonBody(req, version);
    if (!parsedBody.ok) {
      return errorResponse(parsedBody, corsHeaders);
    }

    const validation = validateContract(
      getSchema("route-analyzer", version),
      parsedBody.value,
      version,
    );
    if (!validation.ok) {
      return errorResponse(validation, corsHeaders);
    }

    const { action, message, orderId } = validation.data as {
      action: "analyze-routes" | "analyze-order" | "analyze-drivers" | "analyze-alerts";
      message?: string;
      orderId?: string;
    };

    let contextData = '';

    // Fetch relevant data based on action
    if (action === 'analyze-routes') {
      // Get active orders with tracking data
      const { data: orders, error: ordersError } = await supabase
        .from('lalamove_orders')
        .select(`
          *,
          drivers:driver_id (name, vehicle_type, rating, risk_score),
          active_tracking (current_latitude, current_longitude, eta_minutes, speed, is_on_route)
        `)
        .in('status', ['ON_GOING', 'PICKED_UP', 'MATCHED'])
        .limit(20);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      } else {
        contextData = `Active Orders Data:\n${JSON.stringify(orders, null, 2)}`;
      }
    } else if (action === 'analyze-order' && orderId) {
      // Get specific order details
      const { data: order, error: orderError } = await supabase
        .from('lalamove_orders')
        .select(`
          *,
          drivers:driver_id (name, vehicle_type, rating, risk_score, completed_deliveries),
          active_tracking (current_latitude, current_longitude, eta_minutes, speed, is_on_route, is_stopped, stopped_since),
          lalamove_stops (*),
          lalamove_status_history (*)
        `)
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order:', orderError);
      } else {
        contextData = `Order Details:\n${JSON.stringify(order, null, 2)}`;
      }
    } else if (action === 'analyze-drivers') {
      // Get driver performance data
      const { data: drivers, error: driversError } = await supabase
        .from('drivers')
        .select(`
          *,
          driver_incidents (type, severity, created_at)
        `)
        .order('risk_score', { ascending: false })
        .limit(20);

      if (driversError) {
        console.error('Error fetching drivers:', driversError);
      } else {
        contextData = `Driver Performance Data:\n${JSON.stringify(drivers, null, 2)}`;
      }
    } else if (action === 'analyze-alerts') {
      // Get recent alerts
      const { data: alerts, error: alertsError } = await supabase
        .from('alerts')
        .select(`
          *,
          drivers:driver_id (name),
          lalamove_orders:order_id (lalamove_id, customer_name)
        `)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (alertsError) {
        console.error('Error fetching alerts:', alertsError);
      } else {
        contextData = `Recent Alerts:\n${JSON.stringify(alerts, null, 2)}`;
      }
    }

    const systemPrompt = `You are an AI logistics analyst specialized in delivery route optimization for Lalamove deliveries. Your role is to:

1. Analyze delivery routes and identify inefficiencies
2. Detect potential delays and suggest preventive actions
3. Evaluate driver performance and risk factors
4. Provide actionable recommendations for route optimization
5. Alert about anomalies like route deviations or unusual stops

When analyzing data, consider:
- Traffic patterns and estimated delivery times
- Driver behavior (speed, stops, route adherence)
- Risk scores and incident history
- Geographic clustering for batch deliveries
- Weather and time-of-day factors

Always provide:
- Clear, concise insights
- Specific recommendations with expected impact
- Risk assessments with severity levels
- Priority actions when multiple issues exist

Respond in a professional but approachable tone. Use bullet points and structured formatting when presenting multiple findings.

Current context data:
${contextData}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message || 'Analyze the current delivery routes and provide optimization suggestions.' }
    ];

    console.log('Sending request to Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits exhausted. Please add more credits to continue.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    console.log('AI response received successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      action,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in route-analyzer:', error);
    return new Response(JSON.stringify({ 
      error: 'An internal error occurred during analysis' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
