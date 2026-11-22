import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { processGeoBackfillOrders } from "./index.ts";

/**
 * Etapa 39 — backfill de coordenada por pedido.
 * O fake cobre só o que a função usa: `from().select().or().order().limit()`,
 * `from().update(patch).eq()` e `functions.invoke`.
 */
function fakeSupabase(orders: any[], geocode: (address: string) => any) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      if (table !== "lalamove_orders") throw new Error(`tabela inesperada: ${table}`);
      return {
        select: () => ({
          or: () => ({
            order: () => ({
              limit: (n: number) => Promise.resolve({ data: orders.slice(0, n), error: null }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => {
            updates.push({ id, patch });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
    functions: {
      invoke: (_fn: string, opts: { body: { address: string } }) => {
        const result = geocode(opts.body.address);
        if (result instanceof Error) return Promise.resolve({ data: null, error: result });
        return Promise.resolve({ data: [result], error: null });
      },
    },
  };
  return { client, updates };
}

const exact = (lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  formatted: "Rua XV de Novembro, 500 - Curitiba",
  location: { lat, lng },
  place_id: "google:abc",
  provider: "google",
  precision: "exact",
  components: { street: "Rua XV de Novembro", number: "500" },
  ...extra,
});

Deno.test("grava coordenada de coleta e entrega e marca provedor/precisão", async () => {
  const { client, updates } = fakeSupabase(
    [{
      id: "o1", pickup_address: "Rua XV de Novembro, 500", delivery_address: "Av. Brasil, 100",
      pickup_latitude: null, delivery_latitude: null, lalamove_status: "ON_GOING",
    }],
    (addr) => (addr.startsWith("Rua XV") ? exact(-25.42, -49.27) : exact(-25.5, -49.3)),
  );

  const r = await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(r.mode, "orders");
  assertEquals(r.geocoded, 2);
  assertEquals(r.requires_review, 0);
  assertEquals(updates.length, 1);
  assertEquals(updates[0].patch.pickup_latitude, -25.42);
  assertEquals(updates[0].patch.pickup_longitude, -49.27);
  assertEquals(updates[0].patch.delivery_latitude, -25.5);
  assertEquals(updates[0].patch.pickup_place_id, "google:abc");
  assertEquals(updates[0].patch.geocode_provider, "google");
  assertEquals(updates[0].patch.geocode_precision, "exact");
  assert(!("requires_address_review" in updates[0].patch));
});

Deno.test("endereço sem número liga requires_address_review", async () => {
  const semNumero = { ...exact(-25.42, -49.27), components: { street: "Rua XV de Novembro" } };
  const { client, updates } = fakeSupabase(
    [{ id: "o2", pickup_address: "Rua XV de Novembro", delivery_address: null, pickup_latitude: null, delivery_latitude: -25.1 }],
    () => semNumero,
  );

  const r = await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(r.requires_review, 1);
  assertEquals(updates[0].patch.requires_address_review, true);
});

Deno.test("precisão low liga requires_address_review", async () => {
  const { client, updates } = fakeSupabase(
    [{ id: "o3", pickup_address: "Rodovia BR-116 km 100", delivery_address: null, pickup_latitude: null, delivery_latitude: -25.1 }],
    () => exact(-25.4, -49.2, { precision: "low" }),
  );

  const r = await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(r.requires_review, 1);
  assertEquals(updates[0].patch.requires_address_review, true);
});

Deno.test("lado que já tem coordenada não é recotado nem sobrescrito", async () => {
  const { client, updates } = fakeSupabase(
    [{ id: "o4", pickup_address: "Rua A, 1", delivery_address: "Rua B, 2", pickup_latitude: -25.0, delivery_latitude: null }],
    () => exact(-25.9, -49.9),
  );

  await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(updates[0].patch.pickup_latitude, undefined);
  assertEquals(updates[0].patch.delivery_latitude, -25.9);
});

Deno.test("sem resultado do provedor não grava nada", async () => {
  const { client, updates } = fakeSupabase(
    [{ id: "o5", pickup_address: "Rua Inexistente, 999", delivery_address: null, pickup_latitude: null, delivery_latitude: null }],
    () => ({ formatted: null, location: null, place_id: null, provider: "google", precision: "unknown", components: {} }),
  );

  const r = await processGeoBackfillOrders(client, { source: "orders" });

  // not_found conta POR LADO (coleta e entrega), não por pedido: aqui a coleta não
  // resolveu e a entrega nem tem endereço, então são 2 lados sem ponto.
  assertEquals(r.not_found, 2);
  assertEquals(updates.length, 0);
});

Deno.test("provedor desligado é skipped, não failed — não queima tentativa", async () => {
  const { client, updates } = fakeSupabase(
    [{ id: "o6", pickup_address: "Rua A, 1", delivery_address: null, pickup_latitude: null, delivery_latitude: null }],
    () => new Error("geo-gateway: GEO_UNAVAILABLE - geocodificacao esta desligada"),
  );

  const r = await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(r.skipped, 1);
  assertEquals(r.failed, 0);
  assertEquals(updates.length, 0);
});

Deno.test("status ativo é processado primeiro", async () => {
  const seen: string[] = [];
  const orders = [
    { id: "velho", pickup_address: "Rua A, 1", delivery_address: null, pickup_latitude: null, delivery_latitude: null, lalamove_status: "CANCELLED" },
    { id: "ativo", pickup_address: "Rua B, 1", delivery_address: null, pickup_latitude: null, delivery_latitude: null, lalamove_status: "ON_GOING" },
  ];
  const { client } = fakeSupabase(orders, (a) => { seen.push(a); return exact(-25.1, -49.1); });

  await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(seen[0], "Rua B, 1");
});

Deno.test("endereço vazio ou curto não gasta chamada ao provedor", async () => {
  let calls = 0;
  const { client } = fakeSupabase(
    [{ id: "o7", pickup_address: "abc", delivery_address: null, pickup_latitude: null, delivery_latitude: null }],
    () => { calls++; return exact(-25.1, -49.1); },
  );

  await processGeoBackfillOrders(client, { source: "orders" });

  assertEquals(calls, 0);
});

Deno.test("limit é limitado entre 1 e 500", async () => {
  let asked = 0;
  const { client } = { client: {
    from: () => ({ select: () => ({ or: () => ({ order: () => ({ limit: (n: number) => { asked = n; return Promise.resolve({ data: [], error: null }); } }) }) }) }),
    functions: { invoke: () => Promise.resolve({ data: [], error: null }) },
  } } as any;

  await processGeoBackfillOrders(client, { source: "orders", limit: 9999 });
  assertEquals(asked, 500);

  await processGeoBackfillOrders(client, { source: "orders", limit: 0 });
  assertEquals(asked, 100);
});
