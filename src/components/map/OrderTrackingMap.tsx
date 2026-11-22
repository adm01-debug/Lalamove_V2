import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapboxToken } from './hooks/useMapboxToken';
import { getGoogleMapsMapId, loadGoogleMaps } from './hooks/useGoogleMapsLoader';
import { parseExpectedRoute } from './hooks/useMapMarkers';
import { toGooglePath, type LatLngLiteral } from './googleLayers';
import { setExpectedRoute } from './mapLayers';
import { countMapLoad } from '@/lib/geo-gateway';
import { useTilesProvider } from '@/hooks/useMapProviderPolicy';

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

/** Subconjunto da Google Maps JS API usado por este mini-mapa (etapa 58). */
interface GoogleMapsNamespace {
  Map: new (el: HTMLElement, opts: unknown) => GoogleMapInstance;
  Marker: new (opts: unknown) => GoogleMarkerInstance;
  Polyline: new (opts: unknown) => GooglePolylineInstance;
  LatLngBounds: new () => { extend(p: LatLngLiteral): void };
  SymbolPath: { CIRCLE: unknown };
  event: { trigger(instance: unknown, name: string): void };
}
interface GoogleMapInstance {
  fitBounds(bounds: unknown, padding?: number): void;
}
interface GoogleMarkerInstance {
  setMap(map: unknown): void;
}
interface GooglePolylineInstance {
  setPath(path: LatLngLiteral[]): void;
}

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

  // Etapa 58: o mapa base segue `geo_settings.tiles` (mesma política do `LiveMap`).
  // Com Google ativo o `mapboxgl.Map` não é instanciado — sem isso cada mini-mapa
  // queimaria um map load do Mapbox sem estar visível.
  const { data: tilesProvider } = useTilesProvider();
  const useGoogle = tilesProvider === 'google';
  const googleMap = useRef<GoogleMapInstance | null>(null);
  const googleRoute = useRef<GooglePolylineInstance | null>(null);
  const googleMarkers = useRef<GoogleMarkerInstance[]>([]);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState(false);

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

  /** Mesma semântica do `apply`, no canvas Google. */
  const applyGoogle = () => {
    const m = googleMap.current;
    if (!m) return;
    const g = window.google as unknown as { maps: GoogleMapsNamespace };
    const path = toGooglePath(expectedRoute);

    if (googleRoute.current) {
      googleRoute.current.setPath(path);
    } else if (path.length > 1) {
      googleRoute.current = new g.maps.Polyline({
        path, map: m, strokeColor: '#38bdf8', strokeWeight: 4, strokeOpacity: 0.9,
      });
    }

    const wanted = [
      { lat: pickup?.lat ?? null, lng: pickup?.lng ?? null, color: '#22c55e' },
      { lat: delivery?.lat ?? null, lng: delivery?.lng ?? null, color: '#f97316' },
      { lat: driver?.lat ?? null, lng: driver?.lng ?? null, color: '#38bdf8' },
    ];
    googleMarkers.current.forEach((mk) => mk.setMap(null));
    googleMarkers.current = wanted
      .filter((w) => valid(w.lat, w.lng))
      .map((w) => new g.maps.Marker({
        position: { lat: w.lat!, lng: w.lng! },
        map: m,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: w.color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      }));

    if (points.length >= 2) {
      g.maps.event.trigger(m, 'resize');
      const bounds = new g.maps.LatLngBounds();
      points.forEach((p) => bounds.extend({ lat: p[1], lng: p[0] }));
      m.fitBounds(bounds, 48);
    }
  };

  useEffect(() => {
    if (useGoogle) return;
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

  // Etapa 58: montagem do canvas Google. Só roda quando `geo_settings.tiles = google`,
  // então o bundle/`mapbox-gl` continua sendo o único caminho padrão.
  useEffect(() => {
    if (!useGoogle || !container.current || googleMap.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !container.current || googleMap.current) return;
        const g = window.google as unknown as { maps: GoogleMapsNamespace };
        const mapId = getGoogleMapsMapId();
        googleMap.current = new g.maps.Map(container.current, {
          center: { lat: center[1], lng: center[0] },
          zoom: points.length > 1 ? 10 : 13,
          disableDefaultUI: true,
          gestureHandling: 'cooperative',
          ...(mapId ? { mapId } : {}),
        });
        // Etapa 80: o load é cobrado do provedor que desenhou o mapa.
        countMapLoad('google');
        setGoogleReady(true);
      })
      .catch(() => {
        if (!cancelled) setGoogleError(true);
      });
    return () => {
      cancelled = true;
      googleRoute.current = null;
      googleMarkers.current = [];
      googleMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGoogle]);

  useEffect(() => {
    if (!googleReady) return;
    applyGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady, pickup?.lat, pickup?.lng, delivery?.lat, delivery?.lng, driver?.lat, driver?.lng, expectedRoute]);

  const mapError = useGoogle ? googleError : Boolean(error);

  if (mapError) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-secondary/40 text-xs text-muted-foreground ${className}`}>
        Mapa indisponível no momento.
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      <div
        ref={container}
        className="w-full h-full"
        role="img"
        aria-label="Mapa do trajeto do pedido com coleta, entrega e posição do motorista"
      />
      {/* Termos Mapbox: a atribuição precisa ficar visível. O controle nativo
          fica desligado para não competir com o HUD deste mapa pequeno, então
          a atribuição é renderizada como texto fixo no canto. Com o canvas
          Google o provedor desenha a própria atribuição. */}
      {!useGoogle && (
        <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl bg-background/70 px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
          © Mapbox © OpenStreetMap
        </span>
      )}
    </div>
  );
}
