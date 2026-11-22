import { assertEquals, assert, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildClientMessageId, buildCorrelation } from "./message-id.ts";

const base = { orderId: "order-9", event: "DRIVER_DELAYED", role: "driver", phone: "5541999998888" };

Deno.test("etapa 89: mesmo evento devolve o mesmo id (idempotência)", () => {
  assertEquals(buildClientMessageId(base), buildClientMessageId({ ...base }));
});

Deno.test("etapa 89: telefone com máscara não muda o id", () => {
  assertEquals(
    buildClientMessageId(base),
    buildClientMessageId({ ...base, phone: "+55 (41) 99999-8888" }),
  );
});

Deno.test("etapa 89: eventos diferentes geram ids diferentes", () => {
  assertNotEquals(
    buildClientMessageId(base),
    buildClientMessageId({ ...base, event: "DRIVER_ARRIVED" }),
  );
});

Deno.test("etapa 89: papéis diferentes no mesmo telefone geram ids diferentes", () => {
  assertNotEquals(
    buildClientMessageId({ ...base, role: "pickup_contact" }),
    buildClientMessageId({ ...base, role: "delivery_contact" }),
  );
});

Deno.test("etapa 89: telefones diferentes geram ids diferentes", () => {
  assertNotEquals(
    buildClientMessageId(base),
    buildClientMessageId({ ...base, phone: "5541888887777" }),
  );
});

Deno.test("etapa 89: seq diferente gera id diferente (reenvio explícito)", () => {
  assertNotEquals(buildClientMessageId(base), buildClientMessageId({ ...base, seq: 1 }));
});

Deno.test("etapa 89: id é curto e legível, não uuid completo", () => {
  const id = buildClientMessageId(base);
  assert(/^[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{4}$/.test(id), `formato inesperado: ${id}`);
});

Deno.test("etapa 86: correlação identifica evento, pedido, papel e canal", () => {
  assertEquals(
    buildCorrelation(base, "whatsapp"),
    "DRIVER_DELAYED:order-9:driver:whatsapp",
  );
});

Deno.test("etapa 86: sem pedido a correlação usa o telefone", () => {
  assertEquals(
    buildCorrelation({ ...base, orderId: null }, "whatsapp"),
    "DRIVER_DELAYED:5541999998888:driver:whatsapp",
  );
});
