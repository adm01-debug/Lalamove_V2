// Implementação única dos hooks de mapa. `useMapbox.ts` é o módulo que fala com o
// geo-gateway (camada única de provedores: cache, orçamento e `geo_settings`), e este
// arquivo existe para que consumidores novos importem de `@/hooks/useGeo`.
// Ver docs/planos/PLANO_MAPBOX_100_ETAPAS.md, etapas 60 e 83.
export * from "./useMapbox";

// ── Contrato nomeado do plano Google (etapa 33) ──────────────────────────────
//
// Os hooks acima (série `useMapbox*`) existem antes do plano de 100 etapas e
// devolvem formatos adaptados às telas antigas (GeoJSON v5, LineString). Os hooks
// abaixo expõem o **contrato cru do gateway** tipado por `@/types/geo` — mesmos
// nomes pedidos na etapa 33 e mesma fonte de dados (`callGeo` → `geo-gateway`),
// sem duplicar sessão do Search Box nem cache de autocomplete.
//
// Quando usar qual: tela nova/compartilhada entre Google e Mapbox → estes; tela
// legada que já consome `GeocodingResult`/`DirectionsResult` → os `useMapbox*`.

import { useMutation, useQuery } from "@tanstack/react-query";
import { callGeo, GeoGatewayError } from "@/lib/geo-gateway";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAddressSearchBox } from "@/hooks/useGeoSearch";
import type {
  GeoAddress,
  GeoAutocompleteRequest,
  GeoBias,
  GeoGeocodeRequest,
  GeoMatrix,
  GeoMatrixRequest,
  GeoPrecision,
  GeoRoute,
  GeoRouteRequest,
  GeoStaticImage,
  GeoStaticRequest,
  GeoSuggestion,
} from "@/types/geo";

/** 404 do gateway é resultado vazio, não falha de busca. */
function isNotFound(e: unknown): boolean {
  return e instanceof GeoGatewayError && e.isNotFound;
}

const GEO_PRECISIONS = ["exact", "high", "medium", "low", "unknown"] as const;

/** O hook de busca antigo tipa `precision` como string livre; aqui volta ao vocabulário do edge. */
function toGeoPrecision(value: string | undefined): GeoPrecision {
  return (GEO_PRECISIONS as readonly string[]).includes(value ?? "") ? (value as GeoPrecision) : "unknown";
}

export interface UseGeoAutocompleteOptions {
  bias?: GeoBias | null;
  enabled?: boolean;
  /** Padrão da etapa 33: 300 ms. */
  debounceMs?: number;
}

export interface UseGeoAutocompleteResult {
  suggestions: GeoSuggestion[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** `place-details` do item escolhido; renova o `session_token` da sessão. */
  retrieve: (placeId: string) => Promise<GeoAddress | null>;
  /** Texto já debounced — é ele que foi enviado ao provedor. */
  debouncedInput: string;
}

/**
 * Etapa 33 — autocomplete com debounce e sessão do Search Box.
 *
 * O `session_token` (uuid v4) nasce no primeiro caractere e é renovado depois do
 * `place-details` (ou quando o campo é limpo): é a regra de cobrança por sessão do
 * provedor, já implementada em `useAddressSearchBox`. Aqui só entra o debounce.
 */
export function useGeoAutocomplete(
  input: string,
  options: UseGeoAutocompleteOptions = {},
): UseGeoAutocompleteResult {
  const debouncedInput = useDebouncedValue(input, options.debounceMs ?? 300);
  const box = useAddressSearchBox(
    debouncedInput,
    options.enabled ?? true,
    options.bias ?? null,
  );
  return {
    suggestions: box.suggestions,
    isLoading: box.isLoading,
    isError: box.isError,
    error: box.error,
    // O gateway sempre devolve `precision` (etapa 20); o hook de busca antigo
    // declara o campo como opcional. Normaliza para o contrato de `@/types/geo`
    // sem duplicar a chamada nem a renovação do `session_token`.
    retrieve: async (placeId: string): Promise<GeoAddress | null> => {
      const address = await box.retrieve(placeId);
      if (!address) return null;
      return { ...address, precision: toGeoPrecision(address.precision) };
    },
    debouncedInput,
  };
}

/** Etapa 33 — detalhe de um `place_id` (o retrieve da sessão de busca). */
export function useGeoPlaceDetails() {
  return useMutation<GeoAddress | null, Error, GeoPlaceDetailsVars>({
    mutationFn: async (vars) => {
      const address = await callGeo<GeoAddress | null>({
        action: "place-details",
        place_id: vars.placeId,
        ...(vars.sessionToken ? { session_token: vars.sessionToken } : {}),
        ...(vars.mode ? { mode: vars.mode } : {}),
        ...(vars.address ? { address: vars.address } : {}),
        country: "br",
        language: "pt",
      });
      // O gateway sempre manda `precision` (etapa 20); normalizar aqui mantém o
      // tipo `GeoAddress` fechado mesmo se um provedor futuro omitir o campo.
      return address ? { ...address, precision: toGeoPrecision(address.precision) } : null;
    },
  });
}

export interface GeoPlaceDetailsVars {
  placeId: string;
  sessionToken?: string;
  /** `geocoding` quando o provedor não tem retrieve por id (etapa 22). */
  mode?: "searchbox" | "geocoding";
  address?: string;
}

/** Etapa 33 — geocode por endereço (ou componentes estruturados). Lista vazia em 404. */
export function useGeocode(
  address: string,
  enabled = true,
  options: Omit<GeoGeocodeRequest, "address"> = {},
) {
  const query = address.trim();
  return useQuery<GeoAddress[]>({
    queryKey: ["geo", "geocode", query, options.structured?.city ?? null, options.bias?.lat ?? null, options.bias?.lng ?? null],
    queryFn: async () => {
      try {
        const body: GeoGeocodeRequest = { address: query, country: "br", language: "pt", limit: 5, ...options };
        return (await callGeo<GeoAddress[]>({ action: "geocode", ...body })) ?? [];
      } catch (e) {
        if (isNotFound(e)) return [];
        throw e;
      }
    },
    enabled: enabled && query.length >= 3,
    staleTime: 5 * 60_000,
  });
}

/** Etapa 33 — rota entre origem, waypoints e destino. */
export function useRoute() {
  return useMutation<GeoRoute, Error, GeoRouteRequest>({
    mutationFn: (vars) => callGeo<GeoRoute>({ action: "route", ...vars }),
  });
}

/** Etapa 33 — matriz de distância/duração. Célula `null` = par inalcançável. */
export function useMatrix() {
  return useMutation<GeoMatrix, Error, GeoMatrixRequest>({
    mutationFn: (vars) => callGeo<GeoMatrix>({ action: "matrix", ...vars }),
  });
}

/** Etapa 33 — mapa estático como data URL PNG (serve `<img>` e o WhatsApp da etapa 68). */
export function useStaticMap() {
  return useMutation<GeoStaticImage, Error, GeoStaticRequest>({
    mutationFn: (vars) => callGeo<GeoStaticImage>({ action: "static", ...vars }),
  });
}

export type { GeoAutocompleteRequest };
