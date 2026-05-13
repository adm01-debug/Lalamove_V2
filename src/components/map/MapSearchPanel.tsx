import { useState, useCallback, useMemo } from 'react';
import { Search, X, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { vehicleIcons } from './types';
import type { TrackingData } from './hooks/useTrackingData';

interface MapSearchPanelProps {
  allTrackingData: TrackingData[];
  trackingCount: number;
  onFocusTracking: (tracking: TrackingData) => void;
}

export function MapSearchPanel({ allTrackingData, trackingCount, onFocusTracking }: MapSearchPanelProps) {
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

  // Show/hide results
  const showResults = localSearch.trim().length > 0;

  return (
    <div className="absolute top-4 left-4 z-20">
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar motorista ou pedido..."
            value={localSearch}
            onChange={(e) => { setLocalSearch(e.target.value); setShowSearchResults(true); }}
            className="pl-10 pr-4 py-2 w-64 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => { setLocalSearch(''); setShowSearchResults(false); }}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {showResults && showSearchResults && searchResults.length > 0 && (
          <div className="border-t border-border/50 max-h-60 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleFocus(result)}
                className="w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">{vehicleIcons[result.driver?.vehicle_type || 'MOTORCYCLE']}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{result.driver?.name || 'Motorista'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.order?.internal_order_id || result.order?.lalamove_id || result.order_id}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  result.is_stopped ? 'bg-warning' : !result.is_on_route ? 'bg-destructive' : 'bg-success'
                }`} />
              </button>
            ))}
          </div>
        )}

        {showResults && showSearchResults && localSearch && searchResults.length === 0 && (
          <div className="border-t border-border/50 px-3 py-3 text-sm text-muted-foreground">
            Nenhum resultado encontrado
          </div>
        )}
      </div>

      <div className="glass-card px-4 py-3 rounded-lg mt-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="status-dot bg-success absolute -top-0.5 -right-0.5" />
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-lg font-bold text-foreground">{trackingCount}</span>
            <span className="text-sm text-muted-foreground ml-1">
              {trackingCount === 1 ? 'entrega ativa' : 'entregas ativas'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
