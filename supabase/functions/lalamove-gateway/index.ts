import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders as baseCorsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { isUnsupported, routeAction, translateParams } from './route.ts';

// Override CORS headers to include x-request-id and other custom headers
const corsHeaders = {
  ...baseCorsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-lalamove-signature, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
};

/**
 * Gateway Lalamove do Intelligence Hub.
 *
 * Etapa 19 do roteiro: nenhuma chave de proxy pode existir no bundle frontend.
 * Todo tráfego Lalamove (proxy unificado v3 + proxy UAPI) passa por aqui:
 *  - exige JWT válido do usuário autenticado;
 *  - injeta as chaves a partir de secrets do backend;
 *  - propaga um `x-request-id` para correlação ponta a ponta.
 */

type Target = 'unified' | 'uapi';

interface GatewayRequest {
  target?: Target;
  action: string;
  params?: Record<string, string>;
  body?: unknown;
  method?: 'GET' | 'POST';
}

const TARGETS: Record<Target, { urlEnv: string; keyEnv: string }> = {
  unified: { urlEnv: 'LALAMOVE_UNIFIED_PROXY_URL', keyEnv: 'LALAMOVE_UNIFIED_PROXY_KEY' },
  uapi: { urlEnv: 'LALAMOVE_UAPI_PROXY_URL', keyEnv: 'LALAMOVE_UAPI_PROXY_KEY' },
};

const TIMEOUT_MS = 25_000;

interface RateLimitSnapshot {
  limitTotal: number | null;
  limitRemaining: number | null;
  limitResetAt: string | null;
  usageRatio: number | null;
  raw: Record<string, string>;
}

/**
 * Etapa 14 — a Lalamove publica limites POR ENDPOINT, no formato
 * `ratelimits-limit-{endpoint}` / `-remaining-` / `-reset-` (Unix seconds).
 * Extraímos o primeiro grupo encontrado e devolvemos um snapshot normalizado.
 */
function extractRateLimits(headers: Headers): RateLimitSnapshot | null {
  const raw: Record<string, string> = {};
  let total: number | null = null;
  let remaining: number | null = null;
  let resetAt: string | null = null;

  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!lower.startsWith('ratelimits-')) return;
    raw[lower] = value;

    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) return;

    if (lower.startsWith('ratelimits-limit-') && total === null) total = numeric;
    else if (lower.startsWith('ratelimits-remaining-') && remaining === null) remaining = numeric;
    else if (lower.startsWith('ratelimits-reset-') && resetAt === null) {
      // Unix timestamp em segundos; toleramos milissegundos.
      const ms = numeric > 1e11 ? numeric : numeric * 1000;
      const date = new Date(ms);
      resetAt = Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  });

  if (Object.keys(raw).length === 0) return null;

  const usageRatio =
    total !== null && total > 0 && remaining !== null
      ? Math.min(1, Math.max(0, (total - remaining) / total))
      : null;

  return { limitTotal: total, limitRemaining: remaining, limitResetAt: resetAt, usageRatio, raw };
}

/**
 * Persistência best-effort da telemetria de rate limit. Nunca deve derrubar a
 * requisição principal — falhas são apenas logadas.
 */
async function recordRateLimits(
  snapshot: RateLimitSnapshot | null,
  context: { endpoint: string; method: string; status: number; requestId: string },
): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return;
  // Sem headers e sem erro: nada relevante a registrar.
  if (!snapshot && context.status < 400) return;

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const { error } = await admin.from('lalamove_rate_limits').insert({
      endpoint: context.endpoint,
      method: context.method,
      status: context.status,
      limit_total: snapshot?.limitTotal ?? null,
      limit_remaining: snapshot?.limitRemaining ?? null,
      limit_reset_at: snapshot?.limitResetAt ?? null,
      usage_ratio: snapshot?.usageRatio ?? null,
      request_id: context.requestId,
      raw_headers: snapshot?.raw ?? {},
    });
    if (error) console.error('[lalamove-gateway] rate limit insert failed', error.message);
  } catch (err) {
    console.error('[lalamove-gateway] rate limit telemetry error', err);
  }
}

