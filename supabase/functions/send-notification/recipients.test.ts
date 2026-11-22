/**
 * Etapa 66: a união pedido × alert_configurations tem de ser explícita.
 * O risco real é duplicidade (mesmo telefone configurado e no pedido) e
 * entrada inválida derrubando o alerta.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  firstByRole,
  normalizeRecipients,
  recipientKey,
  unionRecipients,
  type NotificationRecipient,
} from "./recipients.ts";

Deno.test("normaliza o formato do trigger e descarta o que não tem canal ou destino", () => {
  const out = normalizeRecipients([
    { channel: "whatsapp", to: "5541999998888", role: "pickup_contact", name: "Fornecedor" },
    { channel: "whatsapp", to: null },
    { to: "x@y.com" },
    null,
    "texto solto",
    { channel: "  ", to: "   " },
  ]);
  assertEquals(out, [
    { channel: "whatsapp", to: "5541999998888", role: "pickup_contact", name: "Fornecedor" },
  ]);
});

Deno.test("entrada que não é array devolve lista vazia, sem lançar", () => {
  assertEquals(normalizeRecipients(undefined), []);
  assertEquals(normalizeRecipients(null), []);
  assertEquals(normalizeRecipients({ channel: "whatsapp", to: "1" }), []);
});

Deno.test("une pedido + configuração preservando os dois", () => {
  const doPedido: NotificationRecipient[] = [
    { channel: "whatsapp", to: "5541999998888", role: "pickup_contact" },
  ];
  const daConfig: NotificationRecipient[] = [
    { channel: "whatsapp", to: "5541888887777", role: "internal" },
    { channel: "email", to: "ops@promobrindes.com" },
  ];
  const uniao = unionRecipients(doPedido, daConfig);
  assertEquals(uniao.length, 3);
  assertEquals(uniao.map((r) => r.to), ["5541999998888", "5541888887777", "ops@promobrindes.com"]);
});

Deno.test("mesmo destino no pedido e na configuração sai uma vez só", () => {
  const uniao = unionRecipients(
    [{ channel: "whatsapp", to: "+55 41 99999-8888" }],
    [{ channel: "whatsapp", to: "+55 41 99999-8888" }],
  );
  assertEquals(uniao.length, 1);
});

Deno.test("o mesmo número em canais diferentes são dois envios legítimos", () => {
  const uniao = unionRecipients(
    [{ channel: "whatsapp", to: "5541999998888" }],
    [{ channel: "sms", to: "5541999998888" }],
  );
  assertEquals(uniao.length, 2);
});

Deno.test("chave ignora caixa e espaço nas pontas do destino", () => {
  assertEquals(recipientKey("Email", " Ops@X.com "), "Email:ops@x.com");
});

Deno.test("primeiro por papel alimenta o template", () => {
  const list: NotificationRecipient[] = [
    { channel: "whatsapp", to: "1", role: "pickup_contact", name: "Fornecedor" },
    { channel: "whatsapp", to: "2", role: "delivery_contact", name: "Cliente" },
  ];
  assertEquals(firstByRole(list, "delivery_contact")?.name, "Cliente");
  assertEquals(firstByRole(list, "internal"), undefined);
});
