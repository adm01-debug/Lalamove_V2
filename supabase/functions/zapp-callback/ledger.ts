/**
 * Etapa 96: escrita no ledger `notification_messages` a partir do callback.
 *
 * O client do Supabase entra por interface minima (so o subconjunto que usamos)
 * para que os testes injetem um fake e exercitem a regra sem banco: e aqui que
 * ficam as decisoes que erram caro - achar a linha certa, nao regredir estado e
 * nao duplicar inbound.
 */

import type { LedgerWrite, ProviderStatus } from "./payload.ts";
import { nextStatus, timestampColumnFor } from "./payload.ts";
import type { InboundChoice } from "../_shared/messaging/inbound.ts";
import { classifyReply } from "../_shared/messaging/inbound-event.ts";
import { planInboundAction } from "../_shared/messaging/inbound-actions.ts";
import { executeInboundPlan } from "./inbound-exec.ts";

/** Colunas que a resposta do motorista precisa da mensagem original. */
const REPLY_COLUMNS = "id,status,order_id,driver_id,stop_id,event,metadata";

/** Subconjunto de `@supabase/supabase-js` usado aqui. */
export interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

export interface LedgerQuery {
  select(columns?: string): LedgerQuery;
  insert(values: Record<string, unknown>): LedgerQuery;
  update(values: Record<string, unknown>): LedgerQuery;
  eq(column: string, value: unknown): LedgerQuery;
  is(column: string, value: unknown): LedgerQuery;
  order(column: string, options?: { ascending?: boolean }): LedgerQuery;
  limit(count: number): LedgerQuery;
  maybeSingle(): Promise<QueryResult>;
  single(): Promise<QueryResult>;
  then<T>(resolve: (value: QueryResult) => T): Promise<T>;
}

export interface LedgerClient {
  from(table: string): LedgerQuery;
}

export interface ApplyResult {
  outcome: "updated" | "inserted" | "duplicate" | "ignored" | "not_found";
  reason?: string;
  messageId?: string;
  /** Etapa 114: efeitos gravados a partir da resposta (vira log). */
  effects?: string[];
  /** Efeitos que nao puderam ser gravados, com o motivo. */
  skipped?: Array<{ reason: string; effect: string }>;
  failed?: Array<{ reason: string; effect: string }>;
}

function isUniqueViolation(error: QueryResult["error"]): boolean {
  return !!error && (error.code === "23505" || /duplicate key/i.test(error.message));
}

