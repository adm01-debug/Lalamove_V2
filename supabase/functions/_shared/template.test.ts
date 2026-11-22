import { assertEquals } from "jsr:@std/assert@1";
import { missingTemplateVars, renderTemplate } from "./template.ts";

Deno.test("renderTemplate: substitui as variaveis do template PT-BR de coleta", () => {
  const out = renderTemplate(
    "Olá {{pickup_contact_name}}, o motorista {{driver_name}} ({{driver_plate}}) chega em ~{{eta_min}} min para retirar o pedido {{order_ref}}. Acompanhe: {{share_link}}",
    {
      pickup_contact_name: "Maria",
      driver_name: "João",
      driver_plate: "ABC1D23",
      eta_min: 7.6,
      order_ref: "LM-9981",
      share_link: "https://x/abc",
    },
  );
  assertEquals(
    out,
    "Olá Maria, o motorista João (ABC1D23) chega em ~8 min para retirar o pedido LM-9981. Acompanhe: https://x/abc",
  );
});

Deno.test("renderTemplate: placeholder sem valor e preservado, nunca vira undefined", () => {
  const out = renderTemplate("Chegou {{driver_name}} do pedido {{order_ref}}", { driver_name: "João" });
  assertEquals(out, "Chegou João do pedido {{order_ref}}");
});

Deno.test("renderTemplate: null e string vazia tambem preservam o placeholder", () => {
  assertEquals(renderTemplate("a {{driver_name}} b", { driver_name: null }), "a {{driver_name}} b");
  assertEquals(renderTemplate("a {{driver_name}} b", { driver_name: "" }), "a {{driver_name}} b");
  assertEquals(renderTemplate("a {{driver_name}} b", {}), "a {{driver_name}} b");
});

Deno.test("renderTemplate: aceita espacos dentro das chaves", () => {
  assertEquals(renderTemplate("{{ driver_plate }}", { driver_plate: "ABC1D23" }), "ABC1D23");
});

Deno.test("renderTemplate: distance_m sai em pt-BR conforme a ordem de grandeza", () => {
  assertEquals(renderTemplate("{{distance_m}}", { distance_m: 420 }), "420 m");
  assertEquals(renderTemplate("{{distance_m}}", { distance_m: 1450 }), "1,5 km");
});

Deno.test("renderTemplate: eta_min e arredondado e nunca menor que 1", () => {
  assertEquals(renderTemplate("{{eta_min}}", { eta_min: 2.4 }), "2");
  assertEquals(renderTemplate("{{eta_min}}", { eta_min: 0 }), "1");
  assertEquals(renderTemplate("{{eta_min}}", { eta_min: 1.5 }), "2");
});

Deno.test("renderTemplate: template vazio devolve string vazia", () => {
  assertEquals(renderTemplate("", { driver_name: "João" }), "");
});

Deno.test("missingTemplateVars: lista so as variaveis sem valor", () => {
  assertEquals(
    missingTemplateVars("{{driver_name}} {{order_ref}} {{share_link}}", {
      driver_name: "João",
      order_ref: "",
      share_link: null,
    }),
    ["order_ref", "share_link"],
  );
});

Deno.test("missingTemplateVars: template completo devolve lista vazia", () => {
  assertEquals(missingTemplateVars("{{order_ref}}", { order_ref: "LM-1" }), []);
});
