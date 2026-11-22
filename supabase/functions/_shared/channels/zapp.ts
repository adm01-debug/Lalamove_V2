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

export interface TextChannelResult {
  success: boolean;
  error?: string;
}

export interface TextChannel {
  /** Identifica o provedor nos logs e em `alerts_sent.channel`. */
  readonly name: string;
  sendText(number: string, text: string): Promise<TextChannelResult>;
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

/**
 * Normaliza para dígitos, como o Evolution faz hoje. O número de destino do Zapp
 * é o mesmo do WhatsApp, então reusar a regra evita divergência entre canais.
 */
export function normalizeZappNumber(number: string): string {
  return (number ?? "").replace(/\D/g, "");
}

export function createZappChannel(config: ZappConfig): TextChannel {
  const doFetch = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = config.apiUrl.replace(/\/+$/, "");

  return {
    name: "zapp",
    async sendText(number: string, text: string): Promise<TextChannelResult> {
      const formattedNumber = normalizeZappNumber(number);
      if (!formattedNumber) {
        return { success: false, error: "Destinatário vazio ou inválido" };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(`${base}/messages/send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // O Zapp autentica por Bearer; o Evolution usa header `apikey`.
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            number: formattedNumber,
            text,
            ...(config.instance ? { instance: config.instance } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // Corpo do erro ajuda o operador a distinguir sessão caída de número
          // inexistente — 401/403 = credencial, 4xx = destinatário.
          const detail = await response.text().catch(() => "");
          return {
            success: false,
            error: `Zapp API error: ${response.status} ${response.statusText}${detail ? ` - ${detail.slice(0, 200)}` : ""}`.trim(),
          };
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: message === "The signal has been aborted" || message.includes("abort")
            ? `Zapp API timeout após ${timeoutMs} ms`
            : message,
        };
      } finally {
        clearTimeout(timer);
      }
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
