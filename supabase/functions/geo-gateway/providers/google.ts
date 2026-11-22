// Provedor Google — implementa a interface GeoProvider (Bloco 2, etapas 24-29 do plano).
// APIs usadas: Places API (New) `autocomplete`/`places/{id}`, Geocoding API clássica
// (`maps/api/geocode/json`, address e latlng), Routes API `computeRoutes`/`computeRouteMatrix`,
// Static Maps API. Chave: GOOGLE_MAPS_SERVER_KEY (server-side only, nunca no cliente).
// snap/isochrone/optimization/tilequery: sem equivalente direto no Google — não implementados
// (decisão do plano: `supports` não inclui essas funções; o gateway devolve 501/503 pra elas).
import { encodePolyline, decodePolyline, simplify } from "../polyline.ts";
import type {
  AutocompleteReq, GeoAddress, GeoAddressComponents, GeoMatrix, GeoPoint, GeoPrecision, GeoProvider,
  GeoRoute, GeoStaticImage, GeoSuggestion, GeocodeReq, MatrixReq, PlaceDetailsReq,
  ProviderResult, ReverseReq, RouteReq, StaticReq,
} from "./types.ts";
import { GeoProviderError } from "./types.ts";

const PLACES_BASE = "https://places.googleapis.com/v1";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_BASE = "https://routes.googleapis.com";
const STATIC_BASE = "https://maps.googleapis.com/maps/api/staticmap";

type Fetch = typeof fetch;

export interface GoogleOptions {
  key: string;
  fetch?: Fetch;
  /** devolve false quando o bucket (provider:api) está vazio neste minuto */
  rateGuard?: (api: string, consume?: number) => boolean;
}

const LOCATION_TYPE_TO_PRECISION: Record<string, GeoPrecision> = {
  ROOFTOP: "exact",
  RANGE_INTERPOLATED: "medium",
  GEOMETRIC_CENTER: "medium",
  APPROXIMATE: "low",
};

function fmtLatLng(p: GeoPoint) {
  return `${p.lat},${p.lng}`;
}

function componentsFromGeocode(components: Array<{ long_name: string; short_name: string; types: string[] }> | undefined): GeoAddressComponents {
  const out: GeoAddressComponents = {};
  let streetNumber = "";
  let route = "";
  for (const c of components ?? []) {
    if (c.types.includes("street_number")) streetNumber = c.long_name;
    else if (c.types.includes("route")) route = c.long_name;
    else if (c.types.includes("sublocality") || c.types.includes("sublocality_level_1") || c.types.includes("neighborhood")) out.district = c.long_name;
    else if (c.types.includes("administrative_area_level_2") || c.types.includes("locality")) out.city = c.long_name;
    else if (c.types.includes("administrative_area_level_1")) out.state = c.long_name;
    else if (c.types.includes("postal_code")) out.postal_code = c.long_name;
    else if (c.types.includes("country")) out.country = c.long_name;
  }
  if (route) out.street = route;
  if (streetNumber) out.number = streetNumber;
  return out;
}

export class GoogleProvider implements GeoProvider {
  readonly name = "google" as const;
  readonly supports = new Set<
    "autocomplete" | "geocode" | "reverse" | "route" | "matrix" | "static"
  >(["autocomplete", "geocode", "reverse", "route", "matrix", "static"]);

  private key: string;
  private fetchFn: Fetch;
  private rateGuard: (api: string, consume?: number) => boolean;

  constructor(opts: GoogleOptions) {
    this.key = opts.key;
    this.fetchFn = opts.fetch ?? fetch;
    this.rateGuard = opts.rateGuard ?? (() => true);
  }

  // ── Places API (New): autocomplete ──────────────────────────────────────
  async autocomplete(req: AutocompleteReq): Promise<ProviderResult<GeoSuggestion[]>> {
    if (!this.rateGuard("places_autocomplete")) {
      throw new GeoProviderError("GEO_RATE_LIMITED", "Limite local da API Google Places atingido neste minuto", 429, 60_000);
    }
    const body: Record<string, unknown> = {
      input: req.input,
      languageCode: req.language ?? "pt-BR",
      includedRegionCodes: [(req.country ?? "br").toLowerCase()],
    };
    if (req.session_token) body.sessionToken = req.session_token;
    if (req.bias) {
      body.locationBias = {
        circle: { center: { latitude: req.bias.lat, longitude: req.bias.lng }, radius: req.bias.radius_m ?? 5000 },
      };
    }
    const json = await this.call<{ suggestions?: Array<{ placePrediction?: Record<string, unknown> }> }>(
      "POST", `${PLACES_BASE}/places:autocomplete`, body,
      { "X-Goog-FieldMask": "*" },
    );
    const data: GeoSuggestion[] = (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is Record<string, unknown> => !!p)
      .slice(0, Math.min(req.limit ?? 5, 10))
      .map((p) => {
        const structured = (p.structuredFormat ?? {}) as { mainText?: { text?: string }; secondaryText?: { text?: string } };
        const types = (p.types ?? []) as string[];
        return {
          id: `google:${p.placeId}`,
          main_text: structured.mainText?.text ?? String((p.text as { text?: string } | undefined)?.text ?? ""),
          secondary_text: structured.secondaryText?.text ?? "",
          type: types[0] ?? "unknown",
          provider: "google" as const,
        };
      });
    return { data, sku: "places_autocomplete_request", units: req.session_token ? 0 : 1 };
  }

