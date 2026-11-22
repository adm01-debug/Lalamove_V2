// Etapa 9 do plano Mapbox: rotação do token de servidor pelo Tokens API.
//
// Toda a decisão que pode errar (qual token revogar, com que scopes criar o
// novo, o que vai para o log) mora aqui, pura e testável. O `index.ts` só faz
// HTTP e auth. Nunca devolvemos nem logamos o valor do token: só o
// `tokenFingerprint`, que é suficiente para o operador conferir nos dois lados.

/** Token como o Tokens API devolve em `GET /tokens/v2/{username}`. */
export interface MapboxToken {
  id: string;
  note?: string;
  usage?: string;
  scopes?: string[];
  created?: string;
  /** Presente só na resposta da criação — o valor em si, nunca persistido. */
  token?: string;
}

/** Scopes que permitem cunhar/revogar tokens. O token de serviço não os carrega. */
export const TOKEN_ADMIN_SCOPES = ["tokens:write", "tokens:read"] as const;

/**
 * Tempo entre criar o token novo e revogar o antigo (runbook, etapa 9). A janela
 * existe para o deploy das edges terminar antes do token velho morrer: revogar
 * junto com a criação derrubaria as requisições ainda em voo.
 */
export const REVOKE_AFTER_MS = 10 * 60 * 1000;

/**
 * Identificação segura de um token: prefixo de 6, últimos 4 e tamanho.
 * O valor completo nunca entra em log, resposta ou `audit_log`.
 */
export function tokenFingerprint(token: string): string {
  const value = token.trim();
  if (value.length === 0) return "vazio";
  if (value.length <= 12) return `${value.slice(0, 2)}… (len ${value.length})`;
  return `${value.slice(0, 6)}…${value.slice(-4)} (len ${value.length})`;
}

/** `sk.` = secreto de servidor; `pk.` = público de navegador; `tk.` = temporário. */
export function tokenKind(token: string): "secret" | "public" | "temporary" | "unknown" {
  if (token.startsWith("sk.")) return "secret";
  if (token.startsWith("pk.")) return "public";
  if (token.startsWith("tk.")) return "temporary";
  return "unknown";
}

/**
 * Tipo de um token vindo **da listagem**. `GET /tokens/v2` nunca devolve o valor
 * do token (só `usage`, que já é `sk`/`pk`/`tk`); o `token` só existe na
 * resposta da criação. Por isso a classificação prefere `usage` e cai no prefixo
 * apenas quando ele está presente.
 */
export function kindOfListedToken(t: MapboxToken): "secret" | "public" | "temporary" | "unknown" {
  const byUsage = (t.usage ?? "").trim().toLowerCase();
  if (byUsage === "sk") return "secret";
  if (byUsage === "pk") return "public";
  if (byUsage === "tk") return "temporary";
  if (t.token) return tokenKind(t.token);
  return "unknown";
}

/**
 * Qual token revogar depois da rotação: o `sk.` anterior de servidor.
 *
 * Ignora o token recém-criado e os `pk.`/`tk.` — revogar o token do navegador
 * derrubaria o mapa de todos os usuários de uma vez, e revogar o novo desfaria
 * a própria rotação. Devolve `null` quando não há alvo inequívoco: nesse caso o
 * operador revoga à mão em vez de o código adivinhar.
 */
export function pickTokenToRevoke(
  tokens: MapboxToken[],
  newTokenId: string,
  previousTokenFingerprint?: string,
): MapboxToken | null {
  const candidates = tokens.filter((t) => {
    if (t.id === newTokenId) return false;
    const kind = kindOfListedToken(t);
    return kind !== "public" && kind !== "temporary";
  });
  if (candidates.length === 0) return null;
  if (previousTokenFingerprint) {
    const exact = candidates.filter((t) => (t.token ? tokenFingerprint(t.token) === previousTokenFingerprint : false));
    if (exact.length === 1) return exact[0];
  }
  // Sem fingerprint (o Tokens API não devolve o valor na listagem) só é seguro
  // revogar quando sobra exatamente um candidato — mais de um é ambiguidade.
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Corpo do `POST /tokens/v2/{username}`: herda os scopes do token atual menos os
 * de administração de token. O token que o gateway usa não precisa cunhar token;
 * deixá-lo com `tokens:write` transformaria um vazamento em persistência.
 */
export function buildCreateTokenBody(previous: MapboxToken, note: string): { note: string; scopes: string[]; allowedUrls?: string[] } {
  const scopes = (previous.scopes ?? []).filter(
    (s) => !(TOKEN_ADMIN_SCOPES as readonly string[]).includes(s),
  );
  return { note, scopes };
}

/** O token novo ficou utilizável? Só `sk.` com escopo resolve o gateway. */
export function validateNewToken(token: string | undefined, scopes: string[]): string | null {
  if (!token) return "Tokens API não devolveu token na criação";
  if (tokenKind(token) !== "secret") return `Token criado não é secreto (prefixo ${token.slice(0, 3) || "vazio"})`;
  if (scopes.length === 0) return "Token criado sem nenhum scope";
  return null;
}