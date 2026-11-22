import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Package, Radio, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { vehicleIcons } from './types';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrackingData } from './hooks/useTrackingData';

interface MapSearchPanelProps {
  allTrackingData: TrackingData[];
  trackingCount: number;
  onFocusTracking: (tracking: TrackingData) => void;
}

export function MapSearchPanel({ allTrackingData, trackingCount, onFocusTracking }: MapSearchPanelProps) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const trackingSearchKeys = useMemo(() => ['driver.name', 'order.lalamove_id', 'order.internal_order_id', 'order.customer_name'], []);
  const trackingSearchResults = useFuseSearchWithMatches(allTrackingData, trackingSearchKeys, localSearch);
  const searchResults = useMemo(() => {
    if (!localSearch.trim()) return [];
    return trackingSearchResults.map(r => r.item);
  }, [localSearch, trackingSearchResults]);

  const handleFocus = useCallback((tracking: TrackingData) => {
    onFocusTracking(tracking);
    setShowSearchResults(false);
    setLocalSearch('');
  }, [onFocusTracking]);

  const showResults = localSearch.trim().length > 0;

  return (
    <div className="absolute top-6 left-6 z-20 space-y-3 pointer-events-auto">
      {/* Search Bar */}
      <div className="glass-card rounded-xl overflow-hidden border-primary/20 bg-background/40 backdrop-blur-xl shadow-2xl w-72">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            type="text"
            placeholder="Buscar ID ou Motorista..."
            value={localSearch}
            onChange={(e) => { setLocalSearch(e.target.value); setShowSearchResults(true); }}
            className="pl-11 pr-10 h-11 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-black uppercase tracking-widest placeholder:text-muted-foreground/50 placeholder:font-bold"
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('map.actions.clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full hover:bg-white/10"
              onClick={() => { setLocalSearch(''); setShowSearchResults(false); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showResults && showSearchResults && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/5 max-h-80 overflow-y-auto"
            >
              {searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleFocus(result)}
                      className="w-full px-4 py-3 text-left hover:bg-primary/10 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-black/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                        {vehicleIcons[result.driver?.vehicle_type || 'MOTORCYCLE']}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-black text-foreground truncate uppercase tracking-tighter">
                          {result.driver?.name || 'Motorista'}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground truncate uppercase opacity-60">
                          {result.order?.internal_order_id || result.order?.lalamove_id || 'SEM ID'}
                        </div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        result.is_stopped ? 'bg-warning' : !result.is_on_route ? 'bg-destructive' : 'bg-success'
                      } ${!result.is_stopped && result.is_on_route !== false ? 'animate-pulse' : ''}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                    Nenhum sinal encontrado
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fleet Overview Chip */}
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="glass-card px-4 py-3 rounded-xl border-primary/20 bg-background/40 backdrop-blur-xl shadow-2xl inline-flex items-center gap-4 border-l-4 border-l-primary"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
          <Radio className="w-5 h-5 text-primary relative z-10" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black italic text-foreground tracking-tighter">{trackingCount}</span>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-80">Drivers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[9px] font-bold text-success/80 uppercase tracking-tighter italic">Rede Estável</span>
          </div>
        </div>
        <div className="h-8 w-px bg-white/5 mx-1" />
        <Button variant="ghost" size="icon" aria-label={t('map.actions.centerOnTarget')} className="w-8 h-8 rounded-full hover:bg-white/10">
          <Target className="w-4 h-4 text-muted-foreground" />
        </Button>
      </motion.div>
    </div>
  );
}