  // ── Places API (New): place details ─────────────────────────────────────
  async placeDetails(req: PlaceDetailsReq): Promise<ProviderResult<GeoAddress>> {
    const id = req.place_id.replace(/^google:/, "");
    const p = new URLSearchParams({ key: this.key });
    if (req.session_token) p.set("sessionToken", req.session_token);
    if (!this.rateGuard("place_details")) {
      throw new GeoProviderError("GEO_RATE_LIMITED", "Limite local da API Google Places atingido neste minuto", 429, 60_000);
    }
    const res = await this.fetchFn(`${PLACES_BASE}/places/${encodeURIComponent(id)}?${p}`, {
      headers: { "X-Goog-Api-Key": this.key, "X-Goog-FieldMask": "id,location,formattedAddress,addressComponents,types" },
    });
    const json = await this.parseResponse<{
      id?: string; formattedAddress?: string; location?: { latitude: number; longitude: number };
      addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
    }>(res, "place_details");
    const components: GeoAddressComponents = {};
    let streetNumber = "", route = "";
    for (const c of json.addressComponents ?? []) {
      if (c.types.includes("street_number")) streetNumber = c.longText;
      else if (c.types.includes("route")) route = c.longText;
      else if (c.types.includes("sublocality") || c.types.includes("neighborhood")) components.district = c.longText;
      else if (c.types.includes("administrative_area_level_2") || c.types.includes("locality")) components.city = c.longText;
      else if (c.types.includes("administrative_area_level_1")) components.state = c.longText;
      else if (c.types.includes("postal_code")) components.postal_code = c.longText;
      else if (c.types.includes("country")) components.country = c.longText;
    }
    if (route) components.street = route;
    if (streetNumber) components.number = streetNumber;
    return {
      data: {
        formatted: json.formattedAddress ?? "",
        place_id: json.id ? `google:${json.id}` : req.place_id,
        location: json.location ? { lat: json.location.latitude, lng: json.location.longitude } : null,
        components,
        precision: "exact",
        provider: "google",
        retainable: true,
      },
      sku: "place_details_essentials", units: req.session_token ? 0 : 1,
    };
  }

  // ── Geocoding API clássica: forward ──────────────────────────────────────
  async geocode(req: GeocodeReq): Promise<ProviderResult<GeoAddress[]>> {
    const p = new URLSearchParams({ key: this.key, language: req.language ?? "pt-BR", region: req.country ?? "br" });
    if (req.structured) {
      const s = req.structured;
      const parts = [s.address_line1, s.city, s.state, s.postal_code, s.country].filter(Boolean);
      p.set("address", parts.join(", "));
      if (s.postal_code) p.set("components", `postal_code:${s.postal_code}`);
    } else if (req.address) {
      p.set("address", req.address);
    } else {
      throw new GeoProviderError("GEO_INVALID_INPUT", "address ou structured é obrigatório", 422);
    }
    const json = await this.callGeocode(p, "geocoding");
    const limit = Math.min(req.limit ?? 5, 10);
    const data = (json.results ?? []).slice(0, limit).map((r) => this.resultToAddress(r, !!req.persist));
    if (data.length === 0) throw new GeoProviderError("GEO_NOT_FOUND", "Endereço não encontrado", 404);
    return { data, sku: "geocoding", units: 1 };
  }

  // ── Geocoding API clássica: reverse ──────────────────────────────────────
  async reverse(req: ReverseReq): Promise<ProviderResult<GeoAddress | null>> {
    const p = new URLSearchParams({ key: this.key, language: req.language ?? "pt-BR", latlng: `${req.lat},${req.lng}` });
    const json = await this.callGeocode(p, "geocoding");
    const r = json.results?.[0];
    return { data: r ? this.resultToAddress(r, !!req.persist) : null, sku: "geocoding", units: 1 };
  }

