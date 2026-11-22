// deno test --allow-net --allow-env supabase/functions/geo-gateway/mapbox.test.ts
import { assertEquals, assertRejects, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { MapboxProvider } from "./providers/mapbox.ts";
import { GeoProviderError } from "./providers/types.ts";
import { encodePolyline } from "./polyline.ts";

type Call = { url: string };
function mockFetch(handler: (url: string) => { status?: number; body?: unknown; headers?: Record<string, string> }, calls: Call[] = []) {
  const fn = ((input: string | URL | Request) => {
    const url = String(input);
    calls.push({ url });
    const r = handler(url);
    const payload: BodyInit = r.body instanceof Uint8Array ? new Blob([r.body as BlobPart]) : JSON.stringify(r.body ?? {});
    return Promise.resolve(new Response(payload, { status: r.status ?? 200, headers: r.headers }));
  }) as typeof fetch;
  return { fetch: fn, calls };
}

const SUGGEST = {
  suggestions: [{ name: "Rua XV de Novembro", mapbox_id: "dXJuOm1ieGFkcjoxMjM", feature_type: "street", full_address: "Rua XV de Novembro, Centro, Curitiba, PR, Brasil" }],
};
const RETRIEVE = {
  features: [{
    geometry: { coordinates: [-49.2716, -25.4296] },
    properties: {
      mapbox_id: "dXJuOm1ieGFkcjoxMjM", full_address: "Rua XV de Novembro 100, Centro, Curitiba", feature_type: "address",
      coordinates: { latitude: -25.4296, longitude: -49.2716, accuracy: "rooftop", routable_points: [{ name: "default", latitude: -25.4297, longitude: -49.2717 }] },
      context: { address: { address_number: "100", street_name: "Rua XV de Novembro" }, place: { name: "Curitiba" }, region: { name: "Paraná" }, postcode: { name: "80020-310" }, country: { name: "Brasil" } },
    },
  }],
};

Deno.test("autocomplete: Search Box suggest normalizado, sessão exigida, units=0 (sessão conta no gateway)", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: SUGGEST }));
  const p = new MapboxProvider({ token: "pk.test", fetch });
  const r = await p.autocomplete({ input: "Rua XV", session_token: "11111111-1111-4111-8111-111111111111", bias: { lat: -25.43, lng: -49.27 } });
  assertEquals(r.data[0].id, "mapbox:dXJuOm1ieGFkcjoxMjM");
  assertEquals(r.data[0].main_text, "Rua XV de Novembro");
  assertEquals(r.sku, "searchbox_session");
  assertEquals(r.units, 0);
  assert(calls[0].url.includes("/search/searchbox/v1/suggest?"));
  assert(calls[0].url.includes("country=br") && calls[0].url.includes("language=pt") && calls[0].url.includes("proximity=-49.27%2C-25.43"));
  assert(calls[0].url.includes("access_token=pk.test"));
  await assertRejects(() => p.autocomplete({ input: "x" }), GeoProviderError, "session_token");
});

Deno.test("placeDetails: retrieve → endereço com componentes, precisão exact, routable_point, não retível", async () => {
  const { fetch } = mockFetch(() => ({ body: RETRIEVE }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.placeDetails({ place_id: "mapbox:dXJuOm1ieGFkcjoxMjM", session_token: "22222222-2222-4222-8222-222222222222" });
  assertEquals(r.data.location, { lat: -25.4296, lng: -49.2716 });
  assertEquals(r.data.routable_point, { lat: -25.4297, lng: -49.2717 });
  assertEquals(r.data.precision, "exact");
  assertEquals(r.data.components.number, "100");
  assertEquals(r.data.components.city, "Curitiba");
  assertEquals(r.data.components.postal_code, "80020-310");
  assertEquals(r.data.retainable, false);
});

Deno.test("geocode: temporário vs permanent decide sku e retainable; structured input vira parâmetros v6", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: RETRIEVE }));
  const p = new MapboxProvider({ token: "t", fetch });
  const a = await p.geocode({ address: "Rua XV de Novembro 100, Curitiba" });
  assertEquals(a.sku, "geocoding_temporary"); assertEquals(a.data[0].retainable, false);
  assert(calls[0].url.includes("permanent=false") && calls[0].url.includes("autocomplete=false"));
  const b = await p.geocode({ structured: { address_line1: "Rua XV de Novembro 100", postal_code: "80020-310", city: "Curitiba", state: "PR" }, persist: true });
  assertEquals(b.sku, "geocoding_permanent"); assertEquals(b.data[0].retainable, true);
  assert(calls[1].url.includes("permanent=true") && calls[1].url.includes("address_line1=") && calls[1].url.includes("postcode=80020-310") && calls[1].url.includes("place=Curitiba"));
  const { fetch: f2 } = mockFetch(() => ({ body: { features: [] } }));
  await assertRejects(() => new MapboxProvider({ token: "t", fetch: f2 }).geocode({ address: "zzz" }), GeoProviderError, "não encontrado");
});

