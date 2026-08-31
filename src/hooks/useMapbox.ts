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

async function mapboxProxy<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('mapbox-proxy', { body });
  if (error) throw error;
  return data as T;
}

// ── Hooks ──

/** Forward geocode: text query → list of place features */
export function useMapboxGeocode(query: string, enabled = true) {
  return useQuery<GeocodingResult>({
    queryKey: ['mapbox', 'geocode', query],
    queryFn: () => mapboxProxy<GeocodingResult>({
      action: 'geocode',
      query,
      country: 'br',
      language: 'pt',
      limit: 5,
      types: 'address,place,poi,neighborhood',
    }),
    enabled: enabled && query.length >= 3,
    staleTime: 5 * 60_000,
  });
}

/** Reverse geocode: coordinates → place name */
export function useMapboxReverseGeocode(lng: number | null, lat: number | null) {
  return useQuery<GeocodingResult>({
    queryKey: ['mapbox', 'reverse', lng, lat],
    queryFn: () => mapboxProxy<GeocodingResult>({
      action: 'reverse-geocode',
      lng,
      lat,
    }),
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
    mutationFn: (params) => mapboxProxy<DirectionsResult>({
      action: 'directions',
      ...params,
    }),
  });
}

/** Distance/duration matrix between multiple points */
export function useMapboxMatrix() {
  return useMutation<MatrixResult, Error, {
    coordinates: [number, number][];
    profile?: string;
  }>({
    mutationFn: (params) => mapboxProxy<MatrixResult>({
      action: 'matrix',
      ...params,
    }),
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
    mutationFn: (params) => mapboxProxy<IsochroneResult>({ action: 'isochrone', ...params }),
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
    mutationFn: (params) => mapboxProxy<OptimizationResult>({
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
    mutationFn: (params) => mapboxProxy<MapMatchingResult>({
      action: 'map-matching',
      ...params,
    }),
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
    mutationFn: (params) => mapboxProxy<StaticImageResult>({
      action: 'static-image',
      ...params,
    }),
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
    mutationFn: (params) => mapboxProxy<TilequeryResult>({ action: 'tilequery', ...params }),
  });
}

/** Imperative geocode call (for non-hook contexts) */
export async function geocodeAddress(query: string): Promise<MapboxFeature[]> {
  const result = await mapboxProxy<GeocodingResult>({
    action: 'geocode',
    query,
    country: 'br',
    language: 'pt',
    limit: 5,
  });
  return result.features || [];
}

/** Imperative directions call */
export async function getDirections(
  coordinates: [number, number][],
  profile = 'driving-traffic'
): Promise<DirectionsRoute | null> {
  const result = await mapboxProxy<DirectionsResult>({
    action: 'directions',
    coordinates,
    profile,
    geometries: 'geojson',
    overview: 'full',
  });
  return result.routes?.[0] || null;
}
