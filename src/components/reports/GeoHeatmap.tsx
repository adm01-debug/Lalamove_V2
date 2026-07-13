import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { useMapboxToken } from '@/components/map/hooks/useMapboxToken';
import type { WeightedGeoPoint } from '@/hooks/useAdvancedReports';

/** Métrica usada para ponderar a densidade do heatmap. */
export type HeatmapMetric = 'volume' | 'cost' | 'delay';

export interface GeoHeatmapProps {
  /** Pontos de entrega com métricas (lat/lng + custo + atraso). */
  points: WeightedGeoPoint[];
  /** Métrica que define o peso de cada ponto no mapa de calor. */
  metric?: HeatmapMetric;
  /** Altura do canvas do mapa em pixels. */
  height?: number;
}

const SOURCE_ID = 'deliveries';
const HEATMAP_LAYER = 'deliveries-heat';
const POINT_LAYER = 'deliveries-point';

/**
 * Heatmap geográfico interativo (Mapbox GL) das entregas.
 *
 * A camada de calor evidencia zonas de maior densidade de entregas; ao dar
 * zoom, os pontos individuais passam a ser exibidos. O componente é defensivo:
 * ignora coordenadas inválidas, aguarda o token e limpa a instância no unmount.
 */
export function GeoHeatmap({ points, metric = 'volume', height = 360 }: GeoHeatmapProps) {
  const { mapboxToken, error: tokenError } = useMapboxToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // GeoJSON estável a partir das coordenadas válidas, com peso normalizado (0–1)
  // conforme a métrica escolhida. Volume atribui peso uniforme a cada entrega.
  const geojson = useMemo(() => {
    const valid = points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0),
    );
    const rawValue = (p: (typeof valid)[number]) =>
      metric === 'cost' ? p.cost : metric === 'delay' ? p.delay : 1;
    const max = metric === 'volume' ? 1 : Math.max(1, ...valid.map(rawValue));
    const features = valid.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { weight: Math.min(1, rawValue(p) / max) },
    }));
    return { type: 'FeatureCollection' as const, features };
  }, [points, metric]);

  // Inicializa o mapa uma única vez quando o token estiver disponível.
  useEffect(() => {
    if (!mapboxToken || mapRef.current || !containerRef.current) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-46.63, -23.55],
      zoom: 9,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

      map.addLayer({
        id: HEATMAP_LAYER,
        type: 'heatmap',
        source: SOURCE_ID,
        maxzoom: 15,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 15, 30],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 15, 0.4],
        },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        minzoom: 12,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 8],
          'circle-color': 'rgb(239,138,98)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, 0.8],
        },
      });

      setReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [mapboxToken, geojson]);

  // Atualiza os dados e reenquadra o mapa quando os pontos mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(geojson);

    if (geojson.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      geojson.features.forEach((f) => bounds.extend(f.geometry.coordinates as [number, number]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 600 });
    }
  }, [geojson, ready]);

  if (tokenError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground"
        style={{ height }}
      >
        <AlertTriangle className="w-5 h-5 text-warning" />
        <span>{tokenError}</span>
      </div>
    );
  }

  if (geojson.features.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground"
        style={{ height }}
      >
        <MapPin className="w-5 h-5" />
        <span>Sem coordenadas de entrega para exibir no mapa.</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-muted/40 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Carregando mapa de calor…</span>
        </div>
      )}
    </div>
  );
}
