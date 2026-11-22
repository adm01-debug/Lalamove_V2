/**
 * Roteador evento x papel e regras de envio (etapas 88-95 do plano de mensageria).
 *
 * Tudo aqui e funcao pura: o `send-notification` continua dono do banco, do HTTP
 * e do `claim_alert_notification`. Separar essas decisoes do I/O e o que permite
 * testar os casos de borda que custam dinheiro — limite por motorista, silencio
 * noturno, fallback — sem subir edge function.
 */

export type MessageRole = "driver" | "pickup_contact" | "delivery_contact" | "internal";
export type MessageChannel = "whatsapp" | "sms" | "email" | "slack" | "n8n";

/** Estados que o canal devolve e que disparam SMS na hora (etapa 91). */
export const IMMEDIATE_FALLBACK_REASONS = [
  "invalid_number",
  "instance_unavailable",
  "recipient_blocked",
  "channel_down",
] as const;
export type ImmediateFallbackReason = (typeof IMMEDIATE_FALLBACK_REASONS)[number];

export interface RouteRule {
  event: string;
  role: MessageRole;
  /** Canais na ordem de tentativa, ex.: `["whatsapp", "sms"]`. */
  channels: MessageChannel[];
  fallback_after_min: number;
  requires_reply: boolean;
  reply_timeout_min: number;
  is_enabled: boolean;
}

/**
 * Catalogo padrao. Espelha o que a etapa 78 vai semear em `notification_routes`;
 * enquanto a tabela nao existe (Bloco 6, DDL pendente) este e o mapa em vigor.
 * A ordem importa: o primeiro canal e o preferido e o segundo e a contingencia.
 */
export const DEFAULT_ROUTES: RouteRule[] = [
  { event: "DRIVER_ASSIGNED", role: "driver", channels: ["whatsapp", "sms"], fallback_after_min: 10, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "DRIVER_APPROACHING_PICKUP", role: "driver", channels: ["whatsapp"], fallback_after_min: 0, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "DRIVER_ARRIVED_PICKUP", role: "driver", channels: ["whatsapp"], fallback_after_min: 0, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "DRIVER_APPROACHING_DELIVERY", role: "driver", channels: ["whatsapp"], fallback_after_min: 0, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "DRIVER_ARRIVED_DELIVERY", role: "driver", channels: ["whatsapp"], fallback_after_min: 0, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "ETA_DELAY", role: "driver", channels: ["whatsapp"], fallback_after_min: 0, requires_reply: true, reply_timeout_min: 15, is_enabled: true },
  { event: "ORDER_CANCELLED", role: "driver", channels: ["whatsapp", "sms"], fallback_after_min: 10, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "ORDER_CANCELLED", role: "pickup_contact", channels: ["whatsapp", "sms"], fallback_after_min: 10, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
  { event: "ORDER_COMPLETED", role: "driver", channels: ["whatsapp"], fallback_after_min: 0, requires_reply: false, reply_timeout_min: 0, is_enabled: true },
];

/**
 * Resolve a lista ordenada de canais de um par evento x papel.
 * `routes` vazio cai no catalogo padrao; rota desabilitada devolve `[]` (o evento
 * e simplesmente nao sai por canal nenhum, que e o que "desligado" significa).
 */
export function resolveChannels(
  event: string,
  role: MessageRole,
  routes: RouteRule[] = DEFAULT_ROUTES,
): MessageChannel[] {
  const rule = routes.find((r) => r.event === event && r.role === role);
  if (!rule) return [];
  if (!rule.is_enabled) return [];
  return [...rule.channels];
}

export function findRoute(
  event: string,
  role: MessageRole,
  routes: RouteRule[] = DEFAULT_ROUTES,
): RouteRule | null {
  return routes.find((r) => r.event === event && r.role === role) ?? null;
}

/**
 * Etapa 89: chave de idempotencia. Dois webhooks do mesmo evento para o mesmo
 * telefone tem que virar uma mensagem so — e o `seq` existe para o caso legitimo
 * de dois avisos do mesmo evento no mesmo pedido (ex.: 2x ETA_DELAY).
 */
export function clientMessageId(
  orderId: string,
  event: string,
  role: MessageRole,
  phone: string,
  seq: number,
): string {
  return [orderId, event, role, phone.replace(/\D/g, ""), String(seq)].join("|");
}

/**
 * Etapa 90: quando o fallback temporizado deve disparar. Sem `sentAt` nao ha o
 * que cronometrar; `fallback_after_min` 0 significa "so fallback imediato".
 */
export function shouldFallback(
  sentAt: Date | null,
  now: Date,
  fallbackAfterMin: number,
): boolean {
  if (!sentAt) return false;
  if (fallbackAfterMin <= 0) return false;
  return now.getTime() - sentAt.getTime() >= fallbackAfterMin * 60_000;
}

/** Etapa 91: motivos que pulam a espera e vao direto para SMS. */
export function needsImmediateFallback(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return (IMMEDIATE_FALLBACK_REASONS as readonly string[]).includes(reason);
}

/**
 * Etapa 93: horario de silencio por papel. Motorista com pedido ativo e isento
 * (ele esta trabalhando); fornecedor e cliente seguem a janela configuravel.
 */
export interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
  timezoneOffsetMinutes: number;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: true,
  startHour: 20,
  endHour: 7,
  timezoneOffsetMinutes: -180,
};