Deno.test("route: Directions driving-traffic, polyline6 decodificada, legs", async () => {
  const pts = [{ lat: -25.4296, lng: -49.2716 }, { lat: -25.4350, lng: -49.2600 }, { lat: -25.4426, lng: -49.2385 }];
  const geometry = encodePolyline(pts, 6);
  const { fetch, calls } = mockFetch(() => ({ body: { code: "Ok", routes: [{ geometry, distance: 3625.4, duration: 540.2, legs: [{ distance: 3625.4, duration: 540.2 }] }] } }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.route({ origin: pts[0], destination: pts[2] });
  assert(calls[0].url.includes("/directions/v5/mapbox/driving-traffic/-49.2716,-25.4296;-49.2385,-25.4426?"));
  assert(calls[0].url.includes("geometries=polyline6"));
  assertEquals(r.data.polyline.length, 3);
  assertEquals(Math.round(r.data.polyline[1].lat * 1e6), Math.round(-25.4350 * 1e6));
  assertEquals(r.data.distance_m, 3625); assertEquals(r.data.duration_s, 540); assertEquals(r.data.legs.length, 1);
  assertEquals(r.sku, "directions"); assertEquals(r.units, 1);
  const { fetch: f2 } = mockFetch(() => ({ body: { code: "NoRoute", message: "No route found" } }));
  await assertRejects(() => new MapboxProvider({ token: "t", fetch: f2 }).route({ origin: pts[0], destination: pts[2] }), GeoProviderError, "No route");
});

Deno.test("route/matrix: perfil pedido pela tela chega ao Mapbox (walking/cycling) e inválido volta ao padrão", async () => {
  const o = { lat: -25.4296, lng: -49.2716 }, d = { lat: -25.4426, lng: -49.2385 };
  const { fetch, calls } = mockFetch(() => ({ body: { code: "Ok", routes: [{ geometry: encodePolyline([o, d], 6), distance: 100, duration: 60, legs: [] }], durations: [[60]], distances: [[100]] } }));
  const p = new MapboxProvider({ token: "t", fetch });

  await p.route({ origin: o, destination: d, profile: "walking" });
  assert(calls[0].url.includes("/directions/v5/mapbox/walking/"), calls[0].url);
  await p.route({ origin: o, destination: d, profile: "cycling" });
  assert(calls[1].url.includes("/directions/v5/mapbox/cycling/"), calls[1].url);
  // perfil desconhecido não vaza para a URL: cai em driving-traffic
  await p.route({ origin: o, destination: d, profile: "hoverboard" });
  assert(calls[2].url.includes("/directions/v5/mapbox/driving-traffic/"), calls[2].url);

  await p.matrix({ origins: [o], destinations: [d], profile: "walking" });
  assert(calls[3].url.includes("/directions-matrix/v1/mapbox/walking/"), calls[3].url);
  await p.matrix({ origins: [o], destinations: [d], profile: "cycling" });
  assert(calls[4].url.includes("/directions-matrix/v1/mapbox/cycling/"), calls[4].url);
});

Deno.test("snap: geometria e métricas do Map Matching são expostas para a tela de conferência", async () => {
  const { fetch, calls } = mockFetch(() => ({
    body: {
      code: "Ok",
      matchings: [{ confidence: 0.87, distance: 842.6, duration: 95.4, geometry: { type: "LineString", coordinates: [[-49.271, -25.429], [-49.270, -25.430]] } }],
      tracepoints: [{ location: [-49.271, -25.429] }, { location: [-49.270, -25.430] }],
    },
  }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.snap({ points: [{ lat: -25.4296, lng: -49.2716 }, { lat: -25.43, lng: -49.27 }] });
  assert(calls[0].url.includes("overview=full"), calls[0].url);
  assertEquals(r.data.distance_m, 843);
  assertEquals(r.data.duration_s, 95);
  assertEquals(r.data.polyline, [{ lat: -25.429, lng: -49.271 }, { lat: -25.43, lng: -49.27 }]);
});

Deno.test("matrix: elementos = origens×destinos; cai para driving acima de 10 coords ou sem bucket", async () => {
  const o = { lat: -25.43, lng: -49.27 }, d = { lat: -25.44, lng: -49.24 };
  const { fetch, calls } = mockFetch(() => ({ body: { code: "Ok", durations: [[541.3]], distances: [[3625.9]] } }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.matrix({ origins: [o], destinations: [d] });
  assert(calls[0].url.includes("/directions-matrix/v1/mapbox/driving-traffic/") && calls[0].url.includes("sources=0&destinations=1"));
  assertEquals(r.data.durations_s, [[541]]); assertEquals(r.data.distances_m, [[3626]]);
  assertEquals(r.units, 1); assertEquals(r.downgraded, undefined);
  const many = Array.from({ length: 11 }, (_, i) => ({ lat: -25.4 - i / 1000, lng: -49.2 }));
  const r2 = await p.matrix({ origins: many.slice(0, 1), destinations: many.slice(1) });
  assert(calls[1].url.includes("/mapbox/driving/")); assertEquals(r2.downgraded, "driving-traffic→driving"); assertEquals(r2.units, 10);
  const p3 = new MapboxProvider({ token: "t", fetch, rateGuard: (api) => api !== "matrix:driving-traffic" });
  const r3 = await p3.matrix({ origins: [o], destinations: [d] });
  assertEquals(r3.data.profile, "driving"); assertEquals(r3.downgraded, "driving-traffic→driving");
});

Deno.test("snap: Map Matching devolve pontos encaixados e mantém o bruto onde tracepoint é null", async () => {
  const { fetch } = mockFetch(() => ({ body: { code: "Ok", matchings: [{ confidence: 0.9 }], tracepoints: [{ location: [-49.2710, -25.4290] }, null] } }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.snap({ points: [{ lat: -25.4296, lng: -49.2716 }, { lat: -25.4300, lng: -49.2700 }] });
  assertEquals(r.data.points[0], { lat: -25.4290, lng: -49.2710 });
  assertEquals(r.data.points[1], { lat: -25.4300, lng: -49.2700 });
  assertEquals(r.data.confidence, 0.9); assertEquals(r.sku, "map_matching");
});

Deno.test("429: lê X-Rate-Limit-Reset e vira GEO_RATE_LIMITED com retryAfter; token recusado vira GEO_NOT_CONFIGURED", async () => {
  const reset = Math.floor(Date.now() / 1000) + 30;
  const { fetch } = mockFetch(() => ({ status: 429, body: { message: "Too Many Requests" }, headers: { "X-Rate-Limit-Reset": String(reset) } }));
  const p = new MapboxProvider({ token: "t", fetch });
  const e = await assertRejects(() => p.reverse({ lat: -25.4, lng: -49.2 }), GeoProviderError);
  assertEquals(e.code, "GEO_RATE_LIMITED"); assert((e.retryAfterMs ?? 0) > 20_000 && (e.retryAfterMs ?? 0) <= 30_000);
  const { fetch: f2 } = mockFetch(() => ({ status: 401, body: { message: "Not Authorized - Invalid Token" } }));
  const e2 = await assertRejects(() => new MapboxProvider({ token: "bad", fetch: f2 }).reverse({ lat: -25.4, lng: -49.2 }), GeoProviderError);
  assertEquals(e2.code, "GEO_NOT_CONFIGURED");
});

Deno.test("static: monta overlay com path simplificado + pinos, auto bounds, devolve PNG base64", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const { fetch, calls } = mockFetch(() => ({ body: png }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.staticMap({ path: [{ lat: -25.4296, lng: -49.2716 }, { lat: -25.4426, lng: -49.2385 }], markers: [{ lat: -25.4296, lng: -49.2716, label: "A", color: "#285A98" }] });
  assert(calls[0].url.includes("/static/path-5+3b82f6-0.8(") && calls[0].url.includes("pin-s-a+285A98(-49.2716,-25.4296)/auto/600x300@2x"));
  assert(r.data.image.startsWith("data:image/png;base64,iVBORw"));
  assertEquals(r.sku, "static_image");
});

Deno.test("geocode-batch (etapa 25): POST com array, ordem preservada, item vazio vira not_found sem derrubar o lote", async () => {
  const { fetch, calls } = mockFetch(() => ({
    body: {
      batch: [
        { type: "FeatureCollection", features: [RETRIEVE.features[0]] },
        { type: "FeatureCollection", features: [] },
        { type: "FeatureCollection", features: [RETRIEVE.features[0], RETRIEVE.features[0]] },
      ],
    },
  }));
  const p = new MapboxProvider({ token: "sk.test", fetch });
  const r = await p.geocodeBatch(
    [{ address: "Rua XV de Novembro 100, Curitiba" }, { address: "zzzqqq nao existe" }, { structured: { address_line1: "Rua XV 100", city: "Curitiba" } }],
    true,
  );
  assertEquals(calls[0].url.includes("/search/geocode/v6/batch?permanent=true"), true);
  // ordem é a ligação entre consulta e resultado: index 0,1,2 batem com a entrada
  assertEquals(r.data.map((d) => d.index), [0, 1, 2]);
  assertEquals(r.data[0].addresses[0].location, { lat: -25.4296, lng: -49.2716 });
  assertEquals(r.data[1].addresses.length, 0);
  assertEquals(r.data[1].not_found, true);
  assertEquals(r.data[2].addresses.length, 2);
  // cobra por consulta, não por requisição HTTP
  assertEquals(r.sku, "geocoding_permanent");
  assertEquals(r.units, 3);
});

Deno.test("geocode-batch: item sem address nem structured é recusado antes de chamar o provedor", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { batch: [] } }));
  const p = new MapboxProvider({ token: "sk.test", fetch });
  const e = await assertRejects(() => p.geocodeBatch([{ limit: 3 }], true), GeoProviderError);
  assertEquals(e.code, "GEO_INVALID_INPUT");
  assertEquals(calls.length, 0);
});
Deno.test("geocode-batch: endereço livre vai em `q`, não em `address_line1` (cidade embutida é respeitada)", async () => {
  // Medido em produção: com `address_line1` o Mapbox descarta a cidade da string e
  // "Rua XV de Novembro 1000, Curitiba" volta como Joinville/SC. Só `q` faz busca livre.
  let sent: Array<Record<string, unknown>> = [];
  const fetchFn: typeof fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body ?? "[]"));
    return Promise.resolve(new Response(JSON.stringify({ batch: [{ features: [] }] }), { status: 200 }));
  });
  const p = new MapboxProvider({ token: "sk.test", fetch: fetchFn });
  await p.geocodeBatch([{ address: "Rua XV de Novembro 1000, Curitiba" }, { structured: { address_line1: "Rua XV 100", city: "Curitiba" } }], true);
  assertEquals(sent[0].q, "Rua XV de Novembro 1000, Curitiba");
  assertEquals(sent[0].address_line1, undefined);
  // structured continua usando os campos estruturados
  assertEquals(sent[1].address_line1, "Rua XV 100");
  assertEquals(sent[1].place, "Curitiba");
  assertEquals(sent[1].q, undefined);
});
Deno.test("etapa 22: mode=geocoding troca o Search Box pelo v6 forward com autocomplete=true", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: {
    features: [{
      id: "feat.1",
      properties: { mapbox_id: "dXJuOm1ieGFkcjoxMjM", name: "Rua XV de Novembro", full_address: "Rua XV de Novembro, Curitiba, PR", feature_type: "street" },
    }],
  } }));
  const p = new MapboxProvider({ token: "pk.test", fetch });
  const r = await p.autocomplete({ input: "Rua XV", session_token: "11111111-1111-4111-8111-111111111111", mode: "geocoding" });
  assert(calls[0].url.includes("/search/geocode/v6/forward"), "deve chamar o v6 forward");
  assert(calls[0].url.includes("autocomplete=true"), "deve mandar autocomplete=true");
  assert(!calls[0].url.includes("searchbox"), "não deve chamar o Search Box");
  assertEquals(r.data[0].id, "mapbox:dXJuOm1ieGFkcjoxMjM");
  assertEquals(r.data[0].provider, "mapbox");
  // cobra por requisição (não por sessão), ao contrário do Search Box
  assertEquals(r.sku, "geocoding_temporary");
  assertEquals(r.units, 1);
});

