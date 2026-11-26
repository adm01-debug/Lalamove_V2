/**
 * Saúde da sessão UAPI.
 *
 * `token_expires_at` é apenas a estimativa de 24 h da última renovação e NÃO
 * significa token inválido: o coletor verifica o token a cada ciclo e grava
 * `last_refreshed_at`, mesmo quando não obtém um token novo (sessão sem
 * refresh_token). O watchdog usa o mesmo critério (janela de 2 h).
 */
export const VERIFICATION_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface SessionHealthInput {
  token_obtained_at?: string | null;
  last_refreshed_at?: string | null;
  refresh_token?: string | null;
}

export interface SessionHealth {
  /** Evidência mais recente de token aceito. */
  lastVerifiedAt: string | null;
  /** `false` = nenhuma verificação dentro da janela. */
  recentlyVerified: boolean;
  /** Existe `refresh_token` utilizável para renovar sem o navegador. */
  autoRenewal: boolean;
}

export function evaluateSessionHealth(
  session: SessionHealthInput | null | undefined,
  now: number = Date.now(),
): SessionHealth {
  const lastVerifiedAt = session?.last_refreshed_at ?? session?.token_obtained_at ?? null;
  const at = lastVerifiedAt ? Date.parse(lastVerifiedAt) : NaN;
  return {
    lastVerifiedAt,
    recentlyVerified: Number.isFinite(at) && at >= now - VERIFICATION_WINDOW_MS,
    autoRenewal: (session?.refresh_token ?? '').trim().length >= 16,
  };
}