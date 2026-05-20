import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  Loader2, Target, Eye, EyeOff, Layers, Map as MapIcon, 
  TrafficCone, Crosshair, Zap, Shield, Maximize2, Activity,
  Cloud, Wind, MapPin, Compass, Settings
} from 'lucide-react';
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
import { useMapSettings } from '@/hooks/useMapSettings';
import { MapSettingsPanel } from './MapSettingsPanel';
import { vehicleIcons, vehicleColors, type VehicleFilter, type StatusFilter } from './types';
import { createDriverMarkerElement, createPickupMarkerElement, createDeliveryMarkerElement, createDriverPopup, createStoppedMarkerElement } from './markerFactories';


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
  const markerPositions = useRef<Map<string, { current: [number, number], target: [number, number] }>>(new Map());
  const pointMarkers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const routeLines = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  
  const historyLineRef = useRef<string | null>(null);
  const historyMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const playbackMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [mapStyle, setMapStyle] = useState<'dark-v11' | 'satellite-streets-v12'>('dark-v11');
  const [showHistoryFor, setShowHistoryFor] = useState<{ driverId: string; orderId: string; driverName: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // States for requested features
  const [offRouteAlerts, setOffRouteAlerts] = useState<Set<string>>(new Set());
  const [stoppedAlerts, setStoppedAlerts] = useState<Map<string, number>>(new Map()); // id -> start timestamp
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  const [etaIndicator, setEtaIndicator] = useState<Map<string, { original: number; current: number }>>(new Map());
  
  const { offRouteThreshold, stoppedThreshold, geofenceRadius } = useMapSettings();

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
      style: `mapbox://styles/mapbox/${mapStyle}`,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 45,
      antialias: true
    });

    if (showControls) {
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    }

    map.current.on('style.load', () => {
      if (!map.current) return;
      
      // Stage 4: Dynamic Risk Clusters (Geofencing 2.0)
      if (!map.current.getSource('risk-zones')) {
        map.current.addSource('risk-zones', {
          'type': 'geojson',
          'data': {
            'type': 'FeatureCollection',
            'features': [
              {
                'type': 'Feature',
                'properties': { 'severity': 'high', 'name': 'Área de Alto Risco - Zona Sul' },
                'geometry': {
                  'type': 'Polygon',
                  'coordinates': [[
                    [-46.666, -23.570],
                    [-46.640, -23.570],
                    [-46.640, -23.550],
                    [-46.666, -23.550],
                    [-46.666, -23.570]
                  ]]
                }
              },
              {
                'type': 'Feature',
                'properties': { 'severity': 'medium', 'name': 'Área de Atenção - Zona Norte' },
                'geometry': {
                  'type': 'Polygon',
                  'coordinates': [[
                    [-46.680, -23.500],
                    [-46.650, -23.500],
                    [-46.650, -23.480],
                    [-46.680, -23.480],
                    [-46.680, -23.500]
                  ]]
                }
              }
            ]
          }
        });

        map.current.addLayer({
          'id': 'risk-zones-fill',
          'type': 'fill',
          'source': 'risk-zones',
          'paint': {
            'fill-color': [
              'match',
              ['get', 'severity'],
              'high', '#ef4444',
              'medium', '#f59e0b',
              '#3b82f6'
            ],
            'fill-opacity': 0.15
          }
        });

        map.current.addLayer({
          'id': 'risk-zones-outline',
          'type': 'line',
          'source': 'risk-zones',
          'paint': {
            'line-color': [
              'match',
              ['get', 'severity'],
              'high', '#ef4444',
              'medium', '#f59e0b',
              '#3b82f6'
            ],
            'line-width': 2,
            'line-dasharray': [2, 1]
          }
        });
      }

      // Stage 8: Real-time Heatmap Integration
      if (!map.current.getSource('traffic-heatmap')) {
        map.current.addSource('traffic-heatmap', {
          'type': 'geojson',
          'data': 'https://docs.mapbox.com/mapbox-gl-js/assets/earthquakes.geojson' // Mocking with heatmap data
        });

        map.current.addLayer({
          'id': 'traffic-heatmap-layer',
          'type': 'heatmap',
          'source': 'traffic-heatmap',
          'maxzoom': 15,
          'paint': {
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
              1, 'rgb(178,24,43)'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 20],
            'heatmap-opacity': 0.3
          }
        }, 'waterway-label');
      }

      if (showTraffic && map.current) {
        if (!map.current.getSource('mapbox-traffic')) {
          map.current.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
          });
          map.current.addLayer({
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
                100, '#880000'
              ],
              'line-opacity': 0.6
            }
          });
        }
      }
    });

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
  }, [mapboxToken, initialCenter, initialZoom, showControls, mapStyle]);

  // Animation loop for smooth movement
  useEffect(() => {
    const animate = () => {
      if (!map.current) return;

      markerPositions.current.forEach((pos, id) => {
        const marker = driverMarkers.current.get(id);
        if (!marker) return;

        const lerpFactor = 0.05;
        const newLng = pos.current[0] + (pos.target[0] - pos.current[0]) * lerpFactor;
        const newLat = pos.current[1] + (pos.target[1] - pos.current[1]) * lerpFactor;
        
        pos.current = [newLng, newLat];
        marker.setLngLat(pos.current);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Toggle traffic
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    if (showTraffic) {
      if (map.current.getLayer('traffic-layer')) map.current.setLayoutProperty('traffic-layer', 'visibility', 'visible');
    } else {
      if (map.current.getLayer('traffic-layer')) map.current.setLayoutProperty('traffic-layer', 'visibility', 'none');
    }
  }, [showTraffic]);


  // Following logic with Magnetic Zoom and Auto-Rotation & Route corridor visibility
  useEffect(() => {
    if (isFollowing && selectedTracking && map.current) {
      const speed = selectedTracking.speed || 0;
      const heading = selectedTracking.heading || 0;
      const targetZoom = Math.max(14, Math.min(18, 18 - (speed / 20)));
      
      const center: [number, number] = [selectedTracking.current_longitude, selectedTracking.current_latitude];
      
      // Auto-fit to keep driver and destination visible if close (Requested: Auto Zoom)
      if (autoZoomEnabled && selectedTracking.order?.delivery_longitude) {
        const dest: [number, number] = [selectedTracking.order.delivery_longitude, selectedTracking.order.delivery_latitude!];
        
        // Calculate dynamic padding based on distance
        const dist = Math.sqrt(Math.pow(center[0]-dest[0], 2) + Math.pow(center[1]-dest[1], 2));
        
        if (dist < 0.08) { // ~8km - Keep corridor visible
          const bounds = new mapboxgl.LngLatBounds().extend(center).extend(dest);
          
          // Calculate ideal bearing to align route vertically for better "corridor" view
          const y = Math.sin(dest[0] - center[0]) * Math.cos(dest[1]);
          const x = Math.cos(center[1]) * Math.sin(dest[1]) - Math.sin(center[1]) * Math.cos(dest[1]) * Math.cos(dest[0] - center[0]);
          const bearing = (Math.atan2(y, x) * 180 / Math.PI);

          map.current.fitBounds(bounds, { 
            padding: { top: 150, bottom: 150, left: 100, right: 100 }, 
            maxZoom: 17, 
            duration: 1500,
            pitch: 45,
            bearing: dist < 0.02 ? bearing : 0 // Only auto-rotate if very close
          });
          return;
        }
      }

      map.current.easeTo({
        center: center,
        duration: 1000,
        zoom: targetZoom,
        pitch: speed > 30 ? 60 : 45,
        bearing: heading,
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
      if (!currentIds.has(id)) { 
        marker.remove(); 
        driverMarkers.current.delete(id); 
        markerPositions.current.delete(id);
        
        // Cleanup alerts
        setStoppedAlerts(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    });
    
    trackingData.forEach((tracking) => {
      // Logic for Route Deviation Detection (using setting)
      const isOnRoute = tracking.is_on_route !== false;
      const isDeviated = !isOnRoute; 
      
      setOffRouteAlerts(prev => {
        const next = new Set(prev);
        if (isDeviated) next.add(tracking.id);
        else next.delete(tracking.id);
        return next;
      });


      // Logic for Stopped Driver Alert (using setting)
      if (tracking.speed === 0) {
        setStoppedAlerts(prev => {
          if (!prev.has(tracking.id)) {
            const next = new Map(prev);
            next.set(tracking.id, Date.now());
            return next;
          }
          return prev;
        });
      } else {
        setStoppedAlerts(prev => {
          if (prev.has(tracking.id)) {
            const next = new Map(prev);
            next.delete(tracking.id);
            return next;
          }
          return prev;
        });
      }

      // Dynamic ETA Comparison
      if (tracking.eta_minutes) {
        setEtaIndicator(prev => {
          const existing = prev.get(tracking.id);
          const next = new Map(prev);
          if (!existing) {
            next.set(tracking.id, { original: tracking.eta_minutes || 0, current: tracking.eta_minutes || 0 });
          } else {
            next.set(tracking.id, { ...existing, current: tracking.eta_minutes || 0 });
          }
          return next;
        });
      }

      const isSelected = tracking.id === selectedId;
      const isOtherInFocus = focusMode && selectedId && !isSelected;
      
      // Driver marker
      const existingDriverMarker = driverMarkers.current.get(tracking.id);
      const targetPos: [number, number] = [tracking.current_longitude, tracking.current_latitude];

      if (existingDriverMarker) {
        const pos = markerPositions.current.get(tracking.id);
        if (pos) {
          pos.target = targetPos;
        } else {
          markerPositions.current.set(tracking.id, { current: targetPos, target: targetPos });
        }
        
        const el = createDriverMarkerElement(tracking, isSelected);
        existingDriverMarker.getElement().innerHTML = el.innerHTML;
        existingDriverMarker.getElement().className = el.className;
        
        existingDriverMarker.getElement().style.opacity = isOtherInFocus ? '0.15' : '1';
        existingDriverMarker.getElement().style.filter = isOtherInFocus ? 'grayscale(0.8) blur(1px)' : 'none';
        existingDriverMarker.getElement().style.pointerEvents = isOtherInFocus ? 'none' : 'auto';

        if (existingDriverMarker.getPopup()?.isOpen()) {
          existingDriverMarker.setPopup(createDriverPopup(tracking));
        }
      } else {
        const el = createDriverMarkerElement(tracking, isSelected);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(targetPos)
          .setPopup(createDriverPopup(tracking))
          .addTo(map.current!);
        
        markerPositions.current.set(tracking.id, { current: targetPos, target: targetPos });
        
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
        const pMarker = pointMarkers.current.get(pickupId);
        if (pMarker) {
          pMarker.getElement().style.opacity = isOtherInFocus ? '0.1' : '1';
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
        const dMarker = pointMarkers.current.get(deliveryId);
        if (dMarker) {
          dMarker.getElement().style.opacity = isOtherInFocus ? '0.1' : '1';
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
              map.current.addLayer({ 
                id: sourceId, 
                type: 'line', 
                source: sourceId, 
                layout: { 'line-join': 'round', 'line-cap': 'round' }, 
                paint: { 
                  'line-color': color, 
                  'line-width': isSelected ? 6 : 4, 
                  'line-opacity': isOtherInFocus ? 0.05 : 0.7 
                } 
              });
            })
            .catch(() => {
              if (!map.current?.isStyleLoaded() || map.current?.getSource(sourceId)) return;
              map.current?.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: waypoints } } });
              map.current?.addLayer({ 
                id: sourceId, 
                type: 'line', 
                source: sourceId, 
                layout: { 'line-join': 'round', 'line-cap': 'round' }, 
                paint: { 
                  'line-color': color, 
                  'line-width': 3, 
                  'line-opacity': isOtherInFocus ? 0.05 : 0.6, 
                  'line-dasharray': [2, 2] 
                } 
              });
            });
        }
      } else if (routeLines.current.has(tracking.id) && map.current?.getLayer(`route-${tracking.id}`)) {
        // Dynamic visibility/opacity update for route lines
        map.current.setPaintProperty(`route-${tracking.id}`, 'line-opacity', isOtherInFocus ? 0.05 : (isSelected ? 0.8 : 0.6));
        map.current.setPaintProperty(`route-${tracking.id}`, 'line-width', isSelected ? 6 : 4);
        
        // Stage 11: Route Deviation Detection (using setting)
        if (isSelected && !tracking.is_stopped) {
          const source = map.current.getSource(`route-${tracking.id}`) as mapboxgl.GeoJSONSource;
          // In a real app, we'd calculate distance to the nearest point on the line
          // Mocking detection: if current pos is far from direct line pickup->delivery
          const isOff = tracking.is_on_route === false; 
          if (isOff && !offRouteAlerts.has(tracking.id)) {
            setOffRouteAlerts(prev => new Set(prev).add(tracking.id));
            map.current.setPaintProperty(`route-${tracking.id}`, 'line-color', '#ef4444');
          } else if (!isOff && offRouteAlerts.has(tracking.id)) {
            setOffRouteAlerts(prev => {
              const next = new Set(prev);
              next.delete(tracking.id);
              return next;
            });
            const vehicleType = tracking.driver?.vehicle_type || 'MOTORCYCLE';
            map.current.setPaintProperty(`route-${tracking.id}`, 'line-color', vehicleColors[vehicleType]);
          }
        }
      }
      
      // Stage 12: Stopped Driver Detection (using settings)
      if (tracking.is_stopped) {
        if (!stoppedAlerts.has(tracking.id)) {
          setStoppedAlerts(prev => new Map(prev).set(tracking.id, Date.now()));
        }
        
        const startTime = stoppedAlerts.get(tracking.id);
        const durationMin = startTime ? Math.floor((Date.now() - startTime) / 60000) : 0;
        
        if (durationMin >= stoppedThreshold) {
          const stoppedMarkerId = `stopped-${tracking.id}`;
          if (!pointMarkers.current.has(stoppedMarkerId)) {
            const el = createStoppedMarkerElement(tracking, durationMin);
            const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat([tracking.current_longitude, tracking.current_latitude])
              .addTo(map.current!);
            pointMarkers.current.set(stoppedMarkerId, marker);
          } else {
            const marker = pointMarkers.current.get(stoppedMarkerId);
            if (marker) {
              const el = createStoppedMarkerElement(tracking, durationMin);
              marker.getElement().innerHTML = el.innerHTML;
            }
          }
        }
      } else if (stoppedAlerts.has(tracking.id)) {
        setStoppedAlerts(prev => {
          const next = new Map(prev);
          next.delete(tracking.id);
          return next;
        });
        const stoppedMarkerId = `stopped-${tracking.id}`;
        if (pointMarkers.current.has(stoppedMarkerId)) {
          pointMarkers.current.get(stoppedMarkerId)?.remove();
          pointMarkers.current.delete(stoppedMarkerId);
        }
      }
    });

    // Auto-fit bounds if nothing selected
    if (!selectedId && trackingData.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      trackingData.forEach(t => bounds.extend([t.current_longitude, t.current_latitude]));
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 100, maxZoom: 14 });
    }
  }, [trackingData, loading, selectedId, focusMode]);

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
    <div className={`relative rounded-xl overflow-hidden border border-border/50 shadow-2xl group/map-container ${className}`}>
      {/* Top Left HUD - Global Metrics */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-3 pointer-events-none">
        <div className="bg-background/40 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Activity className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Global Status</p>
              <h4 className="text-sm font-black text-foreground tracking-tighter uppercase italic">Control Center</h4>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Active</p>
              <p className="text-xl font-black italic">{trackingData.length}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Alerts</p>
              <p className="text-xl font-black italic text-destructive">03</p>
            </div>
          </div>
        </div>

        <div className="bg-background/40 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl pointer-events-auto flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-sky-400" />
            <span className="text-[11px] font-black italic tracking-tighter">24°C</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-slate-300" />
            <span className="text-[11px] font-black italic tracking-tighter">12 KM/H</span>
          </div>
        </div>
      </div>

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
        @keyframes geofence-pulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.1; }
          100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.3; }
        }
        @keyframes marker-bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-8px); }
        }
        .mapboxgl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-popup-close-button { color: white !important; font-size: 20px !important; padding: 8px !important; z-index: 20; }
      `}</style>

      {/* Control Overlays */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        <div className="bg-background/60 backdrop-blur-2xl border border-white/10 p-1.5 rounded-full shadow-2xl flex items-center gap-1 pointer-events-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-10 w-10 rounded-full transition-all duration-300 ${showSettings ? 'text-primary bg-primary/10' : 'text-muted-foreground'} hover:bg-white/5`}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-5 h-5" />
          </Button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-10 w-10 rounded-full transition-all duration-300 ${mapStyle === 'dark-v11' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110' : 'hover:bg-white/5'}`}
            onClick={() => setMapStyle('dark-v11')}
          >
            <MapIcon className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-10 w-10 rounded-full transition-all duration-300 ${mapStyle === 'satellite-streets-v12' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110' : 'hover:bg-white/5'}`}
            onClick={() => setMapStyle('satellite-streets-v12')}
          >
            <Layers className="w-5 h-5" />
          </Button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-10 w-10 rounded-full transition-all duration-300 ${showTraffic ? 'text-primary' : 'text-muted-foreground'} hover:bg-white/5`}
            onClick={() => setShowTraffic(!showTraffic)}
          >
            <TrafficCone className="w-5 h-5" />
          </Button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-10 w-10 rounded-full transition-all duration-300 ${isFollowing ? 'text-primary' : 'text-muted-foreground'} hover:bg-white/5`}
            onClick={() => setIsFollowing(!isFollowing)}
            disabled={!selectedId}
          >
            <Target className={`w-5 h-5 ${isFollowing ? 'animate-pulse' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-10 w-10 rounded-full transition-all duration-300 ${focusMode ? 'text-primary' : 'text-muted-foreground'} hover:bg-white/5`}
            onClick={() => setFocusMode(!focusMode)}
            disabled={!selectedId}
          >
            <Shield className="w-5 h-5" />
          </Button>
        </div>

        <Button 
          variant="secondary" 
          className="h-12 px-6 rounded-full glass-card border-white/10 font-black italic uppercase tracking-tighter text-xs shadow-2xl pointer-events-auto hover:scale-105 active:scale-95 transition-all"
          onClick={() => {
            if (map.current && trackingData.length > 0) {
              const bounds = new mapboxgl.LngLatBounds();
              trackingData.forEach(t => bounds.extend([t.current_longitude, t.current_latitude]));
              map.current.fitBounds(bounds, { padding: 100, maxZoom: 14 });
            }
          }}
        >
          <Crosshair className="w-4 h-4 mr-2 text-primary" />
          Rescan Network
        </Button>
      </div>

      <MapSearchPanel 
        allTrackingData={allTrackingData} 
        trackingCount={trackingData.length}
        onFocusTracking={focusOnTracking} 
      />
      
      <MapHUD 
        selectedTracking={selectedTracking} 
        offRoute={selectedId ? offRouteAlerts.has(selectedId) : false}
        stoppedTime={selectedId && stoppedAlerts.has(selectedId) ? Math.floor((Date.now() - stoppedAlerts.get(selectedId)!) / 1000) : 0}
        etaOriginal={selectedId ? etaIndicator.get(selectedId)?.original : undefined}
        offRouteThreshold={offRouteThreshold}
        geofenceRadius={geofenceRadius}
        stoppedThreshold={stoppedThreshold}
      />
      
      <MapLegend vehicleCounts={vehicleCounts} />
      
      <MapSettingsPanel show={showSettings} onClose={() => setShowSettings(false)} />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 animate-pulse">
            Establishing Satellite Link...
          </p>
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: '600px' }} />

      {showHistoryFor && (
        <MapHistoryPanel 
          show={!!showHistoryFor} 
          driverName={showHistoryFor?.driverName || ''}
          history={history}
          loading={historyLoading}
          onClose={() => {
            setShowHistoryFor(null);
            clearHistory();
            clearHistoryFromMap();
            if (playbackMarkerRef.current) {
              playbackMarkerRef.current.remove();
              playbackMarkerRef.current = null;
            }
          }}
          onPlaybackUpdate={(lat, lng, heading) => {
            if (!map.current) return;
            
            // Create or update playback marker (Requested: Trajectory Playback Mode)
            if (!playbackMarkerRef.current) {
              const el = document.createElement('div');
              el.innerHTML = `
                <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
                  <div style="width:30px;height:30px;background:#8b5cf6;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px rgba(139,92,246,0.6);border:2px solid white;">
                    <span style="font-size:14px;transform:rotate(${heading}deg);">🛸</span>
                  </div>
                  <div style="background:#8b5cf6;color:white;padding:1px 6px;border-radius:4px;font-size:8px;font-weight:900;margin-top:2px;">HISTÓRICO</div>
                </div>
              `;
              playbackMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lng, lat])
                .addTo(map.current);
            } else {
              playbackMarkerRef.current.setLngLat([lng, lat]);
              const el = playbackMarkerRef.current.getElement();
              const icon = el.querySelector('span');
              if (icon) icon.style.transform = `rotate(${heading}deg)`;
            }

            map.current.easeTo({ center: [lng, lat], duration: 400, zoom: 16 });
          }}
        />
      )}

      {selectedId && (
        <div className="absolute bottom-6 right-6 z-20 flex gap-2">
          <Button 
            variant="destructive" 
            size="sm"
            className="shadow-xl glass-card animate-in slide-in-from-right-5"
            onClick={() => {
              setSelectedId(null);
              setIsFollowing(false);
              setFocusMode(false);
            }}
          >
            <EyeOff className="w-4 h-4 mr-2" />
            Limpar Seleção
          </Button>
        </div>
      )}
    </div>
  );
}