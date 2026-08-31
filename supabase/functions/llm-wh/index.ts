import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// This is a lightweight proxy that forwards Lalamove webhook calls
// to the main lalamove-webhook edge function.
// It exists because the Lalamove API URL validator rejects long Supabase URLs.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lalamove-signature',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Webhook Proxy] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Read raw body to forward
    const rawBody = await req.text();
    
    // Forward all relevant headers
    const forwardHeaders: Record<string, string> = {
      'Content-Type': req.headers.get('content-type') || 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    };

    // Forward Lalamove signature header
    const sig = req.headers.get('x-lalamove-signature');
    if (sig) {
      forwardHeaders['x-lalamove-signature'] = sig;
    }

    // Forward client IP
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    if (clientIp) {
      forwardHeaders['x-forwarded-for'] = clientIp;
    }

    console.log(`[Webhook Proxy] Forwarding ${req.method} to lalamove-webhook`);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/lalamove-webhook`,
      {
        method: req.method,
        headers: forwardHeaders,
        body: rawBody || undefined,
      }
    );

    const responseBody = await response.text();
    console.log(`[Webhook Proxy] Response: ${response.status}`);

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Webhook Proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Proxy error', message: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
