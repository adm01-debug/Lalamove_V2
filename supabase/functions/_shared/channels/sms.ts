/**
 * Etapas 119, 120 e 124 do plano de mensageria: canal SMS de contingencia.
 *
 * O SMS so existe para quando o WhatsApp falha — motorista sem internet, sessao
 * do Zapp caida, numero que nunca instalou o app. Por isso a interface e a mesma
 * do canal Zapp (`{success, error?}`) e o despacho troca de canal sem ramificar
 * a logica de alerta.
 *
 * Dois provedores brasileiros atras de uma interface (decisao Z2): o operador
 * escolhe por `SMS_PROVIDER` sem deploy, e o segundo serve de contingencia.
 */

export interface TextChannelResult {
  success: boolean;
  error?: string;
}

/** Recibo de entrega normalizado. `unknown` = status que o provedor inventou. */
export type DeliveryStatus = "sent" | "delivered" | "failed" | "unknown";

export interface SmsSendResult extends TextChannelResult {
  /** Id do provedor — chave para casar o DLR depois. */
  providerId?: string;
  /** Quantos segmentos a mensagem custou (a fatura e por segmento). */
  segments?: number;
}

export interface SmsInbound {
  from: string;
  text: string;
  providerId?: string;
}

export interface SmsChannel {
  readonly name: string;
  /** Etapa 119: `ref` viaja para o provedor e volta no DLR, casando as pontas. */
  send(to: string, text: string, ref?: string): Promise<SmsSendResult>;
  /** Etapa 126: recibo de entrega do webhook do provedor. */
  parseDeliveryReport(payload: unknown): { providerId?: string; status: DeliveryStatus; to?: string } | null;
  /** Etapa 127: resposta do motorista por SMS. */
  parseInbound(payload: unknown): SmsInbound | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Transliteracao para GSM-7 (etapa 124).
 *
 * Uma unica letra acentuada joga a mensagem inteira para UCS-2, onde o segmento
 * cai de 160 para 70 caracteres. "Atraso na coleta" custa 1 SMS; "Atraso na
 * coleta - via Avenida" com um "A" acentuado custa 2. A regra e agressiva de
 * proposito: em SMS o acento nao informa nada que a letra sem acento ja nao diga.
 */
const TRANSLITERATION: Record<string, string> = {
  "á": "a", "à": "a", "â": "a", "ã": "a", "ä": "a", "å": "a",
  "Á": "A", "À": "A", "Â": "A", "Ã": "A", "Ä": "A", "Å": "A",
  "é": "e", "è": "e", "ê": "e", "ë": "e",
  "É": "E", "È": "E", "Ê": "E", "Ë": "E",
  "í": "i", "ì": "i", "î": "i", "ï": "i",
  "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
  "ó": "o", "ò": "o", "ô": "o", "õ": "o", "ö": "o",
  "Ó": "O", "Ò": "O", "Ô": "O", "Õ": "O", "Ö": "O",
  "ú": "u", "ù": "u", "û": "u", "ü": "u",
  "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
  "ç": "c", "Ç": "C", "ñ": "n", "Ñ": "N",
  "–": "-", "—": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "...", "•": "-",
};

export function toGsm7(text: string): string {
  let out = "";
  for (const ch of text ?? "") out += TRANSLITERATION[ch] ?? ch;
  // Qualquer resto fora do GSM-7 basico forcaria UCS-2; troca por "?" em vez de
  // pagar o dobro sem o operador saber.
  return out.replace(/[^\x20-\x7E\n\r]/g, "?");
}

/** GSM-7: 160 caracteres no primeiro segmento, 153 nos seguintes (cabecalho UDH). */
export function smsSegments(text: string): number {
  const len = text.length;
  if (len === 0) return 0;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

/**
 * Texto final do SMS: transliterado, com espacos colapsados e cortado no ultimo
 * espaco antes de `maxChars` para nao terminar no meio de uma palavra.
 */
export function composeSmsText(text: string, maxChars = 320): { text: string; segments: number; truncated: boolean } {
  const clean = toGsm7(text).replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return { text: clean, segments: smsSegments(clean), truncated: false };

  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > maxChars - 40 ? cut.slice(0, lastSpace) : cut).trimEnd();
  const withEllipsis = `${trimmed}...`;
  return { text: withEllipsis, segments: smsSegments(withEllipsis), truncated: true };
}

/** E.164 em digitos, como o WhatsApp: o provedor quer `5541...`, nao `(41) ...`. */
export function normalizeSmsNumber(number: string): string {
  return (number ?? "").replace(/\D/g, "");
}

function timeoutError(ms: number): string {
  return `SMS API timeout apos ${ms} ms`;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  doFetch: typeof fetch,
): Promise<{ ok: boolean; status: number; statusText: string; json: unknown; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const detail = response.ok ? "" : await response.text().catch(() => "");
    const json = response.ok ? await response.json().catch(() => null) : null;
    return { ok: response.ok, status: response.status, statusText: response.statusText, json, detail };
  } finally {
    clearTimeout(timer);
  }
}

