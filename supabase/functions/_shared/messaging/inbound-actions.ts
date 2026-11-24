/**
 * Efeito de cada resposta do motorista (etapa 114 do plano de mensageria).
 *
 * A etapa 113 responde "o que ele quis dizer"; aqui responde "o que fazer com
 * isso". Decisao pura: o chamador (`zapp-callback`, etapa 96) so executa o que
 * sai daqui. Manter a regra fora do I/O e o que permite testar o caso chato —
 * "quebrei o pneu" sendo incidente e nao confirmacao — sem banco.
 *
 * Limites reais do schema, que definem o desenho:
 * - `driver_incidents.type` e enum (ROUTE_DEVIATION, LONG_STOP, LATE_DELIVERY,
 *   CUSTOMER_COMPLAINT, DAMAGE, OTHER) e `driver_id` e NOT NULL — sem motorista
 *   ligado ao pedido nao existe incidente possivel;
 * - `tracking_events` exige latitude/longitude NOT NULL — sem a ultima posicao
 *   conhecida nao ha evento de rastreio, so o carimbo no pedido.
 */

import { classifyInboundMedia, type InboundResult } from "./inbound.ts";

/** O que o pedido precisa ter para cada efeito ser gravavel. */
export interface InboundContext {
  orderId: string | null;
  driverId: string | null;
  /**
   * Se existe posicao conhecida do motorista. `tracking_events` exige lat/lng e
   * `driver_id` NOT NULL, entao isto so vale quando ha motorista E posicao.
   */
  hasDriverPosition: boolean;
  /** Parada a que a mensagem se refere — ancora comprovante (foto) ou avaria. */
  stopId?: string | null;
  /** Mídia enviada junto, quando a resposta veio com foto (etapa 116). */
  mediaUrl?: string | null;
}

export type IncidentType =
  | "LATE_DELIVERY"
  | "DAMAGE"
  | "CUSTOMER_COMPLAINT"
  | "OTHER";

export type InboundEffect =
  | { kind: "optout" }
  | {
    kind: "incident";
    type: IncidentType;
    severity: "LOW" | "MEDIUM" | "HIGH";
  }
  | { kind: "order_metadata"; key: string; value: string }
  | { kind: "tracking_event"; eventType: string }
  | { kind: "operator_badge"; reason: string }
  | { kind: "stop_proof"; stopId: string; imageUrl: string | null };

export interface InboundPlan {
  /** Efeitos na ordem em que devem ser gravados. Vazio = nada a fazer. */
  effects: InboundEffect[];
  /** Por que um efeito esperado nao entrou — vira log e evita "sumiu sem rastro". */
  skipped: Array<{ reason: string; effect: string }>;
}

const EMPTY_SKIPPED: Array<{ reason: string; effect: string }> = [];

/**
 * Sinais que mudam a classificacao do incidente. Ordem importa: uma mensagem que
 * fala de batida e tambem de atraso e `DAMAGE`, porque e o que exige acao agora.
 */
const DAMAGE_HINTS = [
  "bati",
  "bateu",
  "batida",
  "acidente",
  "avaria",
  "quebrou",
  "quebrado",
  "quebrei",
  "pneu",
  "furou",
];
const COMPLAINT_HINTS = [
  "cliente reclamou",
  "cliente nao atende",
  "ninguem atende",
  "portao fechado",
];

/** `tracking_events` exige motorista e coordenada — sem os dois nao ha evento. */
function canTrack(ctx: InboundContext): boolean {
  return Boolean(ctx.driverId) && ctx.hasDriverPosition;
}

/** Motivo padrao quando falta o que `tracking_events` exige. */
function trackSkipReason(ctx: InboundContext): string {
  return ctx.driverId ? "sem_posicao" : "sem_motorista";
}

function incidentTypeFor(text: string): IncidentType {
  const has = (list: string[]) => list.some((k) => text.includes(k));
  if (has(DAMAGE_HINTS)) return "DAMAGE";
  if (has(COMPLAINT_HINTS)) return "CUSTOMER_COMPLAINT";
  return "LATE_DELIVERY";
}

