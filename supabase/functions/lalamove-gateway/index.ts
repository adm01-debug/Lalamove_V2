import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
    if (!baseUrl || !proxyKey) {
      return json({ error: `Configuração ausente para o destino "${target}"` }, 500, requestId);
    }

    // ── 3. Montagem da URL de destino ──────────────────────────────────────
    const url = new URL(baseUrl);
    url.searchParams.set('key', proxyKey);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(payload.params ?? {})) {
      if (typeof v === 'string') url.searchParams.set(k, v);
    }

    const method = payload.method === 'POST' || payload.body !== undefined ? 'POST' : 'GET';

    // ── 4. Chamada com deadline ────────────────────────────────────────────
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        body: method === 'POST' ? JSON.stringify(payload.body ?? {}) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      return json(
        {
          error: aborted
            ? 'Tempo limite excedido ao contatar a Lalamove'
            : 'Falha de rede ao contatar a Lalamove',
          requestId,
        },
        aborted ? 504 : 502,
        requestId,
      );
    }
    clearTimeout(timer);

    const text = await upstream.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      return json(
        { error: 'Resposta inválida do proxy Lalamove', status: upstream.status, requestId },
        502,
        requestId,
      );
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
