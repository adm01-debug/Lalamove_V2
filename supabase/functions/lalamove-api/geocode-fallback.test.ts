import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { geocodeAddress, geocodeOrderFallback } from "./geocode-fallback.ts";

const deps = (payload: unknown, status = 200) => ({
  supabaseUrl: "https://x.supabase.co",
  serviceRoleKey: "k",
  fetchFn: (() => Promise.resolve(
    new Response(JSON.stringify(payload), { status }),
  )) as unknown as typeof fetch,
});

const hit = (over: Record<string, unknown> = {}) => ({
  data: [{
    location: { lat: -25.4284, lng: -49.2733 },
    place_id: "mapbox:abc",
    precision: "high",
    provider: "mapbox",
    formatted: "Rua XV de Novembro 1000, Curitiba",
    components: { number: "1000" },
    ...over,
  }],
});

Deno.test("geocodeAddress devolve coordenada e place_id do gateway", async () => {
  const r = await geocodeAddress("Rua XV de Novembro 1000, Curitiba", deps(hit()));
  assertEquals(r?.lat, -25.4284);
  assertEquals(r?.lng, -49.2733);
  assertEquals(r?.place_id, "mapbox:abc");
  assertEquals(r?.requires_review, false);
});

Deno.test("geocodeAddress marca revisao quando o endereco nao tem numero", async () => {
  const r = await geocodeAddress("Rua XV de Novembro, Curitiba", deps(hit({ components: {} })));
  assertEquals(r?.requires_review, true);
});

Deno.test("geocodeAddress marca revisao com precisao baixa", async () => {
  const r = await geocodeAddress("Rua XV 1000", deps(hit({ precision: "low" })));
  assertEquals(r?.requires_review, true);
});

Deno.test("geocodeAddress nao marca revisao com precisao exact e numero", async () => {
  const r = await geocodeAddress("Rua XV 1000", deps(hit({ precision: "exact" })));
  assertEquals(r?.requires_review, false);
});

Deno.test("geocodeAddress devolve null quando o gateway falha (pedido nunca cai por geo)", async () => {
  const r = await geocodeAddress("Rua XV 1000", deps({ error: "boom" }, 500));
  assertEquals(r, null);
});

Deno.test("geocodeAddress devolve null para endereco vazio/curto", async () => {
  assertEquals(await geocodeAddress("", deps(hit())), null);
  assertEquals(await geocodeAddress("ab", deps(hit())), null);
  assertEquals(await geocodeAddress(null, deps(hit())), null);
});

Deno.test("geocodeAddress devolve null quando o provedor nao acha nada", async () => {
  const r = await geocodeAddress("Rua Inexistente 999", deps({ data: [] }));
  assertEquals(r, null);
});

Deno.test("geocodeAddress pede persist=true ao gateway (retencao permanente no Mapbox)", async () => {
  let enviado: Record<string, unknown> = {};
  const r = await geocodeAddress("Rua XV de Novembro 1000, Curitiba", {
    supabaseUrl: "https://x.supabase.co",
    serviceRoleKey: "k",
    fetchFn: ((_u: string, init: { body: string }) => {
      enviado = JSON.parse(init.body);
      return Promise.resolve(new Response(JSON.stringify(hit()), { status: 200 }));
    }) as unknown as typeof fetch,
  });
  assert(r?.lat != null);
  assertEquals(enviado.persist, true);
});

Deno.test("geocodeOrderFallback grava coleta e entrega com provedor do gateway", async () => {  const patch = await geocodeOrderFallback("Rua A 1", "Rua B 2", deps(hit()));
  assertEquals(patch.pickup_latitude, -25.4284);
  assertEquals(patch.delivery_latitude, -25.4284);
  assertEquals(patch.geocode_provider, "mapbox");
  assertEquals(patch.geocode_precision, "high");
  assertEquals(patch.requires_address_review, false);
});

Deno.test("geocodeOrderFallback propaga requires_address_review quando um lado e impreciso", async () => {
  let call = 0;
  const fetchFn = (() => {
    call++;
    const payload = call === 1 ? hit() : hit({ precision: "low" });
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  }) as unknown as typeof fetch;
  const patch = await geocodeOrderFallback("Rua A 1", "Rua B", {
    supabaseUrl: "https://x.supabase.co", serviceRoleKey: "k", fetchFn,
  });
  assertEquals(patch.requires_address_review, true);
});

Deno.test("geocodeOrderFallback devolve patch vazio sem coordenada resolvida", async () => {
  const patch = await geocodeOrderFallback("", "", deps(hit()));
  assertEquals(Object.keys(patch).length, 0);
});

Deno.test("geocodeOrderFallback nao inventa coordenada parcial", async () => {
  let call = 0;
  const fetchFn = (() => {
    call++;
    const payload = call === 1 ? hit() : { data: [] };
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  }) as unknown as typeof fetch;
  const patch = await geocodeOrderFallback("Rua A 1", "Rua Inexistente 999", {
    supabaseUrl: "https://x.supabase.co", serviceRoleKey: "k", fetchFn,
  });
  assertEquals(patch.pickup_latitude, -25.4284);
  assert(patch.delivery_latitude === undefined, "entrega nao resolvida nao vira coluna");
});