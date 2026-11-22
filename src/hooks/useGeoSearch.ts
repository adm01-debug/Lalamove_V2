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
