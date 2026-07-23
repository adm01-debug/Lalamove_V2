import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './liveMap.css';
import {
  Loader2, Target, Eye, EyeOff, Layers, Map as MapIcon,
  TrafficCone, Crosshair, Zap, Shield, Activity,
  MapPin, Compass, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrackingHistory } from '@/hooks/useTrackingHistory';
import { useMapboxToken } from './hooks/useMapboxToken';
import { useTrackingData, type TrackingData } from './hooks/useTrackingData';
import { useMapAlerts } from './hooks/useMapAlerts';
import { useMapMarkers } from './hooks/useMapMarkers';
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
import { type VehicleFilter, type StatusFilter } from './types';
import { setupMapLayers } from './mapLayers';
import { GoogleMapsCanvas } from './GoogleMapsCanvas';
import { Google3DCanvas } from './Google3DCanvas';
import { MapProviderSelector } from './MapProviderSelector';


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
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);
  // Densidade adaptativa por zoom: em visão afastada, força marcadores compactos
  // (reduz poluição visual / colisão de rótulos — clustering leve, sem alterar dados).
  const [isFarZoom, setIsFarZoom] = useState(false);
  const FAR_ZOOM_THRESHOLD = 11.5;
  // Clustering real: em zoom muito distante, agrega motoristas em bolhas com contagem.
  const [isVeryFarZoom, setIsVeryFarZoom] = useState(false);
  const VERY_FAR_ZOOM_THRESHOLD = 9.5;


  const { offRouteThreshold, stoppedThreshold, geofenceRadius, markerDensity, preferredProvider } = useMapSettings();
  const isGoogle2D = preferredProvider === 'google-roadmap' || preferredProvider === 'google-hybrid';
  const isGoogle3D = preferredProvider === 'google-3d';
  const isGoogleActive = isGoogle2D || isGoogle3D;
  const googleMapTypeId: 'roadmap' | 'hybrid' = preferredProvider === 'google-hybrid' ? 'hybrid' : 'roadmap';

  const { mapboxToken, error } = useMapboxToken();
  const { trackingData, allTrackingData } = useTrackingData(vehicleFilter, statusFilter);
  const { offRouteAlerts, stoppedAlerts, etaIndicator } = useMapAlerts(trackingData);
  const { history, loading: historyLoading, fetchHistory, clearHistory } = useTrackingHistory();

  const { resetMarkers, togglePopup } = useMapMarkers({
    mapRef: map,
    loading,
    trackingData,
    selectedId,
    onSelect: setSelectedId,
    focusMode,
    markerDensity,
    isFarZoom,
    isVeryFarZoom,
    veryFarZoomThreshold: VERY_FAR_ZOOM_THRESHOLD,
    offRouteAlerts,
    stoppedAlerts,
    stoppedThreshold,
  });




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
      setupMapLayers(map.current, showTraffic);
    });


    map.current.on('load', () => {
      setLoading(false);
    });

    // Densidade adaptativa: atualiza a banda de zoom apenas quando cruza o limiar,
    // evitando re-renders excessivos durante o gesto de zoom.
    const handleZoom = () => {
      if (!map.current) return;
      const zoom = map.current.getZoom();
      const far = zoom < FAR_ZOOM_THRESHOLD;
      const veryFar = zoom < VERY_FAR_ZOOM_THRESHOLD;
      setIsFarZoom(prev => (prev === far ? prev : far));
      setIsVeryFarZoom(prev => (prev === veryFar ? prev : veryFar));
    };
    map.current.on('zoomend', handleZoom);
    handleZoom();

    return () => {
      resetMarkers();
      if (map.current) {
        if (map.current.getLayer('geofence-fill')) map.current.removeLayer('geofence-fill');
        if (map.current.getLayer('geofence-outline')) map.current.removeLayer('geofence-outline');
        if (map.current.getSource('geofence')) map.current.removeSource('geofence');
      }
      map.current?.remove();
    };
  }, [mapboxToken, initialCenter, initialZoom, showControls, mapStyle, resetMarkers]);



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
  }, [isFollowing, selectedTracking, autoZoomEnabled]);

  // Update Geofence visualizer
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    const source = map.current.getSource('geofence') as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (selectedTracking?.order?.delivery_latitude && selectedTracking?.order?.delivery_longitude) {
      const center = [selectedTracking.order.delivery_longitude, selectedTracking.order.delivery_latitude];
      
      // Create a circle polygon
      const points = 64;
      const coords = [];
      const kmRadius = geofenceRadius / 1000;
      const distanceX = kmRadius / (111.32 * Math.cos(center[1] * Math.PI / 180));
      const distanceY = kmRadius / 110.574;

      for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        coords.push([center[0] + x, center[1] + y]);
      }
      coords.push(coords[0]);

      source.setData({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords]
        },
        properties: {}
      });
      
      map.current.setLayoutProperty('geofence-fill', 'visibility', 'visible');
      map.current.setLayoutProperty('geofence-outline', 'visibility', 'visible');
    } else {
      map.current.setLayoutProperty('geofence-fill', 'visibility', 'none');
      map.current.setLayoutProperty('geofence-outline', 'visibility', 'none');
    }
  }, [selectedTracking, geofenceRadius]);

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
    togglePopup(tracking.id);
  }, [togglePopup]);

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

  // Reconciliação de markers, rotas, clustering e animação foram extraídos para `useMapMarkers`.


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
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Ativos</p>
              <p className="text-xl font-black italic">{String(trackingData.length).padStart(2, '0')}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Alertas</p>
              <p className="text-xl font-black italic text-destructive">
                {String(offRouteAlerts.size + stoppedAlerts.size).padStart(2, '0')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-background/40 backdrop-blur-xl border border-white/10 p-3 rounded-xl shadow-2xl pointer-events-auto flex items-center gap-4">
          <div className="flex items-center gap-2" title="Velocidade média da frota ativa">
            <Zap className="w-4 h-4 text-sky-400" />
            <span className="text-[11px] font-black italic tracking-tighter">
              {(() => {
                const moving = trackingData.filter(t => (t.speed ?? 0) > 0);
                if (moving.length === 0) return '—';
                const avg = moving.reduce((s, t) => s + (t.speed ?? 0), 0) / moving.length;
                return `${Math.round(avg)} KM/H`;
              })()}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2" title="Motoristas parados no momento">
            <Compass className="w-4 h-4 text-slate-300" />
            <span className="text-[11px] font-black italic tracking-tighter">
              {String(stoppedAlerts.size).padStart(2, '0')} PARADOS
            </span>
          </div>
        </div>
      </div>


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
        trend={selectedId ? etaIndicator.get(selectedId)?.trend : 'stable'}
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