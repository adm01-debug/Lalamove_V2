/**
 * Decisao de falar com o motorista (etapas 88-95 do plano de mensageria), com o
 * I/O separado: `planDriverMessage` responde "por qual canal e pode falar agora"
 * sem tocar em nada, e `dispatchDriverMessage` executa o plano com os canais
 * injetados. O `notify-driver` injeta os reais e grava o ledger.
 *
 * A separacao existe para poder testar sem rede e sem banco os casos que custam
 * dinheiro: numero sem WhatsApp, orcamento do mes estourado, madrugada, rajada
 * de mensagens e fallback que nunca dispara.
 */

import {
  DRIVER_RATE_LIMIT,
  findRoute,
  isInQuietHours,
  needsImmediateFallback,
  RATE_LIMIT_EXEMPT_EVENTS,
  type MessageChannel,
  type MessageRole,
  type QuietHours,
  type RouteRule,
} from "./router.ts";
import { MessagingSettings, MessageTemplate } from "./registry.ts";
import {
  missingTemplateVars,
  renderTemplate,
  type TemplateVars,
} from "../template.ts";
import type { SendOptions, TextChannelResult } from "../channels/zapp.ts";
import type { SmsSendResult } from "../channels/sms.ts";

export interface DriverSnapshot {
  phone: string | null;
  /** Etapa 79: 'invalid' e numero que o provedor recusou — nao insistir. */
  whatsappStatus: "valid" | "invalid" | "unknown";
  preferredChannel: "auto" | "whatsapp" | "sms";
  optedOut: boolean;
  /** Z9: motorista com pedido em andamento esta trabalhando, nao dormindo. */
  hasActiveOrder: boolean;
  sendsInWindow: number;
  monthCostCents: number;
}

export type PlanAction = "send" | "shadow" | "suppress";

export type DriverMessageReason =
  | "sem_telefone"
  | "opt_out"
  | "sem_rota"
  | "evento_desligado"
  | "sem_template"
  | "horario_silencio"
  | "limite_motorista"
  | "sem_canal_disponivel"
  | "orcamento_estourado"
  | "modo_sombra";

export interface MessagePlan {
  action: PlanAction;
  reason: DriverMessageReason | null;
  /** Canais efetivos na ordem de tentativa, ja filtrados pela configuracao. */
  channels: MessageChannel[];
}

export interface PlanInput {
  event: string;
  role: MessageRole;
  settings: MessagingSettings;
  routes: RouteRule[];
  templates: Partial<Record<MessageChannel, MessageTemplate>>;
  driver: DriverSnapshot;
  now: Date;
}

/** Z9: janela por papel; papel sem janela configurada nao tem silencio. */
function quietWindowFor(
  settings: MessagingSettings,
  role: MessageRole,
): QuietHours | null {
  const window = settings.quietHoursByRole[role];
  if (!window) return null;
  return {
    enabled: true,
    startHour: window.start,
    endHour: window.end,
    timezoneOffsetMinutes: -180,
  };
}

/**
 * O motorista nao escolhe a rota: ele indica preferencia (etapa 79) e o canal
 * que o provedor aceita. Preferencia vale como ordem, nunca como bloqueio —
 * motorista que prefere SMS ainda tem que receber o cancelamento por WhatsApp se
 * o SMS estiver desligado.
 */
function orderByPreference(
  channels: MessageChannel[],
  preferred: DriverSnapshot["preferredChannel"],
): MessageChannel[] {
  if (preferred === "auto") return channels;
  return [
    ...channels.filter((c) => c === preferred),
    ...channels.filter((c) => c !== preferred),
  ];
}

export function planDriverMessage(input: PlanInput): MessagePlan {
  const { driver, settings, routes, templates, event, role, now } = input;
  const suppress = (reason: DriverMessageReason): MessagePlan => ({
    action: "suppress",
    reason,
    channels: [],
  });

  if (!driver.phone) return suppress("sem_telefone");
  if (driver.optedOut) return suppress("opt_out");

  const route = findRoute(event, role, routes);
  if (!route || route.channels.length === 0) return suppress("sem_rota");
  if (route.is_enabled === false) return suppress("evento_desligado");

  const quiet = quietWindowFor(settings, role);
  const exemptFromQuiet = role === "driver" && driver.hasActiveOrder;
  if (quiet && !exemptFromQuiet && isInQuietHours(now, quiet)) {
    return suppress("horario_silencio");
  }

  const exemptFromLimit = (RATE_LIMIT_EXEMPT_EVENTS as readonly string[])
    .includes(event);
  if (!exemptFromLimit && driver.sendsInWindow >= DRIVER_RATE_LIMIT.maxMessages) {
    return suppress("limite_motorista");
  }

  const withTemplate = route.channels.filter((c) => templates[c]);
  if (withTemplate.length === 0) return suppress("sem_template");

  const available = withTemplate.filter((channel) => {
    if (channel === "whatsapp") {
      return settings.whatsappProvider !== "off" &&
        driver.whatsappStatus !== "invalid";
    }
    if (channel === "sms") return settings.smsProvider !== "none";
    return false;
  });
  if (available.length === 0) return suppress("sem_canal_disponivel");

  let channels = orderByPreference(available, driver.preferredChannel);

  // Z5: teto mensal. Estourou, corta o canal pago — o gratuito continua.
  if (
    settings.monthlyBudgetCents > 0 &&
    driver.monthCostCents >= settings.monthlyBudgetCents
  ) {
    const free = channels.filter((c) => c !== "sms");
    if (free.length === 0) return suppress("orcamento_estourado");
    channels = free;
  }

  // Etapa 145: modo sombra decide igual e nao envia. E o padrao de fabrica.
  if (settings.shadowMode) {
    return { action: "shadow", reason: "modo_sombra", channels };
  }
  return { action: "send", reason: null, channels };
}

