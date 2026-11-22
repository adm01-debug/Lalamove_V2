import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { persistOrderCoordinates, stopsCoords } from "./coordinates.ts";

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

// ── Etapa 36: place_id do provedor não pode ser sobrescrito pelo id da parada ──

function fakeSupabase() {
  const updates: Array<Record<string, unknown>> = [];
  const upserts: Array<Array<Record<string, unknown>>> = [];
  const client = {
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          return { eq: () => Promise.resolve({ error: null }) };
        },
        upsert(rows: Array<Record<string, unknown>>) {
          upserts.push(rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, updates, upserts };
}

Deno.test("persistOrderCoordinates mantem o place_id resolvido no formulario", async () => {
  const { client, updates } = fakeSupabase();
  await persistOrderCoordinates(
    client,
    "00000000-0000-0000-0000-000000000001",
    [stop("-25.43", "-49.27", "s1"), stop("-23.55", "-46.63", "s2")],
    { pickupPlaceId: "google:ChIJ123", deliveryPlaceId: "mapbox:dXJuOm1ie" },
  );
  assertEquals(updates[0].pickup_place_id, "google:ChIJ123");
  assertEquals(updates[0].delivery_place_id, "mapbox:dXJuOm1ie");
});

Deno.test("persistOrderCoordinates usa lalamove:<stopId> quando nao ha place_id do provedor", async () => {
  const { client, updates } = fakeSupabase();
  await persistOrderCoordinates(client, "id", [stop("-25.43", "-49.27", "s1"), stop("-23.55", "-46.63", "s2")]);
  assertEquals(updates[0].pickup_place_id, "lalamove:s1");
  assertEquals(updates[0].delivery_place_id, "lalamove:s2");
});

Deno.test("persistOrderCoordinates grava lat/lng e a linha de lalamove_stops com place_id", async () => {
  const { client, updates, upserts } = fakeSupabase();
  await persistOrderCoordinates(client, "id", [stop("-25.43", "-49.27", "s1"), stop("-23.55", "-46.63", "s2")]);
  assertEquals(updates[0].pickup_latitude, -25.43);
  assertEquals(upserts[0].length, 2);
  assertEquals(upserts[0][1].place_id, "lalamove:s2");
  assertEquals(upserts[0][1].stop_index, 1);
});
