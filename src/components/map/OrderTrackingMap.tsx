import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from './hooks/useMapboxToken';
import { parseExpectedRoute } from './hooks/useMapMarkers';
import { setExpectedRoute } from './mapLayers';
import { countMapLoad } from '@/lib/geo-gateway';

export interface OrderTrackingMapProps {
  /** Coordenadas de coleta (colunas `pickup_latitude`/`pickup_longitude` do pedido). */
  pickup?: { lat: number | null; lng: number | null } | null;
  /** Coordenadas de entrega. */
  delivery?: { lat: number | null; lng: number | null } | null;
  /** Posição atual do motorista, quando o pedido está em rota. */
  driver?: { lat: number | null; lng: number | null } | null;
  /** Polyline contratada (`active_tracking.expected_route`), normalizada por `parseExpectedRoute`. */
  expectedRoute?: unknown;
  className?: string;
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function pointFeature(lng: number, lat: number, color: string): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { color },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    }],
  };
}

function valid(lat?: number | null, lng?: number | null): boolean {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng);
}

/**
 * Mini-mapa de acompanhamento dentro do detalhe do pedido: coleta, entrega, motorista
 * e a rota contratada. Reusa o token do `get-mapbox-token` (nunca hardcoded) e as mesmas
 * camadas do LiveMap, então o traçado exibido é o consumido pelo cálculo de desvio.
 */
export function OrderTrackingMap({ pickup, delivery, driver, expectedRoute, className = '' }: OrderTrackingMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ready = useRef(false);
  const { mapboxToken, error } = useMapboxToken();

  const points: [number, number][] = [];
  if (pickup && valid(pickup.lat, pickup.lng)) points.push([pickup.lng!, pickup.lat!]);
  if (delivery && valid(delivery.lat, delivery.lng)) points.push([delivery.lng!, delivery.lat!]);
  if (driver && valid(driver.lat, driver.lng)) points.push([driver.lng!, driver.lat!]);
  const center: [number, number] = points[0] ?? [-46.6544, -23.5629];

  /** Reaplica dados; chamado no `style.load` e a cada mudança de props. */
  const apply = () => {
    const m = map.current;
    if (!m || !ready.current) return;

    const set = (id: string, data: GeoJSON.FeatureCollection) => {
      const src = m.getSource(id) as mapboxgl.GeoJSONSource | undefined;
      src?.setData(data);
    };

    set('pickup-point', valid(pickup?.lat, pickup?.lng) ? pointFeature(pickup!.lng!, pickup!.lat!, '#22c55e') : EMPTY);
    set('delivery-point', valid(delivery?.lat, delivery?.lng) ? pointFeature(delivery!.lng!, delivery!.lat!, '#f97316') : EMPTY);
    set('driver-point', driver && valid(driver.lat, driver.lng) ? pointFeature(driver.lng!, driver.lat!, '#38bdf8') : EMPTY);
    setExpectedRoute(m, parseExpectedRoute(expectedRoute));

    if (points.length >= 2) {
      const bounds = points.reduce(
        (b, p) => b.extend(p as [number, number]),
        new mapboxgl.LngLatBounds(points[0], points[0]),
      );
      m.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
    }
  };

  useEffect(() => {
    if (!container.current || !mapboxToken || map.current) return;
    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: points.length > 1 ? 10 : 13,
      attributionControl: false,
    });
    countMapLoad('mapbox');

    map.current.on('style.load', () => {
      const m = map.current;
      if (!m) return;
      if (!m.getSource('pickup-point')) {
        m.addSource('pickup-point', { type: 'geojson', data: EMPTY });
        m.addLayer({ id: 'pickup-point', type: 'circle', source: 'pickup-point', paint: {
          'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        } });
        m.addSource('delivery-point', { type: 'geojson', data: EMPTY });
        m.addLayer({ id: 'delivery-point', type: 'circle', source: 'delivery-point', paint: {
          'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        } });
        m.addSource('driver-point', { type: 'geojson', data: EMPTY });
        m.addLayer({ id: 'driver-point', type: 'circle', source: 'driver-point', paint: {
          'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
        } });
        m.addSource('expected-route', { type: 'geojson', data: EMPTY });
        m.addLayer({ id: 'expected-route', type: 'line', source: 'expected-route', layout: {
          'line-join': 'round', 'line-cap': 'round',
        }, paint: { 'line-color': '#38bdf8', 'line-width': 4, 'line-opacity': 0.9 } });
      }
      ready.current = true;
      apply();
    });

    return () => {
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);


  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, delivery?.lat, delivery?.lng, driver?.lat, driver?.lng, expectedRoute]);

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-secondary/40 text-xs text-muted-foreground ${className}`}>
        Mapa indisponível no momento.
      </div>
    );
  }

  return (
    <div
      ref={container}
      className={`rounded-lg overflow-hidden ${className}`}
      role="img"
      aria-label="Mapa do trajeto do pedido com coleta, entrega e posição do motorista"
    />
  );
}
