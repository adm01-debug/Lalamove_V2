/**
 * Etapa 114 (parte I/O): grava no banco o que `planInboundAction` decidiu.
 *
 * O plano e puro e testado sem banco; aqui so traduzimos cada efeito em escrita,
 * sempre best-effort: uma resposta do motorista nunca pode virar 5xx no callback
 * do Zapp (ele reenfileira e o motorista recebe duplicado). Efeito que nao deu
 * para gravar volta em `failed` e vira log.
 *
 * Limites reais do schema, que explicam os "skipped":
 * - `driver_incidents.driver_id` e NOT NULL — sem motorista o problema vira badge;
 * - `tracking_events` exige latitude/longitude — sem posicao conhecida nao ha evento;
 * - `lalamove_stop_proofs` separa POP de POD e `lalamove_stops` nao tipifica a
 *   parada, entao foto de comprovante fica no inbox ate a parada ser tipificada.
 */

import type { LedgerClient } from "./ledger.ts";
import type {
  InboundEffect,
  InboundPlan,
} from "../_shared/messaging/inbound-actions.ts";

/** Dados resolvidos da resposta, para executar o plano. */
export interface InboundRow {
  orderId: string | null;
  driverId: string | null;
  stopId: string | null;
  /** Telefone do remetente; o opt-out vale para ele, nao para a corrida. */
  phone: string | null;
  /** Id da linha inbound recem-gravada, para amarrar o rastro. */
  messageId: string | null;
  text: string;
  mediaUrl: string | null;
  /** Posicao conhecida (enviada na mensagem ou a ultima do rastreio). */
  position?: { lat: number; lng: number } | null;
}

export interface ExecuteResult {
  /** Efeitos efetivamente gravados, no formato `kind:detalhe` (vira log). */
  applied: string[];
  /** Efeitos que o schema nao permite gravar agora. */
  skipped: Array<{ reason: string; effect: string }>;
  /** Efeitos que o banco recusou. */
  failed: Array<{ reason: string; effect: string }>;
}

function isUniqueViolation(error: { message: string; code?: string } | null): boolean {
  return !!error && (error.code === "23505" || /duplicate key/i.test(error.message));
}

/**
 * Convite ao operador. So `motorista_recusou` vira alerta da tabela `alerts`:
 * problema ja tem linha em `driver_incidents` (que a operacao ve na tela de
 * incidentes) e texto livre vive no inbox do pedido — duplicar enche o painel.
 */
const BADGE_ALERT_TYPES: Record<string, { type: string; severity: string; title: string }> = {
  motorista_recusou: {
    type: "DRIVER_NO_CONFIRMATION",
    severity: "WARNING",
    title: "Motorista recusou o pedido",
  },
};

async function applyMetadata(
  client: LedgerClient,
  row: InboundRow,
  effect: Extract<InboundEffect, { kind: "order_metadata" }>,
  now: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!row.orderId) return { ok: false, reason: "sem_pedido" };
  const { data, error } = await client
    .from("lalamove_orders")
    .select("metadata")
    .eq("id", row.orderId)
    .maybeSingle();
  if (error) return { ok: false, reason: "leitura_falhou: " + error.message };
  const current = ((data as { metadata?: Record<string, unknown> } | null)?.metadata) ?? {};
  // Carimbo e "primeira vez": nao reescrevemos o que ja aconteceu.
  if (current[effect.key]) return { ok: true, reason: "ja_carimbado" };
  const { error: writeError } = await client
    .from("lalamove_orders")
    .update({ metadata: { ...current, [effect.key]: now } })
    .eq("id", row.orderId);
  if (writeError) return { ok: false, reason: "update_falhou: " + writeError.message };
  return { ok: true };
}

