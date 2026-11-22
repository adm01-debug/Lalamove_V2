/**
 * Interpretador de respostas do motorista (etapa 113 do plano de mensageria).
 *
 * A ordem importa e e a regra de negocio: id de opcao -> numero -> palavra-chave
 * -> texto livre. Um "2" que casa com o mapa de opcoes do `send-choice` (etapa 44)
 * vale mais que qualquer palavra-chave, porque foi o proprio sistema que ofereceu
 * aquelas opcoes. So quando nada casa e que a mensagem vira texto livre para um
 * humano ler no inbox do Zapp.
 *
 * Funcao pura, sem I/O: quem decide o efeito (incidente, tracking_event, badge) e
 * a etapa 114, e quem grava e o `zapp-callback`.
 */

/** Opcao oferecida no envio — vem de `media_meta.integration.choices` (etapa 44). */
export interface InboundChoice {
  id: string;
  digit: string;
}

/** Intencoes reconhecidas em texto (etapa 114 decide o efeito de cada uma). */
export type InboundIntent =
  | "problem"
  | "arrived"
  | "collected"
  | "on_the_way"
  | "decline"
  | "confirm";

export type InboundResult =
  | { kind: "choice"; optionId: string; digit: string; text: string }
  | { kind: "intent"; intent: InboundIntent; text: string }
  | { kind: "free_text"; text: string };

/**
 * Frases por intencao, ja sem acento. A ordem dos grupos define prioridade:
 * "nao consigo chegar" e problema, nao confirmacao, por isso `problem` vem antes
 * de `confirm`/`decline`.
 */
const INTENT_PHRASES: Array<{ intent: InboundIntent; phrases: string[] }> = [
  {
    intent: "problem",
    phrases: [
      "problema",
      "nao consigo",
      "nao vou conseguir",
      "atrasado",
      "atraso",
      "acidente",
      "quebrou",
      "quebrado",
      "pneu",
      "sem combustivel",
      "ajuda",
    ],
  },
  {
    intent: "arrived",
    phrases: [
      "cheguei",
      "estou aqui",
      "estou no local",
      "no portao",
      "na portaria",
      "chegando",
    ],
  },
  {
    intent: "collected",
    phrases: [
      "coletado",
      "coletei",
      "peguei",
      "retirado",
      "retirei",
      "sai com",
    ],
  },
  {
    intent: "on_the_way",
    phrases: ["a caminho", "indo", "saindo", "ja vou", "estou indo", "em rota"],
  },
  {
    intent: "decline",
    phrases: ["nao", "recuso", "recusar", "cancelar", "cancela"],
  },
  {
    intent: "confirm",
    phrases: [
      "sim",
      "confirmo",
      "confirmado",
      "ok",
      "beleza",
      "blz",
      "certo",
      "pode",
    ],
  },
];

/** Minusculo, sem acento, espacos colapsados — o motorista digita como quer. */
export function normalizeInboundText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Procura a frase como palavra inteira — "sim" nao casa dentro de "assim". */
function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+$^()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

/**
 * Classifica uma resposta recebida do motorista.
 *
 * `choices` e o mapa opcao->digito que acompanhou aquela mensagem; quando
 * ausente, um digito solto cai nas palavras-chave e, se nada casar, em texto livre.
 */
export function classifyInbound(
  raw: string,
  choices: InboundChoice[] = [],
): InboundResult {
  const text = normalizeInboundText(raw ?? "");
  if (!text) return { kind: "free_text", text: "" };

  // 1. id de opcao enviado de volta pelo proprio motorista.
  const byId = choices.find((c) => normalizeInboundText(c.id) === text);
  if (byId) {
    return { kind: "choice", optionId: byId.id, digit: byId.digit, text };
  }

  // 2. digito da opcao ("2"), que e o caminho do fallback numerado (Z7).
  const byDigit = choices.find((c) => c.digit === text);
  if (byDigit) {
    return { kind: "choice", optionId: byDigit.id, digit: byDigit.digit, text };
  }

  // 3. palavras-chave, na ordem de prioridade de INTENT_PHRASES.
  for (const group of INTENT_PHRASES) {
    if (group.phrases.some((p) => containsPhrase(text, p))) {
      return { kind: "intent", intent: group.intent, text };
    }
  }

  // 4. texto livre: segue para a timeline e para o humano no inbox.
  return { kind: "free_text", text };
}
