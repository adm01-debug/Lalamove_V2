import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Building2, Users, Truck, ShoppingBag, Contact, Navigation, AlertTriangle, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAddressSearch, type AddressSearchResult, type ExternalTable } from '@/hooks/useExternalData';
import type { MapboxFeature } from '@/hooks/useMapbox';
import { useAddressSearchBox, useFrequentAddresses, resolveDeliveryPoint, normalizeAddressKey, type GeoSuggestion, type FrequentAddress, type GeoAddress } from '@/hooks/useGeoSearch';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectRecord?: (record: AddressSearchResult) => void;
  onSelectMapbox?: (feature: MapboxFeature) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  /**
   * Etapa 34: entrega o endereço completo resolvido pelo provedor (formatted, lat/lng,
   * place_id, components, precision, provider). `onSelectMapbox` existe para os
   * consumidores antigos que só precisam do formato `MapboxFeature`; este é o contrato
   * novo e carrega o que a cotação e a auditoria exigem.
   */
  onAddressSelected?: (address: GeoAddress) => void;
  /** Etapa 40: habilita "usar o endereço como digitado" quando a busca falha. */
  onUseTypedAddress?: (value: string) => void;
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

/**
 * Etapa 40: separa "acabou o orçamento / limite do provedor" (429) de "caiu a rede"
 * (sem status). Os dois precisam de mensagens e ações diferentes na UI — o operador
 * não pode descobrir na cotação que ficou sem busca de endereço.
 */
