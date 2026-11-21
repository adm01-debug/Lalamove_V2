// Camada de mapas (Google / Mapbox) via edge `geo-gateway` — o provedor é escolhido no servidor
// (geo_settings), com cache, medição de custo e orçamento. O front nunca fala com Google/Mapbox direto.
// Plano: docs/planos/PLANO_MAPBOX_100_ETAPAS.md (etapas 35–37) e PLANO_GOOGLE_MAPS_100_ETAPAS.md (33–34).
import { useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GeoProviderName = 'google' | 'mapbox';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoSuggestion {
  id: string; // "<provider>:<id>"
  main_text: string;
  secondary_text: string;
  type: string;
  provider: GeoProviderName;
}

export interface GeoAddress {
  formatted: string;
  place_id: string | null;
  location: GeoPoint | null;
  routable_point?: GeoPoint | null;
  components: {
    street?: string; number?: string; district?: string; city?: string; state?: string; postal_code?: string; country?: string;
  };
  precision: 'exact' | 'high' | 'medium' | 'low' | 'unknown';
  match_confidence?: string;
  provider: GeoProviderName;
  /** false = coordenada temporária (Mapbox): usar só para cotação/visual, não gravar */
  retainable: boolean;
}

export class GeoGatewayError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'GeoGatewayError';
  }
}

async function geoGateway<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('geo-gateway', { body });
  if (error) {
    // FunctionsHttpError traz o Response; o corpo segue o formato único de erro do contrato
    const ctx = (error as { context?: Response }).context;
    let message = error.message;
    let code: string | undefined;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = await ctx.json();
        message = parsed?.error?.message ?? message;
        code = parsed?.error?.fields?.[0]?.code ?? parsed?.error?.code;
      } catch { /* corpo não-JSON */ }
    }
    throw new GeoGatewayError(message, ctx?.status, code);
  }
  return data as T;
}

/** Sessão de autocomplete: 1 token por "digitar → escolher"; é o que a Mapbox/Google cobram por sessão. */
export function useGeoSession() {
  const tokenRef = useRef<string | null>(null);
  const startedAt = useRef(0);
  const SESSION_MAX_MS = 170_000; // Mapbox fecha a sessão em 180 s sem retrieve

  const get = useCallback(() => {
    const now = Date.now();
    if (!tokenRef.current || now - startedAt.current > SESSION_MAX_MS) {
      tokenRef.current = crypto.randomUUID();
      startedAt.current = now;
    }
    return tokenRef.current;
  }, []);

  const end = useCallback(() => {
    tokenRef.current = null;
  }, []);

  return { get, end };
}

/** Sugestões de endereço (Search Box / Places). `enabled` controla a chamada; mínimo 3 caracteres. */
export function useGeoAutocomplete(
  input: string,
  sessionToken: string | null,
  enabled = true,
  bias?: GeoPoint,
) {
  const trimmed = input.trim();
  return useQuery<GeoSuggestion[], GeoGatewayError>({
    queryKey: ['geo', 'autocomplete', sessionToken, trimmed, bias?.lat, bias?.lng],
    queryFn: () => geoGateway<GeoSuggestion[]>({
      action: 'autocomplete',
      input: trimmed,
      session_token: sessionToken ?? undefined,
      ...(bias ? { bias: { lat: bias.lat, lng: bias.lng, radius_m: 60_000 } } : {}),
      country: 'br',
      language: 'pt',
      limit: 5,
    }),
    enabled: enabled && trimmed.length >= 3 && !!sessionToken,
    staleTime: 60_000,
    retry: false,
  });
}

/** Detalhe de uma sugestão (fecha a sessão de cobrança): coordenada, componentes, precisão. */
export async function fetchGeoPlace(placeId: string, sessionToken: string | null): Promise<GeoAddress> {
  return geoGateway<GeoAddress>({ action: 'place-details', place_id: placeId, session_token: sessionToken ?? undefined });
}

/** Geocode direto (texto ou estruturado). `persist: true` só quando a coordenada vai ser gravada. */
export async function fetchGeoGeocode(args: {
  address?: string;
  structured?: { address_line1?: string; postal_code?: string; city?: string; state?: string; country?: string };
  persist?: boolean;
}): Promise<GeoAddress[]> {
  return geoGateway<GeoAddress[]>({ action: 'geocode', country: 'br', language: 'pt', limit: 5, ...args });
}
