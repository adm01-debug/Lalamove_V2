import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";
import { buildUapiRefreshRequest, parseUapiRefreshResponse } from "./uapi-direct.ts";

/**
 * Etapa 24 — Auto-refresh do token UAPI com fallback.
 *
 * O token UAPI vive ~24 h e o refresh é de uso único. Este worker roda de hora
 * em hora (pg_cron) e:
 *  1. lê a sessão ativa e sua idade;
 *  2. renova quando passa de 20 h (janela segura);
 *  3. usa um claim de deduplicação para evitar duas renovações simultâneas
 *     (o refresh de uso único seria queimado por uma corrida);
 *  4. dispara alerta CRITICAL quando a janela é perdida ou o refresh falha.
 */

const REFRESH_AFTER_HOURS = 20;
const EXPIRY_HOURS = 24;
const CLAIM_WINDOW_SECONDS = 1_800; // 30 min entre tentativas
const ALERT_DEDUP_WINDOW_SECONDS = 86_400; // 1 aviso/dia por condicao (repeticao vira contador)
const TIMEOUT_MS = 25_000;

interface ActiveToken {
  access_token: string;
  refresh_token: string;
  user_fid: string | null;
  token_age_hours: number;
  needs_refresh: boolean;
}

type Admin = SupabaseClient;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Repeticao de uma condicao ja avisada nao abre alerta novo: incrementa o
// contador do aviso em aberto para o painel mostrar "1 alerta, N repeticoes".
async function bumpOpenAlert(admin: Admin, title: string, occurrenceCount: number): Promise<void> {
  const { data: open } = await admin
    .from('alerts')
    .select('id, metadata')
    .eq('type', 'INTEGRATION_FAILURE')
    .eq('title', title)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!open) return;

  const meta = (open.metadata ?? {}) as Record<string, unknown>;
  await admin
    .from('alerts')
    .update({
      metadata: {
        ...meta,
        repeats: Number(meta.repeats ?? 0) + 1,
        occurrence_count: occurrenceCount || Number(meta.occurrence_count ?? 0) + 1,
        last_seen_at: new Date().toISOString(),
      },
    })
    .eq('id', open.id);
}

