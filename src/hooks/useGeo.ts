import { useQuery, useMutation } from '@tanstack/react-query';
import { callGeo, GeoGatewayError } from '@/lib/geo-gateway';

// ── Tipos públicos (mesmos nomes/formatos de useMapbox.ts — zero regressão) ──

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
  geometry: { type: string; coordinates: [number, number][] };
  legs: Array<{
    distance: number;
    duration: number;
    steps?: Array<{ maneuver: { instruction: string }; distance: number; duration: number }>;
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

export interface IsochroneFeature {
  type: 'Feature';
  properties: {
    contour: number;
    color: string;
    opacity: number;
    fill: string;
    'fill-opacity': number;
    fillColor: string;
    fillOpacity: number;
  };
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
}

export interface IsochroneResult {
  type: 'FeatureCollection';
  features: IsochroneFeature[];
}

export interface OptimizationResult {
  trips: Array<{
    distance: number;
    duration: number;
    geometry: { type: string; coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
  waypoints: Array<{ name: string; location: [number, number]; waypoint_index: number; trips_index: number }>;
  code: string;
}

export interface MapMatchingResult {
  matchings: Array<{
    confidence: number;
    distance: number;
    duration: number;
    geometry: { type: string; coordinates: [number, number][] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
  tracepoints: Array<{ name: string; location: [number, number]; matchings_index: number; waypoint_index: number } | null>;
  code: string;
}

export interface StaticImageResult {
  image: string;
  width: number;
  height: number;
  url: string;
}

export interface TilequeryFeature {
  type: 'Feature';
  properties: {
    tilequery?: { distance: number; geometry: string; layer: string };
    class?: string;
    type?: string;
    name?: string;
    [key: string]: unknown;
  };
  geometry: { type: string; coordinates: [number, number] | [number, number][] };
}

export interface TilequeryResult {
  type: 'FeatureCollection';
  features: TilequeryFeature[];
}

// ── Payloads normalizados do geo-gateway (espelham providers/types.ts) ──

interface GeoPoint { lat: number; lng: number }

interface GeoAddress {
  formatted: string;
  place_id: string | null;
  location: GeoPoint | null;
  routable_point?: GeoPoint | null;
  components: {
    street?: string; number?: string; district?: string; city?: string;
    state?: string; postal_code?: string; country?: string;
  };
  precision: string;
  match_confidence?: string;
  provider: string;
  retainable: boolean;
}

interface GeoRouteLeg { distance_m: number; duration_s: number }

interface GeoRoute {
  polyline: GeoPoint[];
  distance_m: number;
  duration_s: number;
  duration_traffic_s?: number;
  legs: GeoRouteLeg[];
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
  distance_m?: number;
  duration_s?: number;
  geometry?: { type: string; coordinates: [number, number][] };
  legs?: GeoRouteLeg[];
}

// ── Conversores ──

const LngLat = {
  from: (c: [number, number]): GeoPoint => ({ lng: c[0], lat: c[1] }),
  to: (p: GeoPoint): [number, number] => [p.lng, p.lat],
};

function toLineString(polyline: GeoPoint[]): { type: string; coordinates: [number, number][] } {
  return { type: 'LineString', coordinates: polyline.map(LngLat.to) };
}

function addressToFeature(a: GeoAddress): MapboxFeature {
  const center: [number, number] = a.location ? [a.location.lng, a.location.lat] : [0, 0];
  const c = a.components;
  const primary =
    c.street ?? c.district ?? c.city ?? c.state ?? (a.formatted.split(',')[0] ?? a.formatted);
  const placeType: string[] = c.number && c.street
    ? ['address']
    : c.street
      ? ['road']
      : c.district
        ? ['neighborhood']
        : c.city
          ? ['place']
          : c.state
            ? ['region']
            : ['poi'];
  // O contexto é sintetizado no formato v5 (`neighborhood.xxx`) porque é o que
  // `pickRegion` (useRegionResolver) e a UI já consomem.
  const context: Array<{ id: string; text: string }> = [];
  if (c.district) context.push({ id: `neighborhood.${c.district}`, text: c.district });
  if (c.city) {
    context.push({ id: `locality.${c.city}`, text: c.city });
    context.push({ id: `place.${c.city}`, text: c.city });
  }
  if (c.state) context.push({ id: `region.${c.state}`, text: c.state });
  if (c.postal_code) context.push({ id: `postcode.${c.postal_code}`, text: c.postal_code });
  if (c.country) context.push({ id: `country.${c.country}`, text: c.country });

  return {
    id: a.place_id ?? `${a.provider}:${a.formatted}`,
    place_name: a.formatted,
    text: primary,
    center,
    place_type: placeType,
    geometry: { type: 'Point', coordinates: center },
    context,
    properties: {
      provider: a.provider,
      precision: a.precision,
      retainable: a.retainable,
      ...(a.routable_point ? { routable_point: a.routable_point } : {}),
    },
  };
}

function routeToDirectionsRoute(r: GeoRoute): DirectionsRoute {
  return {
    distance: r.distance_m,
    duration: r.duration_s,
    geometry: toLineString(r.polyline ?? []),
    legs: (r.legs ?? []).map((l) => ({ distance: l.distance_m, duration: l.duration_s })),
  };
}

const EMPTY_GEOCODING: GeocodingResult = { features: [], attribution: '' };

// ── 9 hooks (mesma assinatura pública de useMapbox.ts) ──

/** Forward geocode: text query → list of place features */
export function useMapboxGeocode(query: string, enabled = true) {
  return useQuery<GeocodingResult>({
    queryKey: ['mapbox', 'geocode', query],
    queryFn: async () => {
      try {
        const addresses = await callGeo<GeoAddress[]>({
          action: 'geocode',
          address: query,
          country: 'br',
          language: 'pt',
          limit: 5,
        });
        return { features: (addresses ?? []).map(addressToFeature), attribution: 'Mapbox' };
      } catch (err) {
        // Endereço não encontrado é estado vazio da UI, não erro de tela.
        if (err instanceof GeoGatewayError && err.isNotFound) return EMPTY_GEOCODING;
        throw err;
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
    queryFn: async () => {
      try {
        const address = await callGeo<GeoAddress | null>({ action: 'reverse', lat, lng });
        return {
          features: address ? [addressToFeature(address)] : [],
          attribution: 'Mapbox',
        };
      } catch (err) {
        if (err instanceof GeoGatewayError && err.isNotFound) return EMPTY_GEOCODING;
        throw err;
      }
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
    mutationFn: async ({ coordinates, profile, alternatives }) => {
      if (coordinates.length < 2) throw new Error('Directions precisa de pelo menos 2 coordenadas');
      const points = coordinates.map(LngLat.from);
      const route = await callGeo<GeoRoute>({
        action: 'route',
        origin: points[0],
        destination: points[points.length - 1],
        waypoints: points.slice(1, -1),
        ...(profile ? { profile } : {}),
        ...(profile === 'driving' ? { traffic: false } : {}),
        ...(alternatives != null ? { alternatives } : {}),
      });
      return {
        routes: [routeToDirectionsRoute(route)],
        waypoints: points.map((p, i) => ({ name: `Ponto ${i + 1}`, location: LngLat.to(p) })),
      };
    },
  });
}

/** Distance/duration matrix between multiple points */
export function useMapboxMatrix() {
  return useMutation<MatrixResult, Error, {
    coordinates: [number, number][];
    profile?: string;
  }>({
    mutationFn: async ({ coordinates, profile }) => {
      if (coordinates.length === 0) throw new Error('Matriz precisa de pelo menos 1 coordenada');
      const points = coordinates.map(LngLat.from);
      const matrix = await callGeo<GeoMatrix>({
        action: 'matrix',
        origins: points,
        destinations: points,
        ...(profile ? { profile } : {}),
        ...(profile === 'driving' ? { traffic: false } : {}),
      });
      const rows = points.map((p, i) => ({ name: `Ponto ${i + 1}`, location: LngLat.to(p) }));
      return {
        distances: (matrix.distances_m ?? []).map((row) => row.map((v) => v ?? NaN)),
        durations: (matrix.durations_s ?? []).map((row) => row.map((v) => v ?? NaN)),
        sources: rows,
        destinations: rows,
      };
    },
  });
}

export function useMapboxIsochrone() {
  return useMutation<IsochroneResult, Error, { lng: number; lat: number; contours_minutes?: string; profile?: string }>({
    mutationFn: (params) => callGeo<IsochroneResult>({ action: 'isochrone', ...params }),
  });
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
    mutationFn: (params) => callGeo<OptimizationResult>({ action: 'optimization', ...params }),
  });
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
    mutationFn: async ({ coordinates, profile, timestamps, radiuses }) => {
      const points = coordinates.map(LngLat.from);
      const snap = await callGeo<GeoSnapResult>({
        action: 'snap',
        points,
        ...(profile ? { profile } : {}),
        ...(timestamps ? { timestamps } : {}),
        // radius_m é escalar no contrato; usa o maior raio pedido, limitado a 50 m
        ...(radiuses && radiuses.length > 0
          ? { radius_m: Math.min(50, Math.max(1, Math.round(Math.max(...radiuses)))) }
          : {}),
      });
      const geometry = snap.geometry ?? toLineString(snap.points ?? []);
      return {
        matchings: [{
          confidence: snap.confidence ?? 0,
          distance: snap.distance_m ?? 0,
          duration: snap.duration_s ?? 0,
          geometry,
          legs: (snap.legs ?? []).map((l) => ({ distance: l.distance_m, duration: l.duration_s })),
        }],
        tracepoints: (snap.points ?? []).map((p) => ({
          name: '',
          location: LngLat.to(p),
          matchings_index: 0,
          waypoint_index: 0,
        })),
        code: 'Ok',
      };
    },
  });
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
    mutationFn: async ({ lng, lat, zoom, width, height, style, markers, path }) => {
      const image = await callGeo<GeoStaticImage>({
        action: 'static',
        center: { lat, lng },
        ...(zoom != null ? { zoom } : {}),
        ...(width != null ? { width } : {}),
        ...(height != null ? { height } : {}),
        ...(style ? { style } : {}),
        ...(markers && markers.length > 0
          ? { markers: markers.slice(0, 10).map((m) => ({ lat: m.lat, lng: m.lng, ...(m.color ? { color: m.color } : {}), ...(m.label ? { label: m.label } : {}) })) }
          : {}),
        ...(path && path.length > 1 ? { path: path.map(LngLat.from) } : {}),
      });
      // `image` já é um data URL PNG — serve tanto para <img> quanto para download.
      return { image: image.image, width: image.width, height: image.height, url: '' };
    },
  });
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
    mutationFn: (params) => callGeo<TilequeryResult>({ action: 'tilequery', ...params }),
  });
}

