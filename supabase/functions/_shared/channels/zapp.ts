/**
 * Etapa 69 do plano Google Maps (decisão D2): canal Zapp Web.
 *
 * O Zapp é o provedor de WhatsApp Web da Promo Brindes. A interface é
 * deliberadamente igual à do Evolution em `send-notification` — mesma assinatura
 * `sendText(number, text)` devolvendo `{success, error?}` — para que o despacho
 * troque de canal sem ramificar a lógica de alerta.
 *
 * Sem `ZAPP_API_URL`/`ZAPP_API_KEY` o canal é **ausente** (retorna `null` no
 * factory), nunca um canal quebrado: quem chama cai no Evolution, que é o
 * caminho que já funciona em produção hoje.
 */

/**
 * Etapa 14: código de erro do provedor -> ação no Lalamove.
 * `fallback` = tentar SMS na hora, `retry` = nova tentativa, `give_up` =
 * falha definitiva, `alert` = avisar a operação (o destinatário precisa de
 * outro meio).
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

/** Código desconhecido nunca é silencioso: a operação é avisada. */
export function actionForErrorCode(code: string | null | undefined): ErrorAction | null {
  if (!code) return null;
  return ERROR_CODE_ACTIONS[code.toLowerCase()] ?? "alert";
}

/**
 * Etapa 86: metadados de correlação da etapa 89. `clientMessageId` é a chave de
 * idempotência que o ledger usa; `correlation` liga a mensagem ao evento de
 * origem; `expiresAt` impede entrega de alerta já vencido (o Zapp recusa).
 */
export interface SendOptions {
  clientMessageId?: string;
  correlation?: string;
  expiresAt?: string | Date;
  /** Minutos até o Zapp desistir da entrega, quando `expiresAt` não é dado. */
  ttlMinutes?: number;
}

export interface TextChannelResult {
  success: boolean;
  error?: string;
  /** Etapa 86: `message_id` devolvido pelo Zapp — chave do ledger (etapa 74). */
  providerMessageId?: string;
  /** Etapa 14: código normalizado do erro do provedor. */
  errorCode?: string;
  /** Etapa 14: ação recomendada para o erro acima. */
  action?: ErrorAction;
  /** Status HTTP, para o chamador distinguir 4xx de 5xx sem parsear texto. */
  httpStatus?: number;
}

export interface TextChannel {
  /** Identifica o provedor nos logs e em `alerts_sent.channel`. */
  readonly name: string;
  sendText(number: string, text: string, options?: SendOptions): Promise<TextChannelResult>;
  /**
   * Etapa 68: imagem do trajeto junto com o alerta. Opcional — canal que não
   * implementa faz o despacho cair no `sendText`. `dataUrl` é o PNG em base64
   * que o `geo-gateway` devolve (`data:image/png;base64,...`).
   */
  sendMedia?(
    number: string,
    dataUrl: string,
    caption?: string,
    options?: SendOptions,
  ): Promise<TextChannelResult>;
}

export interface ZappConfig {
  apiUrl: string;
  apiKey: string;
  /** Instância/ número remetente, quando o Zapp exigir. */
  instance?: string;
  /** Injetado nos testes; default `fetch` global. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** TTL padrão de entrega: alerta de pedido não serve depois de 30 min. */
const DEFAULT_TTL_MINUTES = 30;

/**
 * Normaliza para dígitos, como o Evolution faz hoje. O número de destino do Zapp
 * é o mesmo do WhatsApp, então reusar a regra evita divergência entre canais.
 */
export function normalizeZappNumber(number: string): string {
  return (number ?? "").replace(/\D/g, "");
}

/**
 * Etapa 86: monta os metadados de correlação do corpo da requisição. Devolve
 * um objeto vazio quando nenhum campo foi informado, para o payload de canais
 * que não usam ledger continuar idêntico ao de antes.
 */
export function correlationFields(
  options: SendOptions | undefined,
  now: () => Date = () => new Date(),
): Record<string, string> {
  if (!options) return {};
  const fields: Record<string, string> = {};
  if (options.clientMessageId) fields.client_message_id = options.clientMessageId;
  if (options.correlation) fields.correlation = options.correlation;

  let expiresAt: string | null = null;
  if (options.expiresAt) {
    expiresAt = options.expiresAt instanceof Date
      ? options.expiresAt.toISOString()
      : options.expiresAt;
  } else {
    // Sem prazo explícito vale o TTL padrão: alerta de pedido entregue meia
    // hora depois confunde o motorista mais do que ajuda.
    const ttl = options.ttlMinutes ?? DEFAULT_TTL_MINUTES;
    expiresAt = new Date(now().getTime() + ttl * 60_000).toISOString();
  }
  fields.expires_at = expiresAt;
  return fields;
}

/**
 * Etapa 86: o Zapp responde `202 { message_id }` quando aceita a mensagem. Sem
 * esse id não há como casar o callback (etapa 96) com a linha do ledger, então
 * 2xx sem id é tratado como aceito-sem-rastreio (não é falha de envio).
 */
export function parseZappAccepted(body: string): { messageId: string | null } {
  if (!body) return { messageId: null };
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const candidates = [parsed.message_id, parsed.messageId, parsed.id];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return { messageId: value.trim() };
      if (typeof value === "number" && Number.isFinite(value)) return { messageId: String(value) };
    }
    return { messageId: null };
  } catch {
    return { messageId: null };
  }
}

