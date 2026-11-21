import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  geometry: { type: string; coordinates: [number, number] };
  context?: Array<{ id: string; text: string }>;
  properties?: Record<string, unknown>;
}

export interface GeocodingResult {
  features: MapboxFeature[];
  attribution: string;
}

export interface DirectionsRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  legs: Array<{
    distance: number;
    duration: number;
    steps?: Array<{
      maneuver: { instruction: string };
      distance: number;
      duration: number;
    }>;
  }>;
}

export interface DirectionsResult {
  routes: DirectionsRoute[];
  waypoints: Array<{ name: string; location: [number, number] }>;
}

export interface MatrixResult {
  distances: number[][];
  durations: number[][];
  sources: Array<{ name: string; location: [number, number] }>;
  destinations: Array<{ name: string; location: [number, number] }>;
}

// ── API Calls ──

/**
 * Toda chamada passa pelo `geo-gateway` — camada única de acesso a provedor de mapa.
 * O `mapbox-proxy` legado ficou fora de uso: ele falava com o Mapbox direto, sem
 * medição de custo, sem cache e sem respeitar `geo_settings` (docs/planos/
 * PLANO_MAPBOX_100_ETAPAS.md, M1).
 */
async function geoGateway<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('geo-gateway', { body });
  if (error) throw error;
  return data as T;
}

/** [lng, lat] → GeoPoint (o gateway trabalha com objeto, a tela com par ordenado) */
function toPoints(coordinates: [number, number][]): Array<{ lat: number; lng: number }> {
  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}

/** Pares ordenados → origem/paradas/destino, como o contrato `route` exige */
function toRouteBody(coordinates: [number, number][], profile?: string) {
  const pts = toPoints(coordinates);
  if (pts.length < 2) throw new Error('Rota precisa de pelo menos 2 coordenadas');
  return {
    action: 'route',
    origin: pts[0],
    destination: pts[pts.length - 1],
    waypoints: pts.slice(1, -1),
    alternatives: false,
    ...(profile ? { profile } : {}),
  };
}

// ── Contrato do geo-gateway ──
// Espelha `supabase/functions/geo-gateway/providers/types.ts`. O front não importa a
// edge (Deno) — por isso a duplicação mínima dos campos consumidos aqui.

const ATTRIBUTION = '© Mapbox © OpenStreetMap';

interface GeoPoint { lat: number; lng: number }

interface GeoAddress {
  formatted: string;
  place_id: string | null;
  location: GeoPoint | null;
  components: { street?: string; number?: string; district?: string; city?: string; state?: string; postal_code?: string; country?: string };
  precision: string;
  provider: string;
}

interface GeoRoute {
  polyline: GeoPoint[];
  distance_m: number;
  duration_s: number;
  duration_traffic_s?: number;
  legs: Array<{ distance_m: number; duration_s: number }>;
  provider: string;
  profile: string;
}

interface GeoMatrix {
  durations_s: (number | null)[][];
  distances_m: (number | null)[][];
  provider: string;
  profile: string;
}

interface GeoStaticImage { image: string; width: number; height: number; provider: string }

interface GeoSnapResult {
  points: GeoPoint[];
  confidence: number | null;
  provider: string;
  distance_m?: number | null;
  duration_s?: number | null;
  polyline?: GeoPoint[];
}

function toFeature(a: GeoAddress): MapboxFeature {
  const lng = a.location?.lng ?? 0;
  const lat = a.location?.lat ?? 0;
  const c = a.components;
  const street = [c.street, c.number].filter(Boolean).join(', ');
  return {
    id: a.place_id ?? a.formatted,
    place_name: a.formatted,
    text: street || c.district || c.city || a.formatted,
    center: [lng, lat],
    place_type: [a.precision],
    geometry: { type: 'Point', coordinates: [lng, lat] },
    context: [c.district, c.city, c.state, c.postal_code]
      .filter((v): v is string => !!v)
      .map((text) => ({ id: '', text })),
    properties: { provider: a.provider, place_id: a.place_id },
  };
}

function toDirectionsResult(route: GeoRoute): DirectionsResult {
  const coordinates = route.polyline.map((p) => [p.lng, p.lat] as [number, number]);
  return {
    routes: [{
      distance: route.distance_m,
      duration: route.duration_traffic_s ?? route.duration_s,
      geometry: { type: 'LineString', coordinates },
      legs: route.legs.map((l) => ({ distance: l.distance_m, duration: l.duration_s })),
    }],
    waypoints: coordinates.length > 0
      ? [coordinates[0], coordinates[coordinates.length - 1]].map((location) => ({ name: '', location }))
      : [],
  };
}

