// Provedor Mapbox — porta do mapbox-proxy para a interface GeoProvider.
// Docs: Search Box (sessões), Geocoding v6 (temporary/permanent), Directions v5, Matrix v1, Map Matching v5,
// Static Images. Token: MAPBOX_SERVER_TOKEN (sk.) com fallback para MAPBOX_ACCESS_TOKEN (pk.).
import { decodePolyline, encodePolyline, simplify } from "../polyline.ts";
import type {
  AutocompleteReq, GeoAddress, GeoAddressComponents, GeoBatchItem, GeoBatchQuery, GeoMatrix, GeoPoint, GeoPrecision, GeoProvider,
  GeoRoute, GeoSnapResult, GeoStaticImage, GeoSuggestion, GeocodeReq, MatrixReq, PlaceDetailsReq,
  ProviderResult, ReverseReq, RouteReq, SnapReq, StaticReq,
} from "./types.ts";
import { GeoProviderError } from "./types.ts";
import { precisionFromAccuracy } from "../../_shared/geo-precision.ts";

const BASE = "https://api.mapbox.com";

// Limites por token (docs.mapbox.com/api/overview): usados pelo rate guard local.
export const MAPBOX_RATE_LIMITS: Record<string, number> = {
  "directions": 300,
  "matrix:driving-traffic": 30,
  "matrix:driving": 60,
  "matching": 300,
  "geocoding": 1000,
  "searchbox": 600, // 10 req/s
  "static": 1250,
  "isochrone": 300,
  "optimization": 300,
  "tilequery": 600,
};

type Fetch = typeof fetch;

export interface MapboxOptions {
  token: string;
  fetch?: Fetch;
  /** devolve false quando o bucket (provider:api) está vazio neste minuto; `consume` = slots consumidos (lotes) */
  rateGuard?: (api: string, consume?: number) => boolean;
}

const ROUTE_PROFILES = new Set(["driving-traffic", "driving", "walking", "cycling"]);
// Matrix não tem todos os perfis do Directions: fora desta lista cai no default.
const MATRIX_PROFILES = new Set(["driving-traffic", "driving", "walking", "cycling"]);



function fmt(p: GeoPoint) {
  return `${p.lng},${p.lat}`;
}

function toComponents(ctx: Record<string, { name?: string; address_number?: string; street_name?: string } | undefined> | undefined): GeoAddressComponents {
  if (!ctx) return {};
  return {
    street: ctx.street?.name ?? ctx.address?.street_name,
    number: ctx.address?.address_number,
    district: ctx.neighborhood?.name ?? ctx.locality?.name,
    city: ctx.place?.name,
    state: ctx.region?.name,
    postal_code: ctx.postcode?.name,
    country: ctx.country?.name,
  };
}

export class MapboxProvider implements GeoProvider {
  readonly name = "mapbox" as const;
  readonly supports = new Set<
    "tiles" | "autocomplete" | "geocode" | "reverse" | "route" | "matrix" | "static" | "snap" | "isochrone" | "optimization" | "tilequery"
  >(["tiles", "autocomplete", "geocode", "reverse", "route", "matrix", "static", "snap", "isochrone", "optimization", "tilequery"]);

  private token: string;
  private fetchFn: Fetch;
  private rateGuard: (api: string, consume?: number) => boolean;

  constructor(opts: MapboxOptions) {
    this.token = opts.token;
    this.fetchFn = opts.fetch ?? fetch;
    this.rateGuard = opts.rateGuard ?? (() => true);
  }

