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
import { trackContractUsage } from "../_shared/telemetry.ts";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const version = resolveContractVersion(req);
    trackContractUsage("check-external-api", version);
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
    let details: Record<string, unknown> | undefined;

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

      case 'mapbox': {
        const probe = await probeGeoProvider('mapbox');
        ({ status, message } = probe);
        details = probe.details;
        break;
      }

      case 'google': {
        const probe = await probeGeoProvider('google');
        ({ status, message } = probe);
        details = probe.details;
        break;
      }

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
        ...(details ? { details } : {}),
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

// ── Health por provedor geo (etapa 67 do plano Mapbox) ──────────────────────
// Geocoda um endereço fixo e devolve latência, SKU e o saldo de rate limit do
// provedor. Mapbox vai com `permanent=false`, então a chamada não é gravada
// (não é cobrada como permanente nem entra no cache do provedor).

const HEALTH_ADDRESS = 'Avenida Paulista 1578, São Paulo';

interface GeoProbe {
  status: string;
  message: string;
  details: {
    provider: string;
    sku: string;
    address: string;
    http_status: number;
    latency_ms: number;
    rate_limit_remaining: number | null;
    rate_limit_interval: number | null;
  };
}

async function probeGeoProvider(provider: 'mapbox' | 'google'): Promise<GeoProbe> {
  const q = encodeURIComponent(HEALTH_ADDRESS);

  if (provider === 'mapbox') {
    const token = Deno.env.get('MAPBOX_SERVER_TOKEN') ?? Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!token) {
      return {
        status: 'unknown',
        message: 'MAPBOX_SERVER_TOKEN não configurado',
        details: emptyProbe('mapbox', 'geocoding_temporary'),
      };
    }
    const url =
      `https://api.mapbox.com/search/geocode/v6/forward?q=${q}` +
      `&limit=1&permanent=false&access_token=${encodeURIComponent(token)}`;
    return runProbe('mapbox', 'geocoding_temporary', url);
  }

  const key = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');
  if (!key) {
    return {
      status: 'unknown',
      message: 'GOOGLE_MAPS_SERVER_KEY não configurado',
      details: emptyProbe('google', 'geocoding'),
    };
  }
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${encodeURIComponent(key)}`;
  return runProbe('google', 'geocoding', url);
}

function emptyProbe(provider: string, sku: string): GeoProbe['details'] {
  return {
    provider,
    sku,
    address: HEALTH_ADDRESS,
    http_status: 0,
    latency_ms: 0,
    rate_limit_remaining: null,
    rate_limit_interval: null,
  };
}

async function runProbe(provider: string, sku: string, url: string): Promise<GeoProbe> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    const latency = Date.now() - start;
    const remainingHeader = res.headers.get('X-Rate-Limit-Remaining');
    const intervalHeader = res.headers.get('X-Rate-Limit-Interval');

    const details: GeoProbe['details'] = {
      provider,
      sku,
      address: HEALTH_ADDRESS,
      http_status: res.status,
      latency_ms: latency,
      rate_limit_remaining: remainingHeader === null ? null : Number(remainingHeader),
      rate_limit_interval: intervalHeader === null ? null : Number.parseInt(intervalHeader, 10),
    };

    const body = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch { /* corpo não-JSON */ }

    if (res.status === 401 || res.status === 403) {
      return { status: 'down', message: 'Credencial recusada pelo provedor', details };
    }
    if (res.status === 429) {
      return { status: 'degraded', message: 'Provedor respondeu 429 (rate limit)', details };
    }
    if (!res.ok) {
      return { status: 'degraded', message: `Provedor respondeu ${res.status}`, details };
    }

    if (provider === 'google') {
      const gStatus = String((parsed.status as string | undefined) ?? '');
      if (gStatus && gStatus !== 'OK' && gStatus !== 'ZERO_RESULTS') {
        return { status: gStatus === 'REQUEST_DENIED' ? 'down' : 'degraded', message: `Google Geocoding: ${gStatus}`, details };
      }
      const found = Array.isArray(parsed.results) ? parsed.results.length : 0;
      return { status: 'ok', message: `Geocoding respondeu em ${latency} ms (${found} resultado(s))`, details };
    }

    const features = Array.isArray(parsed.features) ? parsed.features.length : 0;
    return { status: 'ok', message: `Geocoding respondeu em ${latency} ms (${features} resultado(s))`, details };
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Connection failed',
      details: { ...emptyProbe(provider, sku), latency_ms: Date.now() - start },
    };
  }
}
