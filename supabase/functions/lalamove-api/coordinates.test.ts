import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stopsCoords } from "./coordinates.ts";

// Formato real devolvido pela Lalamove v3: lat/lng como STRING.
const stop = (lat: string, lng: string, stopId = "s1", address = "Rua A, 1") => ({
  stopId, address, coordinates: { lat, lng },
});

Deno.test("stopsCoords converte as coordenadas string da Lalamove em numero", () => {
  const [c] = stopsCoords([stop("-23.550520", "-46.633308")]);
  assertEquals(c.lat, -23.55052);
  assertEquals(c.lng, -46.633308);
  assertEquals(c.stopId, "s1");
  assertEquals(c.address, "Rua A, 1");
});

Deno.test("stopsCoords preserva a ordem das paradas (indice = stop_index)", () => {
  const coords = stopsCoords([stop("-23.5", "-46.6"), stop("-23.6", "-46.7", "s2")]);
  assertEquals(coords.map((c) => c.lat), [-23.5, -23.6]);
});

Deno.test("stopsCoords anula 0,0 — placeholder que a Lalamove rejeita", () => {
  const [c] = stopsCoords([stop("0", "0")]);
  assertEquals(c.lat, null);
  assertEquals(c.lng, null);
});

Deno.test("stopsCoords anula coordenada invalida em vez de gravar NaN", () => {
  const [c] = stopsCoords([stop("abc", "-46.6")]);
  assertEquals(c.lat, null);
});

Deno.test("stopsCoords tolera parada sem coordinates (nao quebra o pedido)", () => {
  const [c] = stopsCoords([{ stopId: "s1", address: "Rua A" }]);
  assertEquals(c.lat, null);
  assertEquals(c.lng, null);
});

Deno.test("stopsCoords devolve lista vazia para undefined", () => {
  assertEquals(stopsCoords(undefined), []);
});
