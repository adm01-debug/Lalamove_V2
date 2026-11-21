import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Building2, Users, Truck, ShoppingBag, Contact, Navigation } from 'lucide-react';
import { useAddressSearch, type AddressSearchResult, type ExternalTable } from '@/hooks/useExternalData';
import { useGeoAutocomplete, useGeoSession, fetchGeoPlace, type GeoAddress, type GeoSuggestion } from '@/hooks/useGeo';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectRecord?: (record: AddressSearchResult) => void;
  onSelectPlace?: (place: GeoAddress) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

const SOURCE_ICONS: Record<ExternalTable, React.ReactNode> = {
  companies: <Building2 className="w-3 h-3" />,
  customers: <Users className="w-3 h-3" />,
  suppliers: <ShoppingBag className="w-3 h-3" />,
  carriers: <Truck className="w-3 h-3" />,
  contacts: <Contact className="w-3 h-3" />,
};

const SOURCE_LABELS: Record<ExternalTable, string> = {
  companies: 'Empresa',
  customers: 'Cliente',
  suppliers: 'Fornecedor',
  carriers: 'Transportadora',
  contacts: 'Contato',
};

export function AddressAutocomplete({
  value,
  onChange,
  onSelectRecord,
  onSelectPlace,
  onCoordinatesChange,
  placeholder = 'Buscar endereço...',
  className,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const debouncedSearch = useDebouncedValue(inputValue, 350);
  const containerRef = useRef<HTMLDivElement>(null);

  // CRM search
  const { data: crmData, isLoading: crmLoading } = useAddressSearch(debouncedSearch, open && debouncedSearch.length >= 2);
  
  // Autocomplete via geo-gateway (Google ou Mapbox conforme geo_settings) — 1 sessão por "digitar → escolher"
  const session = useGeoSession();
  const [resolving, setResolving] = useState(false);
  const { data: geoData, isLoading: geoLoading, error: geoError } = useGeoAutocomplete(
    debouncedSearch,
    open && debouncedSearch.length >= 3 ? session.get() : null,
    open,
  );

  const isLoading = crmLoading || geoLoading || resolving;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCRM = (result: AddressSearchResult) => {
    const address = result.full_address || result.address || result.name;
    setInputValue(address);
    onChange(address);
    onSelectRecord?.(result);
    setOpen(false);
  };

  const handleSelectPlace = async (suggestion: GeoSuggestion) => {
    const label = suggestion.secondary_text || suggestion.main_text;
    setInputValue(label);
    onChange(label);
    setOpen(false);
    setResolving(true);
    try {
      // place-details fecha a sessão de cobrança e devolve coordenada + componentes
      const place = await fetchGeoPlace(suggestion.id, session.get());
      if (place.formatted) {
        setInputValue(place.formatted);
        onChange(place.formatted);
      }
      onSelectPlace?.(place);
      const point = place.routable_point ?? place.location;
      if (point && onCoordinatesChange) onCoordinatesChange(point.lat, point.lng);
    } catch (err) {
      toast.error('Não foi possível obter a localização do endereço', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      session.end();
      setResolving(false);
    }
  };

  const crmResults = crmData?.results ?? [];
  const geoResults = geoData ?? [];
  const geoProvider = geoResults[0]?.provider;
  const hasResults = crmResults.length > 0 || geoResults.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && hasResults && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {/* CRM Results */}
          {crmResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/30 border-b border-border/30">
                CRM / Cadastro
              </div>
              {crmResults.map((result) => (
                <button
                  key={`${result.source_table}-${result.id}`}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/30"
                  onClick={() => handleSelectCRM(result)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-foreground truncate">
                      {result.display_name}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 flex-shrink-0">
                      {SOURCE_ICONS[result.source_table]}
                      {SOURCE_LABELS[result.source_table]}
                    </Badge>
                  </div>
                  {result.full_address && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {result.full_address}
                    </p>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Sugestões do provedor de mapas (geo-gateway) */}
          {geoResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/30 border-b border-border/30">
                {geoProvider === 'google' ? 'Google Maps' : 'Mapbox'}
              </div>
              {geoResults.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
                  onClick={() => void handleSelectPlace(suggestion)}
                >
                  <div className="flex items-center gap-2">
                    <Navigation className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-sm text-foreground truncate block">
                        {suggestion.main_text}
                      </span>
                      <p className="text-xs text-muted-foreground truncate">
                        {suggestion.secondary_text}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                      {suggestion.type || 'local'}
                    </Badge>
                  </div>
                </button>
              ))}
              {geoProvider === 'mapbox' && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border/30">© Mapbox © OpenStreetMap</div>
              )}
            </>
          )}
        </div>
      )}

      {open && debouncedSearch.length >= 2 && !isLoading && !hasResults && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {geoError
              ? (geoError.status === 429
                  ? 'Busca de endereços indisponível no momento (limite/orçamento). Digite o endereço completo.'
                  : 'Busca de endereços indisponível. Digite o endereço completo.')
              : 'Nenhum resultado encontrado — tente com número e cidade'}
          </p>
        </div>
      )}
    </div>
  );
}
