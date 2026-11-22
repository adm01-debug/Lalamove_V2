// Horário de silêncio (D3, docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md etapa 58): alertas
// geo-disparados para o fornecedor/cliente não saem fora de 07:00-20:00 America/Sao_Paulo.
// `index.ts` usa estas funções puras (sem I/O) para decidir se envia agora ou reenfileira —
// mesmo padrão de `lalamove-webhook/security.ts` + `security.test.ts`.
//
// `metadata.always_send` (motorista chegou, gravado por `geo_emit_event` na migration
// 20261122130100_geo_foundation.sql) e escalonamento (`is_escalation`) furam a janela;
// essa decisão fica em `index.ts`, não aqui.

/** Tipos cujo envio respeita o horário de silêncio quando chamados sem `always_send`. */
export const QUIET_HOURS_ALERT_TYPES: ReadonlySet<string> = new Set([
  "DRIVER_APPROACHING_PICKUP",
  "DRIVER_ARRIVED_PICKUP",
  "DRIVER_APPROACHING_DELIVERY",
  "DRIVER_ARRIVED_DELIVERY",
  "ETA_DELAY",
  "SUPPLIER_DELAY_NOTICE",
]);

export interface QuietHours {
  /** "HH:MM" (vem de `geo_defaults.quiet_hours_start`, tipo `time`) */
  start: string;
  /** "HH:MM" (vem de `geo_defaults.quiet_hours_end`, tipo `time`) */
  end: string;
  /** IANA tz, ex. "America/Sao_Paulo" (`geo_defaults.quiet_hours_tz`) */
  tz: string;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localParts(date: Date, tz: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Converte um horário local de `tz` (ano/mês/dia/hora/minuto) para o instante UTC
 * correspondente. `day` pode passar de 28-31 de propósito (ex. "amanhã") — `Date.UTC`
 * normaliza o overflow para o próximo mês.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const local = localParts(guess, tz);
  const asUtcOfLocal = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return new Date(guess.getTime() - (asUtcOfLocal - guess.getTime()));
}

function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.slice(0, 5).split(":").map(Number);
  return { hour, minute };
}

/** `true` quando `now` cai dentro de `[start, end)` no horário local de `qh.tz`. */
export function isWithinQuietHours(now: Date, qh: QuietHours): boolean {
  const { hour, minute } = localParts(now, qh.tz);
  const nowMin = minutesOfDay(hour, minute);
  const start = parseHHMM(qh.start);
  const end = parseHHMM(qh.end);
  return nowMin >= minutesOfDay(start.hour, start.minute) && nowMin < minutesOfDay(end.hour, end.minute);
}

/** Próximo instante (UTC) em que a janela de envio volta a abrir, a partir de `now`. */
export function nextAllowedTime(now: Date, qh: QuietHours): Date {
  const { year, month, day, hour, minute } = localParts(now, qh.tz);
  const start = parseHHMM(qh.start);
  const dayOffset = minutesOfDay(hour, minute) < minutesOfDay(start.hour, start.minute) ? 0 : 1;
  return zonedTimeToUtc(year, month, day + dayOffset, start.hour, start.minute, qh.tz);
}
