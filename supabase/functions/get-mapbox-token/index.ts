import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    // Contrato de entrada (formato único de erro 422 + versão v1/v2):
    // supabase/functions/_shared/contract.ts e _shared/schemas.ts.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("get-mapbox-token", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("get-mapbox-token", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);

    if (!mapboxToken) {
      console.error('MAPBOX_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Mapbox token retrieved successfully');

    return new Response(
      JSON.stringify({ token: mapboxToken }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching Mapbox token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});