/**
 * Atualidade do dado antes de virar alerta.
 *
 * O cron do Guardian roda a cada 2 min e lia TODO registro de `active_tracking`,
 * sem olhar quando o dado foi atualizado. Com trackings orfaos (nunca encerrados
 * depois que a sincronizacao parou) ligar DRIVER_STOPPED/ROUTE_DEVIATION gerava
 * alerta CRITICO falso do tipo "motorista parado ha 180000 minutos". O mesmo valia
 * para MISSING_POD: pedido de agosto virava "sem comprovante ha 94 mil minutos".
 */
export const MAX_TRACKING_AGE_MIN = 15;

/** Janela em que falta de POD ainda vale alerta/ação (pedido do dia, não historico). */
export const POD_ALERT_LOOKBACK_HOURS = 24;

/** Idade do dado em minutos; `null` quando a data e ausente ou invalida. */
export function trackingAgeMinutes(lastUpdated: string | null | undefined, now: Date): number | null {
  if (!lastUpdated) return null;
  const ts = new Date(lastUpdated).getTime();
  if (!Number.isFinite(ts)) return null;
  return (now.getTime() - ts) / 60000;
}

/** `true` somente quando o dado tem no maximo `maxAgeMin` minutos. */
export function isRecent(
  timestamp: string | null | undefined,
  now: Date,
  maxAgeMin: number,
): boolean {
  const age = trackingAgeMinutes(timestamp, now);
  if (age === null) return false;
  return age <= maxAgeMin;
}

/**
 * `true` somente quando o tracking foi atualizado dentro da janela aceitavel.
 * Sem data, data invalida ou dado velho = nao avaliar alerta.
 */
export function isTrackingFresh(
  lastUpdated: string | null | undefined,
  now: Date,
  maxAgeMin: number = MAX_TRACKING_AGE_MIN,
): boolean {
  return isRecent(lastUpdated, now, maxAgeMin);
}

/** `true` quando o acontecimento esta dentro da janela de horas informada. */
export function isWithinLookbackHours(
  timestamp: string | null | undefined,
  now: Date,
  hours: number = POD_ALERT_LOOKBACK_HOURS,
): boolean {
  return isRecent(timestamp, now, hours * 60);
}