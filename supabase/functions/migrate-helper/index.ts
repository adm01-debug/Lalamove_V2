import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * migrate-helper — utilitário de diagnóstico para operações de migração.
 *
 * Segurança (não negociável):
 *  - Exige JWT válido e papel `admin` (validado via RPC `has_role`).
 *  - NUNCA retorna segredos (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`).
 *    A ação legada `credentials` foi removida por ser vazamento de credenciais.
 */

type Action = 'ping' | 'schema';

const ALLOWED_ACTIONS: readonly Action[] = ['ping', 'schema'] as const;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isAction(value: string): value is Action {
  return (ALLOWED_ACTIONS as readonly string[]).includes(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Autenticação ────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== 'string') {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ── 2. Autorização: apenas admin ───────────────────────────────────────
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (roleError) {
      console.error('[migrate-helper] role check failed', roleError.message);
      return json({ error: 'Falha ao verificar permissões' }, 500);
    }
    if (isAdmin !== true) {
      return json({ error: 'Forbidden: requer papel admin' }, 403);
    }

    // ── 3. Ação ────────────────────────────────────────────────────────────
    const raw = new URL(req.url).searchParams.get('action') ?? 'ping';
    if (!isAction(raw)) {
      return json({ error: 'unknown_action', allowed: ALLOWED_ACTIONS }, 400);
    }

    if (raw === 'ping') {
      return json({
        ok: true,
        action: 'ping',
        // Apenas metadados não sensíveis.
        environment: Deno.env.get('ENVIRONMENT') ?? 'production',
        hasServiceRole: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
        timestamp: new Date().toISOString(),
      });
    }

    // action === 'schema' — sanidade de conectividade sem expor dados.
    const { error: probeError } = await supabase
      .from('user_roles')
      .select('id', { count: 'exact', head: true });

    return json({
      ok: !probeError,
      action: 'schema',
      dataApiReachable: !probeError,
      error: probeError?.message ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[migrate-helper] unexpected error', message);
    return json({ error: 'Erro interno' }, 500);
  }
});