/** 404 (GEO_NOT_FOUND) é "nenhum resultado", não erro: as telas mostram estado vazio. */
function isNotFound(e: unknown): boolean {
  const msg = (e as { message?: string; context?: { status?: number } })?.message ?? '';
  return /GEO_NOT_FOUND|não encontrado|not found/i.test(msg)
    || (e as { context?: { status?: number } })?.context?.status === 404;
}

// ── Hooks ──

/** Forward geocode: text query → list of place features */
export function useMapboxGeocode(query: string, enabled = true) {
  return useQuery<GeocodingResult>({
    queryKey: ['mapbox', 'geocode', query],
    queryFn: async (): Promise<GeocodingResult> => {
      try {
        const addresses = await geoGateway<GeoAddress[]>({
          action: 'geocode',
          address: query,
          country: 'br',
          language: 'pt',
          limit: 5,
        });
        return { features: addresses.map(toFeature), attribution: ATTRIBUTION };
      } catch (e) {
        // GEO_NOT_FOUND é resultado vazio, não falha de busca
        if (isNotFound(e)) return { features: [], attribution: ATTRIBUTION };
        throw e;
      }
    },
    enabled: enabled && query.length >= 3,
    staleTime: 5 * 60_000,
  });
}

/** Reverse geocode: coordinates → place name */
export function useMapboxReverseGeocode(lng: number | null, lat: number | null) {
  return useQuery<GeocodingResult>({
    queryKey: ['mapbox', 'reverse', lng, lat],
    queryFn: async (): Promise<GeocodingResult> => {
      const address = await geoGateway<GeoAddress | null>({ action: 'reverse', lng: lng as number, lat: lat as number });
      return { features: address ? [toFeature(address)] : [], attribution: ATTRIBUTION };
    },
    enabled: lng != null && lat != null,
    staleTime: 30 * 60_000,
  });
}

/** Get driving directions between waypoints */
export function useMapboxDirections() {
  return useMutation<DirectionsResult, Error, {
    coordinates: [number, number][];
    profile?: string;
    steps?: boolean;
    alternatives?: boolean;
  }>({
    mutationFn: async (params) => {
      const body = toRouteBody(params.coordinates, params.profile);
      const route = await geoGateway<GeoRoute>({ ...body, alternatives: params.alternatives ?? false });
      return toDirectionsResult(route);
    },
  });
}

/** Distance/duration matrix between multiple points */
export function useMapboxMatrix() {
  return useMutation<MatrixResult, Error, {
    coordinates: [number, number][];
    profile?: string;
  }>({
    mutationFn: async (params) => {
      const points = toPoints(params.coordinates);
      const matrix = await geoGateway<GeoMatrix>({
        action: 'matrix',
        origins: points,
        destinations: points,
        ...(params.profile ? { profile: params.profile } : {}),
      });
      const asMatrixPoints = points.map((p, i) => ({ name: String.fromCharCode(65 + i), location: [p.lng, p.lat] as [number, number] }));
      return {
        // O gateway pode devolver `null` quando o par é inalcançável; a tela já trata.
        distances: matrix.distances_m.map((row) => row.map((v) => v ?? 0)),
        durations: matrix.durations_s.map((row) => row.map((v) => v ?? 0)),
        sources: asMatrixPoints,
        destinations: asMatrixPoints,
      };
    },
  });
}

