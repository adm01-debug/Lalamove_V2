import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2 } from 'lucide-react';
import { useTrackingHistory } from '@/hooks/useTrackingHistory';
import { getDirections } from '@/hooks/useMapbox';
import { useMapboxToken } from './hooks/useMapboxToken';
import { useTrackingData, type TrackingData } from './hooks/useTrackingData';
import { MapSearchPanel } from './MapSearchPanel';
import { MapHistoryPanel } from './MapHistoryPanel';
import { MapLegend } from './MapLegend';
import { vehicleIcons, vehicleColors, type VehicleFilter, type StatusFilter } from './types';
import { createDriverMarkerElement, createPickupMarkerElement, createDeliveryMarkerElement, createDriverPopup } from './markerFactories';

export type { VehicleFilter, StatusFilter };

interface LiveMapProps {
  className?: string;
  showControls?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  vehicleFilter?: VehicleFilter;
  statusFilter?: StatusFilter;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function LiveMap({ 
  className = '', 
  showControls = true,
  initialCenter = [-46.6544, -23.5629],
  initialZoom = 12,
  vehicleFilter = 'ALL',
  statusFilter = 'ALL',
}: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const pointMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const routeLines = useRef<Set<string>>(new Set());
  const historyLineRef = useRef<string | null>(null);
  const historyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracking, setSelectedTracking] = useState<string | null>(null);
  const [showHistoryFor, setShowHistoryFor] = useState<{ driverId: string; orderId: string; driverName: string } | null>(null);

