import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, Target, Eye, EyeOff, Layers, Map as MapIcon, TrafficCone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrackingHistory } from '@/hooks/useTrackingHistory';
import { getDirections } from '@/hooks/useMapbox';
import { useMapboxToken } from './hooks/useMapboxToken';
import { useTrackingData, type TrackingData } from './hooks/useTrackingData';
import { MapSearchPanel } from './MapSearchPanel';
import { MapHistoryPanel } from './MapHistoryPanel';
import { MapLegend } from './MapLegend';
import { MapHUD } from './MapHUD';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
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
  const ghostTrails = useRef<Map<string, string>>(new Map());
  
  const historyLineRef = useRef<string | null>(null);
  const historyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showHistoryFor, setShowHistoryFor] = useState<{ driverId: string; orderId: string; driverName: string } | null>(null);

  const { mapboxToken, error } = useMapboxToken();
  const { trackingData, allTrackingData } = useTrackingData(vehicleFilter, statusFilter);
  const { history, loading: historyLoading, fetchHistory, clearHistory } = useTrackingHistory();

  const selectedTracking = useMemo(() => 
    trackingData.find(t => t.id === selectedId) || null
  , [trackingData, selectedId]);

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
      antialias: true
    });

    if (showControls) {
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    }

    map.current.on('load', () => {
      setLoading(false);
    });

    return () => {
      driverMarkers.current.forEach(marker => marker.remove());
      driverMarkers.current.clear();
      pointMarkers.current.forEach(marker => marker.remove());
      pointMarkers.current.clear();
      routeLines.current.clear();
      map.current?.remove();
    };
  }, [mapboxToken, initialCenter, initialZoom, showControls]);

  // Following logic
  useEffect(() => {
    if (isFollowing && selectedTracking && map.current) {
      map.current.easeTo({
        center: [selectedTracking.current_longitude, selectedTracking.current_latitude],
        duration: 1000,
        zoom: Math.max(map.current.getZoom(), 15)
      });
    }
  }, [isFollowing, selectedTracking]);

  // Focus on search result
  const focusOnTracking = useCallback((tracking: TrackingData) => {
    if (!map.current) return;
    setSelectedId(tracking.id);
    map.current.flyTo({ 
      center: [tracking.current_longitude, tracking.current_latitude], 
      zoom: 15, 
      duration: 1200,
      pitch: 60
    });
    const marker = driverMarkers.current.get(tracking.id);
    if (marker) marker.togglePopup();
  }, []);

  // Handle show history event
  useEffect(() => {
    const handleShowHistory = (e: CustomEvent<{ driverId: string; orderId: string; driverName: string }>) => {
      setShowHistoryFor(e.detail);
      fetchHistory(e.detail.driverId, e.detail.orderId, 200);
    };
    window.addEventListener('show-driver-history', handleShowHistory as EventListener);
    return () => window.removeEventListener('show-driver-history', handleShowHistory as EventListener);
  }, [fetchHistory]);

  const clearHistoryFromMap = useCallback(() => {
    if (map.current && historyLineRef.current) {
      if (map.current.getLayer(historyLineRef.current)) map.current.removeLayer(historyLineRef.current);
      if (map.current.getSource(historyLineRef.current)) map.current.removeSource(historyLineRef.current);
      historyLineRef.current = null;
    }
    historyMarkersRef.current.forEach(marker => marker.remove());
    historyMarkersRef.current = [];
  }, []);

  // Update markers and paths
  useEffect(() => {
    if (!map.current || loading) return;
    const currentIds = new Set(trackingData.map(t => t.id));

    // Cleanup logic
    driverMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); driverMarkers.current.delete(id); }
    });
    
    trackingData.forEach((tracking) => {
      const isSelected = tracking.id === selectedId;
      
      // Driver marker
      const existingDriverMarker = driverMarkers.current.get(tracking.id);
      if (existingDriverMarker) {
        existingDriverMarker.setLngLat([tracking.current_longitude, tracking.current_latitude]);
      } else {
        const el = createDriverMarkerElement(tracking, isSelected);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([tracking.current_longitude, tracking.current_latitude])
          .setPopup(createDriverPopup(tracking))
          .addTo(map.current!);
        
        marker.getElement().addEventListener('click', () => {
          setSelectedId(tracking.id);
        });
        
        driverMarkers.current.set(tracking.id, marker);
      }

      // Pickup/Delivery markers
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

    // Auto-fit bounds if nothing selected
    if (!selectedId && trackingData.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      trackingData.forEach(t => bounds.extend([t.current_longitude, t.current_latitude]));
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 100, maxZoom: 14 });
    }
  }, [trackingData, loading, selectedId]);

  const vehicleCounts = useMemo(() => trackingData.reduce((acc, t) => {
    const type = t.driver?.vehicle_type || 'MOTORCYCLE';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [trackingData]);

  if (error) return (
    <div className={`relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center ${className}`}>
      <div className="text-center p-8">
        <p className="text-destructive font-medium mb-2">{error}</p>
        <p className="text-muted-foreground text-sm">Configure MAPBOX_ACCESS_TOKEN</p>
      </div>
    </div>
  );

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border/50 shadow-2xl ${className}`}>
      <style>{`
        @keyframes pulse-glow {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 0.3; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes pulse-warning {
          0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          70% { transform: scale(1.1); opacity: 0; box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes pulse-critical {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.2); opacity: 0.4; background: rgba(239, 68, 68, 0.5); }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-popup-close-button { color: white !important; font-size: 20px !important; padding: 8px !important; z-index: 20; }
      `}</style>

      {loading && (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <span className="text-sm font-medium animate-pulse uppercase tracking-tighter">Iniciando Monitoramento Guardian</span>
          </div>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '600px' }} />

      <MapLegend vehicleCounts={vehicleCounts} />
      <MapSearchPanel allTrackingData={allTrackingData} trackingCount={trackingData.length} onFocusTracking={focusOnTracking} />
      
      {/* HUD Layer */}
      <MapHUD selectedTracking={selectedTracking} />

      {/* Floating Controls */}
      <div className="absolute bottom-6 left-6 z-20 flex flex-col gap-2">
        {selectedId && (
          <Button 
            variant={isFollowing ? "default" : "secondary"} 
            size="sm"
            className="shadow-xl glass-card border-primary/20"
            onClick={() => setIsFollowing(!isFollowing)}
          >
            {isFollowing ? <Target className="w-4 h-4 mr-2 animate-pulse text-primary" /> : <Target className="w-4 h-4 mr-2" />}
            {isFollowing ? 'Seguindo' : 'Focar Motorista'}
          </Button>
        )}
        <Button 
          variant="secondary" 
          size="sm"
          className="shadow-xl glass-card"
          onClick={() => setSelectedId(null)}
        >
          <EyeOff className="w-4 h-4 mr-2" />
          Limpar Seleção
        </Button>
      </div>

      {showHistoryFor && (
        <MapHistoryPanel
          driverName={showHistoryFor.driverName}
          history={history}
          historyLoading={historyLoading}
          onClose={() => { clearHistoryFromMap(); clearHistory(); setShowHistoryFor(null); }}
        />
      )}
    </div>
  );
}
