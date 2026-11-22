import { useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Search Box (geo-gateway: action 'autocomplete'/'place-details') — substitui o
// mapbox-proxy/Geocoding v5 direto. session_token obrigatório: inicia no primeiro
// caractere digitado, vale para toda a sessão de sugestões e é renovado após o
// retrieve (regra de cobrança por sessão do Search Box, ToS etapa 8).

export interface GeoSuggestion {
  id: string; // "<provider>:<id>"
  main_text: string;
  secondary_text: string;
  type: string;
  provider: 'google' | 'mapbox';
}

export interface GeoAddress {
  formatted: string;
  place_id: string | null;
  location: { lat: number; lng: number } | null;
  components: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  provider: 'google' | 'mapbox';
  /** Precisão do provedor: exact | high | medium | low | unknown (etapa 20) */
  precision?: string;
  /**
   * Ponto de acesso do veículo (etapa 21). O Mapbox devolve `routable_points[]`
   * quando a rua não é acessível no número exato — condomínio, viela, rodovia.
   * Sempre que existir, é a coordenada correta para coleta/entrega: é onde o
   * motorista consegue parar, não o centroide do imóvel.
   */
  routable_point?: { lat: number; lng: number } | null;
}

/**
 * Coordenada de coleta/entrega: prioriza o ponto roteável e cai para o centroide.
 * Retorna `null` quando o provedor não devolveu nenhum dos dois — nunca `[0,0]`,
 * que viraria pedido no Golfo da Guiné.
 */
export function resolveDeliveryPoint(address: GeoAddress): { lat: number; lng: number } | null {
  if (address.routable_point?.lat != null && address.routable_point?.lng != null) {
    return address.routable_point;
  }
  return address.location ?? null;
}

function newSessionToken(): string {
  return crypto.randomUUID();
}

export function useAddressSearchBox(query: string, enabled: boolean) {
  const sessionTokenRef = useRef<string>(newSessionToken());

  // Campo limpo sem retrieve = sessão de busca abandonada; renova o token para
  // a próxima busca não herdar uma sessão que nunca terminou em seleção.
  useEffect(() => {
    if (query.length === 0) sessionTokenRef.current = newSessionToken();
  }, [query]);

  const { data, isLoading, isError } = useQuery<GeoSuggestion[]>({
    queryKey: ['geo-search', 'autocomplete', query],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('geo-gateway', {
        body: {
          action: 'autocomplete',
          input: query,
          session_token: sessionTokenRef.current,
          country: 'br',
          language: 'pt',
          limit: 5,
        },
      });
      if (error) throw error;
      return (data as GeoSuggestion[]) ?? [];
    },
    enabled: enabled && query.length >= 3,
    staleTime: 60_000,
  });

  const retrieve = useCallback(async (placeId: string): Promise<GeoAddress | null> => {
    const { data, error } = await supabase.functions.invoke('geo-gateway', {
      body: { action: 'place-details', place_id: placeId, session_token: sessionTokenRef.current },
    });
    sessionTokenRef.current = newSessionToken();
    if (error) throw error;
    return (data as GeoAddress) ?? null;
  }, []);

  return { suggestions: data ?? [], isLoading, isError, retrieve };
}