  const { mapboxToken, error } = useMapboxToken();
  const { trackingData, allTrackingData } = useTrackingData(vehicleFilter, statusFilter);
  const { history, loading: historyLoading, fetchHistory, clearHistory } = useTrackingHistory();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;
    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: initialCenter,
      zoom: initialZoom,
      pitch: 45,
    });
    if (showControls) {
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    }
    map.current.on('load', () => setLoading(false));
    return () => {
      driverMarkers.current.forEach(marker => marker.remove());
      driverMarkers.current.clear();
      pointMarkers.current.forEach(marker => marker.remove());
      pointMarkers.current.clear();
      routeLines.current.clear();
      map.current?.remove();
    };
  }, [mapboxToken, initialCenter, initialZoom, showControls]);

  // Focus on search result
  const focusOnTracking = useCallback((tracking: TrackingData) => {
    if (!map.current) return;
    map.current.flyTo({ center: [tracking.current_longitude, tracking.current_latitude], zoom: 15, duration: 1000 });
    const marker = driverMarkers.current.get(tracking.id);
    if (marker) marker.togglePopup();
  }, []);

  // Handle show history event from popup
  useEffect(() => {
    const handleShowHistory = (e: CustomEvent<{ driverId: string; orderId: string; driverName: string }>) => {
      setShowHistoryFor(e.detail);
      fetchHistory(e.detail.driverId, e.detail.orderId, 200);
    };
    window.addEventListener('show-driver-history', handleShowHistory as EventListener);
    return () => window.removeEventListener('show-driver-history', handleShowHistory as EventListener);
  }, [fetchHistory]);

  // Clear history line and markers
  const clearHistoryFromMap = useCallback(() => {
    if (map.current && historyLineRef.current) {
      if (map.current.getLayer(historyLineRef.current)) map.current.removeLayer(historyLineRef.current);
      if (map.current.getSource(historyLineRef.current)) map.current.removeSource(historyLineRef.current);
      historyLineRef.current = null;
    }
    historyMarkersRef.current.forEach(marker => marker.remove());
    historyMarkersRef.current = [];
  }, []);

  // Draw history line on map
  useEffect(() => {
    if (!map.current || !showHistoryFor || history.length < 2) return;
    clearHistoryFromMap();
    const sourceId = `history-line-${showHistoryFor.driverId}`;
    historyLineRef.current = sourceId;
    const coordinates = history.map(event => [event.longitude, event.latitude]);
    if (!map.current.isStyleLoaded()) return;

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }
    });
    map.current.addLayer({
      id: sourceId, type: 'line', source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#8b5cf6', 'line-width': 4, 'line-opacity': 0.8 }
    });

    // Start marker
    const startEvent = history[0];
    const startEl = document.createElement('div');
    startEl.innerHTML = `<div style="width:24px;height:24px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">1</div>`;
    const startMarker = new mapboxgl.Marker({ element: startEl })
      .setLngLat([startEvent.longitude, startEvent.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`<div style="padding:8px;font-size:12px;"><strong>Início do trajeto</strong><br/>${new Date(startEvent.created_at).toLocaleString('pt-BR')}</div>`))
      .addTo(map.current);
    historyMarkersRef.current.push(startMarker);

    // End marker
    const endEvent = history[history.length - 1];
    const endEl = document.createElement('div');
    endEl.innerHTML = `<div style="width:24px;height:24px;background:#f43f5e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${history.length}</div>`;
    const endMarker = new mapboxgl.Marker({ element: endEl })
      .setLngLat([endEvent.longitude, endEvent.latitude])
      .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`<div style="padding:8px;font-size:12px;"><strong>Última posição</strong><br/>${new Date(endEvent.created_at).toLocaleString('pt-BR')}</div>`))
      .addTo(map.current);
    historyMarkersRef.current.push(endMarker);

    const bounds = new mapboxgl.LngLatBounds();
    history.forEach(event => bounds.extend([event.longitude, event.latitude]));
    map.current.fitBounds(bounds, { padding: 80, maxZoom: 15 });
  }, [history, showHistoryFor, clearHistoryFromMap]);

  const handleCloseHistory = useCallback(() => {
    clearHistoryFromMap();
    clearHistory();
    setShowHistoryFor(null);
  }, [clearHistoryFromMap, clearHistory]);

  // Update markers
  useEffect(() => {
    if (!map.current || loading) return;
    const currentIds = new Set(trackingData.map(t => t.id));

    // Remove old markers
    driverMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); driverMarkers.current.delete(id); }
    });
    pointMarkers.current.forEach((marker, id) => {
      const trackingId = id.replace('-pickup', '').replace('-delivery', '');
      if (!currentIds.has(trackingId)) { marker.remove(); pointMarkers.current.delete(id); }
    });
    routeLines.current.forEach(id => {
      if (!currentIds.has(id) && map.current?.getSource(`route-${id}`)) {
        map.current?.removeLayer(`route-${id}`);
        map.current?.removeSource(`route-${id}`);
        routeLines.current.delete(id);
      }
    });

    trackingData.forEach((tracking) => {
      // Driver marker
      const existingDriverMarker = driverMarkers.current.get(tracking.id);
      if (existingDriverMarker) {
        existingDriverMarker.setLngLat([tracking.current_longitude, tracking.current_latitude]);
      } else {
        const el = createDriverMarkerElement(tracking);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([tracking.current_longitude, tracking.current_latitude])
          .setPopup(createDriverPopup(tracking))
          .addTo(map.current!);
        driverMarkers.current.set(tracking.id, marker);
      }

      // Pickup marker
      if (tracking.order?.pickup_latitude && tracking.order?.pickup_longitude) {
        const pickupId = `${tracking.id}-pickup`;
        if (!pointMarkers.current.has(pickupId)) {
          const el = createPickupMarkerElement(tracking);
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([tracking.order.pickup_longitude, tracking.order.pickup_latitude])
            .addTo(map.current!);
          pointMarkers.current.set(pickupId, marker);
        }
      }

      // Delivery marker
      if (tracking.order?.delivery_latitude && tracking.order?.delivery_longitude) {
        const deliveryId = `${tracking.id}-delivery`;
        if (!pointMarkers.current.has(deliveryId)) {
          const el = createDeliveryMarkerElement(tracking);
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([tracking.order.delivery_longitude, tracking.order.delivery_latitude])
            .addTo(map.current!);
          pointMarkers.current.set(deliveryId, marker);
        }
      }

      // Route line
      if (
        tracking.order?.pickup_latitude && tracking.order?.pickup_longitude &&
        tracking.order?.delivery_latitude && tracking.order?.delivery_longitude &&
        !routeLines.current.has(tracking.id)
      ) {
        const sourceId = `route-${tracking.id}`;
        const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
        const color = vehicleColors[vehicleType] || '#00d9ff';
        routeLines.current.add(tracking.id);

        if (map.current?.isStyleLoaded()) {
          const waypoints: [number, number][] = [
            [tracking.order.pickup_longitude, tracking.order.pickup_latitude],
            [tracking.current_longitude, tracking.current_latitude],
            [tracking.order.delivery_longitude, tracking.order.delivery_latitude],
          ];
          getDirections(waypoints, 'driving-traffic')
            .then((route) => {
              if (!map.current || !map.current.isStyleLoaded() || map.current.getSource(sourceId)) return;
              const routeGeometry = route?.geometry || { type: 'LineString', coordinates: waypoints };
              map.current.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: routeGeometry as GeoJSON.Geometry } });
              map.current.addLayer({ id: sourceId, type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.7 } });
            })
            .catch(() => {
              if (!map.current?.isStyleLoaded() || map.current?.getSource(sourceId)) return;
              map.current?.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: waypoints } } });
              map.current?.addLayer({ id: sourceId, type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.6, 'line-dasharray': [2, 2] } });
            });
        }
      }
    });

    // Fit bounds
    if (trackingData.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      trackingData.forEach(tracking => {
        bounds.extend([tracking.current_longitude, tracking.current_latitude]);
        if (tracking.order?.pickup_longitude && tracking.order?.pickup_latitude) bounds.extend([tracking.order.pickup_longitude, tracking.order.pickup_latitude]);
        if (tracking.order?.delivery_longitude && tracking.order?.delivery_latitude) bounds.extend([tracking.order.delivery_longitude, tracking.order.delivery_latitude]);
      });
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    }
  }, [trackingData, loading]);

  const vehicleCounts = trackingData.reduce((acc, t) => {
    const type = t.driver?.vehicle_type || 'MOTORCYCLE';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (error) {
    return (
      <div className={`relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <p className="text-muted-foreground text-sm">Configure MAPBOX_ACCESS_TOKEN nas secrets do projeto</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 4px 20px var(--glow-color, rgba(0,217,255,0.4)), 0 0 0 3px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 4px 30px var(--glow-color, rgba(0,217,255,0.6)), 0 0 0 5px rgba(255,255,255,0.2); }
        }
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-popup-close-button { color: white !important; font-size: 20px !important; padding: 4px 8px !important; }
      `}</style>

      {loading && (
        <div className="absolute inset-0 z-10 bg-background/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '500px' }} />

      <MapLegend vehicleCounts={vehicleCounts} />
      <MapSearchPanel allTrackingData={allTrackingData} trackingCount={trackingData.length} onFocusTracking={focusOnTracking} />

      {showHistoryFor && (
        <MapHistoryPanel
          driverName={showHistoryFor.driverName}
          history={history}
          historyLoading={historyLoading}
          onClose={handleCloseHistory}
        />
      )}
    </div>
  );
}
