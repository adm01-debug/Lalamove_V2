/**
 * Etapa 113: o que fazer com a resposta quando o template perguntou por numero.
 *
 * O motorista responde "1" ou "2", nao "coletado" nem "problema". Sem o mapa do
 * evento que originou a mensagem, um digito solto nao casa com nenhuma palavra-
 * chave e a resposta vira texto livre para um humano ler — foi exatamente o que
 * acontecia com o M4.
 *
 * O `id` de cada opcao aqui e a frase canonica: depois de acertar o digito, a
 * frase volta para o mesmo classificador de texto, entao a regra de negocio
 * (intencao -> efeito) continua num lugar so.
 */

import {
  classifyInbound,
  type InboundChoice,
  type InboundResult,
} from "./inbound.ts";

/**
 * Opcoes numeradas por evento, espelhando o texto do template ativo no banco.
 * Evento sem mapa = resposta tratada por palavra-chave/ texto livre.
 */
export const EVENT_CHOICES: Record<string, InboundChoice[]> = {
  // M4: "1 = coletado / 2 = problema"
  DRIVER_ARRIVED_PICKUP: [
    { id: "coletado", digit: "1" },
    { id: "problema", digit: "2" },
  ],
  // M2: "1 = sim / 2 = problema"
  DRIVER_CONFIRMATION_DUE: [
    { id: "sim", digit: "1" },
    { id: "problema", digit: "2" },
  ],
  // M10: "1 = transito / 2 = problema no veiculo / 3 = endereco errado"
  ETA_DELAY: [
    { id: "a caminho", digit: "1" },
    { id: "problema no veiculo", digit: "2" },
    { id: "problema no endereco", digit: "3" },
  ],
  // M11 e M7: "Responda 1 para confirmar"
  ORDER_SCHEDULED_REMINDER: [{ id: "sim", digit: "1" }],
  ORDER_EDITED: [{ id: "sim", digit: "1" }],
};

/** Opcoes do evento; vazio quando o evento nao pergunta numero. */
export function choicesForEvent(event: string | null | undefined): InboundChoice[] {
  if (!event) return [];
  return EVENT_CHOICES[event] ?? [];
}

/**
 * Classifica a resposta no contexto do evento. `fallback` sao opcoes vindas do
 * proprio envio (etapa 44), usadas quando o catalogo nao cobre o evento.
 */
export function classifyReply(
  event: string | null | undefined,
  raw: string,
  fallback: InboundChoice[] = [],
): InboundResult {
  const choices = choicesForEvent(event);
  const first = classifyInbound(raw ?? "", choices.length ? choices : fallback);
  if (first.kind !== "choice") return first;
  // O digito ja disse a que veio: a frase canonica da opcao segue pelo caminho
  // de palavra-chave para virar intencao (collected, problem, confirm...).
  const mapped = classifyInbound(first.optionId);
  if (mapped.kind !== "intent") return mapped;
  // O texto do motorista continua valendo junto: "2 bati o pneu" e problema e
  // e avaria, e e o tipo de incidente que decide quem olha primeiro.
  return { ...mapped, text: `${mapped.text} ${first.text}`.trim() };
}