  private resultToAddress(r: {
    formatted_address?: string; place_id?: string;
    geometry?: { location?: { lat: number; lng: number }; location_type?: string };
    address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
  }, retainable: boolean): GeoAddress {
    const loc = r.geometry?.location;
    return {
      formatted: r.formatted_address ?? "",
      place_id: r.place_id ? `google:${r.place_id}` : null,
      location: loc ? { lat: loc.lat, lng: loc.lng } : null,
      components: componentsFromGeocode(r.address_components),
      precision: LOCATION_TYPE_TO_PRECISION[r.geometry?.location_type ?? ""] ?? "unknown",
      provider: "google",
      retainable,
    };
  }

  private async callGeocode(p: URLSearchParams, api: string): Promise<{
    status: string;
    results?: Array<{
      formatted_address?: string; place_id?: string;
      geometry?: { location?: { lat: number; lng: number }; location_type?: string };
      address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
    }>;
  }> {
    if (!this.rateGuard(api)) {
      throw new GeoProviderError("GEO_RATE_LIMITED", `Limite local da API Google ${api} atingido neste minuto`, 429, 60_000);
    }
    const res = await this.fetchFn(`${GEOCODE_BASE}?${p}`);
    const json = await this.parseResponse<{ status: string; results?: unknown[]; error_message?: string }>(res, api, true);
    if (json.status === "ZERO_RESULTS") return { status: json.status, results: [] };
    if (json.status === "OVER_QUERY_LIMIT") throw new GeoProviderError("GEO_RATE_LIMITED", "Google Geocoding: cota excedida", 429, 60_000);
    if (json.status === "REQUEST_DENIED") throw new GeoProviderError("GEO_NOT_CONFIGURED", `Google Geocoding recusou a chave: ${json.error_message ?? ""}`, 502);
    if (json.status !== "OK") throw new GeoProviderError("GEO_PROVIDER_ERROR", `Google Geocoding ${json.status}: ${json.error_message ?? ""}`, 502);
    return json as never;
  }

  // ── Routes API: computeRoutes ────────────────────────────────────────────
  async route(req: RouteReq): Promise<ProviderResult<GeoRoute>> {
    const traffic = req.traffic !== false;
    const toWaypoint = (pt: GeoPoint) => ({ location: { latLng: { latitude: pt.lat, longitude: pt.lng } } });
    const body: Record<string, unknown> = {
      origin: toWaypoint(req.origin),
      destination: toWaypoint(req.destination),
      travelMode: "DRIVE",
      routingPreference: traffic ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
      polylineQuality: "OVERVIEW",
      languageCode: req.language ?? "pt-BR",
      computeAlternativeRoutes: !!req.alternatives,
      units: "METRIC",
    };
    if (req.waypoints?.length) body.intermediates = req.waypoints.map(toWaypoint);
    // Sem departureTime: a Routes API usa "agora" por padrão com TRAFFIC_AWARE.
    // Enviar new Date().toISOString() explicitamente foi rejeitado em produção com
    // "Timestamp must be set to a future time" — a hora chega ao servidor do Google
    // já no passado pelo relógio dele, mesmo tendo sido "agora" no momento do envio.
    const json = await this.call<{
      routes?: Array<{
        duration?: string; distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{ duration?: string; distanceMeters?: number }>;
      }>;
    }>("POST", `${ROUTES_BASE}/directions/v2:computeRoutes`, body, {
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters",
    }, "routes_compute_routes");
    const r = json.routes?.[0];
    if (!r) throw new GeoProviderError("GEO_NO_ROUTE", "Sem rota", 404);
    const legs = (r.legs ?? []).map((l) => ({ distance_m: l.distanceMeters ?? 0, duration_s: parseInt(l.duration ?? "0", 10) }));
    const durationS = parseInt(r.duration ?? "0", 10);
    return {
      data: {
        polyline: r.polyline?.encodedPolyline ? decodePolyline(r.polyline.encodedPolyline, 5) : [],
        distance_m: r.distanceMeters ?? 0,
        duration_s: durationS,
        duration_traffic_s: traffic ? durationS : undefined,
        legs, provider: "google", profile: traffic ? "driving-traffic" : "driving",
      },
      sku: "routes_compute_routes", units: 1,
    };
  }