function geoSearchFailure(kind: unknown): { type: 'quota' | 'network'; message: string } {
  const status = (kind as { context?: { status?: number } } | null)?.context?.status;
  if (status === 429) {
    return {
      type: 'quota',
      message: 'Busca de endereço atingiu o limite de uso agora. Digite o endereço completo e siga — a cotação da Lalamove localiza o ponto.',
    };
  }
  return {
    type: 'network',
    message: 'Busca de endereço indisponível no momento. Digite o endereço completo e siga — a cotação da Lalamove localiza o ponto.',
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelectRecord,
  onSelectMapbox,
  onCoordinatesChange,
  onAddressSelected,
  onUseTypedAddress,
  placeholder = 'Buscar endereço...',
  className,
}: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const listboxId = useId();
  const debouncedSearch = useDebouncedValue(inputValue, 350);
  const containerRef = useRef<HTMLDivElement>(null);

  // CRM search
  const { data: crmData, isLoading: crmLoading } = useAddressSearch(debouncedSearch, open && debouncedSearch.length >= 2);
  
  // Mapbox Search Box (sugestões + retrieve, sessão cobrada por token)
  const { suggestions: mapboxResults, isLoading: mapboxLoading, isError: mapboxError, error: mapboxFailure, retrieve } = useAddressSearchBox(debouncedSearch, open && debouncedSearch.length >= 3);
  const searchFailure = mapboxError ? geoSearchFailure(mapboxFailure) : null;
  // Etapa 41: endereços com coordenada já gravada, mostrados antes de qualquer provedor.
  const { data: frequentAddresses } = useFrequentAddresses(open);

  const isLoading = crmLoading || mapboxLoading;

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

  const handleSelectMapbox = async (suggestion: GeoSuggestion) => {
    let address: Awaited<ReturnType<typeof retrieve>>;
    try {
      address = await retrieve(suggestion.id);
    } catch {
      toast.error('Não foi possível buscar os detalhes deste endereço. Tente novamente.');
      return;
    }
    if (!address) return;
    setInputValue(address.formatted);
    onChange(address.formatted);
    // Emite o endereço resolvido mesmo sem coordenada: o texto e os componentes
    // (cidade/UF/CEP) já valem, e o consumidor decide o que fazer com a falta de ponto.
    onAddressSelected?.(address);
    // Etapa 20: avisa quando o provedor devolveu coordenada interpolada/aproximada —
    // 40 % dos endereços BR medidos (etapa 36) caem em `interpolated`; sem isto o operador
    // grava um ponto a centenas de metros do imóvel sem saber.
    if (address.precision && (address.precision === 'medium' || address.precision === 'low')) {
      toast.warning('Endereço localizado com precisão aproximada — confira o ponto no mapa antes de salvar.');
    }
    // Sem coordenada o retrieve não localizou o ponto: nunca propagar [0,0] (que cai no
    // Golfo da Guiné e vira ponto de entrega inválido). Só o texto fica preenchido.
    const point = resolveDeliveryPoint(address);
    if (!point) {
      toast.warning('Endereço encontrado sem coordenada — selecione outro resultado ou marque o ponto no mapa.');
      setOpen(false);
      return;
    }
    if (onSelectMapbox || onCoordinatesChange) {
      const feature: MapboxFeature = {
        id: address.place_id ?? suggestion.id,
        place_name: address.formatted,
        text: suggestion.main_text,
        center: [point.lng, point.lat],
        place_type: [suggestion.type],
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      };
      onSelectMapbox?.(feature);
      onCoordinatesChange?.(point.lat, point.lng);
    }
    setOpen(false);
  };

  const handleSelectFrequent = (item: FrequentAddress) => {
    setInputValue(item.address);
    onChange(item.address);
    if (onSelectMapbox || onCoordinatesChange) {
      const feature: MapboxFeature = {
        id: `lalamove:${normalizeAddressKey(item.address)}`,
        place_name: item.address,
        text: item.address,
        center: [item.longitude, item.latitude],
        place_type: [item.side],
        geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
      };
      onSelectMapbox?.(feature);
      onCoordinatesChange?.(item.latitude, item.longitude);
    }
    setOpen(false);
  };

  const crmResults = crmData?.results ?? [];
  // Só sugere o que casa com o que o operador digitou; a lista cheia fica para o campo vazio.
  const frequentMatches = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return (frequentAddresses ?? [])
      .filter((item) => term.length < 2 || item.address.toLowerCase().includes(term))
      .slice(0, 5);
  }, [frequentAddresses, debouncedSearch]);
  const hasResults = crmResults.length > 0 || mapboxResults.length > 0 || frequentMatches.length > 0;

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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && hasResults}
          aria-controls={listboxId}
          aria-label={placeholder}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && hasResults && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Sugestões de endereço"
          className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
        <div className="max-h-72 overflow-y-auto">
          {/* Endereços já usados (etapa 41) — zero chamada ao provedor */}
          {frequentMatches.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/30 border-b border-border/30">
                Já usados ({frequentMatches.length})
              </div>
              {frequentMatches.map((item) => (
                <button
                  key={`freq-${item.address}`}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/30"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelectFrequent(item)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-foreground truncate">{item.address}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 flex-shrink-0">
                      <MapPin className="w-3 h-3" />
                      {item.hits}x
                    </Badge>
                  </div>
                </button>
              ))}
            </>
          )}

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
                  role="option"
                  aria-selected={false}
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

          {/* Mapbox Search Box Results */}
          {mapboxResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/30 border-b border-border/30">
                Mapbox Search Box
              </div>
              {mapboxResults.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSelectMapbox(suggestion)}
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
            </>
          )}
        </div>
          {mapboxResults.length > 0 && (
            <p className="px-3 py-1 text-[10px] text-muted-foreground/70 bg-muted/20 border-t border-border/30">
              © Mapbox © OpenStreetMap
            </p>
          )}
        </div>
      )}

      {open && debouncedSearch.length >= 2 && !isLoading && !hasResults && crmResults.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-4">
          {searchFailure ? (
            <div className="flex items-start gap-2 text-left">
              <AlertTriangle
                className={cn(
                  'w-4 h-4 mt-0.5 flex-shrink-0',
                  searchFailure.type === 'quota' ? 'text-destructive' : 'text-amber-500',
                )}
              />
              <div className="space-y-1">
                <p className="text-sm text-foreground">
                  {searchFailure.type === 'quota' ? 'Limite de busca atingido' : 'Busca indisponível'}
                </p>
                <p className="text-xs text-muted-foreground">{searchFailure.message}</p>
                {onUseTypedAddress && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 gap-1.5"
                    onClick={() => {
                      onUseTypedAddress(inputValue.trim());
                      setOpen(false);
                    }}
                  >
                    <PencilLine className="w-3.5 h-3.5" /> Usar o endereço como digitado
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                Nenhum resultado para “{debouncedSearch}”
              </p>
              <p className="text-xs text-muted-foreground">
                Tente incluir o número do imóvel ou o CEP.
              </p>
              {onUseTypedAddress && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1 gap-1.5"
                  onClick={() => {
                    onUseTypedAddress(inputValue.trim());
                    setOpen(false);
                  }}
                >
                  <PencilLine className="w-3.5 h-3.5" /> Usar o endereço como digitado
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
