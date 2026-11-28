import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizarHost, resolverDominioBitrix24, urlPortalBitrix24 } from "./bitrix24-domain.ts";

function envFake(vars: Record<string, string>) {
  return { get: (chave: string) => vars[chave] };
}

Deno.test("normalizarHost aceita host puro e limpa esquema/caminho", () => {
  assertEquals(normalizarHost("empresa.bitrix24.com.br"), "empresa.bitrix24.com.br");
  assertEquals(normalizarHost("  EMPRESA.Bitrix24.com  "), "empresa.bitrix24.com");
  assertEquals(normalizarHost("https://empresa.bitrix24.com/rest/"), "empresa.bitrix24.com");
});

Deno.test("normalizarHost rejeita esquema, porta, espaco interno e valores nao-string", () => {
  assertEquals(normalizarHost("empresa.bitrix24.com:8443"), null);
  assertEquals(normalizarHost("empresa bitrix24.com"), null);
  assertEquals(normalizarHost("usuario@empresa.bitrix24.com"), null);
  assertEquals(normalizarHost("localhost"), null);
  assertEquals(normalizarHost(""), null);
  assertEquals(normalizarHost(undefined), null);
  assertEquals(normalizarHost(42), null);
});

Deno.test("secret vence o dominio gravado", () => {
  const r = resolverDominioBitrix24(envFake({ BITRIX24_DOMAIN: "contratado.bitrix24.com.br" }), "antigo.bitrix24.com");
  assertEquals(r, { ok: true, domain: "contratado.bitrix24.com.br" });
});

Deno.test("dominio envenenado por sufixo e recusado quando o secret define o portal", () => {
  const r = resolverDominioBitrix24(envFake({ BITRIX24_DOMAIN: "contratado.bitrix24.com.br" }), "evil.bitrix24.com.attacker.tld");
  assertEquals(r, { ok: true, domain: "contratado.bitrix24.com.br" });
  // e a url final nunca aponta para o host do atacante
  if (r.ok) assertEquals(urlPortalBitrix24(r.domain), "https://contratado.bitrix24.com.br");
});

Deno.test("sem secret, cai no dominio gravado quando ele e host valido", () => {
  const r = resolverDominioBitrix24(envFake({}), "legado.bitrix24.com");
  assertEquals(r, { ok: true, domain: "legado.bitrix24.com" });
});

Deno.test("sem secret e sem dominio gravado, falha com motivo", () => {
  const r = resolverDominioBitrix24(envFake({}), null);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.motivo.includes("BITRIX24_DOMAIN"), true);
});

Deno.test("secret invalido falha em vez de cair no gravado", () => {
  const r = resolverDominioBitrix24(envFake({ BITRIX24_DOMAIN: "https://x/../y:99" }), "legado.bitrix24.com");
  assertEquals(r.ok, false);
});
