import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCreateTokenBody,
  kindOfListedToken,
  pickTokenToRevoke,
  tokenFingerprint,
  tokenKind,
  validateNewToken,
  type MapboxToken,
} from "./rotation.ts";

const SERVER: MapboxToken = { id: "t1", note: "lalamove-v2-server", usage: "sk", scopes: ["geocoding:read", "directions:read", "tokens:write", "tokens:read"] };
const BROWSER: MapboxToken = { id: "t2", note: "lalamove-v2-web", usage: "pk", scopes: ["styles:read"] };

Deno.test("tokenKind separa segredo, publico e temporario", () => {
  assertEquals(tokenKind("sk.abc"), "secret");
  assertEquals(tokenKind("pk.abc"), "public");
  assertEquals(tokenKind("tk.abc"), "temporary");
  assertEquals(tokenKind("abc"), "unknown");
});

Deno.test("kindOfListedToken usa `usage` porque a listagem nao traz o valor", () => {
  assertEquals(kindOfListedToken({ id: "a", usage: "sk" }), "secret");
  assertEquals(kindOfListedToken({ id: "a", usage: "pk" }), "public");
  assertEquals(kindOfListedToken({ id: "a", usage: "tk" }), "temporary");
  // Sem `usage` mas com valor (resposta da criacao), cai no prefixo.
  assertEquals(kindOfListedToken({ id: "a", token: "sk.xyz" }), "secret");
  assertEquals(kindOfListedToken({ id: "a" }), "unknown");
});

Deno.test("tokenFingerprint nao expoe o valor: prefixo, sufixo e tamanho", () => {
  // Valor sintetico: so precisa do prefixo sk. e de 40+ caracteres para exercitar o mascaramento.
  const secret = "sk.NAO_E_SEGREDO_TESTE";
  const fp = tokenFingerprint(secret);
  assertEquals(fp.includes(secret), false);
  assertStringIncludes(fp, "sk.eyJ");
  assertStringIncludes(fp, "ghij");
  assertStringIncludes(fp, `len ${secret.length}`);
});

Deno.test("tokenFingerprint aguenta valor curto e vazio sem estourar", () => {
  assertStringIncludes(tokenFingerprint("abc"), "len 3");
  assertEquals(tokenFingerprint("   "), "vazio");
});

Deno.test("buildCreateTokenBody herda os scopes mas remove tokens:write/read", () => {
  const body = buildCreateTokenBody(SERVER, "lalamove-v2-server rotated 2026-11-25");
  assertEquals(body.scopes, ["geocoding:read", "directions:read"]);
  assertEquals(body.scopes.includes("tokens:write"), false);
  assertEquals(body.note, "lalamove-v2-server rotated 2026-11-25");
});

Deno.test("buildCreateTokenBody de token sem scopes nao inventa escopo", () => {
  assertEquals(buildCreateTokenBody({ id: "x" }, "n").scopes, []);
});

Deno.test("pickTokenToRevoke devolve o unico sk candidato e ignora o novo", () => {
  const picked = pickTokenToRevoke([{ ...SERVER, id: "novo" }, SERVER, BROWSER], "novo");
  assertEquals(picked?.id, "t1");
});

Deno.test("pickTokenToRevoke nunca escolhe o token publico do navegador", () => {
  // Sem o servidor na lista, o unico candidato restante e o pk -> nao revoga nada.
  const picked = pickTokenToRevoke([{ id: "novo", usage: "sk" }, BROWSER], "novo");
  assertEquals(picked, null);
});

Deno.test("pickTokenToRevoke devolve null quando ha mais de um sk (ambiguidade)", () => {
  const outro: MapboxToken = { id: "t3", note: "outro", usage: "sk", scopes: ["geocoding:read"] };
  assertEquals(pickTokenToRevoke([{ id: "novo" }, SERVER, outro], "novo"), null);
});

Deno.test("pickTokenToRevoke usa o fingerprint quando a listagem traz o valor", () => {
  const alvo = "sk.alvo1234567890abcdef";
  const outro = "sk.outro9876543210zyxwvu";
  const picked = pickTokenToRevoke(
    [{ id: "novo" }, { id: "t1", token: alvo }, { id: "t3", token: outro }],
    "novo",
    tokenFingerprint(alvo),
  );
  assertEquals(picked?.id, "t1");
});

Deno.test("validateNewToken aceita sk com escopo e rejeita o resto", () => {
  assertEquals(validateNewToken("sk.novo", ["geocoding:read"]), null);
  assertStringIncludes(validateNewToken(undefined, ["geocoding:read"]) ?? "", "não devolveu token");
  assertStringIncludes(validateNewToken("pk.novo", ["styles:read"]) ?? "", "não é secreto");
  assertStringIncludes(validateNewToken("sk.novo", []) ?? "", "sem nenhum scope");
});