  // ── Routes API: computeRouteMatrix ───────────────────────────────────────
  async matrix(req: MatrixReq): Promise<ProviderResult<GeoMatrix>> {
    const elements = req.origins.length * req.destinations.length;
    if (elements < 1 || elements > 625) throw new GeoProviderError("GEO_INVALID_INPUT", "Matrix: entre 1 e 625 elementos", 422);
    const traffic = req.traffic !== false;
    const toWaypoint = (pt: GeoPoint) => ({ waypoint: { location: { latLng: { latitude: pt.lat, longitude: pt.lng } } } });
    const body: Record<string, unknown> = {
      origins: req.origins.map(toWaypoint),
      destinations: req.destinations.map(toWaypoint),
      travelMode: "DRIVE",
      routingPreference: traffic ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
    };
    const json = await this.call<Array<{ originIndex?: number; destinationIndex?: number; duration?: string; distanceMeters?: number; condition?: string }>>(
      "POST", `${ROUTES_BASE}/distanceMatrix/v2:computeRouteMatrix`, body, {
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
      }, "routes_matrix",
    );
    const durations_s: (number | null)[][] = req.origins.map(() => req.destinations.map(() => null));
    const distances_m: (number | null)[][] = req.origins.map(() => req.destinations.map(() => null));
    for (const el of Array.isArray(json) ? json : []) {
      const oi = el.originIndex ?? 0, di = el.destinationIndex ?? 0;
      if (el.condition && el.condition !== "ROUTE_EXISTS") continue;
      if (durations_s[oi]) durations_s[oi][di] = el.duration ? parseInt(el.duration, 10) : null;
      if (distances_m[oi]) distances_m[oi][di] = el.distanceMeters ?? null;
    }
    return { data: { durations_s, distances_m, provider: "google", profile: traffic ? "driving-traffic" : "driving" }, sku: "routes_matrix", units: elements };
  }

  // ── Static Maps API ───────────────────────────────────────────────────────
  async staticMap(req: StaticReq): Promise<ProviderResult<GeoStaticImage>> {
    const width = Math.min(req.width ?? 600, 640), height = Math.min(req.height ?? 300, 640);
    const p = new URLSearchParams({ size: `${width}x${height}`, scale: "2", key: this.key });
    if (req.center) p.set("center", fmtLatLng(req.center));
    if (req.zoom != null) p.set("zoom", String(req.zoom));
    for (const m of req.markers ?? []) {
      p.append("markers", `color:0x${(m.color ?? "f44336").replace("#", "")}${m.label ? `|label:${m.label.slice(0, 1).toUpperCase()}` : ""}|${m.lat},${m.lng}`);
    }
    if (req.path && req.path.length >= 2) {
      const enc = encodePolyline(simplify(req.path, 40), 5);
      p.append("path", `color:0x3b82f6cc|weight:5|enc:${enc}`);
    }
    if (!req.center && !req.markers?.length && !req.path?.length) {
      throw new GeoProviderError("GEO_INVALID_INPUT", "static requer center, markers ou path", 422);
    }
    const url = `${STATIC_BASE}?${p}`;
    if (!this.rateGuard("static_maps")) throw new GeoProviderError("GEO_RATE_LIMITED", "Limite local Static Maps", 429, 60_000);
    const res = await this.fetchFn(url);
    if (!res.ok) throw new GeoProviderError("GEO_PROVIDER_ERROR", `Static Maps ${res.status}`, 502);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: { image: `data:image/png;base64,${btoa(bin)}`, width, height, provider: "google" }, sku: "static_maps", units: 1 };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────
  private async call<T>(
    method: "GET" | "POST",
    url: string,
    body: unknown,
    extraHeaders: Record<string, string>,
    rateApi?: string,
  ): Promise<T> {
    if (rateApi && !this.rateGuard(rateApi)) {
      throw new GeoProviderError("GEO_RATE_LIMITED", `Limite local da API Google ${rateApi} atingido neste minuto`, 429, 60_000);
    }
    const res = await this.fetchFn(url, {
      method,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.key, ...extraHeaders },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    return this.parseResponse<T>(res, rateApi ?? "google");
  }

  private async parseResponse<T>(res: Response, api: string, allowErrorStatus = false): Promise<T> {
    const text = await res.text();
    let json: unknown;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
    if (!res.ok && !allowErrorStatus) {
      const j = (json ?? {}) as { error?: { message?: string; status?: string } };
      const msg = j.error?.message ?? res.statusText;
      if (res.status === 401 || res.status === 403) throw new GeoProviderError("GEO_NOT_CONFIGURED", `Google ${api} recusou a chave: ${msg}`, 502);
      if (res.status === 429) throw new GeoProviderError("GEO_RATE_LIMITED", `Google ${api}: ${msg}`, 429, 60_000);
      if (res.status === 400 || res.status === 422) throw new GeoProviderError("GEO_INVALID_INPUT", msg, 422);
      if (res.status === 404) throw new GeoProviderError("GEO_NOT_FOUND", msg, 404);
      throw new GeoProviderError("GEO_PROVIDER_ERROR", `Google ${api} ${res.status}: ${msg}`, 502);
    }
    return json as T;
  }
}
