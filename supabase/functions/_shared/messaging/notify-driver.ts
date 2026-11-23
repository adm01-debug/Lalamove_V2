/**
 * Liga o Bloco 6 (banco) ao motor: monta o contexto real do motorista, chama a
 * decisao do `dispatch.ts` e registra tudo em `notification_messages`.
 *
 * Etapas 88-100 do plano de mensageria. Nenhum texto nasce aqui: o corpo vem de
 * `message_templates` e as regras de "quando e por onde" do `dispatch.ts`.
 * Nada nesta funcao pode lancar: o webhook chama isto no meio do processamento
 * de um pedido e uma falha de mensagem nao pode derrubar o pedido.
 */

import {
  loadMessagingSettings,
  loadRoutes,
  loadTemplates,
  type MessageTemplate,
  type MessagingSettings,
  type ReadClient,
} from "./registry.ts";
import {
  dispatchDriverMessage,
  type ChannelSenders,
  type DispatchOutcome,
  type MessagePlan,
  type MessagingVars,
} from "./dispatch.ts";
import { clientMessageId as buildClientMessageId } from "./router.ts";
import { type MessageChannel, type MessageRole } from "./router.ts";
import { smsSegments } from "../channels/sms.ts";
import { maskPhone } from "../phone.ts";
import { zappChannelFromEnv } from "../channels/zapp.ts";
import { smsChannelFromEnv } from "../channels/sms.ts";

export interface MessagingClient extends ReadClient {
  // deno-lint-ignore no-explicit-any
  rpc(name: string, args?: Record<string, unknown>): any;
}

export interface NotifyDriverRequest {
  event: string;
  driverId: string;
  orderId?: string | null;
  role?: MessageRole;
  variables?: Record<string, string | number | null | undefined>;
  /** Separa dois avisos do mesmo evento no mesmo pedido (etapa 89). */
  seq?: number;
}

export interface NotifyDriverResult {
  outcome:
    | "sent"
    | "shadow"
    | "suppressed"
    | "failed"
    | "duplicate"
    | "ignored";
  reason: string | null;
  channel: MessageChannel | null;
  ledgerId: string | null;
  plan: MessagePlan | null;
}

export interface NotifyDriverOptions {
  now?: Date;
  /** Injetado nos testes; default: canais de ambiente (Zapp + SMS). */
  senders?: ChannelSenders;
}

/** Status de pedido que contam como "motorista em servico" (Z9). */
const ACTIVE_ORDER_STATUSES = ["PENDING", "MATCHED", "ON_GOING", "PICKED_UP"];

const RATE_WINDOW_MS = 10 * 60_000;