/**
 * Etapa 27 — telemetria por endpoint em `query_telemetry`.
 * Best-effort: nunca deve derrubar a requisição principal.
 */
async function recordQueryTelemetry(context: {
  action: string;
  durationMs: number;
  status: number;
  errorMessage?: string | null;
}): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return;

  const severity =
    context.status >= 400 ? 'error' : context.durationMs >= 3000 ? 'slow' : 'normal';

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const { error } = await admin.from('query_telemetry').insert({
      operation: 'lalamove',
      table_name: 'lalamove_gateway',
      rpc_name: context.action,
      duration_ms: Math.max(0, Math.round(context.durationMs)),
      severity,
      error_message: context.errorMessage ?? null,
    });
    if (error) console.error('[lalamove-gateway] telemetry insert failed', error.message);
  } catch (err) {
    console.error('[lalamove-gateway] telemetry error', err);
  }
}

/**
 * Etapa 28 — alerta CRITICAL para falhas de autenticação (502 do proxy v3 e
 * `ret=10007` da UAPI), reaproveitando a deduplicação multi-canal existente.
 */
async function raiseAuthFailureAlert(context: {
  action: string;
  target: Target;
  detail: string;
  requestId: string;
}): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) return;

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const dedupKey = `lalamove_auth_failure:${context.target}`;
    const { data, error } = await admin.rpc('claim_alert_notification', {
      p_dedup_key: dedupKey,
      p_alert_type: 'INTEGRATION_FAILURE',
      p_window_seconds: 900,
    });
    if (error) {
      console.error('[lalamove-gateway] dedup failed', error.message);
      return;
    }
    const shouldSend = Array.isArray(data) ? data[0]?.should_send : undefined;
    if (!shouldSend) return;

    await admin.from('alerts').insert({
      type: 'INTEGRATION_FAILURE',
      severity: 'CRITICAL',
      title: `Falha de autenticação Lalamove (${context.target})`,
      message: `A ação "${context.action}" falhou por autenticação: ${context.detail}. Renove o token e verifique o proxy.`,
      metadata: {
        subtype: 'LALAMOVE_AUTH_FAILURE',
        target: context.target,
        action: context.action,
        request_id: context.requestId,
      },
    });
  } catch (err) {
    console.error('[lalamove-gateway] auth alert error', err);
  }
}

/** Extrai o `ret` de respostas UAPI para detectar sessão expirada (10007). */
function extractUapiRet(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const ret = (parsed as Record<string, unknown>).ret;
  return typeof ret === 'number' ? ret : null;
}