Deno.test("etapa 22: mode=geocoding sem session_token não falha (Search Box exige, v6 não)", async () => {
  const { fetch } = mockFetch(() => ({ body: { features: [] } }));
  const p = new MapboxProvider({ token: "pk.test", fetch });
  const r = await p.autocomplete({ input: "Rua XV", mode: "geocoding" });
  assertEquals(r.data.length, 0);
  assertEquals(r.sku, "geocoding_temporary");
});

Deno.test("etapa 22: place-details no modo geocoding resolve por address no v6", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: RETRIEVE }));
  const p = new MapboxProvider({ token: "pk.test", fetch });
  const r = await p.placeDetails({ place_id: "mapbox:abc", mode: "geocoding", address: "Rua XV de Novembro 100, Curitiba" });
  assert(calls[0].url.includes("/search/geocode/v6/forward"), "detalhe vem do forward");
  assert(!calls[0].url.includes("retrieve"), "não tenta retrieve com id do v6");
  assertEquals(r.data.provider, "mapbox");
  assertEquals(r.sku, "geocoding_temporary");
});

Deno.test("reverse: lat/lng acham endereço (caso de sucesso, não só os de erro)", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: RETRIEVE }));
  const p = new MapboxProvider({ token: "t", fetch });
  const r = await p.reverse({ lat: -25.4296, lng: -49.2716 });
  assert(calls[0].url.includes("/search/geocode/v6/reverse"));
  assertEquals(r.data?.formatted, "Rua XV de Novembro 100, Centro, Curitiba");
  assertEquals(r.data?.location, { lat: -25.4296, lng: -49.2716 });
  assertEquals(r.sku, "geocoding_temporary");
});