function ignored(reason: string): NotifyDriverResult {
  return { outcome: "ignored", reason, channel: null, ledgerId: null, plan: null };
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/**
 * Etapa 86/88: o catalogo tem vocabulario proprio (`order_number`,
 * `pickup_window`, `volume_count`...) e o webhook nao conhece esses nomes. Quem
 * traduz pedido -> variaveis e este modulo, para o aviso ao motorista nao
 * depender de cada case do webhook montar o texto certo.
 */
const ORDER_COLUMNS = [
  "lalamove_id",
  "pickup_address",
  "delivery_address",
  "customer_name",
  "customer_phone",
  "pickup_contact_name",
  "pickup_contact_phone",
  "scheduled_at",
  "estimated_delivery",
  "share_link",
  "internal_notes",
  "requires_pod",
  "pickup_latitude",
  "pickup_longitude",
  "driver_name",
].join(", ");

function asText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

/** Janela em horario de Sao Paulo (o painel e operado em BRT, nao em UTC). */
function formatWindow(value: unknown): string | null {
  const iso = asText(value);
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() - 3 * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)} ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** Link de mapa sem chave de API: o motorista abre no app que ja usa. */
function mapLink(lat: unknown, lng: unknown): string | null {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function contact(name: unknown, phone: unknown): string | null {
  const parts = [asText(name), asText(phone)].filter(Boolean);
  return parts.length ? parts.join(" - ") : null;
}

/** Monta o mapa de variaveis do evento a partir do pedido e do proximo stop. */
export async function loadOrderVariables(
  supabase: MessagingClient,
  orderId: string | null,
): Promise<MessagingVars> {
  if (!orderId) return {};
  const variables: MessagingVars = {};
  const { data, error } = await supabase
    .from("lalamove_orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (error || !data) return variables;
  const row = data as Row;

  const put = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    variables[key] = value;
  };

  put("order_number", asText(row.lalamove_id));
  put("pickup_address", asText(row.pickup_address));
  put("delivery_address", asText(row.delivery_address));
  put("pickup_contact", contact(row.pickup_contact_name, row.pickup_contact_phone));
  put("delivery_contact", contact(row.customer_name, row.customer_phone));
  put("pickup_window", formatWindow(row.scheduled_at));
  put("delivery_window", formatWindow(row.estimated_delivery));
  put("pickup_location_link", mapLink(row.pickup_latitude, row.pickup_longitude));
  put("share_link", asText(row.share_link));
  put("pickup_notes", asText(row.internal_notes));
  put("driver_name", asText(row.driver_name));
  if (row.requires_pod === true) put("pod_requirement", "\nComprovante: obrigatorio.");

  const { count } = await supabase
    .from("lalamove_stops")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if (count) put("volume_count", count);

  const { data: nextStop } = await supabase
    .from("lalamove_stops")
    .select("address, contact_name, contact_phone")
    .eq("order_id", orderId)
    .is("completed_at", null)
    .order("stop_index", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (nextStop) {
    const stop = nextStop as Row;
    put("next_stop_address", asText(stop.address));
    put("next_stop_contact", contact(stop.contact_name, stop.contact_phone));
  }
  return variables;
}

async function driverSnapshot(
  supabase: MessagingClient,
  driverId: string,
  phone: string,
  now: Date,
): Promise<{
  whatsappStatus: "valid" | "invalid" | "unknown";
  preferredChannel: "auto" | "whatsapp" | "sms";
  optedOut: boolean;
  hasActiveOrder: boolean;
  sendsInWindow: number;
  monthCostCents: number;
} | null> {
  const since = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
  const [driver, optedOut, active, sends, cost] = await Promise.all([
    supabase.from("drivers")
      .select("whatsapp_status, preferred_channel")
      .eq("id", driverId)
      .maybeSingle(),
    supabase.rpc("is_phone_opted_out", { p_phone: phone }),
    supabase.from("lalamove_orders")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverId)
      .in("status", ACTIVE_ORDER_STATUSES),
    supabase.from("notification_messages")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverId)
      .eq("direction", "outbound")
      .gte("created_at", since),
    supabase.rpc("messaging_month_cost_cents", {}),
  ]);
  if (driver.error) return null;
  const row = (driver.data ?? {}) as Record<string, unknown>;
  const status = row.whatsapp_status;
  const preferred = row.preferred_channel;
  return {
    whatsappStatus: status === "valid" || status === "invalid" ? status : "unknown",
    preferredChannel: preferred === "whatsapp" || preferred === "sms"
      ? preferred
      : "auto",
    optedOut: optedOut.data === true,
    hasActiveOrder: Number(active.count ?? 0) > 0,
    sendsInWindow: Number(sends.count ?? 0),
    monthCostCents: Number(cost.data ?? 0) || 0,
  };
}

function defaultSenders(settings: MessagingSettings): ChannelSenders {
  const senders: ChannelSenders = {};
  if (settings.whatsappProvider !== "off") {
    const zapp = zappChannelFromEnv();
    if (zapp) {
      senders.whatsapp = (phone, text, options) => zapp.sendText(phone, text, options);
    }
  }
  if (settings.smsProvider !== "none") {
    const sms = smsChannelFromEnv();
    if (sms) senders.sms = (phone, text, ref) => sms.send(phone, text, ref);
  }
  return senders;
}

