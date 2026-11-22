// deno test --allow-net --allow-env supabase/functions/geo-gateway/google.test.ts
import { assertEquals, assertRejects, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { GoogleProvider } from "./providers/google.ts";
import { GeoProviderError } from "./providers/types.ts";
import type { GeoProvider } from "./providers/types.ts";
import { encodePolyline } from "./polyline.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
function mockFetch(handler: (c: Call) => { status?: number; body?: unknown }, calls: Call[] = []) {
  const fn = ((input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    const h = init?.headers as Record<string, string> | undefined;
    if (h) for (const k in h) headers[k] = h[k];
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const r = handler(call);
    return Promise.resolve(new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 }));
  }) as typeof fetch;
  return { fetch: fn, calls };
}

Deno.test("autocomplete: Places API (New) normalizado; sessionToken passado; units=0 com sessão", async () => {
  const { fetch, calls } = mockFetch(() => ({
    body: {
      suggestions: [{
        placePrediction: {
          placeId: "ChIJ123", text: { text: "Rua XV de Novembro, Curitiba" },
          structuredFormat: { mainText: { text: "Rua XV de Novembro" }, secondaryText: { text: "Curitiba, PR" } },
          types: ["route"],
        },
      }],
    },
  }));
  const p = new GoogleProvider({ key: "AIzaTest", fetch });
  const r = await p.autocomplete({ input: "Rua XV", session_token: "sess-1", bias: { lat: -25.43, lng: -49.27, radius_m: 3000 } });
  assertEquals(r.data[0].id, "google:ChIJ123");
  assertEquals(r.data[0].main_text, "Rua XV de Novembro");
  assertEquals(r.data[0].secondary_text, "Curitiba, PR");
  assertEquals(r.data[0].type, "route");
  assertEquals(r.sku, "places_autocomplete_request");
  assertEquals(r.units, 0);
  assertEquals(calls[0].method, "POST");
  assertEquals(calls[0].headers["X-Goog-Api-Key"], "AIzaTest");
  assertEquals((calls[0].body as { sessionToken?: string }).sessionToken, "sess-1");
  const bias = (calls[0].body as { locationBias?: { circle?: { radius?: number } } }).locationBias;
  assertEquals(bias?.circle?.radius, 3000);
});

