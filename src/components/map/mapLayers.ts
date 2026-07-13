import type mapboxgl from 'mapbox-gl';
import { statusColor as statusHsl } from '@/lib/statusPalette';

/**
 * Configura as fontes (sources) e camadas (layers) estáticas do mapa.
 *
 * Deve ser chamada dentro do handler `style.load` do Mapbox, pois camadas só
 * podem ser adicionadas após o estilo estar carregado. Todas as inserções são
 * idempotentes (verificam `getSource` antes de adicionar), permitindo re-execução
 * segura em trocas de estilo (dark <-> satellite).
 *
 * @param map      Instância ativa do mapa Mapbox.
 * @param showTraffic Quando verdadeiro, adiciona a camada vetorial de tráfego.
 */
export function setupMapLayers(map: mapboxgl.Map, showTraffic: boolean): void {
  // Stage 4: Dynamic Risk Clusters (Geofencing 2.0)
  if (!map.getSource('risk-zones')) {
    map.addSource('risk-zones', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { severity: 'high', name: 'Área de Alto Risco - Zona Sul' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-46.666, -23.570],
                [-46.640, -23.570],
                [-46.640, -23.550],
                [-46.666, -23.550],
                [-46.666, -23.570],
              ]],
            },
          },
          {
            type: 'Feature',
            properties: { severity: 'medium', name: 'Área de Atenção - Zona Norte' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-46.680, -23.500],
                [-46.650, -23.500],
                [-46.650, -23.480],
                [-46.680, -23.480],
                [-46.680, -23.500],
              ]],
            },
          },
        ],
      },
    });

    map.addLayer({
      id: 'risk-zones-fill',
      type: 'fill',
      source: 'risk-zones',
      paint: {
        'fill-color': [
          'match',
          ['get', 'severity'],
          'high', statusHsl('critical'),
          'medium', statusHsl('attention'),
          statusHsl('info'),
        ],
        'fill-opacity': 0.15,
      },
    });

    map.addLayer({
      id: 'risk-zones-outline',
      type: 'line',
      source: 'risk-zones',
      paint: {
        'line-color': [
          'match',
          ['get', 'severity'],
          'high', statusHsl('critical'),
          'medium', statusHsl('attention'),
          statusHsl('info'),
        ],
        'line-width': 2,
        'line-dasharray': [2, 1],
      },
    });
  }

  // Stage 8: Real-time Heatmap Integration
  if (!map.getSource('traffic-heatmap')) {
    map.addSource('traffic-heatmap', {
      type: 'geojson',
      data: 'https://docs.mapbox.com/mapbox-gl-js/assets/earthquakes.geojson',
    });

    map.addLayer({
      id: 'traffic-heatmap-layer',
      type: 'heatmap',
      source: 'traffic-heatmap',
      maxzoom: 15,
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'mag'], 0, 0, 6, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 20],
        'heatmap-opacity': 0.3,
      },
    }, 'waterway-label');
  }

  if (showTraffic && !map.getSource('mapbox-traffic')) {
    map.addSource('mapbox-traffic', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1',
    });
    map.addLayer({
      id: 'traffic-layer',
      type: 'line',
      source: 'mapbox-traffic',
      'source-layer': 'traffic',
      paint: {
        'line-width': 1.5,
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'congestion'],
          0, '#00ff00',
          25, '#ffff00',
          50, '#ff9900',
          75, '#ff0000',
          100, '#880000',
        ],
        'line-opacity': 0.6,
      },
    });
  }

  // Add Geofence Source
  if (!map.getSource('geofence')) {
    map.addSource('geofence', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'geofence-fill',
      type: 'fill',
      source: 'geofence',
      paint: {
        'fill-color': statusHsl('operational'),
        'fill-opacity': 0.1,
      },
    });

    map.addLayer({
      id: 'geofence-outline',
      type: 'line',
      source: 'geofence',
      paint: {
        'line-color': statusHsl('operational'),
        'line-width': 2,
        'line-dasharray': [2, 1],
      },
    });
  }
}