/** Texto ja normalizado pela etapa 113 (`normalizeInboundText`). */
export function planInboundAction(
  result: InboundResult,
  ctx: InboundContext,
): InboundPlan {
  const effects: InboundEffect[] = [];
  const skipped: Array<{ reason: string; effect: string }> = [];

  if (result.kind === "choice") {
    // Opcao numerada do `send-choice`: a semantica vem do texto do botao, por isso
    // ela passa pelo mesmo caminho de palavra-chave na etapa 113 quando o motorista
    // responde com palavra em vez de numero. Aqui, sem o mapa de opcoes a mao, o
    // unico efeito seguro e devolver para o humano.
    return {
      effects: [{ kind: "operator_badge", reason: `opcao ${result.digit}` }],
      skipped: EMPTY_SKIPPED,
    };
  }

  if (result.kind === "free_text") {
    // Foto enviada sem texto vira comprovante quando ha parada; sem parada vira
    // badge para o operador, que abre o anexo no Zapp e decide (etapa 116).
    if (ctx.mediaUrl) {
      const media = classifyInboundMedia(ctx.mediaUrl);
      if (ctx.stopId) {
        return {
          effects: [{
            kind: "stop_proof",
            stopId: ctx.stopId,
            imageUrl: ctx.mediaUrl,
          }],
          skipped: media === "damage"
            ? [{ reason: "media_avaria", effect: "stop_proof" }]
            : EMPTY_SKIPPED,
        };
      }
      return {
        effects: [{
          kind: "operator_badge",
          reason: media === "damage" ? "media_avaria" : "media_comprovante",
        }],
        skipped: EMPTY_SKIPPED,
      };
    }
    return {
      effects: [{ kind: "operator_badge", reason: "texto_livre" }],
      skipped: EMPTY_SKIPPED,
    };
  }

  // Daqui para baixo e `intent`.
  if (result.intent === "optout") {
    // Opt-out nao depende de pedido: vale para o telefone, nao para a corrida.
    return { effects: [{ kind: "optout" }], skipped: EMPTY_SKIPPED };
  }

  if (!ctx.orderId) {
    return {
      effects: [],
      skipped: [{ reason: "sem_pedido", effect: result.intent }],
    };
  }

  switch (result.intent) {
    case "confirm": {
      effects.push({
        kind: "order_metadata",
        key: "driver_confirmed_at",
        value: "@now",
      });
      if (canTrack(ctx)) {
        effects.push({ kind: "tracking_event", eventType: "DRIVER_CONFIRMED" });
      } else {
        skipped.push({
          reason: trackSkipReason(ctx),
          effect: "tracking_event:DRIVER_CONFIRMED",
        });
      }
      break;
    }
    case "arrived": {
      effects.push({
        kind: "order_metadata",
        key: "driver_arrived_at",
        value: "@now",
      });
      if (canTrack(ctx)) {
        effects.push({ kind: "tracking_event", eventType: "DRIVER_ARRIVED" });
      } else {
        skipped.push({
          reason: trackSkipReason(ctx),
          effect: "tracking_event:DRIVER_ARRIVED",
        });
      }
      break;
    }
    case "collected": {
      // Confirmar coleta e o que tira o pedido da duvida na operacao: carimba no
      // pedido (nao mexe em `status`, que dispara sincronia Bitrix24).
      effects.push({
        kind: "order_metadata",
        key: "driver_pickup_confirmed_at",
        value: "@now",
      });
      if (canTrack(ctx)) {
        effects.push({ kind: "tracking_event", eventType: "COLLECTED" });
      } else {
        skipped.push({
          reason: trackSkipReason(ctx),
          effect: "tracking_event:COLLECTED",
        });
      }
      break;
    }
    case "on_the_way": {
      if (canTrack(ctx)) {
        effects.push({ kind: "tracking_event", eventType: "ON_THE_WAY" });
      } else {
        skipped.push({
          reason: trackSkipReason(ctx),
          effect: "tracking_event:ON_THE_WAY",
        });
      }
      break;
    }
    case "decline": {
      // Recusa nao e incidente: e trabalho a redistribuir. O alerta interno e o
      // que tira o pedido da mao do motorista que nao vai.
      effects.push({
        kind: "order_metadata",
        key: "driver_declined_at",
        value: "@now",
      });
      effects.push({ kind: "operator_badge", reason: "motorista_recusou" });
      break;
    }
    case "problem": {
      const type = incidentTypeFor(result.text);
      if (!ctx.driverId) {
        // `driver_incidents.driver_id` e NOT NULL: sem motorista, o problema vira
        // badge para a operacao em vez de sumir.
        skipped.push({ reason: "sem_motorista", effect: `incident:${type}` });
        effects.push({
          kind: "operator_badge",
          reason: "problema_sem_motorista",
        });
        break;
      }
      effects.push({
        kind: "incident",
        type,
        severity: type === "DAMAGE" ? "HIGH" : "MEDIUM",
      });
      effects.push({
        kind: "operator_badge",
        reason: `problema:${type.toLowerCase()}`,
      });
      break;
    }
  }

  return { effects, skipped };
}