async function applyEffect(
  client: LedgerClient,
  row: InboundRow,
  effect: InboundEffect,
  now: string,
): Promise<{ applied?: string; skipped?: { reason: string; effect: string }; failed?: { reason: string; effect: string } }> {
  switch (effect.kind) {
    case "optout": {
      if (!row.phone) return { skipped: { reason: "sem_telefone", effect: "optout" } };
      const { error } = await client
        .from("notification_optouts")
        .insert({ phone: row.phone, reason: "resposta do motorista: " + row.text });
      // Telefone ja descadastrado e sucesso: o estado desejado vale.
      if (error && !isUniqueViolation(error)) {
        return { failed: { reason: "insert_falhou: " + error.message, effect: "optout" } };
      }
      return { applied: "optout" + (error ? ":ja_estava" : "") };
    }

    case "incident": {
      if (!row.driverId) return { skipped: { reason: "sem_motorista", effect: "incident" } };
      const { error } = await client
        .from("driver_incidents")
        .insert({
          driver_id: row.driverId,
          order_id: row.orderId,
          type: effect.type,
          severity: effect.severity,
          description: row.text,
          reported_by: "whatsapp",
          metadata: { source: "inbound_reply", message_id: row.messageId },
        });
      if (error) return { failed: { reason: "insert_falhou: " + error.message, effect: "incident" } };
      return { applied: "incident:" + effect.type };
    }

    case "order_metadata": {
      const result = await applyMetadata(client, row, effect, now);
      if (!result.ok) {
        return { failed: { reason: result.reason ?? "metadata_falhou", effect: "order_metadata:" + effect.key } };
      }
      return { applied: "order_metadata:" + effect.key + (result.reason ? ":" + result.reason : "") };
    }

    case "tracking_event": {
      if (!row.driverId) return { skipped: { reason: "sem_motorista", effect: "tracking_event:" + effect.eventType } };
      if (!row.position) return { skipped: { reason: "sem_posicao", effect: "tracking_event:" + effect.eventType } };
      const { error } = await client
        .from("tracking_events")
        .insert({
          order_id: row.orderId,
          driver_id: row.driverId,
          latitude: row.position.lat,
          longitude: row.position.lng,
          event_type: effect.eventType,
          metadata: { source: "inbound_reply", message_id: row.messageId },
        });
      if (error) return { failed: { reason: "insert_falhou: " + error.message, effect: "tracking_event:" + effect.eventType } };
      return { applied: "tracking_event:" + effect.eventType };
    }

    case "operator_badge": {
      const alert = BADGE_ALERT_TYPES[effect.reason];
      if (!alert) {
        // Sem tipo de alerta proprio: o aviso e a propria linha no inbox.
        return { skipped: { reason: "badge_no_inbox", effect: "operator_badge:" + effect.reason } };
      }
      const { error } = await client
        .from("alerts")
        .insert({
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: row.text,
          order_id: row.orderId,
          driver_id: row.driverId,
          metadata: { source: "inbound_reply", reason: effect.reason, message_id: row.messageId },
        });
      if (error) return { failed: { reason: "insert_falhou: " + error.message, effect: "operator_badge" } };
      return { applied: "alert:" + alert.type };
    }

    case "stop_proof": {
      // `lalamove_stop_proofs` existe, mas separa POP (coleta) de POD (entrega) e
      // `lalamove_stops` nao diz de que tipo e a parada — sem isso a foto iria
      // para a coluna errada. Fica no inbox ate a parada ser tipificada.
      return { skipped: { reason: "comprovante_sem_tipificacao", effect: "stop_proof" } };
    }
  }
}

/** Executa o plano na ordem dos efeitos. Nunca lanca. */
export async function executeInboundPlan(
  client: LedgerClient,
  plan: InboundPlan,
  row: InboundRow,
): Promise<ExecuteResult> {
  const result: ExecuteResult = { applied: [], skipped: [], failed: [] };
  const now = new Date().toISOString();

  for (const [index, effect] of plan.effects.entries()) {
    try {
      const outcome = await applyEffect(client, row, effect, now);
      if (outcome.applied) result.applied.push(outcome.applied);
      if (outcome.skipped) result.skipped.push(outcome.skipped);
      if (outcome.failed) result.failed.push(outcome.failed);
    } catch (error) {
      result.failed.push({
        reason: "excecao: " + (error instanceof Error ? error.message : String(error)),
        effect: `${effect.kind}#${index}`,
      });
    }
  }

  // Ultima resposta do motorista: alimenta o painel e o diagnostico de canal.
  if (row.driverId) {
    try {
      await client
        .from("drivers")
        .update({ last_reply_at: now })
        .eq("id", row.driverId);
    } catch {
      // best-effort: perder o carimbo nao invalida os efeitos acima
    }
  }

  return result;
}