/** Hora local (0-23) do instante no fuso informado. */
export function localHour(at: Date, timezoneOffsetMinutes: number): number {
  const shifted = new Date(at.getTime() + timezoneOffsetMinutes * 60_000);
  return shifted.getUTCHours();
}

export function isInQuietHours(at: Date, quiet: QuietHours = DEFAULT_QUIET_HOURS): boolean {
  if (!quiet.enabled) return false;
  const hour = localHour(at, quiet.timezoneOffsetMinutes);
  if (quiet.startHour === quiet.endHour) return false;
  // Janela que vira a meia-noite (20h -> 7h) precisa do OU, nao do E.
  if (quiet.startHour > quiet.endHour) {
    return hour >= quiet.startHour || hour < quiet.endHour;
  }
  return hour >= quiet.startHour && hour < quiet.endHour;
}

export interface SilenceDecision {
  suppressed: boolean;
  /** Quando `suppressed`, o instante em que a janela abre de novo. */
  releaseAt: Date | null;
}

/**
 * Decide se a mensagem espera. Motorista com pedido ativo nunca espera; os
 * demais papeis esperam ate a janela abrir (o `job_queue` reenfileira).
 */
export function applyQuietHours(
  role: MessageRole,
  at: Date,
  hasActiveOrder: boolean,
  quiet: QuietHours = DEFAULT_QUIET_HOURS,
): SilenceDecision {
  if (role === "driver" && hasActiveOrder) return { suppressed: false, releaseAt: null };
  if (!isInQuietHours(at, quiet)) return { suppressed: false, releaseAt: null };

  const hour = localHour(at, quiet.timezoneOffsetMinutes);
  // Quantas horas faltam para `endHour`.
  const hoursUntilOpen = quiet.endHour > hour ? quiet.endHour - hour : 24 - hour + quiet.endHour;
  const releaseAt = new Date(at.getTime() + hoursUntilOpen * 3_600_000 - (at.getTime() % 3_600_000));
  return { suppressed: true, releaseAt };
}

/** Etapa 95: teto de mensagens automaticas por motorista em uma janela. */
export const DRIVER_RATE_LIMIT = { maxMessages: 6, windowMs: 10 * 60_000 };

/** Evento que nunca e bloqueado pelo limite (M8 = motorista chegou). */
export const RATE_LIMIT_EXEMPT_EVENTS = ["DRIVER_ARRIVED_PICKUP", "DRIVER_ARRIVED_DELIVERY"] as const;

export interface RateLimitInput {
  recentSends: Date[];
  now: Date;
  event: string;
  maxMessages?: number;
  windowMs?: number;
}

export function isRateLimited(input: RateLimitInput): boolean {
  const { recentSends, now, event } = input;
  const maxMessages = input.maxMessages ?? DRIVER_RATE_LIMIT.maxMessages;
  const windowMs = input.windowMs ?? DRIVER_RATE_LIMIT.windowMs;
  if ((RATE_LIMIT_EXEMPT_EVENTS as readonly string[]).includes(event)) return false;
  const inWindow = recentSends.filter((d) => now.getTime() - d.getTime() < windowMs);
  return inWindow.length >= maxMessages;
}

/** Etapa 92: opt-out vale para todos os canais do telefone. */
export function suppressionReason(optedOut: boolean, rateLimited: boolean): string | null {
  if (optedOut) return "opted_out";
  if (rateLimited) return "rate_limited";
  return null;
}