import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, containerVariants, itemVariants, panelVariants } from '@/components/ui/motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Flame, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDeliveryHeatmapData, HeatmapPoint } from '@/hooks/useDeliveryHeatmapData';
import { HeatmapFiltersPanel, HeatmapLegendPanel, HeatmapActionButtons } from './heatmap/HeatmapControls';
import { HeatmapStatsPanel } from './heatmap/HeatmapStatsPanel';

type HeatmapType = 'pickup' | 'delivery' | 'both';

export function HeatmapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [heatmapType, setHeatmapType] = useState<HeatmapType>('both');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const { data, isLoading: dataLoading, refetch } = useDeliveryHeatmapData(days);

  useEffect(() => {
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (cancelled) return;
        if (error) throw error;
        if (data?.token) setMapboxToken(data.token);
        else setError('Token Mapbox não configurado');
      } catch {
        if (!cancelled) setError('Erro ao buscar token do Mapbox');
      }
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;
    mapboxgl.accessToken = mapboxToken;
    map.current = new mapboxgl.Map({ container: mapContainer.current, style: 'mapbox://styles/mapbox/dark-v11', center: [-46.6544, -23.5629], zoom: 11, pitch: 45, bearing: -17.6 });
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.current.on('load', () => setLoading(false));
    return () => { map.current?.remove(); };
  }, [mapboxToken]);

  const updateHeatmapLayers = useCallback(() => {
    if (!map.current || !data) return;
    ['pickup-heat', 'delivery-heat'].forEach(id => { if (map.current?.getLayer(id)) map.current.removeLayer(id); });
    ['pickup-points', 'delivery-points'].forEach(id => { if (map.current?.getSource(id)) map.current.removeSource(id); });
    const createGeoJSON = (points: HeatmapPoint[]) => ({ type: 'FeatureCollection' as const, features: points.map(p => ({ type: 'Feature' as const, properties: { weight: p.weight }, geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] } })) });
    if ((heatmapType === 'pickup' || heatmapType === 'both') && data.pickupPoints.length > 0) {
      map.current.addSource('pickup-points', { type: 'geojson', data: createGeoJSON(data.pickupPoints) });
      map.current.addLayer({ id: 'pickup-heat', type: 'heatmap', source: 'pickup-points', paint: { 'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 10, 1], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(6,182,212,0)', 0.1, 'rgba(6,182,212,0.2)', 0.3, 'rgba(20,184,166,0.4)', 0.5, 'rgba(16,185,129,0.6)', 0.7, 'rgba(5,150,105,0.8)', 1, 'rgba(4,120,87,1)'], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 40], 'heatmap-opacity': 0.85 } });
    }
    if ((heatmapType === 'delivery' || heatmapType === 'both') && data.deliveryPoints.length > 0) {
      map.current.addSource('delivery-points', { type: 'geojson', data: createGeoJSON(data.deliveryPoints) });
      map.current.addLayer({ id: 'delivery-heat', type: 'heatmap', source: 'delivery-points', paint: { 'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 10, 1], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3], 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(236,72,153,0)', 0.1, 'rgba(236,72,153,0.2)', 0.3, 'rgba(217,70,239,0.4)', 0.5, 'rgba(168,85,247,0.6)', 0.7, 'rgba(139,92,246,0.8)', 1, 'rgba(109,40,217,1)'], 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 15, 40], 'heatmap-opacity': 0.85 } });
    }
  }, [data, heatmapType]);

  useEffect(() => {
    if (!loading && map.current) {
      if (map.current.isStyleLoaded()) updateHeatmapLayers();
      else map.current.on('load', updateHeatmapLayers);
    }
  }, [loading, updateHeatmapLayers]);

  const toggleFullscreen = () => { if (!document.fullscreenElement) { mapContainer.current?.parentElement?.requestFullscreen(); setIsFullscreen(true); } else { document.exitFullscreen(); setIsFullscreen(false); } };
  const resetView = () => { map.current?.flyTo({ center: [-46.6544, -23.5629], zoom: 11, pitch: 45, bearing: -17.6, duration: 1500 }); };

  if (error) {
    return (
      <div className="h-full flex flex-col p-6"><div className="flex-1 flex items-center justify-center"><div className="text-center p-8 rounded-2xl bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20"><div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4"><Flame className="w-8 h-8 text-destructive" /></div><h3 className="text-lg font-semibold text-foreground mb-2">Erro ao Carregar Mapa</h3><p className="text-muted-foreground mb-4">{error}</p><Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button></div></div></div>
    );
  }

  return (
    <motion.div className="h-full flex flex-col gap-4 p-4 md:p-6 bg-gradient-to-br from-background via-background to-primary/5" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div className="flex flex-col md:flex-row md:items-center justify-between gap-4" variants={itemVariants}>
        <div className="flex items-center gap-4">
          <motion.div className="relative" whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-lg opacity-50 animate-pulse" />
            <div className="relative p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg"><Flame className="w-6 h-6 text-white" /></div>
          </motion.div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Mapa de Calor</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Zap className="w-3 h-3 text-primary" />Visualização em tempo real das zonas de maior atividade</p>
          </div>
        </div>
        <AnimatePresence>
          {data && (
            <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <motion.div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50" whileHover={{ scale: 1.02 }}>
                <div className="flex items-center gap-2"><motion.div className="w-2 h-2 rounded-full bg-cyan-500" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} /><span className="text-sm font-medium">{data.pickupPoints.length}</span><span className="text-xs text-muted-foreground">coletas</span></div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-2"><motion.div className="w-2 h-2 rounded-full bg-accent" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} /><span className="text-sm font-medium">{data.deliveryPoints.length}</span><span className="text-xs text-muted-foreground">entregas</span></div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Map */}
      <motion.div className="flex-1 relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-pink-500/20 pointer-events-none z-10" style={{ padding: '1px' }}><div className="w-full h-full rounded-2xl bg-background" /></div>
        <motion.div className="absolute top-4 left-4 z-20 flex flex-col gap-3 max-w-xs" variants={panelVariants} initial="hidden" animate="visible">
          <HeatmapFiltersPanel days={days} setDays={setDays} heatmapType={heatmapType} setHeatmapType={setHeatmapType} />
          <HeatmapLegendPanel heatmapType={heatmapType} />
        </motion.div>
        <HeatmapActionButtons onRefresh={() => refetch()} onResetView={resetView} onToggleFullscreen={toggleFullscreen} isRefreshing={dataLoading} />
        {data && <HeatmapStatsPanel stats={data.stats} showStats={showStats} setShowStats={setShowStats} />}
        {(loading || dataLoading) && <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 backdrop-blur-sm"><motion.div className="flex flex-col items-center gap-3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}><div className="relative"><div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-xl opacity-50 animate-pulse" /><Loader2 className="w-10 h-10 text-primary animate-spin relative" /></div><p className="text-sm text-muted-foreground font-medium">Carregando mapa de calor...</p></motion.div></div>}
        <div ref={mapContainer} className="absolute inset-0" style={{ borderRadius: 'inherit' }} />
      </motion.div>
    </motion.div>
  );
}
