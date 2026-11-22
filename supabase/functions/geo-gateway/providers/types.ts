// Interface comum dos provedores de mapa (Google / Mapbox).
// Tudo que o front e as outras edges consomem passa por estes tipos — nunca pelo JSON cru do provedor.

export type ProviderName = "google" | "mapbox";
export type ProviderSetting = ProviderName | "auto" | "off";

export type GeoFunction =
  | "tiles"
  | "autocomplete"
  | "geocode"
  | "reverse"
  | "route"
  | "matrix"
  | "static"
  | "snap"
  | "validate"
  | "isochrone"
  | "optimization"
  | "tilequery";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type { GeoPrecision } from "../../_shared/geo-precision.ts";
import type { GeoPrecision } from "../../_shared/geo-precision.ts";

export interface GeoSuggestion {
  id: string; // "<provider>:<id do provedor>"
  main_text: string;
  secondary_text: string;
  type: string;
  provider: ProviderName;
}

export interface GeoAddressComponents {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface GeoAddress {
  formatted: string;
  place_id: string | null; // "<provider>:<id>"
  location: GeoPoint | null;
  routable_point?: GeoPoint | null;
  components: GeoAddressComponents;
  precision: GeoPrecision;
  match_confidence?: string;
  provider: ProviderName;
  /** true quando o provedor permite guardar a coordenada (Mapbox permanent / Google) */
  retainable: boolean;
}

export interface GeoRouteLeg {
  distance_m: number;
  duration_s: number;
}

export interface GeoRoute {
  polyline: GeoPoint[];
  distance_m: number;
  duration_s: number;
  duration_traffic_s?: number;
  legs: GeoRouteLeg[];
  provider: ProviderName;
  profile: string;
}

export interface GeoMatrix {
  durations_s: (number | null)[][];
  distances_m: (number | null)[][];
  provider: ProviderName;
  profile: string;
}

export interface GeoStaticImage {
  image: string; // data URL PNG
  width: number;
  height: number;
  provider: ProviderName;
}

export interface GeoSnapResult {
  points: GeoPoint[]; // pontos encaixados na via (mesma ordem da entrada)
  confidence: number | null;
  provider: ProviderName;
  /** métricas do trecho encaixado — a tela /map-tools mostra distância e duração */
  distance_m?: number | null;
  duration_s?: number | null;
  /** geometria do trecho encaixado, pronta para desenhar no mapa */
  polyline?: GeoPoint[];
  /** a mesma geometria em GeoJSON, formato que a tela de conferência consome */
  geometry?: { type: string; coordinates: [number, number][] };
  legs?: GeoRouteLeg[];
}

// ── Requests normalizados (espelham _shared/schemas.ts) ─────────────────────

export interface AutocompleteReq {
  input: string;
  session_token?: string;
  bias?: { lat: number; lng: number; radius_m?: number };
  country?: string; // ISO-2, default "br"
  language?: string; // default "pt"
  limit?: number;
  /** Etapa 22: `geocoding` troca o Search Box pelo Geocoding v6 `autocomplete=true`. */
  mode?: "searchbox" | "geocoding";
}

export interface PlaceDetailsReq {
  place_id: string; // "<provider>:<id>"
  session_token?: string;
  /** Etapa 22: no modo `geocoding` o detalhe é resolvido por `address` (v6 não tem retrieve por id). */
  mode?: "searchbox" | "geocoding";
  address?: string;
  country?: string;
  language?: string;
}

export interface GeocodeReq {
  address?: string;
  structured?: {
    address_line1?: string;
    postal_code?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  bias?: { lat: number; lng: number };
  country?: string;
  language?: string;
  limit?: number;
  /** o chamador vai GRAVAR a coordenada → Mapbox usa permanent=true */
  persist?: boolean;
}

export interface ReverseReq {
  lat: number;
  lng: number;
  language?: string;
  persist?: boolean;
}

export interface RouteReq {
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  /** perfil do Directions (driving-traffic | driving | walking | cycling); vence `traffic` */
  profile?: string;
  traffic?: boolean;
  alternatives?: boolean;
  language?: string;
}

export interface MatrixReq {
  origins: GeoPoint[];
  destinations: GeoPoint[];
  /** perfil do Matrix (driving | driving-traffic | walking | cycling); vence `traffic` */
  profile?: string;
  traffic?: boolean;
}

export interface StaticReq {
  width?: number;
  height?: number;
  markers?: { lat: number; lng: number; color?: string; label?: string }[];
  path?: GeoPoint[];
  center?: GeoPoint;
  zoom?: number;
  style?: string;
}

/** Um item do lote de `geocode-batch`: mesmo contrato do `geocode` individual. */
export interface GeoBatchQuery {
  address?: string;
  structured?: {
    address_line1?: string;
    postal_code?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  bias?: { lat: number; lng: number };
  country?: string;
  language?: string;
  limit?: number;
}

/** Resultado por item: `addresses` vazio (com `not_found`) quando nada foi encontrado. */
export interface GeoBatchItem {
  index: number;
  addresses: GeoAddress[];
  not_found?: boolean;
}

export interface SnapReq {
  points: GeoPoint[];
  timestamps?: number[];
  radius_m?: number;
  /** perfil do Map Matching (driving | walking | cycling); ausente = driving */
  profile?: string;
}

export interface ProviderResult<T> {
  data: T;
  /** SKU em geo_price_list usado na medição */
  sku: string;
  /** unidades cobradas (requisições, elementos, sessões...) — 0 = não contar */
  units: number;
  /** o provedor usou um perfil/tier diferente do pedido (ex.: traffic → driving) */
  downgraded?: string;
}

export class GeoProviderError extends Error {
  constructor(
    public code:
      | "GEO_NOT_FOUND"
      | "GEO_NO_ROUTE"
      | "GEO_INVALID_INPUT"
      | "GEO_RATE_LIMITED"
      | "GEO_PROVIDER_ERROR"
      | "GEO_NOT_SUPPORTED"
      | "GEO_NOT_CONFIGURED",
    message: string,
    public status: number,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GeoProviderError";
  }
}

export interface GeoProvider {
  readonly name: ProviderName;
  /** funções que este provedor implementa */
  readonly supports: ReadonlySet<GeoFunction>;
  autocomplete(req: AutocompleteReq): Promise<ProviderResult<GeoSuggestion[]>>;
  placeDetails(req: PlaceDetailsReq): Promise<ProviderResult<GeoAddress>>;
  geocode(req: GeocodeReq): Promise<ProviderResult<GeoAddress[]>>;
  /**
   * Etapa 25: geocodificação em lote. Opcional — o gateway devolve 501 quando ausente
   * em vez de degradar em N chamadas silenciosas. Cada item falha sozinho: um endereço
   * não encontrado não derruba o lote.
   */
  geocodeBatch?(reqs: GeoBatchQuery[], persist: boolean): Promise<ProviderResult<GeoBatchItem[]>>;
  reverse(req: ReverseReq): Promise<ProviderResult<GeoAddress | null>>;
  route(req: RouteReq): Promise<ProviderResult<GeoRoute>>;
  matrix(req: MatrixReq): Promise<ProviderResult<GeoMatrix>>;
  staticMap(req: StaticReq): Promise<ProviderResult<GeoStaticImage>>;
  snap?(req: SnapReq): Promise<ProviderResult<GeoSnapResult>>;
  /** pass-through de APIs sem equivalente no outro provedor (Mapbox-only) */
  raw?(action: "isochrone" | "optimization" | "tilequery", body: Record<string, unknown>): Promise<ProviderResult<unknown>>;
}
