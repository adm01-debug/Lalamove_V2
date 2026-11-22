/**
 * Etapa 68: imagem do trajeto no WhatsApp.
 * O contrato tem três pernas e cada uma pode falhar sozinha sem derrubar o
 * alerta: (1) decidir quando há imagem, (2) gerar a imagem, (3) enviar.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildStaticMapRequest,
  buildStaticMapRequestFromRows,
  extractDataUrl,
  fetchStaticMap,
  isNonRetryableGeoError,
  parseRoute,
  shouldAttachStaticMap,
} from "./static-map.ts";

Deno.test("só as aproximações levam imagem", () => {
  assertEquals(shouldAttachStaticMap("DRIVER_APPROACHING_PICKUP"), true);
  assertEquals(shouldAttachStaticMap("DRIVER_APPROACHING_DELIVERY"), true);
  assertEquals(shouldAttachStaticMap("DRIVER_ARRIVED_PICKUP"), false);
  assertEquals(shouldAttachStaticMap("ETA_DELAY"), false);
});

Deno.test("markers na ordem coleta → entrega → motorista, com rota quando há 2+ pontos", () => {
  const req = buildStaticMapRequest({
    pickup: { lat: -25.4, lng: -49.2 },
    delivery: { lat: -25.5, lng: -49.3 },
    driver: { lat: -25.45, lng: -49.25 },
    route: [{ lat: -25.4, lng: -49.2 }, { lat: -25.45, lng: -49.25 }],
  });
  assert(req);
  assertEquals(req!.markers.map((m) => m.label), ["C", "E", "M"]);
  assertEquals(req!.path?.length, 2);
  assertEquals(req!.width, 600);
  assertEquals(req!.height, 300);
});

Deno.test("rota de um ponto só não vira path (path exige 2)", () => {
  const req = buildStaticMapRequest({
    pickup: { lat: -25.4, lng: -49.2 },
    route: [{ lat: -25.4, lng: -49.2 }],
  });
  assert(req);
  assertEquals(req!.path, undefined);
});

Deno.test("sem nenhum ponto não gera request (Google exige center/markers/path)", () => {
  assertEquals(buildStaticMapRequest({}), null);
  assertEquals(buildStaticMapRequest({ route: [{ lat: 1, lng: 2 }] }), null);
});

Deno.test("lê coordenadas do banco: numeric vem como string", () => {
  const req = buildStaticMapRequestFromRows(
    { pickup_latitude: "-25.40000000", pickup_longitude: "-49.20000000", delivery_latitude: null, delivery_longitude: null },
    { current_latitude: "-25.41", current_longitude: "-49.21", expected_route: [{ lat: "-25.4", lng: "-49.2" }, { lat: "-25.41", lng: "-49.21" }] },
  );
  assert(req);
  assertEquals(req!.markers.length, 2);
  assertEquals(req!.path?.length, 2);
});

Deno.test("expected_route inválido é ignorado, não quebra", () => {
  assertEquals(parseRoute(null), []);
  assertEquals(parseRoute([{ lat: "x" }, null, 3]), []);
});

Deno.test("só data URL de imagem é aceito como mídia", () => {
  assertEquals(extractDataUrl({ image: "data:image/png;base64,AAA" }), "data:image/png;base64,AAA");
  assertEquals(extractDataUrl({ image: "https://exemplo/x.png" }), null);
  assertEquals(extractDataUrl(null), null);
});

Deno.test("orçamento estourado e provedor desligado não são falha retentável", () => {
  assertEquals(isNonRetryableGeoError('geo-gateway: {"error":{"code":"GEO_BUDGET_EXCEEDED"}}'), true);
  assertEquals(isNonRetryableGeoError("geocodificacao esta desligada"), true);
  assertEquals(isNonRetryableGeoError("GEO_UNAVAILABLE"), true);
  assertEquals(isNonRetryableGeoError("Static Maps 500"), false);
});

Deno.test("fetchStaticMap devolve o data URL do gateway", async () => {
  const url = await fetchStaticMap(
    { invoke: async () => ({ image: "data:image/png;base64,ZZZ", width: 600, height: 300 }) },
    { markers: [{ lat: 1, lng: 2 }] },
  );
  assertEquals(url, "data:image/png;base64,ZZZ");
});

Deno.test("orçamento bloqueado ⇒ null, e o texto ainda sai", async () => {
  const url = await fetchStaticMap(
    { invoke: async () => { throw new Error('geo-gateway: {"error":{"code":"GEO_BUDGET_EXCEEDED"}}'); } },
    { markers: [{ lat: 1, lng: 2 }] },
  );
  assertEquals(url, null);
});

Deno.test("erro real do provedor também cai para texto, sem lançar", async () => {
  const url = await fetchStaticMap(
    { invoke: async () => { throw new Error("Static Maps 503"); } },
    { markers: [{ lat: 1, lng: 2 }] },
  );
  assertEquals(url, null);
});

Deno.test("GEO_STATIC_MAP_IN_WHATSAPP=false desliga a imagem sem chamar o gateway", async () => {
  let called = false;
  const url = await fetchStaticMap(
    {
      invoke: async () => { called = true; return { image: "data:image/png;base64,Z" }; },
      env: (k) => (k === "GEO_STATIC_MAP_IN_WHATSAPP" ? "false" : undefined),
    },
    { markers: [{ lat: 1, lng: 2 }] },
  );
  assertEquals(url, null);
  assertEquals(called, false);
});
