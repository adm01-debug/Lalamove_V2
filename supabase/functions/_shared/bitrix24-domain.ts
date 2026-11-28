// Resolve o dominio do portal Bitrix24 de uma unica fonte confiavel.
//
// MOTIVO (achado C-007): bitrix24-sync aceitava `domain` da query string e fazia
// POST com client_id + client_secret para `https://<domain>/oauth/token/`. Quem
// tivesse login no sistema podia apontar para um host proprio e receber o secret
// da integracao; pior, o valor envenenado era gravado em `bitrix24_tokens.domain`
// e passava a ser usado por bitrix24-process-queue e send-notification em todo
// ciclo, perpetuando a troca de segredo com um terceiro.
//
// A regra aqui e igualdade com valor configurado, nunca sufixo/regex: um dominio
// como `evil.bitrix24.com.attacker.tld` satisfaz "termina com bitrix24.com".
//
// Ordem de preferencia:
//   1. BITRIX24_DOMAIN (secret da edge) — fonte definitiva.
//   2. domain ja gravado em bitrix24_tokens — so quando o secret nao existe,
//      para nao derrubar uma instalacao que ainda nao configurou a variavel.
// O `domain` vindo da requisicao NUNCA e usado.

export type ResolucaoDominio =
  | { ok: true; domain: string }
  | { ok: false; motivo: string };

// Aceita apenas host puro (sem esquema, sem caminho, sem porta, sem espaco).
const RE_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u;

/** Normaliza e valida um host. Devolve null quando nao e host puro. */
export function normalizarHost(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const host = valor.trim().toLowerCase().replace(/^https?:\/\//u, "").replace(/\/.*$/u, "");
  if (!host || host.includes(":") || host.includes("@") || /\s/u.test(host)) return null;
  return RE_HOST.test(host) ? host : null;
}

/**
 * Devolve o dominio confiavel do portal.
 * `dominioGravado` e o valor ja existente em bitrix24_tokens.domain (pode ser undefined).
 */
export function resolverDominioBitrix24(
  env: { get(chave: string): string | undefined } = Deno.env,
  dominioGravado?: string | null,
): ResolucaoDominio {
  const doSecret = normalizarHost(env.get("BITRIX24_DOMAIN"));
  if (doSecret) return { ok: true, domain: doSecret };

  if (env.get("BITRIX24_DOMAIN")) {
    return { ok: false, motivo: "BITRIX24_DOMAIN configurado com valor invalido (esperado host puro, ex.: empresa.bitrix24.com.br)" };
  }

  const gravado = normalizarHost(dominioGravado ?? "");
  if (gravado) return { ok: true, domain: gravado };

  return {
    ok: false,
    motivo: "BITRIX24_DOMAIN nao configurado e nenhum dominio valido em bitrix24_tokens; configure o secret com o portal contratado",
  };
}

/** Url base do portal para as chamadas REST/OAuth. */
export function urlPortalBitrix24(domain: string): string {
  return `https://${domain}`;
}