// Edge Function: check-external-api
// Objetivo: Verificar health de APIs externas de forma segura
// Evita expor API keys no frontend

import { corsHeaders } from '../_shared/cors.ts';
import {
  resolveContractVersion,
  parseJsonBody,
  validateContract,
  errorResponse,
} from '../_shared/contract.ts';
import { getSchema } from '../_shared/schemas.ts';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const version = resolveContractVersion(req);
    const parsedBody = await parseJsonBody(req, version);
    if (!parsedBody.ok) {
      return errorResponse(parsedBody, corsHeaders);
    }

    const validation = validateContract(
      getSchema('check-external-api', version),
      parsedBody.value,
      version,
    );
    if (!validation.ok) {
      return errorResponse(validation, corsHeaders);
    }

    const { service } = validation.data as { service: string };

    let status = 'unknown';
    let message = '';
    let latency = 0;

    const startTime = Date.now();

    switch (service) {
      case 'lalamove':
        ({ status, message } = await checkLalamove());
        break;

      case 'bitrix24':
        ({ status, message } = await checkBitrix24());
        break;

      case 'evolution':
        ({ status, message } = await checkEvolution());
        break;

      case 'mapbox':
        ({ status, message } = await checkMapbox());
        break;

      default:
        throw new Error(`Unknown service: ${service}`);
    }

    latency = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status,
        message,
        latency,
        service,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[CHECK-API] Error:', error);
    return new Response(
      JSON.stringify({
        status: 'down',
        message: 'An internal error occurred during health check',
        service: 'unknown',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

async function checkLalamove(): Promise<{ status: string; message: string }> {
  try {
    const LALAMOVE_API = Deno.env.get('LALAMOVE_API_URL') || 'https://rest.lalamove.com';
    const LALAMOVE_TOKEN = Deno.env.get('LALAMOVE_API_KEY');

    if (!LALAMOVE_TOKEN) {
      return {
        status: 'unknown',
        message: 'API key not configured',
      };
    }

    // Ping endpoint (ou endpoint de health se existir)
    const response = await fetch(`${LALAMOVE_API}/v3/ping`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${LALAMOVE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (response.ok) {
      return {
        status: 'ok',
        message: 'API responding',
      };
    } else {
      return {
        status: 'degraded',
        message: `API returned ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkBitrix24(): Promise<{ status: string; message: string }> {
  try {
    const BITRIX24_URL = Deno.env.get('BITRIX24_WEBHOOK_URL');

    if (!BITRIX24_URL) {
      return {
        status: 'unknown',
        message: 'Webhook URL not configured',
      };
    }

    // Chamar método simples (profile)
    const response = await fetch(`${BITRIX24_URL}/profile.json`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: 'ok',
        message: 'Webhook responding',
      };
    } else {
      return {
        status: 'degraded',
        message: `Webhook returned ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkEvolution(): Promise<{ status: string; message: string }> {
  try {
    const EVOLUTION_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return {
        status: 'unknown',
        message: 'API not configured',
      };
    }

    // Health endpoint
    const response = await fetch(`${EVOLUTION_URL}/health`, {
      method: 'GET',
      headers: {
        apikey: EVOLUTION_API_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: 'ok',
        message: 'API responding',
      };
    } else {
      return {
        status: 'degraded',
        message: `API returned ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkMapbox(): Promise<{ status: string; message: string }> {
  try {
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_API_KEY');

    if (!MAPBOX_TOKEN) {
      return {
        status: 'unknown',
        message: 'API key not configured',
      };
    }

    // Endpoint simples de geocoding
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/test.json?access_token=${MAPBOX_TOKEN}&limit=1`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      }
    );

    if (response.ok) {
      return {
        status: 'ok',
        message: 'API responding',
      };
    } else if (response.status === 401) {
      return {
        status: 'down',
        message: 'Invalid API key',
      };
    } else {
      return {
        status: 'degraded',
        message: `API returned ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
