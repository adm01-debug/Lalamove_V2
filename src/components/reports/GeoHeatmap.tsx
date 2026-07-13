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
// Fonte separada com clustering para os pontos individuais/aglomerados.
// A camada de calor continua usando a fonte não-clusterizada (SOURCE_ID),
// pois heatmap exige pontos brutos, não agregados.
const CLUSTER_SOURCE = 'deliveries-clustered';
const CLUSTER_LAYER = 'deliveries-clusters';
const CLUSTER_COUNT_LAYER = 'deliveries-cluster-count';
const POINT_LAYER = 'deliveries-point';

/** Rótulo descritivo da métrica ativa exibido na legenda. */
const METRIC_LABEL: Record<HeatmapMetric, string> = {
  volume: 'Densidade de entregas',
  cost: 'Concentração de custo',
  delay: 'Concentração de atraso',
};

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
      properties: {
        weight: Math.min(1, rawValue(p) / max),
        cost: p.cost,
        delay: p.delay,
      },
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
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource(CLUSTER_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      map.addLayer({
        id: HEATMAP_LAYER,
        type: 'heatmap',
        source: SOURCE_ID,
        maxzoom: 15,
        paint: {
          'heatmap-weight':
            metric === 'volume' ? 1 : ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
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

      // Círculos de cluster: raio/cor escalam pela quantidade de pontos.
      map.addLayer({
        id: CLUSTER_LAYER,
        type: 'circle',
        source: CLUSTER_SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            'rgb(103,169,207)', 25,
            'rgb(253,219,199)', 100,
            'rgb(239,138,98)', 500,
            'rgb(178,24,43)',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            14, 25, 18, 100, 24, 500, 30,
          ],
          'circle-opacity': 0.85,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      });

      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: 'symbol',
        source: CLUSTER_SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#0f172a' },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: CLUSTER_SOURCE,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 16, 8],
          'circle-color': 'rgb(239,138,98)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.9,
        },
      });

      // Popup com detalhes da entrega ao clicar num ponto individual.
      const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
      const currencyFmt = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });

      // Zoom ao clicar num cluster, expandindo-o.
      map.on('click', CLUSTER_LAYER, (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] })[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null || feature.geometry.type !== 'Point') return;
        const center = feature.geometry.coordinates as [number, number];
        const source = map.getSource(CLUSTER_SOURCE) as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({ center, zoom });
        });
      });

      map.on('mouseenter', CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CLUSTER_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', POINT_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== 'Point') return;

        const coords = feature.geometry.coordinates.slice() as [number, number];
        const cost = Number(feature.properties?.cost ?? 0);
        const delay = Number(feature.properties?.delay ?? 0);

        // Evita saltos de longitude ao dar zoom em wrap-around.
        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        const delayLabel =
          delay > 0
            ? `<span style="color:#ef4444">+${delay} min de atraso</span>`
            : '<span style="color:#22c55e">No prazo</span>';

        popup
          .setLngLat(coords)
          .setHTML(
            `<div style="font-size:12px;line-height:1.5;color:#0f172a">
               <strong>Entrega</strong><br/>
               Custo: ${currencyFmt.format(Number.isFinite(cost) ? cost : 0)}<br/>
               ${delayLabel}
             </div>`,
          )
          .addTo(map);
      });

      map.on('mouseenter', POINT_LAYER, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', POINT_LAYER, () => {
        map.getCanvas().style.cursor = '';
      });

      setReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [mapboxToken]);

  // Atualiza os dados, o peso da métrica e reenquadra o mapa quando mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(geojson);

    const clusterSource = map.getSource(CLUSTER_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    clusterSource?.setData(geojson);

    if (map.getLayer(HEATMAP_LAYER)) {
      map.setPaintProperty(
        HEATMAP_LAYER,
        'heatmap-weight',
        metric === 'volume'
          ? 1
          : (['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1] as unknown as number),
      );
    }

    if (geojson.features.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      geojson.features.forEach((f) => bounds.extend(f.geometry.coordinates as [number, number]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 600 });
    }
  }, [geojson, metric, ready]);

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
      {ready && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-background/85 px-3 py-2 shadow-sm backdrop-blur-sm">
          <p className="mb-1 text-[11px] font-medium text-foreground">{METRIC_LABEL[metric]}</p>
          <div
            className="h-2 w-32 rounded-full"
            style={{
              background:
                'linear-gradient(to right, rgb(103,169,207), rgb(209,229,240), rgb(253,219,199), rgb(239,138,98), rgb(178,24,43))',
            }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Menor</span>
            <span>Maior</span>
          </div>
        </div>
      )}
    </div>
  );
}