async function raiseAlert(
  admin: Admin,
  severity: 'CRITICAL' | 'WARNING',
  title: string,
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const dedupKey = `uapi_token_refresh:${severity}:${title}`;
  const { data: claim } = await admin.rpc('claim_alert_notification', {
    p_dedup_key: dedupKey,
    p_alert_type: 'INTEGRATION_FAILURE',
    p_window_seconds: ALERT_DEDUP_WINDOW_SECONDS,
  });

  const row = Array.isArray(claim) ? claim[0] : claim;
  const shouldSend = row?.should_send;

  if (shouldSend === false) {
    await bumpOpenAlert(admin, title, Number(row?.occurrence_count ?? 0));
    return;
  }

  await admin.from('alerts').insert({
    type: 'INTEGRATION_FAILURE',
    severity,
    title,
    message,
    metadata: { subtype: 'UAPI_TOKEN_REFRESH', ...metadata },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Contrato de entrada (formato único de erro 422 + versão v1/v2):
    // supabase/functions/_shared/contract.ts e _shared/schemas.ts.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("lalamove-token-refresh", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("lalamove-token-refresh", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);

    // ── 1. Sessão ativa ────────────────────────────────────────────────────
    const { data: sessions, error: sessionError } = await admin
      .from('lalamove_uapi_sessions')
      .select('id, token_obtained_at, last_refreshed_at, is_active, access_token, refresh_token')
      .eq('is_active', true)
      .limit(1);

    if (sessionError) throw new Error(sessionError.message);

    const session = sessions?.[0] as
      | {
        id: string;
        token_obtained_at: string;
        last_refreshed_at: string | null;
        access_token: string;
        refresh_token: string;
      }
      | undefined;

    if (!session) {
      await raiseAlert(
        admin,
        'CRITICAL',
        'Nenhuma sessão UAPI ativa',
        'Não há sessão UAPI ativa cadastrada. Carteira, histórico e cupons estão indisponíveis. Siga o runbook para re-login manual.',
        {},
      );
      return json({ ok: false, reason: 'no_active_session' }, 200);
    }

    const referenceAt = session.last_refreshed_at ?? session.token_obtained_at;
    const ageHours = (Date.now() - new Date(referenceAt).getTime()) / 3_600_000;

    // ── 2. Janela perdida → alerta imediato ────────────────────────────────
    if (ageHours >= EXPIRY_HOURS) {
      await raiseAlert(
        admin,
        'CRITICAL',
        'Token UAPI expirado',
        `A sessão UAPI passou de ${EXPIRY_HOURS} h sem renovação (idade: ${ageHours.toFixed(1)} h). O refresh de uso único provavelmente não é mais válido — re-login manual necessário.`,
        { session_id: session.id, age_hours: Number(ageHours.toFixed(2)) },
      );
      return json({ ok: false, reason: 'expired', age_hours: ageHours }, 200);
    }

    // ── 3. Ainda dentro da janela segura ───────────────────────────────────
    if (ageHours < REFRESH_AFTER_HOURS) {
      return json({ ok: true, refreshed: false, age_hours: Number(ageHours.toFixed(2)) });
    }

    // ── 4. Claim anti-corrida (refresh é de uso único) ─────────────────────
    const { data: claim } = await admin.rpc('claim_alert_notification', {
      p_dedup_key: `uapi_token_refresh_attempt:${session.id}`,
      p_alert_type: 'INTEGRATION_FAILURE',
      p_window_seconds: CLAIM_WINDOW_SECONDS,
    });
    const mayRefresh = Array.isArray(claim) ? claim[0]?.should_send : claim?.should_send;
    if (mayRefresh === false) {
      return json({ ok: true, refreshed: false, reason: 'already_claimed' });
    }

    // ── 5. Renovação: proxy externo quando configurado, UAPI direta caso ────
    // Os secrets do proxy nunca existiram em produção; sem a via direta a
    // renovação sempre falhava e a sessão morria em 24 h.
    const baseUrl = Deno.env.get('LALAMOVE_UNIFIED_PROXY_URL');
    const proxyKey = Deno.env.get('LALAMOVE_UNIFIED_PROXY_KEY');
    const useProxy = Boolean(baseUrl && proxyKey);

    const url = useProxy ? new URL(baseUrl!) : null;
    if (url && proxyKey) {
      url.searchParams.set('key', proxyKey);
      url.searchParams.set('action', 'refresh_token');
    }
    const direct = useProxy
      ? null
      : buildUapiRefreshRequest(session.access_token, session.refresh_token);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let ok = false;
    let detail = '';
    let renewedTokens: { accessToken: string; refreshToken: string } | null = null;

    try {
      const resp = direct
        ? await fetch(direct.url, {
          method: 'POST',
          headers: direct.headers,
          body: direct.body,
          signal: controller.signal,
        })
        : await fetch(url!.toString(), {
          headers: { 'x-request-id': crypto.randomUUID() },
          signal: controller.signal,
        });
      const text = await resp.text();
      ok = resp.ok;
      detail = text.slice(0, 500);
      if (direct) {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          ok = false;
        }
        if (ok) {
          const result = parseUapiRefreshResponse(parsed, session.refresh_token);
          ok = result.ok;
          detail = result.detail;
          if (ok && result.accessToken && result.refreshToken) {
            renewedTokens = { accessToken: result.accessToken, refreshToken: result.refreshToken };
          }
        }
      } else if (ok) {
        try {
          const parsed = JSON.parse(text) as { ok?: boolean; error?: string };
          if (parsed.ok === false) {
            ok = false;
            detail = parsed.error ?? detail;
          }
        } catch {
          // resposta não-JSON do proxy: trata como sucesso silencioso
        }
      }
    } catch (err) {
      ok = false;
      detail = err instanceof Error ? err.message : 'erro desconhecido';
    } finally {
      clearTimeout(timer);
    }

    if (!ok) {
      await raiseAlert(
        admin,
        'CRITICAL',
        'Falha ao renovar token UAPI',
        `A renovação automática falhou com ${ageHours.toFixed(1)} h de idade. Restam ~${(EXPIRY_HOURS - ageHours).toFixed(1)} h antes da expiração. Detalhe: ${detail}`,
        { session_id: session.id, age_hours: Number(ageHours.toFixed(2)), detail, via: useProxy ? 'proxy' : 'uapi_direta' },
      );
      return json({ ok: false, reason: 'refresh_failed', detail }, 200);
    }

    // O proxy grava a sessão por conta própria; na via direta somos nós.
    const patch: Record<string, unknown> = {
      last_refreshed_at: new Date().toISOString(),
      refresh_method: 'auto',
    };
    if (renewedTokens) {
      patch.access_token = renewedTokens.accessToken;
      patch.refresh_token = renewedTokens.refreshToken;
      patch.token_obtained_at = new Date().toISOString();
      patch.token_expires_at = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    }

    await admin.from('lalamove_uapi_sessions').update(patch).eq('id', session.id);

    return json({
      ok: true,
      refreshed: true,
      age_hours: Number(ageHours.toFixed(2)),
      via: useProxy ? 'proxy' : 'uapi_direta',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    await raiseAlert(admin, 'CRITICAL', 'Erro no worker de refresh UAPI', message, {});
    return json({ ok: false, error: message }, 500);
  }
});