Deno.test("etapa 32: route() com 414 (URL acima de 8 KB) refaz como POST — coordenadas no corpo, não na URL", async () => {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const fetchFn: typeof fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method, body: init?.body ? String(init.body) : undefined });
    if (!init?.method) return Promise.resolve(new Response("", { status: 414 }));
    return Promise.resolve(new Response(JSON.stringify({
      routes: [{ geometry: encodePolyline([{ lat: -25.43, lng: -49.27 }, { lat: -25.44, lng: -49.23 }], 6), distance: 1000, duration: 120, legs: [{ distance: 1000, duration: 120 }] }],
    }), { status: 200 }));
  });
  const p = new MapboxProvider({ token: "t", fetch: fetchFn });
  const origin = { lat: -25.43, lng: -49.27 };
  const destination = { lat: -25.44, lng: -49.23 };
  const r = await p.route({ origin, destination });
  // exatamente 1 tentativa GET + 1 retry POST — nunca mais que isso
  assertEquals(calls.length, 2);
  assertEquals(calls[0].method, undefined);
  assert(calls[0].url.includes(`/directions/v5/mapbox/driving-traffic/-49.27,-25.43;-49.23,-25.44`), "GET leva as coordenadas no caminho");
  assertEquals(calls[1].method, "POST");
  assert(!calls[1].url.includes("-49.27,-25.43;-49.23,-25.44"), "POST não repete as coordenadas na URL");
  assertEquals(calls[1].body, "coordinates=-49.27%2C-25.43%3B-49.23%2C-25.44");
  assertEquals(r.data.distance_m, 1000);
});

