import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizePhone, isDeliverablePhone, resolveGeoRecipient } from "./phone.ts";

/**
 * Etapa 59 do plano Google Maps (D1) — normalização E.164 e resolução de
 * destinatário do aviso geográfico.
 */

Deno.test("normaliza celular com máscara", () => {
  assertEquals(normalizePhone("(41) 99999-8888"), "+5541999998888");
});

Deno.test("normaliza celular já com DDI", () => {
  assertEquals(normalizePhone("+55 41 99999-8888"), "+5541999998888");
  assertEquals(normalizePhone("+5541999998888"), "+5541999998888");
});

Deno.test("normaliza celular cru e remove zero de discagem", () => {
  assertEquals(normalizePhone("41999998888"), "+5541999998888");
  assertEquals(normalizePhone("041999998888"), "+5541999998888");
  assertEquals(normalizePhone("0041999998888"), "+5541999998888");
});

Deno.test("normaliza telefone fixo de 10 dígitos", () => {
  assertEquals(normalizePhone("(41) 3333-4444"), "+554133334444");
});

Deno.test("rejeita máscara censurada", () => {
  // `****` parece telefone em exportação de CRM e não é — precisa virar null,
  // não string vazia que depois passa por acidente.
  assertEquals(normalizePhone("****"), null);
  assertEquals(normalizePhone("(41) *****-8888"), null);
  assertEquals(normalizePhone("41####8888"), null);
  assertEquals(normalizePhone("41999998888x"), null);
});

Deno.test("rejeita vazio, null, undefined e não-string", () => {
  assertEquals(normalizePhone(""), null);
  assertEquals(normalizePhone("   "), null);
  assertEquals(normalizePhone(null), null);
  assertEquals(normalizePhone(undefined), null);
  assertEquals(normalizePhone(41999998888), null);
});

Deno.test("rejeita quantidade de dígitos inválida", () => {
  assertEquals(normalizePhone("4199999888"), null); // 10 dígitos mas DDD 41 + 8 começando com 9 => celular truncado
  assertEquals(normalizePhone("419999888"), null);
  assertEquals(normalizePhone("419999988889"), null);
});

Deno.test("rejeita DDD inexistente", () => {
  assertEquals(normalizePhone("01999998888"), null);
  assertEquals(normalizePhone("00999998888"), null);
});

Deno.test("celular de 11 dígitos precisa ter 9 após o DDD", () => {
  assertEquals(normalizePhone("41899998888"), null);
  assertEquals(normalizePhone("41999998888"), "+5541999998888");
});

Deno.test("isDeliverablePhone reflete normalizePhone", () => {
  assert(isDeliverablePhone("(41) 99999-8888"));
  assert(!isDeliverablePhone("****"));
});

Deno.test("resolve: contato da coleta tem prioridade", () => {
  const r = resolveGeoRecipient({
    pickup_contact_phone: "(41) 99999-8888",
    supplier_contact: "(41) 3333-4444",
    auto_notify_supplier: true,
    stop_contact_phone: "(41) 98888-7777",
  });
  assertEquals(r, { phone: "+5541999998888", source: "pickup_contact" });
});

Deno.test("resolve: fornecedor só entra com auto_notify_supplier", () => {
  const semAuto = resolveGeoRecipient({
    pickup_contact_phone: "****",
    supplier_contact: "(41) 3333-4444",
    auto_notify_supplier: false,
  });
  assertEquals(semAuto, null);

  const comAuto = resolveGeoRecipient({
    pickup_contact_phone: "****",
    supplier_contact: "(41) 3333-4444",
    auto_notify_supplier: true,
  });
  assertEquals(comAuto, { phone: "+554133334444", source: "supplier_contact" });
});

Deno.test("resolve: cai no telefone da parada quando os demais falham", () => {
  const r = resolveGeoRecipient({
    pickup_contact_phone: null,
    supplier_contact: "****",
    auto_notify_supplier: true,
    stop_contact_phone: "(41) 98888-7777",
  });
  assertEquals(r, { phone: "+5541988887777", source: "stop_contact" });
});

Deno.test("resolve: nenhum candidato válido devolve null (vira no_recipient)", () => {
  assertEquals(resolveGeoRecipient({ pickup_contact_phone: "****", supplier_contact: "##" }), null);
  assertEquals(resolveGeoRecipient({}), null);
});