/** Isochrone (delivery zones) */
export interface IsochroneFeature {
  type: 'Feature';
  properties: {
    contour: number;
    color: string;
    opacity: number;
    fill: string;
    'fill-opacity': number;
    'fillColor': string;
    'fillOpacity': number;
  };
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

export interface IsochroneResult {
  type: 'FeatureCollection';
  features: IsochroneFeature[];
}

export function useMapboxIsochrone() {
  return useMutation<IsochroneResult, Error, { lng: number; lat: number; contours_minutes?: string; profile?: string }>({
    mutationFn: (params) => geoGateway<IsochroneResult>({ action: 'isochrone', ...params }),
  });
}

/** Route Optimization (multi-stop TSP/VRP) */
export interface OptimizationResult {
  trips: Array<{
    distance: number;
    duration: number;
    geometry: { type: string; coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
  waypoints: Array<{
    name: string;
    location: [number, number];
    waypoint_index: number;
    trips_index: number;
  }>;
  code: string;
}

export function useMapboxOptimization() {
  return useMutation<OptimizationResult, Error, {
    coordinates: [number, number][];
    profile?: string;
    source?: string;
    destination?: string;
    roundtrip?: boolean;
    steps?: boolean;
    annotations?: string;
  }>({
    mutationFn: (params) => geoGateway<OptimizationResult>({
      action: 'optimization',
      ...params,
    }),
  });
}

/** Map Matching (snap GPS traces to roads) */
export interface MapMatchingResult {
  matchings: Array<{
    confidence: number;
    distance: number;
    duration: number;
    geometry: { type: string; coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
  tracepoints: Array<{
    name: string;
    location: [number, number];
    matchings_index: number;
    waypoint_index: number;
  } | null>;
  code: string;
}

export function useMapboxMapMatching() {
  return useMutation<MapMatchingResult, Error, {
    coordinates: [number, number][];
    profile?: string;
    timestamps?: number[];
    radiuses?: number[];
    tidy?: boolean;
    annotations?: string;
  }>({
    mutationFn: async (params) => {
      const snap = await geoGateway<GeoSnapResult>({
        action: 'snap',
        points: toPoints(params.coordinates),
        ...(params.timestamps ? { timestamps: params.timestamps } : {}),
        ...(params.radiuses?.[0] ? { radius_m: params.radiuses[0] } : {}),
      });
      // A tela mostra confidence/distância/duração e copia a geometria; o gateway
      // devolve os pontos encaixados, então recompomos o formado de `matchings`.
      return {
        matchings: [{
          confidence: snap.confidence ?? 0,
          distance: snap.distance_m ?? 0,
          duration: snap.duration_s ?? 0,
          geometry: {
            type: 'LineString',
            coordinates: (snap.polyline ?? snap.points).map((p) => [p.lng, p.lat] as [number, number]),
          },
          legs: [],
        }],
        tracepoints: snap.points.map((p) => ({ name: '', location: [p.lng, p.lat] as [number, number], matchings_index: 0, waypoint_index: 0 })),
        code: 'Ok',
      };
    },
  });
}

/** Static Map Image */
export interface StaticImageResult {
  image: string;
  width: number;
  height: number;
  url: string;
}

export function useMapboxStaticImage() {
  return useMutation<StaticImageResult, Error, {
    lng: number;
    lat: number;
    zoom?: number;
    width?: number;
    height?: number;
    style?: string;
    bearing?: number;
    pitch?: number;
    retina?: boolean;
    markers?: Array<{ lng: number; lat: number; color?: string; label?: string }>;
    path?: [number, number][];
    overlay?: string;
  }>({
    mutationFn: async (params) => {
      const img = await geoGateway<GeoStaticImage>({
        action: 'static',
        width: params.width,
        height: params.height,
        style: params.style,
        center: { lat: params.lat, lng: params.lng },
        zoom: params.zoom,
        markers: params.markers?.map((m) => ({ lat: m.lat, lng: m.lng, color: m.color, label: m.label })),
        path: params.path ? toPoints(params.path) : undefined,
      });
      return { image: img.image, width: img.width, height: img.height, url: img.image };
    },
  });
}

/** Tilequery (query features at location) */
export interface TilequeryFeature {
  type: 'Feature';
  properties: {
    tilequery?: {
      distance: number;
      geometry: string;
      layer: string;
    };
    class?: string;
    type?: string;
    name?: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: [number, number] | [number, number][];
  };
}

export interface TilequeryResult {
  type: 'FeatureCollection';
  features: TilequeryFeature[];
}

export function useMapboxTilequery() {
  return useMutation<TilequeryResult, Error, {
    lng: number;
    lat: number;
    tileset?: string;
    radius?: number;
    limit?: number;
    layers?: string;
  }>({
    mutationFn: (params) => geoGateway<TilequeryResult>({ action: 'tilequery', ...params }),
  });
}

/** Imperative geocode call (for non-hook contexts) */
export async function geocodeAddress(query: string): Promise<MapboxFeature[]> {
  try {
    const addresses = await geoGateway<GeoAddress[]>({
      action: 'geocode',
      address: query,
      country: 'br',
      language: 'pt',
      limit: 5,
    });
    return addresses.map(toFeature);
  } catch (e) {
    if (isNotFound(e)) return [];
    throw e;
  }
}

/** Imperative directions call */
export async function getDirections(
  coordinates: [number, number][],
  profile = 'driving-traffic'
): Promise<DirectionsRoute | null> {
  const route = await geoGateway<GeoRoute>(toRouteBody(coordinates, profile));
  return toDirectionsResult(route).routes[0] ?? null;
}
