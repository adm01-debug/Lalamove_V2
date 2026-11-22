import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  actionForErrorCode,
  nextStatus,
  parseCallback,
  timestampColumnFor,
  truncatePreview,
  unwrapPayload,
} from "./payload.ts";

Deno.test("unwrapPayload desembrulha data e aceita raiz plana", () => {
  assertEquals(unwrapPayload({ event: "message.status" }), { event: "message.status" });
  assertEquals(unwrapPayload({ data: { event: "message.status" } }), { event: "message.status" });
  assertEquals(unwrapPayload(null), null);
  assertEquals(unwrapPayload("texto"), null);
  assertEquals(unwrapPayload([1, 2]), null);
});

Deno.test("message.status valido vira escrita de status", () => {
  const write = parseCallback({
    event: "message.status",
    client_message_id: "cm-1",
    message_id: "pm-1",
    status: "delivered",
    occurred_at: "2026-11-25T12:00:00Z",
    sequence: 4,
  });
  assertEquals(write.ignore, false);
  assertEquals(write.kind, "status");
  assertEquals(write.status, "delivered");
  assertEquals(write.clientMessageId, "cm-1");
  assertEquals(write.providerMessageId, "pm-1");
  assertEquals(write.sequence, 4);
});

Deno.test("message.status com status desconhecido e ignorado sem perder id", () => {
  const write = parseCallback({ event: "message.status", message_id: "pm-9", status: "teleported" });
  assertEquals(write.ignore, true);
  assertEquals(write.ignoreReason, "status_desconhecido");
  assertEquals(write.providerMessageId, "pm-9");
});

Deno.test("status em maiuscula e normalizado", () => {
  const write = parseCallback({ event: "message.status", message_id: "pm-2", status: "READ" });
  assertEquals(write.status, "read");
});

Deno.test("payload sem identificador e ignorado", () => {
  const write = parseCallback({ event: "message.status", status: "sent" });
  assertEquals(write.ignore, true);
  assertEquals(write.ignoreReason, "sem_identificador");
});

Deno.test("evento desconhecido e ignorado", () => {
  const write = parseCallback({ event: "message.teleported", message_id: "x" });
  assertEquals(write.ignore, true);
  assertEquals(write.ignoreReason, "evento_nao_tratado");
});

Deno.test("payload invalido e ignorado", () => {
  assertEquals(parseCallback(null).ignoreReason, "payload_invalido");
  assertEquals(parseCallback(42).ignoreReason, "payload_invalido");
});

Deno.test("message.inbound com texto, opcao, midia e localizacao", () => {
  const write = parseCallback({
    event: "message.inbound",
    from: "5541999998888",
    message_id: "in-1",
    text: "confirmo",
    choice_id: "1",
    media_url: "https://cdn/zapp/foto.jpg",
    location: { lat: -25.43, lng: -49.27 },
    in_reply_to: "cm-1",
    correlation: "ord-1:DRIVER_ASSIGNED:driver",
  });
  assertEquals(write.kind, "inbound");
  assertEquals(write.bodyPreview, "confirmo");
  assertEquals(write.inbound?.choiceId, "1");
  assertEquals(write.inbound?.mediaUrl, "https://cdn/zapp/foto.jpg");
  assertEquals(write.inbound?.location, { lat: -25.43, lng: -49.27 });
  assertEquals(write.inbound?.inReplyTo, "cm-1");
  assertEquals(write.inbound?.correlation, "ord-1:DRIVER_ASSIGNED:driver");
});

Deno.test("inbound aceita latitude/longitude alternativos", () => {
  const write = parseCallback({
    event: "message.inbound",
    message_id: "in-2",
    location: { latitude: "-25.1", longitude: "-49.2" },
  });
  assertEquals(write.inbound?.location, { lat: -25.1, lng: -49.2 });
});

Deno.test("inbound sem coordenada completa nao vira localizacao", () => {
  const write = parseCallback({
    event: "message.inbound",
    message_id: "in-3",
    location: { lat: -25.1 },
  });
  assertEquals(write.inbound?.location, null);
});

Deno.test("message.outbound_manual registra resposta do operador", () => {
  const write = parseCallback({
    event: "message.outbound_manual",
    client_message_id: "cm-7",
    text: "Ja estou a caminho",
  });
  assertEquals(write.kind, "outbound_manual");
  assertEquals(write.status, "sent");
  assertEquals(write.bodyPreview, "Ja estou a caminho");
});

Deno.test("truncatePreview corta em 280 e preserva null", () => {
  assertEquals(truncatePreview(null), null);
  assertEquals(truncatePreview("curto"), "curto");
  const longo = "x".repeat(400);
  assertEquals(truncatePreview(longo)?.length, 280);
});

Deno.test("timestampColumnFor mapeia status para coluna", () => {
  assertEquals(timestampColumnFor("sent"), "sent_at");
  assertEquals(timestampColumnFor("delivered"), "delivered_at");
  assertEquals(timestampColumnFor("read"), "read_at");
  assertEquals(timestampColumnFor("failed"), "failed_at");
  assertEquals(timestampColumnFor("queued"), null);
});

Deno.test("nextStatus avanca e nunca regride", () => {
  assertEquals(nextStatus(null, "sent"), "sent");
  assertEquals(nextStatus("queued", "sent"), "sent");
  assertEquals(nextStatus("sent", "delivered"), "delivered");
  assertEquals(nextStatus("delivered", "read"), "read");
  // callback atrasado
  assertEquals(nextStatus("read", "delivered"), null);
  assertEquals(nextStatus("read", "sent"), null);
  assertEquals(nextStatus("delivered", "queued"), null);
});

Deno.test("nextStatus nao ressuscita mensagem falhada", () => {
  assertEquals(nextStatus("failed", "delivered"), null);
  assertEquals(nextStatus("expired", "sent"), null);
  assertEquals(nextStatus("suppressed", "queued"), null);
});

Deno.test("nextStatus permite ir de queued para failed", () => {
  assertEquals(nextStatus("queued", "failed"), "failed");
  assertEquals(nextStatus("sent", "failed"), "failed");
});

Deno.test("nextStatus com status igual nao reescreve", () => {
  assertEquals(nextStatus("delivered", "delivered"), null);
});

Deno.test("actionForErrorCode mapeia a tabela da etapa 14", () => {
  assertEquals(actionForErrorCode("invalid_number"), "fallback");
  assertEquals(actionForErrorCode("recipient_blocked"), "fallback");
  assertEquals(actionForErrorCode("recipient_opted_out"), "fallback");
  assertEquals(actionForErrorCode("instance_unavailable"), "fallback");
  assertEquals(actionForErrorCode("rate_limited"), "retry");
  assertEquals(actionForErrorCode("expired"), "give_up");
  assertEquals(actionForErrorCode("unauthorized"), "give_up");
  assertEquals(actionForErrorCode("media_invalid"), "alert");
  assertEquals(actionForErrorCode(null), null);
  // codigo novo que o Zapp ainda nao documentou: alerta, nao chute
  assertEquals(actionForErrorCode("codigo_novo"), "alert");
});