// ── Chamadas imperativas ──

/** Imperative geocode call (for non-hook contexts) */
export async function geocodeAddress(query: string): Promise<MapboxFeature[]> {
  try {
    const addresses = await callGeo<GeoAddress[]>({
      action: 'geocode',
      address: query,
      country: 'br',
      language: 'pt',
      limit: 5,
    });
    return (addresses ?? []).map(addressToFeature);
  } catch (err) {
    if (err instanceof GeoGatewayError && err.isNotFound) return [];
    throw err;
  }
}

/** Imperative reverse geocode (for non-hook contexts, ex.: resolução de região em lote) */
export async function reverseGeocode(lng: number, lat: number): Promise<MapboxFeature | null> {
  try {
    const address = await callGeo<GeoAddress | null>({ action: 'reverse', lat, lng });
    return address ? addressToFeature(address) : null;
  } catch (err) {
    if (err instanceof GeoGatewayError && err.isNotFound) return null;
    throw err;
  }
}

/** Imperative directions call */
export async function getDirections(
  coordinates: [number, number][],
  profile = 'driving-traffic'
): Promise<DirectionsRoute | null> {
  if (coordinates.length < 2) return null;
  const points = coordinates.map(LngLat.from);
  try {
    const route = await callGeo<GeoRoute>({
      action: 'route',
      origin: points[0],
      destination: points[points.length - 1],
      waypoints: points.slice(1, -1),
      profile,
      ...(profile === 'driving' ? { traffic: false } : {}),
    });
    return routeToDirectionsRoute(route);
  } catch (err) {
    if (err instanceof GeoGatewayError && err.isNotFound) return null;
    throw err;
  }
}
