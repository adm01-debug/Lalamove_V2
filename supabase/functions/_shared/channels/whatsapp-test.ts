/**
 * Remetente de WhatsApp do botao "enviar teste" do painel de mensageria.
 *
 * Espelha a ordem do despacho real (`send-notification`): Zapp quando
 * `ZAPP_API_URL`/`ZAPP_API_KEY` existem, senao Evolution. Antes disso o teste
 * falava so Evolution, entao com o motor configurado no Zapp o operador recebia
 * "EVOLUTION_API_KEY nao configurado" e nao conseguia validar a entrega.
 */
import { zappChannelFromEnv } from "./zapp.ts";
import type { TextChannelResult } from "./zapp.ts";

export interface WhatsAppTestSender {
  /** Identifica o provedor usado na resposta ao operador. */
  readonly name: string;
  send(number: string, text: string): Promise<TextChannelResult>;
}

export type EnvReader = (key: string) => string | undefined;

/** Mensagem unica de configuracao ausente, usada pela edge e pelo painel. */
export const WHATSAPP_TEST_MISSING_CONFIG =
  "Nenhum provedor de WhatsApp configurado: defina ZAPP_API_URL/ZAPP_API_KEY (preferido) ou EVOLUTION_API_URL/EVOLUTION_API_KEY nas secrets do projeto.";

/**
 * Devolve o remetente disponivel ou `null` quando nenhum provedor tem secrets.
 * Nunca lanca: falta de secret e mensagem para o operador, nao erro 500.
 */
export function whatsAppTestSender(
  env: EnvReader = (key) => Deno.env.get(key),
  fetchImpl?: typeof fetch,
): WhatsAppTestSender | null {
  const zapp = zappChannelFromEnv(env, fetchImpl);
  if (zapp) {
    return { name: "zapp", send: (number, text) => zapp.sendText(number, text) };
  }

  const apiUrl = env("EVOLUTION_API_URL");
  const apiKey = env("EVOLUTION_API_KEY");
  if (!apiUrl || !apiKey) return null;

  const instance = env("EVOLUTION_INSTANCE_NAME") || "lalamove";
  const doFetch = fetchImpl ?? fetch;
  const base = apiUrl.replace(/\/+$/, "");

  return {
    name: "evolution",
    async send(number, text) {
      const digits = (number ?? "").replace(/\D/g, "");
      if (!digits) {
        return {
          success: false,
          error: "Destinatario vazio ou invalido",
          errorCode: "invalid_number",
          action: "fallback",
        };
      }

      try {
        const response = await doFetch(`${base}/message/sendText/${instance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: digits, text }),
        });
        const body = await response.text().catch(() => "");
        if (!response.ok) {
          return {
            success: false,
            error: body || `HTTP ${response.status}`,
            errorCode: "provider_rejected",
            // 5xx costuma ser instancia fora do ar (tentar de novo); 4xx e
            // credencial/numero e insistir nao resolve.
            action: response.status >= 500 ? "retry" : "give_up",
            httpStatus: response.status,
          };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          errorCode: "instance_unavailable",
          action: "retry",
        };
      }
    },
  };
}
