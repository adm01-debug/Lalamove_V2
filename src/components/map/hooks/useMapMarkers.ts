import { useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { getDirections } from '@/hooks/useMapbox';
import { statusColor as statusHsl } from '@/lib/statusPalette';
import { vehicleColors } from '../types';
import {
  createDriverMarkerElement,
  createDriverPopup,
  createPickupMarkerElement,
  createDeliveryMarkerElement,
  createStoppedMarkerElement,
  createClusterMarkerElement,
  type MarkerDensity,
} from '../markerFactories';
import type { TrackingData } from './useTrackingData';

interface UseMapMarkersParams {
  /** Ref da instância ativa do Mapbox. Pode conter `null` durante remount. */
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  loading: boolean;
  trackingData: TrackingData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  focusMode: boolean;
  markerDensity: MarkerDensity;
  isFarZoom: boolean;
  isVeryFarZoom: boolean;
  veryFarZoomThreshold: number;
  offRouteAlerts: Set<string>;
  stoppedAlerts: Map<string, number>;
  stoppedThreshold: number;
}

interface UseMapMarkersResult {
  /**
   * Destroi todos os markers e limpa refs internas. Deve ser invocada no
   * cleanup do `useEffect` que instancia o `mapboxgl.Map`, garantindo que
   * uma nova instância (ex.: troca de estilo) comece com estado limpo.
   */
  resetMarkers: () => void;
}

/**
 * Encapsula o ciclo de vida dos marcadores do LiveMap: motoristas, coleta,
 * entrega, marcadores de "parado", rotas e clustering em zoom afastado.
 *
 * Responsabilidades:
 * - Animação suave (LERP 5%) da posição dos motoristas.
 * - Reconciliação idempotente entre `trackingData` e os markers ativos.
 * - Clustering por grade em zoom muito afastado (`isVeryFarZoom`).
 * - Cleanup completo via `resetMarkers` para trocas de estilo do mapa.
 */
export function useMapMarkers(params: UseMapMarkersParams): UseMapMarkersResult {
  const {
    mapRef,
    loading,
    trackingData,
    selectedId,
    onSelect,
    focusMode,
    markerDensity,
    isFarZoom,
    isVeryFarZoom,
    veryFarZoomThreshold,
    offRouteAlerts,
    stoppedAlerts,
    stoppedThreshold,
  } = params;

  const driverMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const markerPositions = useRef<Map<string, { current: [number, number]; target: [number, number] }>>(new Map());
  const pointMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const clusterMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const routeLines = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);

  const resetMarkers = useCallback(() => {
    driverMarkers.current.forEach(m => m.remove());
    driverMarkers.current.clear();
    markerPositions.current.clear();
    pointMarkers.current.forEach(m => m.remove());
    pointMarkers.current.clear();
    clusterMarkers.current.forEach(m => m.remove());
    clusterMarkers.current.clear();
    routeLines.current.clear();
  }, []);

  // Animation loop — interpolação linear suave entre posição atual e target.
  useEffect(() => {
    const animate = () => {
      if (mapRef.current) {
        markerPositions.current.forEach((pos, id) => {
          const marker = driverMarkers.current.get(id);
          if (!marker) return;
          const lerpFactor = 0.05;
          const newLng = pos.current[0] + (pos.target[0] - pos.current[0]) * lerpFactor;
          const newLat = pos.current[1] + (pos.target[1] - pos.current[1]) * lerpFactor;
          pos.current = [newLng, newLat];
          marker.setLngLat(pos.current);
        });
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [mapRef]);

  // Reconciliação de markers, rotas e stops.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    const currentIds = new Set(trackingData.map(t => t.id));
    const effectiveDensity: MarkerDensity = isFarZoom ? 'compact' : markerDensity;

    driverMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkers.current.delete(id);
        markerPositions.current.delete(id);
      }
    });

    trackingData.forEach((tracking) => {
      const isSelected = tracking.id === selectedId;
      const isOtherInFocus = focusMode && !!selectedId && !isSelected;
      const targetPos: [number, number] = [tracking.current_longitude, tracking.current_latitude];

      const existingDriverMarker = driverMarkers.current.get(tracking.id);
      if (existingDriverMarker) {
        const pos = markerPositions.current.get(tracking.id);
        if (pos) pos.target = targetPos;
        else markerPositions.current.set(tracking.id, { current: targetPos, target: targetPos });

        const el = createDriverMarkerElement(tracking, isSelected, effectiveDensity);
        const domEl = existingDriverMarker.getElement();
        domEl.innerHTML = el.innerHTML;
        domEl.className = el.className + (offRouteAlerts.has(tracking.id) ? ' deviated-marker' : '');
        domEl.style.opacity = isOtherInFocus ? '0.15' : '1';
        domEl.style.filter = isOtherInFocus ? 'grayscale(0.8) blur(1px)' : 'none';
        domEl.style.pointerEvents = isOtherInFocus ? 'none' : 'auto';

        if (existingDriverMarker.getPopup()?.isOpen()) {
          existingDriverMarker.setPopup(createDriverPopup(tracking));
        }
      } else {
        const el = createDriverMarkerElement(tracking, isSelected, effectiveDensity);
        if (offRouteAlerts.has(tracking.id)) el.classList.add('deviated-marker');
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(targetPos)
          .setPopup(createDriverPopup(tracking))
          .addTo(map);
        markerPositions.current.set(tracking.id, { current: targetPos, target: targetPos });
        marker.getElement().addEventListener('click', () => onSelect(tracking.id));
        driverMarkers.current.set(tracking.id, marker);
      }

      // Pickup/Delivery markers.
      if (tracking.order?.pickup_latitude && tracking.order?.pickup_longitude) {
        const pickupId = `${tracking.id}-pickup`;
        if (!pointMarkers.current.has(pickupId)) {
          const el = createPickupMarkerElement(tracking);
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([tracking.order.pickup_longitude, tracking.order.pickup_latitude])
            .addTo(map);
          pointMarkers.current.set(pickupId, marker);
        }
        const pMarker = pointMarkers.current.get(pickupId);
        if (pMarker) pMarker.getElement().style.opacity = isOtherInFocus ? '0.1' : '1';
      }

      if (tracking.order?.delivery_latitude && tracking.order?.delivery_longitude) {
        const deliveryId = `${tracking.id}-delivery`;
        if (!pointMarkers.current.has(deliveryId)) {
          const el = createDeliveryMarkerElement(tracking);
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([tracking.order.delivery_longitude, tracking.order.delivery_latitude])
            .addTo(map);
          pointMarkers.current.set(deliveryId, marker);
        }
        const dMarker = pointMarkers.current.get(deliveryId);
        if (dMarker) dMarker.getElement().style.opacity = isOtherInFocus ? '0.1' : '1';
      }

      // Route line — inserção idempotente via routeLines Set.
      if (
        tracking.order?.pickup_latitude && tracking.order?.pickup_longitude &&
        tracking.order?.delivery_latitude && tracking.order?.delivery_longitude &&
        !routeLines.current.has(tracking.id)
      ) {
        const sourceId = `route-${tracking.id}`;
        const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
        const color = vehicleColors[vehicleType] || '#00d9ff';
        routeLines.current.add(tracking.id);

        if (map.isStyleLoaded()) {
          const waypoints: [number, number][] = [
            [tracking.order.pickup_longitude, tracking.order.pickup_latitude],
            [tracking.current_longitude, tracking.current_latitude],
            [tracking.order.delivery_longitude, tracking.order.delivery_latitude],
          ];
          getDirections(waypoints, 'driving-traffic')
            .then((route) => {
              if (!mapRef.current || !mapRef.current.isStyleLoaded() || mapRef.current.getSource(sourceId)) return;
              const routeGeometry = route?.geometry || { type: 'LineString', coordinates: waypoints };
              mapRef.current.addSource(sourceId, {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: routeGeometry as GeoJSON.Geometry },
              });
              mapRef.current.addLayer({
                id: sourceId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                  'line-color': color,
                  'line-width': isSelected ? 6 : 4,
                  'line-opacity': isOtherInFocus ? 0.05 : 0.7,
                },
              });
            })
            .catch(() => {
              if (!mapRef.current?.isStyleLoaded() || mapRef.current?.getSource(sourceId)) return;
              mapRef.current?.addSource(sourceId, {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: waypoints } },
              });
              mapRef.current?.addLayer({
                id: sourceId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                  'line-color': color,
                  'line-width': 3,
                  'line-opacity': isOtherInFocus ? 0.05 : 0.6,
                  'line-dasharray': [2, 2],
                },
              });
            });
        }
      } else if (routeLines.current.has(tracking.id) && map.getLayer(`route-${tracking.id}`)) {
        map.setPaintProperty(`route-${tracking.id}`, 'line-opacity', isOtherInFocus ? 0.05 : (isSelected ? 0.8 : 0.6));
        map.setPaintProperty(`route-${tracking.id}`, 'line-width', isSelected ? 6 : 4);

        if (isSelected && !tracking.is_stopped) {
          const isOff = tracking.is_on_route === false;
          if (isOff) {
            map.setPaintProperty(`route-${tracking.id}`, 'line-color', statusHsl('critical'));
          } else {
            const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
            map.setPaintProperty(`route-${tracking.id}`, 'line-color', vehicleColors[vehicleType]);
          }
        }
      }

      // Stopped marker: aparece a partir de `stoppedThreshold` minutos.
      if (tracking.is_stopped) {
        const startTime = stoppedAlerts.get(tracking.id);
        const durationMin = startTime ? Math.floor((Date.now() - startTime) / 60000) : 0;
        if (durationMin >= stoppedThreshold) {
          const stoppedMarkerId = `stopped-${tracking.id}`;
          if (!pointMarkers.current.has(stoppedMarkerId)) {
            const el = createStoppedMarkerElement(tracking, durationMin);
            const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat([tracking.current_longitude, tracking.current_latitude])
              .addTo(map);
            pointMarkers.current.set(stoppedMarkerId, marker);
          } else {
            const marker = pointMarkers.current.get(stoppedMarkerId);
            if (marker) {
              const el = createStoppedMarkerElement(tracking, durationMin);
              marker.getElement().innerHTML = el.innerHTML;
            }
          }
        }
      } else {
        const stoppedMarkerId = `stopped-${tracking.id}`;
        if (pointMarkers.current.has(stoppedMarkerId)) {
          pointMarkers.current.get(stoppedMarkerId)?.remove();
          pointMarkers.current.delete(stoppedMarkerId);
        }
      }
    });

    // Auto-fit apenas quando não há seleção ativa.
    if (!selectedId && trackingData.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      trackingData.forEach(t => bounds.extend([t.current_longitude, t.current_latitude]));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 100, maxZoom: 14 });
    }
  }, [
    mapRef, trackingData, loading, selectedId, focusMode, markerDensity,
    isFarZoom, offRouteAlerts, stoppedAlerts, stoppedThreshold, onSelect,
  ]);

  // Clustering em zoom muito afastado.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    const clearClusters = () => {
      clusterMarkers.current.forEach(m => m.remove());
      clusterMarkers.current.clear();
    };
    const setDriverVisibility = (visible: boolean) => {
      driverMarkers.current.forEach(m => { m.getElement().style.display = visible ? '' : 'none'; });
      pointMarkers.current.forEach(m => { m.getElement().style.display = visible ? '' : 'none'; });
    };

    if (!isVeryFarZoom) {
      clearClusters();
      setDriverVisibility(true);
      return;
    }

    setDriverVisibility(false);

    const cellSize = 0.06; // ~6 km
    const cells = new Map<string, {
      lngSum: number; latSum: number; count: number;
      critical: number; attention: number; operational: number;
      byVehicle: Record<string, number>;
      bounds: mapboxgl.LngLatBounds;
    }>();

    trackingData.forEach(t => {
      const key = `${Math.floor(t.current_longitude / cellSize)}:${Math.floor(t.current_latitude / cellSize)}`;
      const cell = cells.get(key) ?? {
        lngSum: 0, latSum: 0, count: 0,
        critical: 0, attention: 0, operational: 0,
        byVehicle: {} as Record<string, number>,
        bounds: new mapboxgl.LngLatBounds(),
      };
      cell.lngSum += t.current_longitude;
      cell.latSum += t.current_latitude;
      cell.count += 1;
      if (t.is_on_route === false) cell.critical += 1;
      else if (t.is_stopped) cell.attention += 1;
      else cell.operational += 1;
      const vType = t.driver?.vehicle_type || 'MOTORCYCLE';
      cell.byVehicle[vType] = (cell.byVehicle[vType] || 0) + 1;
      cell.bounds.extend([t.current_longitude, t.current_latitude]);
      cells.set(key, cell);
    });

    const activeKeys = new Set(cells.keys());
    clusterMarkers.current.forEach((marker, key) => {
      if (!activeKeys.has(key)) {
        marker.remove();
        clusterMarkers.current.delete(key);
      }
    });

    cells.forEach((cell, key) => {
      const center: [number, number] = [cell.lngSum / cell.count, cell.latSum / cell.count];
      const el = createClusterMarkerElement({
        count: cell.count,
        critical: cell.critical,
        attention: cell.attention,
        operational: cell.operational,
        byVehicle: cell.byVehicle,
      });
      el.addEventListener('click', () => {
        if (!mapRef.current) return;
        if (cell.bounds.isEmpty()) {
          mapRef.current.flyTo({ center, zoom: veryFarZoomThreshold + 2, duration: 900 });
        } else {
          mapRef.current.fitBounds(cell.bounds, { padding: 120, maxZoom: 14, duration: 900 });
        }
      });

      const existing = clusterMarkers.current.get(key);
      if (existing) {
        existing.getElement().innerHTML = el.innerHTML;
        existing.setLngLat(center);
      } else {
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(center)
          .addTo(map);
        clusterMarkers.current.set(key, marker);
      }
    });
  }, [mapRef, trackingData, loading, isVeryFarZoom, veryFarZoomThreshold]);

  return { resetMarkers };
}