export interface ChannelSenders {
  whatsapp?: (
    phone: string,
    text: string,
    options?: SendOptions,
  ) => Promise<TextChannelResult>;
  sms?: (phone: string, text: string, ref?: string) => Promise<SmsSendResult>;
}

export interface DispatchAttempt {
  channel: MessageChannel;
  success: boolean;
  error?: string;
  errorCode?: string;
  providerMessageId?: string | null;
}

export interface DispatchOutcome {
  outcome: "sent" | "shadow" | "suppressed" | "failed";
  plan: MessagePlan;
  attempts: DispatchAttempt[];
  sentChannel: MessageChannel | null;
  /** Texto final por canal tentado (ja renderizado). */
  bodies: Partial<Record<MessageChannel, string>>;
}

/**
 * O catalogo de mensageria tem vocabulario proprio (`order_number`,
 * `pickup_window`, `change_summary`...) alem das variaveis do mapa
 * (`TemplateVars`) — quem manda e o texto salvo em `message_templates`, nao uma
 * lista fechada aqui. `renderTemplate`/`missingTemplateVars` indexam por nome,
 * entao aceitam qualquer chave; o cast documenta isso.
 */
export type MessagingVars = Record<string, string | number | null | undefined>;

export interface DispatchInput extends PlanInput {
  senders: ChannelSenders;
  variables: MessagingVars;
  /** Etapa 89: id estavel do evento, casa o DLR do provedor com o ledger. */
  clientMessageId: string;
}

async function sendOnce(
  channel: MessageChannel,
  text: string,
  input: DispatchInput,
): Promise<DispatchAttempt> {
  const phone = input.driver.phone ?? "";
  if (channel === "whatsapp") {
    const sender = input.senders.whatsapp;
    if (!sender) {
      return {
        channel,
        success: false,
        error: "provedor de whatsapp nao configurado",
        errorCode: "instance_unavailable",
      };
    }
    const result = await sender(phone, text, {
      clientMessageId: input.clientMessageId,
      correlation: input.clientMessageId,
    });
    return {
      channel,
      success: result.success,
      error: result.error,
      errorCode: result.errorCode,
      providerMessageId: result.providerMessageId ?? null,
    };
  }
  if (channel === "sms") {
    const sender = input.senders.sms;
    if (!sender) {
      return {
        channel,
        success: false,
        error: "provedor de sms nao configurado",
        errorCode: "instance_unavailable",
      };
    }
    const result = await sender(phone, text, input.clientMessageId);
    return {
      channel,
      success: result.success,
      error: result.error,
      errorCode: result.success ? undefined : "provider_rejected",
      providerMessageId: result.providerId ?? null,
    };
  }
  return {
    channel,
    success: false,
    error: "canal sem transporte de texto",
    errorCode: "provider_rejected",
  };
}

export async function dispatchDriverMessage(
  input: DispatchInput,
): Promise<DispatchOutcome> {
  const plan = planDriverMessage(input);
  const attempts: DispatchAttempt[] = [];
  const bodies: Partial<Record<MessageChannel, string>> = {};

  if (plan.action !== "send") {
    return {
      outcome: plan.action === "shadow" ? "shadow" : "suppressed",
      plan,
      attempts,
      sentChannel: null,
      bodies,
    };
  }

  for (const channel of plan.channels) {
    const template = input.templates[channel];
    if (!template) break;
    // Texto com placeholder nao resolvido e pior que texto nenhum: o motorista
    // receberia "pedido {{order_number}}". Aborta antes de gastar.
    const missing = missingTemplateVars(
      template.body,
      input.variables as TemplateVars,
    );
    if (missing.length > 0) {
      attempts.push({
        channel,
        success: false,
        error: `variaveis faltando: ${missing.join(", ")}`,
        errorCode: "variaveis_faltando",
      });
      break;
    }
    const text = renderTemplate(template.body, input.variables as TemplateVars);
    bodies[channel] = text;
    const attempt = await sendOnce(channel, text, input);
    attempts.push(attempt);
    if (attempt.success) {
      return { outcome: "sent", plan, attempts, sentChannel: channel, bodies };
    }
    // Etapa 91: numero invalido/instancia fora do ar cai no proximo canal na
    // hora. Erro que pode passar (rate limit, timeout) espera o fallback
    // temporizado da etapa 90 em vez de gastar dois canais.
    if (!needsImmediateFallback(attempt.errorCode)) break;
  }

  return { outcome: "failed", plan, attempts, sentChannel: null, bodies };
}