Deno.test("autocomplete: sem session_token conta units=1 (sem sessão paga)", async () => {
  const { fetch } = mockFetch(() => ({ body: { suggestions: [] } }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.autocomplete({ input: "x" });
  assertEquals(r.units, 1);
});

Deno.test("placeDetails: componentes mapeados (número/rua/bairro sublocality_level_1/cidade/UF/CEP), retainable=true", async () => {
  const { fetch, calls } = mockFetch(() => ({
    body: {
      id: "ChIJ123", formattedAddress: "Rua XV de Novembro, 100, Curitiba - PR",
      location: { latitude: -25.4296, longitude: -49.2716 },
      addressComponents: [
        { longText: "100", shortText: "100", types: ["street_number"] },
        { longText: "Rua XV de Novembro", shortText: "R. XV de Novembro", types: ["route"] },
        { longText: "Centro", shortText: "Centro", types: ["sublocality_level_1", "sublocality", "political"] },
        { longText: "Curitiba", shortText: "Curitiba", types: ["administrative_area_level_2", "locality"] },
        { longText: "Paraná", shortText: "PR", types: ["administrative_area_level_1"] },
        { longText: "80020-310", shortText: "80020-310", types: ["postal_code"] },
        { longText: "Brasil", shortText: "BR", types: ["country"] },
      ],
    },
  }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.placeDetails({ place_id: "google:ChIJ123", session_token: "s1" });
  assertEquals(r.data.location, { lat: -25.4296, lng: -49.2716 });
  assertEquals(r.data.components.number, "100");
  assertEquals(r.data.components.street, "Rua XV de Novembro");
  assertEquals(r.data.components.district, "Centro");
  assertEquals(r.data.components.city, "Curitiba");
  assertEquals(r.data.components.state, "Paraná");
  assertEquals(r.data.components.postal_code, "80020-310");
  assertEquals(r.data.retainable, true);
  assert(calls[0].url.includes("/places/ChIJ123?"));
  assert(calls[0].url.includes("sessionToken=s1"));
});

Deno.test("geocode: ROOFTOP vira precisão exact; structured monta address_line1+city+state+postal_code", async () => {
  const { fetch, calls } = mockFetch(() => ({
    body: {
      status: "OK",
      results: [{
        formatted_address: "Av. Sete de Setembro, 2775, Curitiba - PR",
        place_id: "ChIJabc",
        geometry: { location: { lat: -25.43, lng: -49.27 }, location_type: "ROOFTOP" },
        address_components: [
          { long_name: "2775", short_name: "2775", types: ["street_number"] },
          { long_name: "Avenida Sete de Setembro", short_name: "Av. Sete de Setembro", types: ["route"] },
        ],
      }],
    },
  }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.geocode({ structured: { address_line1: "Av. Sete de Setembro 2775", city: "Curitiba", state: "PR", postal_code: "80230-010" } });
  assertEquals(r.data[0].precision, "exact");
  assertEquals(r.data[0].place_id, "google:ChIJabc");
  assertEquals(r.sku, "geocoding");
  assert(calls[0].url.includes("Av.+Sete") || calls[0].url.includes("Av.%20Sete"));
});

Deno.test("geocode: ZERO_RESULTS vira GEO_NOT_FOUND (lista vazia)", async () => {
  const { fetch } = mockFetch(() => ({ body: { status: "ZERO_RESULTS" } }));
  const p = new GoogleProvider({ key: "k", fetch });
  await assertRejects(() => p.geocode({ address: "endereço inexistente xyz" }), GeoProviderError, "não encontrado");
});

Deno.test("geocode: REQUEST_DENIED vira GEO_NOT_CONFIGURED (chave recusada)", async () => {
  const { fetch } = mockFetch(() => ({ body: { status: "REQUEST_DENIED", error_message: "API key invalid" } }));
  const p = new GoogleProvider({ key: "bad", fetch });
  await assertRejects(() => p.geocode({ address: "x" }), GeoProviderError, "recusou a chave");
});

Deno.test("geocode: OVER_QUERY_LIMIT vira GEO_RATE_LIMITED", async () => {
  const { fetch } = mockFetch(() => ({ body: { status: "OVER_QUERY_LIMIT" } }));
  const p = new GoogleProvider({ key: "k", fetch });
  await assertRejects(() => p.geocode({ address: "x" }), GeoProviderError, "cota excedida");
});

Deno.test("reverse: sem resultado devolve null (não lança)", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { status: "ZERO_RESULTS" } }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.reverse({ lat: -25.43, lng: -49.27 });
  assertEquals(r.data, null);
  assert(calls[0].url.includes("latlng=-25.43%2C-49.27"));
});

Deno.test("route: computeRoutes decodifica polyline, soma legs, marca duration_traffic_s com tráfego", async () => {
  const enc = encodePolyline([{ lat: -25.43, lng: -49.27 }, { lat: -25.44, lng: -49.26 }], 5);
  const { fetch, calls } = mockFetch(() => ({
    body: {
      routes: [{
        duration: "720s", distanceMeters: 3200,
        polyline: { encodedPolyline: enc },
        legs: [{ duration: "720s", distanceMeters: 3200 }],
      }],
    },
  }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.route({ origin: { lat: -25.43, lng: -49.27 }, destination: { lat: -25.44, lng: -49.26 } });
  assertEquals(r.data.duration_s, 720);
  assertEquals(r.data.distance_m, 3200);
  assertEquals(r.data.duration_traffic_s, 720);
  assertEquals(r.data.polyline.length, 2);
  assertEquals(r.data.legs[0], { distance_m: 3200, duration_s: 720 });
  assertEquals(calls[0].headers["X-Goog-FieldMask"]?.includes("routes.polyline.encodedPolyline"), true);
  const body = calls[0].body as { routingPreference?: string; departureTime?: string };
  assertEquals(body.routingPreference, "TRAFFIC_AWARE");
  // Sem departureTime: a API rejeita "agora" em produção ("Timestamp must be set to
  // a future time") — deixa o default dela decidir, não envia o campo.
  assertEquals(body.departureTime, undefined);
});

Deno.test("route: traffic=false usa TRAFFIC_UNAWARE e não marca duration_traffic_s nem departureTime", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { routes: [{ duration: "600s", distanceMeters: 3000, legs: [] }] } }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.route({ origin: { lat: 0, lng: 0 }, destination: { lat: 1, lng: 1 }, traffic: false });
  assertEquals(r.data.duration_traffic_s, undefined);
  const body = calls[0].body as { routingPreference?: string; departureTime?: string };
  assertEquals(body.routingPreference, "TRAFFIC_UNAWARE");
  assertEquals(body.departureTime, undefined);
});

Deno.test("route: sem rota devolve GEO_NO_ROUTE", async () => {
  const { fetch } = mockFetch(() => ({ body: { routes: [] } }));
  const p = new GoogleProvider({ key: "k", fetch });
  await assertRejects(() => p.route({ origin: { lat: 0, lng: 0 }, destination: { lat: 1, lng: 1 } }), GeoProviderError, "Sem rota");
});

Deno.test("matrix: elementos = origens×destinos; reshape do array plano pra grid por originIndex/destinationIndex", async () => {
  const { fetch } = mockFetch(() => ({
    body: [
      { originIndex: 0, destinationIndex: 0, duration: "300s", distanceMeters: 1000, condition: "ROUTE_EXISTS" },
      { originIndex: 0, destinationIndex: 1, duration: "600s", distanceMeters: 2000, condition: "ROUTE_EXISTS" },
      { originIndex: 1, destinationIndex: 0, condition: "ROUTE_NOT_FOUND" },
    ],
  }));
  const p = new GoogleProvider({ key: "k", fetch });
  const r = await p.matrix({ origins: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }], destinations: [{ lat: 2, lng: 2 }, { lat: 3, lng: 3 }] });
  assertEquals(r.data.durations_s, [[300, 600], [null, null]]);
  assertEquals(r.data.distances_m, [[1000, 2000], [null, null]]);
  assertEquals(r.units, 4);
  assertEquals(r.sku, "routes_matrix");
});

Deno.test("matrix: fora de 1..625 elementos é recusado antes de chamar o provedor", async () => {
  const { fetch } = mockFetch(() => ({ body: [] }));
  const p = new GoogleProvider({ key: "k", fetch });
  await assertRejects(() => p.matrix({ origins: [], destinations: [] }), GeoProviderError, "Matrix");
});

Deno.test("static: monta markers e path (polyline5); exige ao menos center/markers/path", async () => {
  // staticMap espera bytes de imagem (arrayBuffer), não JSON — mocka a resposta crua.
  const calls: Call[] = [];
  const fetchImg = ((input: string | URL | Request) => {
    calls.push({ url: String(input), method: "GET", headers: {}, body: undefined });
    return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  }) as typeof fetch;
  const p = new GoogleProvider({ key: "k", fetch: fetchImg });
  const r = await p.staticMap({ markers: [{ lat: -25.43, lng: -49.27, color: "f44336", label: "A" }], path: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] });
  assertEquals(r.data.provider, "google");
  assert(calls[0].url.includes("markers=color%3A0xf44336%7Clabel%3AA%7C-25.43%2C-49.27"));
  assert(calls[0].url.includes("path=color%3A0x3b82f6cc"));
  await assertRejects(() => p.staticMap({}), GeoProviderError, "requer");
});

Deno.test("supports: não inclui snap/isochrone/optimization/tilequery/tiles (sem equivalente no Google)", () => {
  const p: GeoProvider = new GoogleProvider({ key: "k" });
  assertEquals(p.supports.has("autocomplete" as never), true);
  assertEquals(p.supports.has("route" as never), true);
  assertEquals(p.supports.has("snap" as never), false);
  assertEquals(p.supports.has("isochrone" as never), false);
  assertEquals(p.snap, undefined);
  assertEquals(p.raw, undefined);
  assertEquals(p.geocodeBatch, undefined);
});
