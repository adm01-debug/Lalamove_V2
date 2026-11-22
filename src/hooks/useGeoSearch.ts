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

/**
 * Etapa 81 do plano Google Maps — viés de localização do autocomplete.
 *
 * Sem `proximity`, o Search Box do Mapbox ordena por relevância global e um
 * endereço de Curitiba ("Rua XV de Novembro") perde para homônimos de outras
 * capitais. O viés vem do mapa que o operador está olhando: passar o centro do
 * mapa é mais fiel à intenção dele do que fixar a sede da empresa.
 *
 * `radius_m` fica em 50 km: cobre a região metropolitana sem descartar o
 * interior próximo, e é o teto que o Mapbox usa para `proximity` sem penalizar
 * resultados fora do raio (ele só reordena — não filtra).
 */
export interface SearchBias {
  lat: number;
  lng: number;
  radius_m?: number;
}

const DEFAULT_BIAS_RADIUS_M = 50_000;

/**
 * Etapa 81: viés a partir do último pedido do cliente/fornecedor.
 *
 * Quando o operador está criando pedido para alguém que já comprou, a região do
 * último pedido é o palpite certo — melhor que o centro do mapa vazio ou a sede
 * da empresa. Devolve `null` sem histórico, e quem chama cai no centro do mapa.
 */
export function useCustomerSearchBias(customerPhone?: string | null): SearchBias | null {
  const { data } = useQuery<SearchBias | null>({
    queryKey: ['geo-search', 'customer-bias', customerPhone ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lalamove_orders')
        // `pickup_latitude/longitude` é a geocodificação da coleta (etapa 37).
        // `delivery_*` como fallback cobre pedido cuja coleta não foi geocodificada.
        .select('pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, created_at')
        // `lalamove_orders` não tem `customer_id`: o cliente é identificado por
        // `customer_name`/`customer_phone`. O telefone é o que não muda quando o
        // operador digita o nome com variação de grafia.
        .eq('customer_phone', customerPhone as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      const row = data as {
        pickup_latitude?: number | null;
        pickup_longitude?: number | null;
        delivery_latitude?: number | null;
        delivery_longitude?: number | null;
      } | null;
      if (!row) return null;
      const lat = row.pickup_latitude ?? row.delivery_latitude;
      const lng = row.pickup_longitude ?? row.delivery_longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      return { lat, lng, radius_m: DEFAULT_BIAS_RADIUS_M };
    },
    enabled: !!customerPhone,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data ?? null;
}

export function useAddressSearchBox(
  query: string,
  enabled: boolean,
  bias?: SearchBias | null,
) {
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
    // O viés entra na queryKey: mudar o centro do mapa muda a ordem das
    // sugestões, então o cache não pode devolver a lista do centro anterior.
    queryKey: ['geo-search', 'autocomplete', query, bias?.lat ?? null, bias?.lng ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('geo-gateway', {
        body: {
          action: 'autocomplete',
          input: query,
          session_token: currentSessionToken(),
          country: 'br',
          language: 'pt',
          limit: 5,
          ...(bias ? { bias: { lat: bias.lat, lng: bias.lng, radius_m: bias.radius_m ?? DEFAULT_BIAS_RADIUS_M } } : {}),
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