function preview(text: string | undefined): string | null {
  if (!text) return null;
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

/**
 * Etapa 97: uma linha por evento no ledger, com `client_message_id` unico. O
 * insert acontece ANTES do envio (claim): dois webhooks do mesmo evento no mesmo
 * telefone resultam em uma mensagem so, nao em duas.
 */
async function claimLedger(
  supabase: MessagingClient,
  req: NotifyDriverRequest,
  channel: MessageChannel,
  role: MessageRole,
  clientMessageId: string,
): Promise<{ id: string } | { duplicate: true } | null> {
  const { data, error } = await supabase
    .from("notification_messages")
    .insert({
      event: req.event,
      role,
      direction: "outbound",
      channel,
      driver_id: req.driverId,
      order_id: req.orderId ?? null,
      client_message_id: clientMessageId,
      status: "queued",
      metadata: { source: "notify-driver" },
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { duplicate: true };
    return null;
  }
  return data?.id ? { id: String(data.id) } : null;
}

export async function notifyDriver(
  supabase: MessagingClient,
  req: NotifyDriverRequest,
  options: NotifyDriverOptions = {},
): Promise<NotifyDriverResult> {
  const now = options.now ?? new Date();
  const role: MessageRole = req.role ?? "driver";
  try {
    const { data: driverRow, error: driverError } = await supabase
      .from("drivers")
      .select("id, phone, name")
      .eq("id", req.driverId)
      .maybeSingle();
    if (driverError) return ignored("erro_ao_ler_motorista");
    if (!driverRow) return ignored("motorista_desconhecido");
    const phone = typeof driverRow.phone === "string" ? driverRow.phone : null;
    const driverName = typeof driverRow.name === "string" ? driverRow.name : null;

    const [settings, routes, templates, orderVariables] = await Promise.all([
      loadMessagingSettings(supabase),
      loadRoutes(supabase),
      loadTemplates(supabase, req.event, role),
      loadOrderVariables(supabase, req.orderId ?? null),
    ]);

    // `req.variables` por ultimo: quem chama corrige um valor quando o pedido nao
    // guarda ele (ex.: `change_summary` de ORDER_EDITED).
    const variables: MessagingVars = {
      ...orderVariables,
      ...(driverName ? { driver_name: driverName } : {}),
      ...(req.variables ?? {}),
    };

    const snapshot = phone
      ? await driverSnapshot(supabase, req.driverId, phone, now)
      : {
        whatsappStatus: "unknown" as const,
        preferredChannel: "auto" as const,
        optedOut: false,
        hasActiveOrder: false,
        sendsInWindow: 0,
        monthCostCents: 0,
      };
    if (!snapshot) return ignored("erro_ao_ler_motorista");

    const clientMessageId = buildClientMessageId(
      req.orderId ?? "",
      req.event,
      role,
      phone ?? "",
      req.seq ?? 0,
    );

    const outcome: DispatchOutcome = await dispatchDriverMessage({
      event: req.event,
      role,
      settings,
      routes,
      templates,
      now,
      driver: {
        phone,
        whatsappStatus: snapshot.whatsappStatus,
        preferredChannel: snapshot.preferredChannel,
        optedOut: snapshot.optedOut,
        hasActiveOrder: snapshot.hasActiveOrder,
        sendsInWindow: snapshot.sendsInWindow,
        monthCostCents: snapshot.monthCostCents,
      },
      senders: options.senders ?? defaultSenders(settings),
      variables,
      clientMessageId,
    });

    // Sem rota para evento x papel nao ha o que registrar: o evento nao e
    // tratado por este caminho.
    const ledgerChannel = outcome.plan.channels[0] ?? null;
    if (!ledgerChannel) {
      return {
        outcome: outcome.outcome === "shadow" ? "shadow" : "suppressed",
        reason: outcome.plan.reason,
        channel: null,
        ledgerId: null,
        plan: outcome.plan,
      };
    }

    if (outcome.outcome !== "sent") {
      await supabase.from("notification_messages").insert({
        event: req.event,
        role,
        direction: "outbound",
        channel: ledgerChannel,
        driver_id: req.driverId,
        order_id: req.orderId ?? null,
        recipient_phone: phone,
        client_message_id: clientMessageId,
        status: "suppressed",
        metadata: {
          source: "notify-driver",
          reason: outcome.plan.reason,
          attempts: outcome.attempts,
        },
      });
      return {
        outcome: outcome.outcome,
        reason: outcome.plan.reason ??
          outcome.attempts.at(-1)?.errorCode ?? "falha_no_envio",
        channel: ledgerChannel,
        ledgerId: null,
        plan: outcome.plan,
      };
    }

    const claim = await claimLedger(
      supabase,
      req,
      outcome.sentChannel ?? ledgerChannel,
      role,
      clientMessageId,
    );
    if (claim && "duplicate" in claim) {
      return {
        outcome: "duplicate",
        reason: "evento_repetido",
        channel: outcome.sentChannel,
        ledgerId: null,
        plan: outcome.plan,
      };
    }
    const ledgerId = claim && "id" in claim ? claim.id : null;
    const sentText = outcome.bodies[outcome.sentChannel ?? "" as MessageChannel];
    const template = outcome.sentChannel
      ? templates[outcome.sentChannel] as MessageTemplate | undefined
      : undefined;
    const sent = outcome.attempts.find((a) => a.success);

    if (ledgerId) {
      await supabase.from("notification_messages").update({
        status: "sent",
        sent_at: now.toISOString(),
        provider: outcome.sentChannel === "whatsapp"
          ? settings.whatsappProvider
          : settings.smsProvider,
        provider_message_id: sent?.providerMessageId ?? null,
        template_key: template?.key ?? null,
        template_version: template?.version ?? null,
        body_preview: preview(sentText),
        recipient_phone: phone,
        segments: outcome.sentChannel === "sms" && sentText
          ? smsSegments(sentText)
          : null,
      }).eq("id", ledgerId);
    }

    try {
      await supabase.rpc("record_messaging_usage", {
        p_channel: outcome.sentChannel,
        p_provider: outcome.sentChannel === "whatsapp"
          ? settings.whatsappProvider
          : settings.smsProvider,
        p_messages: 1,
        p_segments: outcome.sentChannel === "sms" && sentText
          ? smsSegments(sentText)
          : 1,
        p_cost_cents: 0,
      });
    } catch {
      // Custo sem tabela de preco fica registrado em 0: o teto (Z5) passa a
      // valer quando o preco por segmento existir.
    }

    return {
      outcome: "sent",
      reason: null,
      channel: outcome.sentChannel,
      ledgerId,
      plan: outcome.plan,
    };
  } catch (error) {
    // Mensagem nao pode derrubar o fluxo do pedido.
    console.error(
      `[Messaging] notifyDriver falhou (${req.event}/${maskPhone(req.driverId)}):`,
      error instanceof Error ? error.message : String(error),
    );
    return ignored("erro_inesperado");
  }
}