Deno.test("etapa 32: snap() com 414 refaz como POST — mesmo contrato do Directions", async () => {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const fetchFn: typeof fetch = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method, body: init?.body ? String(init.body) : undefined });
    if (!init?.method) return Promise.resolve(new Response("", { status: 414 }));
    return Promise.resolve(new Response(JSON.stringify({ matchings: [{ confidence: 0.8 }], tracepoints: [null, null] }), { status: 200 }));
  });
  const p = new MapboxProvider({ token: "t", fetch: fetchFn });
  const points = [{ lat: -25.43, lng: -49.27 }, { lat: -25.44, lng: -49.23 }];
  await p.snap({ points });
  assertEquals(calls.length, 2);
  assert(calls[0].url.includes("/matching/v5/mapbox/driving/-49.27,-25.43;-49.23,-25.44"));
  assertEquals(calls[1].method, "POST");
  assert(!calls[1].url.includes("-49.27,-25.43;-49.23,-25.44"), "POST não repete as coordenadas na URL");
  assertEquals(calls[1].body, "coordinates=-49.27%2C-25.43%3B-49.23%2C-25.44");
});

Deno.test("etapa 32: 414 persiste mesmo via POST → GEO_INVALID_INPUT (um retry só, não fica tentando pra sempre)", async () => {
  const calls: { method?: string }[] = [];
  const fetchFn: typeof fetch = ((_input: string | URL | Request, init?: RequestInit) => {
    calls.push({ method: init?.method });
    return Promise.resolve(new Response("", { status: 414 }));
  });
  const p = new MapboxProvider({ token: "t", fetch: fetchFn });
  const e = await assertRejects(
    () => p.route({ origin: { lat: -25.43, lng: -49.27 }, destination: { lat: -25.44, lng: -49.23 } }),
    GeoProviderError,
  );
  assertEquals(e.code, "GEO_INVALID_INPUT");
  assertEquals(calls.length, 2, "GET + 1 retry POST, nunca um segundo retry");
});

