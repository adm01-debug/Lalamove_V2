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

/**
 * Teto de vida da sessão do Search Box (etapa 37).
 * O Mapbox fecha a sessão em 180 s; um `retrieve` com token vencido deixa de ser
 * cobrado como sessão e cada `suggest` seguinte passa a abrir uma sessão nova,
 * inflando o sku `searchbox_session`. Renovamos aos 170 s para nunca chegar no limite.
 */
const SESSION_TTL_MS = 170_000;

export function useAddressSearchBox(query: string, enabled: boolean) {
  const sessionTokenRef = useRef<string>(newSessionToken());
  // Marca de início preguiçosa: ler o relógio no render violaria a pureza do componente.
  const sessionStartedAtRef = useRef<number | null>(null);

  const renewSession = useCallback((): void => {
    sessionTokenRef.current = newSessionToken();
    sessionStartedAtRef.current = Date.now();
  }, []);

  // Devolve um token vivo: sessão vencida é descartada antes de ir ao provedor.
  const currentSessionToken = useCallback((): string => {
    const startedAt = sessionStartedAtRef.current;
    if (startedAt === null || Date.now() - startedAt > SESSION_TTL_MS) renewSession();
    return sessionTokenRef.current;
  }, [renewSession]);

  // Campo limpo sem retrieve = sessão de busca abandonada; renova o token para
  // a próxima busca não herdar uma sessão que nunca terminou em seleção.
  useEffect(() => {
    if (query.length === 0) renewSession();
  }, [query, renewSession]);

  const { data, isLoading, isError, error } = useQuery<GeoSuggestion[]>({
    queryKey: ['geo-search', 'autocomplete', query],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('geo-gateway', {
        body: {
          action: 'autocomplete',
          input: query,
          session_token: currentSessionToken(),
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
      body: { action: 'place-details', place_id: placeId, session_token: currentSessionToken() },
    });
    renewSession();
    if (error) throw error;
    return (data as GeoAddress) ?? null;
  }, [currentSessionToken, renewSession]);

  return { suggestions: data ?? [], isLoading, isError, error, retrieve };
}

export interface FrequentAddress {
  address: string;
  latitude: number;
  longitude: number;
  /** Quantas vezes o endereço já apareceu em pedidos. */
  hits: number;
  /** De onde o ponto veio: coleta ou entrega do pedido anterior. */
  side: 'pickup' | 'delivery';
}

interface FrequentOrderRow {
  pickup_address: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
}

export function normalizeAddressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Etapa 41: endereços já geocodificados em pedidos anteriores.
 *
 * Custo zero — nenhum `suggest`/`retrieve` é chamado. Antes de abrir uma sessão do
 * Search Box o operador vê primeiro o que já foi localizado e aprovado pela Lalamove
 * num pedido real; endereço repetido nunca gera sessão cobrada.
 */
export function useFrequentAddresses(enabled = true, limit = 8) {
  return useQuery<FrequentAddress[]>({
    queryKey: ['geo', 'frequent-addresses', limit],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('lalamove_orders')
        .select('pickup_address, pickup_latitude, pickup_longitude, delivery_address, delivery_latitude, delivery_longitude')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const seen = new Map<string, FrequentAddress>();
      const bump = (
        address: string | null,
        latitude: number | null,
        longitude: number | null,
        side: 'pickup' | 'delivery',
      ): void => {
        if (!address || latitude == null || longitude == null) return;
        const key = normalizeAddressKey(address);
        const current = seen.get(key);
        if (current) {
          current.hits += 1;
          return;
        }
        seen.set(key, {
          address: address.trim(),
          latitude: Number(latitude),
          longitude: Number(longitude),
          hits: 1,
          side,
        });
      };

      for (const row of (data as FrequentOrderRow[] | null) ?? []) {
        bump(row.pickup_address, row.pickup_latitude, row.pickup_longitude, 'pickup');
        bump(row.delivery_address, row.delivery_latitude, row.delivery_longitude, 'delivery');
      }

      return [...seen.values()].sort((a, b) => b.hits - a.hits).slice(0, limit);
    },
    staleTime: 5 * 60_000,
    enabled,
    retry: false,
  });
}