function json(payload: unknown, status = 200, requestId?: string): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  });
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  try {
    // ── 1. Autenticação obrigatória ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401, requestId);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: 'Unauthorized' }, 401, requestId);
    }

    // ── 2. Validação de entrada ────────────────────────────────────────────
    let payload: GatewayRequest;
    try {
      payload = await req.json();
    } catch {
      return json({ error: 'Corpo da requisição inválido (JSON esperado)' }, 400, requestId);
    }

    const target: Target = payload.target === 'uapi' ? 'uapi' : 'unified';
    const action = typeof payload.action === 'string' ? payload.action.trim() : '';
    if (!action || action.length > 64) {
      return json({ error: 'Campo "action" é obrigatório' }, 400, requestId);
    }

    const { urlEnv, keyEnv } = TARGETS[target];
    const baseUrl = Deno.env.get(urlEnv);
    const proxyKey = Deno.env.get(keyEnv);

    // ── 3. Montagem da URL de destino ──────────────────────────────────────
    // O proxy externo é opcional: quando os secrets não estão definidos
    // (é o caso da produção), a ação é atendida pelas edges locais.
    let url: URL;
    let forwardHeaders: Record<string, string> = {};

    if (baseUrl && proxyKey) {
      url = new URL(baseUrl);
      url.searchParams.set('key', proxyKey);
      url.searchParams.set('action', action);
      for (const [k, v] of Object.entries(payload.params ?? {})) {
        if (typeof v === 'string') url.searchParams.set(k, v);
      }
    } else {
      const routed = routeAction(target, action);
      if (routed === null) {
        return json({ error: `Ação "${action}" não é reconhecida`, requestId }, 400, requestId);
      }
      if (isUnsupported(routed)) {
        return json({ error: routed.reason, action, requestId }, 501, requestId);
      }
      const functionsBase = Deno.env.get('SUPABASE_URL');
      if (!functionsBase) {
        return json({ error: 'SUPABASE_URL ausente no ambiente da função' }, 500, requestId);
      }
      url = new URL(`${functionsBase}/functions/v1/${routed.fn}`);
      url.searchParams.set('action', routed.action);
      for (const [k, v] of Object.entries(translateParams(payload.params ?? {}))) {
        url.searchParams.set(k, v);
      }
      for (const [k, v] of Object.entries(routed.query ?? {})) {
        url.searchParams.set(k, v);
      }
      // a edge de destino exige JWT: repassamos o do chamador, já validado acima
      forwardHeaders = { Authorization: authHeader };
    }

    const method = payload.method === 'POST' || payload.body !== undefined ? 'POST' : 'GET';

    // ── 4. Chamada com deadline ────────────────────────────────────────────
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const startedAt = Date.now();

    let upstream: Response;
    try {
      upstream = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          ...forwardHeaders,
        },
        body: method === 'POST' ? JSON.stringify(payload.body ?? {}) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      const failureMessage = aborted
        ? 'Tempo limite excedido ao contatar a Lalamove'
        : 'Falha de rede ao contatar a Lalamove';
      await recordQueryTelemetry({
        action,
        durationMs: Date.now() - startedAt,
        status: aborted ? 504 : 502,
        errorMessage: failureMessage,
      });
      return json({ error: failureMessage, requestId }, aborted ? 504 : 502, requestId);
    }
    clearTimeout(timer);
    const durationMs = Date.now() - startedAt;

    // ── 5. Telemetria de rate limit (Etapa 14) ─────────────────────────────
    const rateLimits = extractRateLimits(upstream.headers);
    await recordRateLimits(rateLimits, {
      endpoint: action,
      method,
      status: upstream.status,
      requestId,
    });

    const text = await upstream.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      await recordQueryTelemetry({
        action,
        durationMs,
        status: 502,
        errorMessage: 'Resposta inválida do proxy Lalamove',
      });
      return json(
        { error: 'Resposta inválida do proxy Lalamove', status: upstream.status, requestId },
        502,
        requestId,
      );
    }

    // ── 6. Etapa 27/28 — telemetria por endpoint e alerta de auth ──────────
    const uapiRet = extractUapiRet(parsed);
    const isAuthFailure =
      (upstream.status === 401 || upstream.status === 502) || uapiRet === 10007 || uapiRet === 10001;

    await recordQueryTelemetry({
      action,
      durationMs,
      status: upstream.ok && !uapiRet ? 200 : upstream.status,
      errorMessage: upstream.ok
        ? uapiRet && uapiRet !== 0
          ? `UAPI ret=${uapiRet}`
          : null
        : `HTTP ${upstream.status}`,
    });

    if (isAuthFailure) {
      await raiseAuthFailureAlert({
        action,
        target,
        detail: uapiRet ? `UAPI ret=${uapiRet}` : `HTTP ${upstream.status}`,
        requestId,
      });
    }

    if (!upstream.ok) {
      return json(
        { error: `Proxy error: ${upstream.status}`, status: upstream.status, body: parsed, requestId },
        upstream.status >= 500 ? 502 : upstream.status,
        requestId,
      );

    }

    return json(parsed, 200, requestId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return json({ error: message, requestId }, 500, requestId);
  }
});