async function findMessage(client: LedgerClient, write: LedgerWrite): Promise<Record<string, unknown> | null> {
  if (write.clientMessageId) {
    const { data } = await client
      .from("notification_messages")
      .select(REPLY_COLUMNS)
      .eq("client_message_id", write.clientMessageId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (write.providerMessageId) {
    const { data } = await client
      .from("notification_messages")
      .select(REPLY_COLUMNS)
      .eq("provider_message_id", write.providerMessageId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

/** Ids resolvidos da mensagem que o motorista respondeu. */
interface ReplyIds {
  orderId: string | null;
  driverId: string | null;
  stopId: string | null;
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function replyIds(row: Record<string, unknown> | null): ReplyIds {
  return {
    orderId: asId(row?.order_id),
    driverId: asId(row?.driver_id),
    stopId: asId(row?.stop_id),
  };
}

/**
 * Sem `in_reply_to`, a resposta so traz o telefone. A ultima mensagem enviada
 * para aquele telefone devolve evento, pedido e motorista — e e por ela que
 * sabemos o que o motorista estava respondendo (M4, M2, M10...).
 */
async function findLastOutbound(client: LedgerClient, phone: string | null): Promise<Record<string, unknown> | null> {
  if (!phone) return null;
  const { data } = await client
    .from("notification_messages")
    .select(REPLY_COLUMNS)
    .eq("recipient_phone", phone)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1);
  if (!Array.isArray(data) || !data.length) return null;
  return data[0] as Record<string, unknown>;
}

/** Opcoes que o envio registrou (etapa 44), quando existirem. */
function choicesFromMetadata(metadata: unknown): InboundChoice[] {
  const integration = (metadata as { integration?: { choices?: unknown } } | null)?.integration;
  const choices = integration?.choices;
  if (!Array.isArray(choices)) return [];
  return choices.flatMap((c) => {
    const item = c as { id?: unknown; digit?: unknown };
    if (typeof item?.id !== "string" || typeof item?.digit !== "string") return [];
    return [{ id: item.id, digit: item.digit }];
  });
}

/** Ultima posicao do rastreio ativo — `tracking_events` exige lat/lng. */
async function lookupPosition(
  client: LedgerClient,
  driverId: string | null,
): Promise<{ lat: number; lng: number } | null> {
  if (!driverId) return null;
  const { data } = await client
    .from("active_tracking")
    .select("current_latitude,current_longitude")
    .eq("driver_id", driverId)
    .is("tracking_ended_at", null)
    .order("last_updated", { ascending: false })
    .limit(1);
  const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  const lat = first?.current_latitude;
  const lng = first?.current_longitude;
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return null;
  return { lat: numLat, lng: numLng };
}

/**
 * Etapa 16: inbound vindo de numero que nunca recebeu nada. Nao descartamos -
 * o operador precisa ver a resposta no inbox do pedido. Grava uma linha nova
 * com direction=inbound e o telefone do remetente.
 */
async function insertInbound(
  client: LedgerClient,
  write: LedgerWrite,
  senderPhone: string | null,
  ids: ReplyIds,
  replyToId?: string,
): Promise<ApplyResult> {
  const inbound = write.inbound!;
  const { data, error } = await client
    .from("notification_messages")
    .insert({
      event: "MESSAGE_INBOUND",
      role: "driver",
      direction: "inbound",
      channel: "whatsapp",
      provider: "zapp",
      recipient_phone: senderPhone,
      provider_message_id: write.providerMessageId,
      client_message_id: write.clientMessageId,
      body_preview: write.bodyPreview,
      status: "delivered",
      // Amarrar pedido/motorista e o que faz a resposta aparecer no cartao do
      // pedido (etapa 67) — sem isso ela ficava solta no ledger.
      order_id: ids.orderId,
      driver_id: ids.driverId,
      stop_id: ids.stopId,
      occurred_at: write.occurredAt,
      delivered_at: write.occurredAt ?? new Date().toISOString(),
      metadata: {
        media_url: inbound.mediaUrl,
        choice_id: inbound.choiceId,
        location: inbound.location,
        in_reply_to: replyToId ?? inbound.inReplyTo,
        correlation: inbound.correlation,
      },
    })
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return { outcome: "duplicate", reason: "inbound_repetido" };
    return { outcome: "ignored", reason: "insert_falhou: " + error.message };
  }
  return { outcome: "inserted", messageId: (data as { id?: string } | null)?.id };
}

/**
 * Etapa 114: efeito da resposta no sistema — carimbo no pedido, incidente do
 * motorista, evento de rastreio, opt-out e alerta de recusa. Roda depois da
 * linha gravada: a linha e a garantia de que a resposta nao se perde, e uma
 * falha de efeito nunca pode virar retry do Zapp (duplicaria a mensagem).
 */
async function applyInboundEffects(
  client: LedgerClient,
  write: LedgerWrite,
  replied: Record<string, unknown> | null,
  ids: ReplyIds,
  inserted: ApplyResult,
  senderPhone: string | null,
): Promise<ApplyResult> {
  const inbound = write.inbound!;
  const event = typeof replied?.event === "string" ? replied.event : null;
  try {
    const reply = classifyReply(event, inbound.text ?? "", choicesFromMetadata(replied?.metadata));
    const position = inbound.location ?? await lookupPosition(client, ids.driverId);
    const plan = planInboundAction(reply, {
      orderId: ids.orderId,
      driverId: ids.driverId,
      hasDriverPosition: !!position,
      stopId: ids.stopId,
      mediaUrl: inbound.mediaUrl,
    });
    const executed = await executeInboundPlan(client, plan, {
      orderId: ids.orderId,
      driverId: ids.driverId,
      stopId: ids.stopId,
      phone: senderPhone,
      messageId: inserted.messageId ?? null,
      text: inbound.text ?? "",
      mediaUrl: inbound.mediaUrl,
      position,
    });
    return {
      ...inserted,
      effects: executed.applied,
      skipped: [...plan.skipped, ...executed.skipped],
      failed: executed.failed,
    };
  } catch (error) {
    return {
      ...inserted,
      failed: [{
        reason: "excecao: " + (error instanceof Error ? error.message : String(error)),
        effect: "plan",
      }],
    };
  }
}

export interface ApplyOptions {
  client: LedgerClient;
  write: LedgerWrite;
  /** Telefone do remetente (inbound) ou destino, quando o payload trouxer. */
  senderPhone?: string | null;
}

/**
 * Aplica a escrita. Regras:
 *  - status: nunca regride (etapa 74), so preenche a data do status novo.
 *  - inbound: se a linha da mensagem original existir, grava uma linha
 *    direction=inbound referenciando-a por metadata.in_reply_to; se nao existir,
 *    grava solta (nao se perde resposta).
 *  - outbound_manual: so marca a mensagem como existente quando achamos a linha;
 *    sem linha, ignora - nao inventa envio que o Lalamove nao fez.
 */
export async function applyCallback(options: ApplyOptions): Promise<ApplyResult> {
  const { client, write } = options;
  if (write.ignore) return { outcome: "ignored", reason: write.ignoreReason };

  const existing = await findMessage(client, write);

  if (write.kind === "status") {
    if (!existing) {
      // Etapa 16: status sem linha conhecida = envio feito por outro caminho
      // (operator mandou pelo Zapp, ou a linha ainda nao foi criada). Grava a
      // referencia minima para nao perder o rastro de entrega.
      return { outcome: "not_found", reason: "mensagem_desconhecida" };
    }
    const current = typeof existing.status === "string" ? existing.status : null;
    const finalStatus = nextStatus(current, write.status as ProviderStatus);
    if (!finalStatus) {
      return { outcome: "ignored", reason: "transicao_invalida", messageId: String(existing.id) };
    }
    const patch: Record<string, unknown> = {
      status: finalStatus,
      occurred_at: write.occurredAt,
      provider_sequence: write.sequence,
    };
    if (write.errorCode) patch.error_code = write.errorCode;
    const column = timestampColumnFor(finalStatus);
    if (column) patch[column] = write.occurredAt ?? new Date().toISOString();
    if (!write.providerMessageId) delete patch.provider_message_id;
    else patch.provider_message_id = write.providerMessageId;

    const { error } = await client
      .from("notification_messages")
      .update(patch)
      .eq("id", existing.id);
    if (error) return { outcome: "ignored", reason: "update_falhou: " + error.message };
    return { outcome: "updated", messageId: String(existing.id) };
  }

  if (write.kind === "inbound") {
    // A resposta sempre vira linha nova. `in_reply_to` aponta para a mensagem
    // que o motorista respondeu; sem ela, a ultima mensagem enviada para o
    // telefone diz o que ele estava respondendo.
    const replied = existing ?? await findLastOutbound(client, options.senderPhone ?? null);
    const ids = replyIds(replied);
    const inserted = await insertInbound(
      client,
      write,
      options.senderPhone ?? null,
      ids,
      existing?.id as string | undefined,
    );
    // Duplicata nao reexecuta efeito: o motorista responder duas vezes o mesmo
    // "1" nao pode virar dois carimbos.
    if (inserted.outcome !== "inserted") return inserted;
    return await applyInboundEffects(client, write, replied, ids, inserted, options.senderPhone ?? null);
  }

  // outbound_manual: resposta humana do operador. So registra quando a linha da
  // conversa existe; sem ela nao ha o que atualizar.
  if (!existing) return { outcome: "not_found", reason: "conversa_desconhecida" };
  const { error } = await client
    .from("notification_messages")
    .update({
      metadata: { manual_reply_at: write.occurredAt ?? new Date().toISOString() },
    })
    .eq("id", existing.id);
  if (error) return { outcome: "ignored", reason: "update_falhou: " + error.message };
  return { outcome: "updated", messageId: String(existing.id) };
}