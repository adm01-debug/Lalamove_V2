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
}

function isUniqueViolation(error: QueryResult["error"]): boolean {
  return !!error && (error.code === "23505" || /duplicate key/i.test(error.message));
}

async function findMessage(client: LedgerClient, write: LedgerWrite): Promise<Record<string, unknown> | null> {
  if (write.clientMessageId) {
    const { data } = await client
      .from("notification_messages")
      .select("id,status")
      .eq("client_message_id", write.clientMessageId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (write.providerMessageId) {
    const { data } = await client
      .from("notification_messages")
      .select("id,status")
      .eq("provider_message_id", write.providerMessageId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
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
    // que o motorista respondeu, quando a conhecemos.
    return insertInbound(client, write, options.senderPhone ?? null, existing?.id as string | undefined);
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