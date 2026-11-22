// Etapa 96 do plano Google Maps — alarme de integração por taxa de erro.
//
// O `GEO_BUDGET_WARNING` cobre custo; nada cobria disponibilidade. Se o provedor
// começa a devolver 4xx/5xx em série, o operador só descobria quando o mapa quebrava.
// Aqui cada falha do provedor entra em `query_telemetry` com `severity = 'error'`
// (mesma tabela do `recordLatency`, sem DDL) e, quando a taxa da última hora passa de
// `ERROR_RATE_THRESHOLD`, grava UM alerta `INTEGRATION_FAILURE`.
//
// A deduplicação reusa `geo_cache` (PK atômica, já podada pelo cron `geo-cache-prune`),
// então chamadas concorrentes do gateway não duplicam o alerta e o registro some
// sozinho quando o cooldown expira.
// Nunca lança: observabilidade não pode derrubar a requisição de mapa.

import type { ProviderName } from "./providers/types.ts";

/** Taxa de erro (0..1) da última hora que dispara o alerta. Espelha o `>5%/h` do plano. */
export const ERROR_RATE_THRESHOLD = 0.05;
/** Amostra mínima antes de alertar — 2 erros em 3 chamadas não é integração caída. */
export const ERROR_RATE_MIN_SAMPLES = 20;
/** Janela de avaliação. */
export const ERROR_RATE_WINDOW_MINUTES = 60;
/** Depois de alertar, espera isso antes de poder alertar de novo (evita enxurrada). */
export const ERROR_ALERT_COOLDOWN_MINUTES = 60;

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };

export type ErrorOutcome = "ok" | "error" | "skipped";

/** Grava a falha em `query_telemetry` para entrar na conta da taxa. Best-effort. */
export async function recordProviderFailure(
  db: Db,
  provider: ProviderName,
  fn: string,
  errorCode: string,
  httpStatus: number,
): Promise<void> {
  try {
    await db.from("query_telemetry").insert({
      operation: `geo:${provider}`,
      table_name: "geo_gateway",
      rpc_name: fn,
      duration_ms: 0,
      severity: "error",
      error_message: `${errorCode} ${httpStatus}`.trim(),
    });
  } catch { /* medição best-effort */ }
}

export interface ErrorRateSample {
  total: number;
  errors: number;
}

/** Lê a janela em `query_telemetry` e devolve a taxa por provedor. */
export async function readErrorRate(db: Db, provider: ProviderName): Promise<ErrorRateSample> {
  const since = new Date(Date.now() - ERROR_RATE_WINDOW_MINUTES * 60_000).toISOString();
  try {
    const base = () => db
      .from("query_telemetry")
      .select("id", { count: "exact", head: true })
      .eq("table_name", "geo_gateway")
      .eq("operation", `geo:${provider}`)
      .gte("created_at", since);
    const total = await base();
    const errors = await base().eq("severity", "error");
    return { total: total.count ?? 0, errors: errors.count ?? 0 };
  } catch {
    return { total: 0, errors: 0 };
  }
}

export interface ErrorAlertDecision {
  fire: boolean;
  total: number;
  errors: number;
  pct: number;
}

/** Decide se deve alertar. Puro — testável sem banco. */
export function shouldAlert(sample: ErrorRateSample): ErrorAlertDecision {
  const pct = sample.total > 0 ? Math.round((sample.errors / sample.total) * 10000) / 100 : 0;
  const fire = sample.total >= ERROR_RATE_MIN_SAMPLES && sample.errors / sample.total > ERROR_RATE_THRESHOLD;
  return { fire, total: sample.total, errors: sample.errors, pct };
}

/**
 * Reserva o direito de alertar agora (cooldown de 1h por provedor).
 * Reusa `geo_cache`: a PK `key` garante que só uma chamada concorrente entra, e o
 * `geo-cache-prune` (cron diário) já limpa registros expirados. Sem DDL novo.
 * Devolve `true` só para quem conseguiu reservar — o resto desiste.
 */
export async function claimAlertSlot(db: Db, provider: ProviderName): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ERROR_ALERT_COOLDOWN_MINUTES * 60_000).toISOString();
  try {
    const { data, error } = await db
      .from("geo_cache")
      .insert({
        key: alertKey(provider),
        provider,
        function: "alert",
        response: {},
        expires_at: expiresAt,
      })
      .select("key");
    if (data?.[0]) return true;
    // Conflito de PK = já existe reserva. Renova só se a anterior já expirou.
    if (!error) return false;
    const { data: renewed } = await db
      .from("geo_cache")
      .update({ expires_at: expiresAt })
      .eq("key", alertKey(provider))
      .lt("expires_at", new Date().toISOString())
      .select("key");
    return Boolean(renewed?.[0]);
  } catch {
    return false;
  }
}

/** Libera o slot quando a taxa normalizou, para o próximo incidente alertar na hora. */
export async function releaseAlertSlot(db: Db, provider: ProviderName): Promise<void> {
  try {
    await db.from("geo_cache").delete().eq("key", alertKey(provider));
  } catch { /* best-effort */ }
}

function alertKey(provider: ProviderName): string {
  return `alert:geo_error:${provider}`;
}

/**
 * Avalia a taxa de erro do provedor e, se necessário, grava `INTEGRATION_FAILURE`.
 * Chamado no caminho de falha do gateway (catch) — nunca lança.
 */
export async function evaluateProviderErrors(
  db: Db,
  provider: ProviderName,
  fn: string,
): Promise<ErrorOutcome> {
  const sample = await readErrorRate(db, provider);
  const decision = shouldAlert(sample);
  if (!decision.fire) {
    // Recuperou: libera o slot para o próximo incidente alertar imediatamente.
    if (sample.total >= ERROR_RATE_MIN_SAMPLES) await releaseAlertSlot(db, provider);
    return "skipped";
  }
  if (!(await claimAlertSlot(db, provider))) return "skipped";

  const { error } = await db.from("alerts").insert({
    type: "INTEGRATION_FAILURE",
    severity: decision.pct >= 50 ? "CRITICAL" : "WARNING",
    title: `Falhas em série no provedor geo ${provider}`,
    message:
      `${decision.errors} de ${decision.total} chamadas a ${provider} falharam na última hora ` +
      `(${decision.pct}%). O mapa pode estar degradado; verifique a chave/contrato com o provedor.`,
    metadata: {
      provider,
      function: fn,
      window_minutes: ERROR_RATE_WINDOW_MINUTES,
      total: decision.total,
      errors: decision.errors,
      error_rate_pct: decision.pct,
      threshold_pct: ERROR_RATE_THRESHOLD * 100,
    },
  });
  if (error) return "skipped";
  return "error";
}