/**
 * Etapa 14/86: traduz a resposta de erro do Zapp para o código canônico. O
 * corpo do erro manda quando traz `error.code`; senão o status HTTP decide.
 * Isso importa porque 404 (número sem WhatsApp) pede fallback imediato para
 * SMS, enquanto 401 pede desistir — confundir os dois ou manda SMS à toa ou
 * deixa o motorista sem a mensagem.
 */
export function errorCodeFromResponse(status: number, body: string): string {
  if (body) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      const err = parsed.error;
      if (err && typeof err === "object") {
        const code = (err as Record<string, unknown>).code;
        if (typeof code === "string" && code.trim()) return code.trim().toLowerCase();
      }
      if (typeof err === "string" && err.trim()) {
        const lowered = err.trim().toLowerCase();
        if (lowered in ERROR_CODE_ACTIONS) return lowered;
      }
      const code = parsed.code;
      if (typeof code === "string" && code.trim()) return code.trim().toLowerCase();
    } catch {
      // corpo não-JSON: decide pelo status
    }
  }

  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden_connection";
    case 404:
      return "invalid_number";
    case 408:
      return "rate_limited";
    case 410:
      return "expired";
    case 422:
      return "provider_rejected";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "instance_unavailable" : "provider_rejected";
  }
}

function failureResult(
  status: number,
  statusText: string,
  detail: string,
): TextChannelResult {
  const errorCode = errorCodeFromResponse(status, detail);
  const action = actionForErrorCode(errorCode) ?? "alert";
  return {
    success: false,
    httpStatus: status,
    errorCode,
    action,
    error:
      `Zapp API error: ${status} ${statusText}${detail ? ` - ${detail.slice(0, 200)}` : ""}`.trim(),
  };
}

function networkFailure(error: unknown, timeoutMs: number): TextChannelResult {
  const message = error instanceof Error ? error.message : String(error);
  const timedOut = message === "The signal has been aborted" || message.includes("abort");
  return {
    success: false,
    errorCode: "instance_unavailable",
    action: actionForErrorCode("instance_unavailable") ?? "fallback",
    error: timedOut ? `Zapp API timeout após ${timeoutMs} ms` : message,
  };
}

export function createZappChannel(config: ZappConfig): TextChannel {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = config.apiUrl.replace(/\/+$/, "");

  async function post(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<TextChannelResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // O Zapp autentica por Bearer; o Evolution usa header `apikey`.
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          ...payload,
          ...(config.instance ? { instance: config.instance } : {}),
        }),
        signal: controller.signal,
      });

      const body = await response.text().catch(() => "");
      if (!response.ok) {
        // Corpo do erro ajuda o operador a distinguir sessão caída de número
        // inexistente — 401/403 = credencial, 4xx = destinatário.
        return failureResult(response.status, response.statusText, body);
      }

      const { messageId } = parseZappAccepted(body);
      // Forma de sucesso preservada (`{success:true}`) para não quebrar quem já
      // compara o resultado por igualdade; o id entra só quando o Zapp manda.
      return messageId ? { success: true, providerMessageId: messageId } : { success: true };
    } catch (error) {
      return networkFailure(error, timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "zapp",

    async sendText(
      number: string,
      text: string,
      options?: SendOptions,
    ): Promise<TextChannelResult> {
      const formattedNumber = normalizeZappNumber(number);
      if (!formattedNumber) {
        return { success: false, error: "Destinatário vazio ou inválido", errorCode: "invalid_number", action: "fallback" };
      }

      return await post("/messages/send-text", {
        number: formattedNumber,
        text,
        ...correlationFields(options),
      });
    },

    async sendMedia(
      number: string,
      dataUrl: string,
      caption?: string,
      options?: SendOptions,
    ): Promise<TextChannelResult> {
      const formattedNumber = normalizeZappNumber(number);
      if (!formattedNumber) {
        return { success: false, error: "Destinatário vazio ou inválido", errorCode: "invalid_number", action: "fallback" };
      }
      if (!dataUrl.startsWith("data:image/")) {
        return { success: false, error: "Mídia não é um data URL de imagem", errorCode: "media_invalid", action: "alert" };
      }

      return await post("/messages/send-media", {
        number: formattedNumber,
        mediatype: "image",
        mimetype: dataUrl.slice(5, dataUrl.indexOf(";")),
        media: dataUrl.slice(dataUrl.indexOf(",") + 1),
        ...(caption ? { caption } : {}),
        ...correlationFields(options),
      });
    },
  };
}

/**
 * Lê as variáveis de ambiente e devolve o canal, ou `null` quando não configurado.
 * Nunca lança: falta de secret não pode derrubar o despacho de alerta.
 */
export function zappChannelFromEnv(
  env: (key: string) => string | undefined = (k) => Deno.env.get(k),
  fetchImpl?: typeof fetch,
): TextChannel | null {
  const apiUrl = env("ZAPP_API_URL");
  const apiKey = env("ZAPP_API_KEY");
  if (!apiUrl || !apiKey) return null;

  return createZappChannel({
    apiUrl,
    apiKey,
    instance: env("ZAPP_INSTANCE_NAME"),
    fetchImpl,
  });
}
