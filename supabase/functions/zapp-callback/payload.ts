/**
 * Normalizacao do payload de callback do Zapp (etapas 15, 16 e 96).
 *
 * Funcoes puras: recebem o JSON ja validado pela assinatura e devolvem a
 * instrucao de escrita no ledger. Toda a decisao (qual status gravar, qual
 * coluna de data preencher, se o evento e ignorado) fica testavel sem banco.
 */

/** Etapa 96: eventos que o Zapp manda (etapas 15, 16 e 68). */
export const CALLBACK_EVENTS = [
  "message.status",
  "message.inbound",
  "message.outbound_manual",
] as const;

export type CallbackEvent = (typeof CALLBACK_EVENTS)[number];

/** Etapa 15: status aceitos no callback. */
export const PROVIDER_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "uncertain",
] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/**
 * Etapa 14: codigo -> acao no Lalamove. `fallback` = tentar SMS na hora,
 * `retry` = nova tentativa, `give_up` = desistir e marcar falha definitiva,
 * `alert` = avisar a operacao (numero invalido/opt-out precisa de outro meio).
 */
export type ErrorAction = "fallback" | "retry" | "give_up" | "alert";

export const ERROR_CODE_ACTIONS: Record<string, ErrorAction> = {
  invalid_number: "fallback",
  recipient_blocked: "fallback",
  recipient_opted_out: "fallback",
  instance_unavailable: "fallback",
  unauthorized: "give_up",
  forbidden_connection: "give_up",
  media_invalid: "alert",
  expired: "give_up",
  rate_limited: "retry",
  receipt_unconfirmed: "alert",
  provider_rejected: "give_up",
};

export function actionForErrorCode(code: string | null | undefined): ErrorAction | null {
  if (!code) return null;
  return ERROR_CODE_ACTIONS[code.toLowerCase()] ?? "alert";
}

/** Resultado de uma mensagem inbound (etapa 16). */
export interface InboundContent {
  text: string | null;
  choiceId: string | null;
  mediaUrl: string | null;
  location: { lat: number; lng: number } | null;
  inReplyTo: string | null;
  correlation: string | null;
}

export interface LedgerWrite {
  kind: "status" | "inbound" | "outbound_manual";
  clientMessageId: string | null;
  providerMessageId: string | null;
  status: ProviderStatus | null;
  errorCode: string | null;
  occurredAt: string | null;
  sequence: number | null;
  bodyPreview: string | null;
  inbound: InboundContent | null;
  /** true quando o evento nao altera nada (ex.: status desconhecido). */
  ignore: boolean;
  ignoreReason?: string;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Body do callback pode vir desembrulhado ou dentro de `data` (etapa 15). */
export function unwrapPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  if (root.event === undefined && root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data as Record<string, unknown>;
  }
  return root;
}

function parseInbound(data: Record<string, unknown>): InboundContent {
  const location = data.location && typeof data.location === "object"
    ? (data.location as Record<string, unknown>)
    : null;
  const lat = asNumber(location?.lat ?? location?.latitude);
  const lng = asNumber(location?.lng ?? location?.longitude);
  return {
    text: asString(data.text),
    choiceId: asString(data.choice_id ?? data.button_id ?? data.option),
    mediaUrl: asString(data.media_url ?? data.mediaUrl),
    location: lat !== null && lng !== null ? { lat, lng } : null,
    inReplyTo: asString(data.in_reply_to ?? data.inReplyTo),
    correlation: asString(data.correlation),
  };
}

const PREVIEW_MAX = 280;

export function truncatePreview(text: string | null): string | null {
  if (!text) return null;
  return text.length <= PREVIEW_MAX ? text : text.slice(0, PREVIEW_MAX);
}

/**
 * Traduz o callback em uma escrita de ledger. Nunca lanca: payload estranho
 * vira `ignore`, e o handler responde 2xx para nao fazer o Zapp reenfileirar
 * para sempre um evento que nao sabemos ler.
 */
export function parseCallback(payload: unknown): LedgerWrite {
  const vazio: LedgerWrite = {
    kind: "status",
    clientMessageId: null,
    providerMessageId: null,
    status: null,
    errorCode: null,
    occurredAt: null,
    sequence: null,
    bodyPreview: null,
    inbound: null,
    ignore: true,
    ignoreReason: "payload_invalido",
  };

  const data = unwrapPayload(payload);
  if (!data) return vazio;

  const event = asString(data.event) as CallbackEvent | null;
  const clientMessageId = asString(data.client_message_id ?? data.clientMessageId);
  const providerMessageId = asString(data.message_id ?? data.messageId ?? data.id);
  const occurredAt = asString(data.occurred_at ?? data.occurredAt);
  const sequence = asNumber(data.sequence);

  if (!event) return { ...vazio, ignoreReason: "evento_ausente" };
  if (!clientMessageId && !providerMessageId) {
    return { ...vazio, ignoreReason: "sem_identificador" };
  }

  if (event === "message.status") {
    const rawStatus = asString(data.status)?.toLowerCase();
    const status = (PROVIDER_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as ProviderStatus)
      : null;
    if (!status) {
      return {
        ...vazio,
        clientMessageId,
        providerMessageId,
        occurredAt,
        sequence,
        ignoreReason: "status_desconhecido",
      };
    }
    return {
      kind: "status",
      clientMessageId,
      providerMessageId,
      status,
      errorCode: asString(data.code ?? data.error_code),
      occurredAt,
      sequence,
      bodyPreview: null,
      inbound: null,
      ignore: false,
    };
  }

  if (event === "message.inbound") {
    const inbound = parseInbound(data);
    return {
      kind: "inbound",
      clientMessageId,
      providerMessageId,
      status: null,
      errorCode: null,
      occurredAt,
      sequence,
      bodyPreview: truncatePreview(inbound.text),
      inbound,
      ignore: false,
    };
  }

  if (event === "message.outbound_manual") {
    return {
      kind: "outbound_manual",
      clientMessageId,
      providerMessageId,
      status: "sent",
      errorCode: null,
      occurredAt,
      sequence,
      bodyPreview: truncatePreview(asString(data.text)),
      inbound: null,
      ignore: false,
    };
  }

  return { ...vazio, clientMessageId, providerMessageId, ignoreReason: "evento_nao_tratado" };
}

const STATUS_COLUMN: Record<ProviderStatus, string | null> = {
  queued: null,
  sent: "sent_at",
  delivered: "delivered_at",
  read: "read_at",
  failed: "failed_at",
  uncertain: "failed_at",
};

/** Coluna de data que o status preenche; `null` = nao preenche nenhuma. */
export function timestampColumnFor(status: ProviderStatus): string | null {
  return STATUS_COLUMN[status];
}

/**
 * Etapa 96 + 74: decide o status final do ledger. Um callback atrasado nao
 * regride estado terminal - `delivered` que chega depois de `read` mantem
 * `read`, e `sent` depois de `failed` nao ressuscita a mensagem.
 */
export function nextStatus(current: string | null, incoming: ProviderStatus): ProviderStatus | null {
  if (!current) return incoming;
  const rank: Record<string, number> = {
    queued: 0,
    sent: 1,
    delivered: 2,
    read: 3,
    failed: 4,
    uncertain: 4,
    expired: 4,
    suppressed: 4,
  };
  const atual = rank[current] ?? 0;
  const novo = rank[incoming] ?? 0;
  // Terminais de falha nunca sobem; progresso normal so avanca.
  if (atual >= 4) return null;
  if (novo <= atual) return null;
  return incoming;
}