export interface SmsConfig {
  apiKey: string;
  /** Remetente cadastrado no provedor (etapa 123): codigo curto ou alfanumerico. */
  sender?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Comtele: `POST /v1/sms/send`, header `auth-key`. */
export function createComteleChannel(config: SmsConfig): SmsChannel {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "comtele",
    async send(to: string, text: string, ref?: string): Promise<SmsSendResult> {
      const number = normalizeSmsNumber(to);
      if (!number) return { success: false, error: "Destinatario vazio ou invalido" };

      const composed = composeSmsText(text);
      try {
        const res = await postJson(
          "https://api.comtele.com.br/v1/sms/send",
          { "auth-key": config.apiKey },
          {
            sender: config.sender ?? "",
            receiver: number,
            content: composed.text,
            ...(ref ? { tag: ref } : {}),
          },
          timeoutMs,
          doFetch,
        );
        if (!res.ok) {
          return {
            success: false,
            error: `Comtele API error: ${res.status} ${res.statusText}${res.detail ? ` - ${res.detail.slice(0, 200)}` : ""}`.trim(),
          };
        }
        const body = (res.json ?? {}) as { data?: { id?: string } };
        return { success: true, providerId: body.data?.id, segments: composed.segments };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes("abort") ? timeoutError(timeoutMs) : message };
      }
    },
    parseDeliveryReport(payload: unknown) {
      // Comtele manda `{type:"sms.status", data:{id, status}}`; status em portugues.
      const p = payload as { data?: { id?: string; status?: string; receiver?: string } } | null;
      const status = (p?.data?.status ?? "").toLowerCase();
      if (!p?.data?.id) return null;
      return {
        providerId: p.data.id,
        to: p.data.receiver,
        status: status === "delivered" || status === "entregue" ? "delivered"
          : status === "failed" || status === "falha" ? "failed"
          : status === "sent" || status === "enviado" ? "sent"
          : "unknown",
      };
    },
    parseInbound(payload: unknown) {
      // Comtele: `{type:"sms.response", data:{cellphone, message, id}}`.
      const p = payload as { data?: { cellphone?: string; message?: string; id?: string } } | null;
      if (!p?.data?.message || !p.data.cellphone) return null;
      return { from: p.data.cellphone, text: p.data.message, providerId: p.data.id };
    },
  };
}

/** Zenvia: `POST /v2/channels/sms/messages`, header `X-API-TOKEN`. */
export function createZenviaChannel(config: SmsConfig): SmsChannel {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    name: "zenvia",
    async send(to: string, text: string, ref?: string): Promise<SmsSendResult> {
      const number = normalizeSmsNumber(to);
      if (!number) return { success: false, error: "Destinatario vazio ou invalido" };

      const composed = composeSmsText(text);
      try {
        const res = await postJson(
          "https://api.zenvia.com/v2/channels/sms/messages",
          { "X-API-TOKEN": config.apiKey },
          {
            from: config.sender ?? "",
            to: `55${number.replace(/^55/, "")}`,
            contents: [{ type: "text", text: composed.text }],
            ...(ref ? { metadata: { ref } } : {}),
          },
          timeoutMs,
          doFetch,
        );
        if (!res.ok) {
          return {
            success: false,
            error: `Zenvia API error: ${res.status} ${res.statusText}${res.detail ? ` - ${res.detail.slice(0, 200)}` : ""}`.trim(),
          };
        }
        const body = (res.json ?? {}) as { id?: string };
        return { success: true, providerId: body.id, segments: composed.segments };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message.includes("abort") ? timeoutError(timeoutMs) : message };
      }
    },
    parseDeliveryReport(payload: unknown) {
      // Zenvia: `{id, event:"MESSAGE_STATUS", messageStatus:{code}}`; 400=entregue.
      const p = payload as { id?: string; messageStatus?: { code?: number | string } } | null;
      if (!p?.id) return null;
      const code = String(p.messageStatus?.code ?? "");
      return {
        providerId: p.id,
        status: code === "400" || code === "3" ? "delivered"
          : code === "500" || code === "1" ? "failed"
          : code === "100" || code === "0" ? "sent"
          : "unknown",
      };
    },
    parseInbound(payload: unknown) {
      // Zenvia: `{id, from, contents:[{type:"text", text}]}`.
      const p = payload as { id?: string; from?: string; contents?: Array<{ text?: string }> } | null;
      const text = p?.contents?.find((c) => typeof c.text === "string")?.text;
      if (!p?.from || !text) return null;
      return { from: p.from, text, providerId: p.id };
    },
  };
}

/**
 * Etapa 121: seletor de provedor por `SMS_PROVIDER`. Sem configuracao devolve
 * `null` — nunca um canal quebrado: quem chama cai no WhatsApp, que e o caminho
 * que ja funciona hoje.
 */
export function smsChannelFromEnv(
  env: (key: string) => string | undefined = (k) => Deno.env.get(k),
  fetchImpl?: typeof fetch,
): SmsChannel | null {
  const apiKey = env("SMS_PROVIDER_API_KEY");
  if (!apiKey) return null;

  const provider = (env("SMS_PROVIDER") ?? "comtele").trim().toLowerCase();
  const config: SmsConfig = { apiKey, sender: env("SMS_SENDER"), fetchImpl };

  if (provider === "zenvia") return createZenviaChannel(config);
  if (provider === "comtele") return createComteleChannel(config);
  return null;
}