Deno.test("reverse: 414 não tenta POST (sem variante POST documentada p/ reverse geocode de 1 ponto)", async () => {
  const { fetch, calls } = mockFetch(() => ({ status: 414 }));
  const p = new MapboxProvider({ token: "t", fetch });
  const e = await assertRejects(() => p.reverse({ lat: -25.4, lng: -49.2 }), GeoProviderError);
  assertEquals(e.code, "GEO_INVALID_INPUT");
  assertEquals(calls.length, 1, "não existe retry para reverse — a URL de 1 ponto nunca passa de 8 KB de verdade");
});

Deno.test("raw: isochrone/optimization/tilequery (pass-through sem equivalente no Google) chegam ao Mapbox", async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { ok: true } }));
  const p = new MapboxProvider({ token: "t", fetch });

  const iso = await p.raw("isochrone", { lng: -49.27, lat: -25.43, profile: "driving" });
  assert(calls[0].url.includes("/isochrone/v1/mapbox/driving/-49.27,-25.43"));
  assertEquals(iso.sku, "isochrone");

  const opt = await p.raw("optimization", { coordinates: [[-49.27, -25.43], [-49.23, -25.44]], profile: "driving" });
  assert(calls[1].url.includes("/optimized-trips/v1/mapbox/driving/-49.27,-25.43;-49.23,-25.44"));
  assertEquals(opt.sku, "optimization");

  const tile = await p.raw("tilequery", { lng: -49.27, lat: -25.43, tileset: "mapbox.mapbox-streets-v8" });
  assert(calls[2].url.includes("/v4/mapbox.mapbox-streets-v8/tilequery/-49.27,-25.43.json"));
  assertEquals(tile.sku, "tilequery");
});