  // ── HTTP ────────────────────────────────────────────────────────────────
  /**
   * HTTP com o token do provedor. `consume` diz quantos slots do rate limit esta chamada
   * gasta — o lote de geocoding consome 1 por consulta, não 1 pela requisição HTTP.
   */
  private async call<T = Record<string, unknown>>(api: string, url: string, init?: RequestInit, consume = 1): Promise<T> {
    if (!this.rateGuard(api, consume)) {
      throw new GeoProviderError("GEO_RATE_LIMITED", `Limite local da API Mapbox ${api} atingido neste minuto`, 429, 60_000);
    }
    const sep = url.includes("?") ? "&" : "?";
    const res = await this.fetchFn(`${url}${sep}access_token=${encodeURIComponent(this.token)}`, init);
    if (res.status === 429) {
      const reset = Number(res.headers.get("X-Rate-Limit-Reset") ?? 0) * 1000;
      throw new GeoProviderError("GEO_RATE_LIMITED", "Mapbox 429", 429, reset ? Math.max(0, reset - Date.now()) : 60_000);
    }
    if (res.status === 414) {
      throw new GeoProviderError("GEO_INVALID_INPUT", "URL acima de 8 KB — reduza as coordenadas", 414);
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
    if (!res.ok) {
      const msg = String(json.message ?? json.error ?? res.statusText);
      if (res.status === 401 || res.status === 403) throw new GeoProviderError("GEO_NOT_CONFIGURED", `Token Mapbox recusado: ${msg}`, 502);
      if (res.status === 422 || res.status === 400) throw new GeoProviderError("GEO_INVALID_INPUT", msg, 422);
      throw new GeoProviderError("GEO_PROVIDER_ERROR", `Mapbox ${res.status}: ${msg}`, 502);
    }
    const code = json.code as string | undefined;
    if (code && code !== "Ok") {
      if (code === "NoRoute" || code === "NoSegment" || code === "NoMatch") throw new GeoProviderError("GEO_NO_ROUTE", String(json.message ?? code), 404);
      if (code === "InvalidInput" || code === "ProfileNotFound") throw new GeoProviderError("GEO_INVALID_INPUT", String(json.message ?? code), 422);
    }
    return json as T;
  }

  // ── Search Box: suggest (autocomplete) ──────────────────────────────────
  async autocomplete(req: AutocompleteReq): Promise<ProviderResult<GeoSuggestion[]>> {
    // Etapa 22: `geo_settings.autocomplete.config.mode='geocoding'` troca o Search Box pelo
    // Geocoding v6 `autocomplete=true` — usado quando a cobertura do Search Box reprova na
    // medição (script `scripts/geo/searchbox-coverage.ts`). Default = Search Box.
    if (req.mode === "geocoding") return this.autocompleteGeocoding(req);
    if (!req.session_token) throw new GeoProviderError("GEO_INVALID_INPUT", "session_token é obrigatório no Search Box", 422);
    const p = new URLSearchParams({
      q: req.input,
      session_token: req.session_token,
      language: req.language ?? "pt",
      country: req.country ?? "br",
      limit: String(Math.min(req.limit ?? 5, 10)),
      types: "address,street,place,locality,neighborhood,poi",
    });
    if (req.bias) p.set("proximity", `${req.bias.lng},${req.bias.lat}`);
    const json = await this.call<{ suggestions?: Array<Record<string, unknown>> }>("searchbox", `${BASE}/search/searchbox/v1/suggest?${p}`);
    const data: GeoSuggestion[] = (json.suggestions ?? []).map((s) => ({
      id: `mapbox:${s.mapbox_id}`,
      main_text: String(s.name ?? ""),
      secondary_text: String(s.full_address ?? s.place_formatted ?? ""),
      type: String(s.feature_type ?? "unknown"),
      provider: "mapbox",
    }));
    // Cobrança por sessão: a medição conta 1 por session_token (index.ts registra a sessão); aqui units=0.
    return { data, sku: "searchbox_session", units: 0 };
  }

  /**
   * Etapa 22 — respaldo do autocomplete: Geocoding v6 `forward` com `autocomplete=true`.
   * Cobra `geocoding_temporary` por requisição (não por sessão), então `units=1`.
   * O `id` continua `mapbox:<id>` para o `place-details` resolver pelo mesmo caminho.
   */
  private async autocompleteGeocoding(req: AutocompleteReq): Promise<ProviderResult<GeoSuggestion[]>> {
    const p = new URLSearchParams({
      q: req.input,
      autocomplete: "true",
      language: req.language ?? "pt",
      country: req.country ?? "br",
      limit: String(Math.min(req.limit ?? 5, 10)),
      types: "address,street,place",
    });
    if (req.bias) p.set("proximity", `${req.bias.lng},${req.bias.lat}`);
    const json = await this.call<{ features?: Array<Record<string, unknown>> }>("geocoding", `${BASE}/search/geocode/v6/forward?${p}`);
    const data: GeoSuggestion[] = (json.features ?? []).map((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      return {
        id: `mapbox:${props.mapbox_id ?? f.id ?? ""}`,
        main_text: String(props.name ?? props.name_preferred ?? ""),
        secondary_text: String(props.full_address ?? props.place_formatted ?? ""),
        type: String(props.feature_type ?? "unknown"),
        provider: "mapbox" as const,
      };
    });
    return { data, sku: "geocoding_temporary", units: 1 };
  }

  // ── Search Box: retrieve ────────────────────────────────────────────────
  async placeDetails(req: PlaceDetailsReq): Promise<ProviderResult<GeoAddress>> {
    const id = req.place_id.replace(/^mapbox:/, "");
    // Etapa 22: id vindo do Geocoding v6 (modo `geocoding`) não existe no Search Box —
    // resolve pelo `forward` com `q=<id>`? Não: o v6 não tem retrieve avulso por id, então
    // o detalhe vem do próprio forward quando o chamador manda o endereço formatado.
    if (req.mode === "geocoding" && req.address) {
      const p = new URLSearchParams({
        q: req.address, language: req.language ?? "pt", country: req.country ?? "br", limit: "1",
      });
      const json = await this.call<{ features?: Array<Record<string, unknown>> }>("geocoding", `${BASE}/search/geocode/v6/forward?${p}`);
      const f = json.features?.[0];
      if (!f) throw new GeoProviderError("GEO_NOT_FOUND", "Lugar não encontrado", 404);
      return { data: this.featureToAddress(f, false), sku: "geocoding_temporary", units: 1 };
    }
    if (!req.session_token) throw new GeoProviderError("GEO_INVALID_INPUT", "session_token é obrigatório no retrieve", 422);
    const p = new URLSearchParams({ session_token: req.session_token });
    const json = await this.call<{ features?: Array<Record<string, unknown>> }>("searchbox", `${BASE}/search/searchbox/v1/retrieve/${encodeURIComponent(id)}?${p}`);
    const f = json.features?.[0];
    if (!f) throw new GeoProviderError("GEO_NOT_FOUND", "Lugar não encontrado", 404);
    return { data: this.featureToAddress(f, false), sku: "searchbox_session", units: 0 };
  }

  // ── Geocoding v6 batch (etapa 25) ───────────────────────────────────────
  /**
   * `POST /search/geocode/v6/batch` — até 50 consultas por chamada com `permanent=true`.
   * O Mapbox devolve um array `batch[]` na mesma ordem das consultas, então o índice é a
   * ligação com o pedido original. Item sem resultado sai como `not_found` (não é 404 do
   * lote inteiro, como no `forward` unitário).
   */
  async geocodeBatch(reqs: GeoBatchQuery[], persist: boolean): Promise<ProviderResult<GeoBatchItem[]>> {
    const queries = reqs.map((r) => {
      const q: Record<string, unknown> = {
        language: r.language ?? "pt",
        country: r.country ?? "br",
        limit: Math.min(r.limit ?? 5, 10),
      };
      if (r.structured) {
        const s = r.structured;
        if (s.address_line1) q.address_line1 = s.address_line1;
        if (s.postal_code) q.postcode = s.postal_code;
        if (s.city) q.place = s.city;
        if (s.state) q.region = s.state;
        q.country = s.country ?? r.country ?? "br";
      } else if (r.address) {
        // `q` é o campo de busca livre do batch. Em `address_line1` o Mapbox descarta a
        // cidade embutida na string e devolve endereço de outra cidade (medido em produção:
        // "Rua XV de Novembro 1000, Curitiba" voltou Joinville/SC).
        q.q = r.address;
      } else {
        throw new GeoProviderError("GEO_INVALID_INPUT", "cada item do lote precisa de address ou structured", 422);
      }
      if (r.bias) q.proximity = [r.bias.lng, r.bias.lat];
      return q;
    });

    const json = await this.call<{ batch?: Array<{ features?: Array<Record<string, unknown>> }> }>(
      "geocoding",
      `${BASE}/search/geocode/v6/batch?permanent=${persist ? "true" : "false"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queries),
      },
      queries.length, // 1 slot de rate limit por consulta, não por requisição
    );

    const data: GeoBatchItem[] = reqs.map((_, i) => {
      const features = json.batch?.[i]?.features ?? [];
      if (features.length === 0) return { index: i, addresses: [], not_found: true };
      return { index: i, addresses: features.map((f) => this.featureToAddress(f, persist)) };
    });
    return { data, sku: persist ? "geocoding_permanent" : "geocoding_temporary", units: reqs.length };
  }

  private featureToAddress(f: Record<string, unknown>, retainable: boolean): GeoAddress {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const geom = (f.geometry ?? {}) as { coordinates?: [number, number] };
    const coords = (props.coordinates ?? {}) as { accuracy?: string; routable_points?: Array<{ latitude: number; longitude: number }>; latitude?: number; longitude?: number };
    const lng = geom.coordinates?.[0] ?? coords.longitude;
    const lat = geom.coordinates?.[1] ?? coords.latitude;
    const rp = coords.routable_points?.[0];
    const match = props.match_code as { confidence?: string } | undefined;
    return {
      formatted: String(props.full_address ?? props.place_formatted ?? props.name ?? ""),
      place_id: props.mapbox_id ? `mapbox:${props.mapbox_id}` : null,
      location: lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null,
      routable_point: rp ? { lat: rp.latitude, lng: rp.longitude } : null,
      components: toComponents(props.context as Parameters<typeof toComponents>[0]),
      precision: precisionFromAccuracy(coords.accuracy),
      match_confidence: match?.confidence,
      provider: "mapbox",
      retainable,
    };
  }

  // ── Geocoding v6 forward ────────────────────────────────────────────────
  async geocode(req: GeocodeReq): Promise<ProviderResult<GeoAddress[]>> {
    const p = new URLSearchParams({
      language: req.language ?? "pt",
      country: req.country ?? "br",
      limit: String(Math.min(req.limit ?? 5, 10)),
      autocomplete: "false",
      permanent: req.persist ? "true" : "false",
    });
    if (req.structured) {
      const s = req.structured;
      if (s.address_line1) p.set("address_line1", s.address_line1);
      if (s.postal_code) p.set("postcode", s.postal_code);
      if (s.city) p.set("place", s.city);
      if (s.state) p.set("region", s.state);
      if (s.country) p.set("country", s.country);
    } else if (req.address) {
      p.set("q", req.address);
    } else {
      throw new GeoProviderError("GEO_INVALID_INPUT", "address ou structured é obrigatório", 422);
    }
    if (req.bias) p.set("proximity", `${req.bias.lng},${req.bias.lat}`);
    const json = await this.call<{ features?: Array<Record<string, unknown>> }>("geocoding", `${BASE}/search/geocode/v6/forward?${p}`);
    const data = (json.features ?? []).map((f) => this.featureToAddress(f, !!req.persist));
    if (data.length === 0) throw new GeoProviderError("GEO_NOT_FOUND", "Endereço não encontrado", 404);
    return { data, sku: req.persist ? "geocoding_permanent" : "geocoding_temporary", units: 1 };
  }

  // ── Geocoding v6 reverse ────────────────────────────────────────────────
  async reverse(req: ReverseReq): Promise<ProviderResult<GeoAddress | null>> {
    const p = new URLSearchParams({
      longitude: String(req.lng), latitude: String(req.lat),
      language: req.language ?? "pt",
      types: "address,street,neighborhood,locality,place",
      limit: "1",
      permanent: req.persist ? "true" : "false",
    });
    const json = await this.call<{ features?: Array<Record<string, unknown>> }>("geocoding", `${BASE}/search/geocode/v6/reverse?${p}`);
    const f = json.features?.[0];
    return { data: f ? this.featureToAddress(f, !!req.persist) : null, sku: req.persist ? "geocoding_permanent" : "geocoding_temporary", units: 1 };
  }

  // ── Directions v5 ───────────────────────────────────────────────────────
  async route(req: RouteReq): Promise<ProviderResult<GeoRoute>> {
    const pts = [req.origin, ...(req.waypoints ?? []), req.destination];
    if (pts.length > 25) throw new GeoProviderError("GEO_INVALID_INPUT", "Directions aceita no máximo 25 coordenadas", 422);
    // O perfil pedido pela tela vence a heurística de tráfego: /map-tools oferece
    // walking e cycling, e antes disto qualquer perfil virava driving-traffic.
    const profile = req.profile && ROUTE_PROFILES.has(req.profile)
      ? req.profile
      : req.traffic === false ? "driving" : "driving-traffic";
    const p = new URLSearchParams({
      geometries: "polyline6", overview: "full", steps: "false",
      alternatives: req.alternatives ? "true" : "false",
      annotations: "duration,distance", language: req.language ?? "pt",
    });
    const coords = pts.map(fmt).join(";");
    const json = await this.call<{ routes?: Array<Record<string, unknown>> }>("directions", `${BASE}/directions/v5/mapbox/${profile}/${coords}?${p}`);
    const r = json.routes?.[0];
    if (!r) throw new GeoProviderError("GEO_NO_ROUTE", "Sem rota", 404);
    const legs = ((r.legs ?? []) as Array<{ distance: number; duration: number }>).map((l) => ({ distance_m: Math.round(l.distance), duration_s: Math.round(l.duration) }));
    return {
      data: {
        polyline: decodePolyline(String(r.geometry), 6),
        distance_m: Math.round(Number(r.distance)),
        duration_s: Math.round(Number(r.duration)),
        duration_traffic_s: profile === "driving-traffic" ? Math.round(Number(r.duration)) : undefined,
        legs, provider: "mapbox", profile,
      },
      sku: "directions", units: 1,
    };
  }

  // ── Matrix v1 ───────────────────────────────────────────────────────────
  async matrix(req: MatrixReq): Promise<ProviderResult<GeoMatrix>> {
    const all = [...req.origins, ...req.destinations];
    const elements = req.origins.length * req.destinations.length;
    if (elements < 1 || elements > 625) throw new GeoProviderError("GEO_INVALID_INPUT", "Matrix: entre 1 e 625 elementos", 422);
    // driving-traffic: ≤ 10 coordenadas e 30 req/min; cai para driving quando não couber ou o bucket estiver vazio
    let profile = req.profile && MATRIX_PROFILES.has(req.profile)
      ? req.profile
      : req.traffic === false ? "driving" : "driving-traffic";
    let downgraded: string | undefined;
    if (profile === "driving-traffic" && (all.length > 10 || !this.rateGuard("matrix:driving-traffic"))) {
      profile = "driving"; downgraded = "driving-traffic→driving";
    }
    if (all.length > 25) throw new GeoProviderError("GEO_INVALID_INPUT", "Matrix: no máximo 25 coordenadas", 422);
    const sources = req.origins.map((_, i) => i).join(";");
    const destinations = req.destinations.map((_, i) => req.origins.length + i).join(";");
    const p = new URLSearchParams({ sources, destinations, annotations: "duration,distance" });
    const json = await this.call<{ durations?: (number | null)[][]; distances?: (number | null)[][] }>(
      `matrix:${profile}`, `${BASE}/directions-matrix/v1/mapbox/${profile}/${all.map(fmt).join(";")}?${p}`);
    return {
      data: {
        durations_s: (json.durations ?? []).map((row) => row.map((v) => v == null ? null : Math.round(v))),
        distances_m: (json.distances ?? []).map((row) => row.map((v) => v == null ? null : Math.round(v))),
        provider: "mapbox", profile,
      },
      sku: "matrix", units: elements, downgraded,
    };
  }

  // ── Map Matching v5 (snap) ──────────────────────────────────────────────
  async snap(req: SnapReq): Promise<ProviderResult<GeoSnapResult>> {
    const pts = req.points.slice(-100);
    if (pts.length < 2) throw new GeoProviderError("GEO_INVALID_INPUT", "Map Matching precisa de ≥ 2 pontos", 422);
    // overview=full: sem a geometria a tela não tem o que desenhar nem distância/duração
    const snapProfile = req.profile ?? "driving";
    if (!/^(driving|walking|cycling)$/.test(snapProfile)) {
      throw new GeoProviderError("GEO_INVALID_INPUT", `Perfil inválido para map matching: ${snapProfile}`, 422);
    }
    const p = new URLSearchParams({ geometries: "geojson", overview: "full", steps: "false", tidy: "true" });
    p.set("radiuses", pts.map(() => String(req.radius_m ?? 25)).join(";"));
    if (req.timestamps && req.timestamps.length === pts.length) p.set("timestamps", req.timestamps.join(";"));
    const json = await this.call<{
      matchings?: Array<{
        confidence?: number; distance?: number; duration?: number;
        geometry?: { type: string; coordinates: [number, number][] };
        legs?: Array<{ distance: number; duration: number }>;
      }>;
      tracepoints?: Array<{ location: [number, number] } | null>;
    }>("matching", `${BASE}/matching/v5/mapbox/${snapProfile}/${pts.map(fmt).join(";")}?${p}`);
    const points = (json.tracepoints ?? []).map((tp, i) => tp ? { lat: tp.location[1], lng: tp.location[0] } : pts[i]);
    const m = json.matchings?.[0];
    const geom = m?.geometry?.coordinates ?? [];
    return {
      data: {
        points,
        confidence: m?.confidence ?? null,
        provider: "mapbox",
        distance_m: m?.distance != null ? Math.round(Number(m.distance)) : null,
        duration_s: m?.duration != null ? Math.round(Number(m.duration)) : null,
        polyline: geom.map(([lng, lat]) => ({ lat, lng })),
        geometry: m?.geometry,
        legs: m?.legs?.map((l) => ({ distance_m: Math.round(l.distance), duration_s: Math.round(l.duration) })),
      },
      sku: "map_matching", units: 1,
    };
  }

  // ── Static Images ───────────────────────────────────────────────────────
  async staticMap(req: StaticReq): Promise<ProviderResult<GeoStaticImage>> {
    const width = Math.min(req.width ?? 600, 1280), height = Math.min(req.height ?? 300, 1280);
    const style = req.style ?? "streets-v12";
    const overlays: string[] = [];
    if (req.path && req.path.length >= 2) {
      const enc = encodePolyline(simplify(req.path, 40), 5);
      overlays.push(`path-5+3b82f6-0.8(${encodeURIComponent(enc)})`);
    }
    for (const m of req.markers ?? []) {
      overlays.push(`pin-s${m.label ? "-" + m.label.toLowerCase().slice(0, 1) : ""}+${(m.color ?? "f44336").replace("#", "")}(${m.lng},${m.lat})`);
    }
    const view = req.center ? `${req.center.lng},${req.center.lat},${req.zoom ?? 13},0,0` : "auto";
    const url = `${BASE}/styles/v1/mapbox/${style}/static/${overlays.length ? overlays.join(",") + "/" : ""}${view}/${width}x${height}@2x?access_token=${encodeURIComponent(this.token)}`;
    if (url.length > 8000) throw new GeoProviderError("GEO_INVALID_INPUT", "URL da imagem estática acima de 8 KB", 414);
    if (!this.rateGuard("static")) throw new GeoProviderError("GEO_RATE_LIMITED", "Limite local Static Images", 429, 60_000);
    const res = await this.fetchFn(url);
    if (!res.ok) throw new GeoProviderError("GEO_PROVIDER_ERROR", `Static Images ${res.status}`, 502);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: { image: `data:image/png;base64,${btoa(bin)}`, width, height, provider: "mapbox" }, sku: "static_image", units: 1 };
  }

  // ── Mapbox-only (pass-through com medição) ──────────────────────────────
  async raw(action: "isochrone" | "optimization" | "tilequery", body: Record<string, unknown>): Promise<ProviderResult<unknown>> {
    const toCoords = (c: unknown) => Array.isArray(c) ? (c as number[][]).map((x) => x.join(",")).join(";") : String(c ?? "");
    switch (action) {
      case "isochrone": {
        const p = new URLSearchParams({ contours_minutes: String(body.contours_minutes ?? "15,30,60"), polygons: String(body.polygons ?? true) });
        const data = await this.call("isochrone", `${BASE}/isochrone/v1/mapbox/${body.profile ?? "driving"}/${body.lng},${body.lat}?${p}`);
        return { data, sku: "isochrone", units: 1 };
      }
      case "optimization": {
        const p = new URLSearchParams({
          source: String(body.source ?? "first"), destination: String(body.destination ?? "last"),
          roundtrip: String(body.roundtrip ?? false), geometries: "geojson", overview: "full", language: "pt",
        });
        const data = await this.call("optimization", `${BASE}/optimized-trips/v1/mapbox/${body.profile ?? "driving"}/${toCoords(body.coordinates)}?${p}`);
        return { data, sku: "optimization", units: 1 };
      }
      case "tilequery": {
        const p = new URLSearchParams({ radius: String(body.radius ?? 100), limit: String(body.limit ?? 5) });
        if (body.layers) p.set("layers", String(body.layers));
        const data = await this.call("tilequery", `${BASE}/v4/${body.tileset ?? "mapbox.mapbox-streets-v8"}/tilequery/${body.lng},${body.lat}.json?${p}`);
        return { data, sku: "tilequery", units: 1 };
      }
    }
  }
}
