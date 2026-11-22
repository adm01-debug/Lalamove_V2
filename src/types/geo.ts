/**
 * Tipos do contrato do `geo-gateway` no front.
 *
 * Espelha `supabase/functions/_shared/schemas.ts` (bloco "geo-gateway") e os
 * payloads de resposta de `supabase/functions/geo-gateway/providers/types.ts`.
 * Quando o contrato do edge mudar, este arquivo muda junto — os hooks de
 * `src/hooks/useGeo.ts` são tipados por ele.
 *
 * Etapa 33 do docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md.
 */

export type ProviderName = 'google' | 'mapbox';

/** Funções da camada de provedor — cada uma tem linha própria em `geo_settings`. */
export type GeoFunction =
  | 'tiles'
  | 'autocomplete'
  | 'geocode'
  | 'reverse'
  | 'route'
  | 'matrix'
  | 'static'
  | 'snap'
  | 'validate'
  | 'isochrone'
  | 'optimization'
  | 'tilequery';

/** Precisão de geocodificação — mesmo vocabulário de negócio do edge. */
export type GeoPrecision = 'exact' | 'high' | 'medium' | 'low' | 'unknown';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Centro de busca + raio. O provedor só reordena o resultado, nunca filtra por ele. */
export type GeoBias = GeoPoint & { radius_m?: number };

export interface GeoSuggestion {
  /** `<provider>:<id do provedor>` — é o que volta em `place-details`. */
  id: string;
  main_text: string;
  secondary_text: string;
  type: string;
  provider: ProviderName;
}

export interface GeoAddressComponents {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface GeoAddress {
  formatted: string;
  place_id: string | null;
  location: GeoPoint | null;
  /** Onde o veículo consegue parar quando o número não é acessível (etapa 21). */
  routable_point?: GeoPoint | null;
  components: GeoAddressComponents;
  precision: GeoPrecision;
  match_confidence?: string;
  provider: ProviderName;
  /** `false` quando o provedor não permite guardar a coordenada (ToS). */
  retainable?: boolean;
}

export interface GeoRouteLeg {
  distance_m: number;
  duration_s: number;
}

export interface GeoRoute {
  polyline: GeoPoint[];
  distance_m: number;
  duration_s: number;
  duration_traffic_s?: number;
  legs: GeoRouteLeg[];
  provider: ProviderName;
  profile: string;
}

/** Célula `null` = par inalcançável; a tela decide como exibir. */
export interface GeoMatrix {
  durations_s: (number | null)[][];
  distances_m: (number | null)[][];
  provider: ProviderName;
  profile: string;
}

export interface GeoStaticImage {
  /** data URL PNG — pronto para `<img src>` e para o envio no WhatsApp. */
  image: string;
  width: number;
  height: number;
  provider: ProviderName;
}

// ── Requests (mesmos campos aceitos pelo schema do edge) ──

export type GeoMode = 'searchbox' | 'geocoding';
export type GeoProfile = 'driving-traffic' | 'driving' | 'walking' | 'cycling';

export type GeoAutocompleteRequest = {
  input: string;
  session_token?: string;
  bias?: GeoBias;
  country?: string;
  language?: string;
  limit?: number;
  mode?: GeoMode;
  provider?: ProviderName;
};

export type GeoPlaceDetailsRequest = {
  place_id: string;
  session_token?: string;
  mode?: GeoMode;
  address?: string;
  country?: string;
  language?: string;
  provider?: ProviderName;
};

export type GeoGeocodeRequest = {
  address?: string;
  structured?: {
    address_line1?: string;
    postal_code?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  bias?: GeoBias;
  country?: string;
  language?: string;
  limit?: number;
  persist?: boolean;
  provider?: ProviderName;
};

export type GeoRouteRequest = {
  origin: GeoPoint;
  destination: GeoPoint;
  waypoints?: GeoPoint[];
  profile?: GeoProfile;
  traffic?: boolean;
  alternatives?: boolean;
  language?: string;
  provider?: ProviderName;
};

export type GeoMatrixRequest = {
  origins: GeoPoint[];
  destinations: GeoPoint[];
  profile?: GeoProfile;
  traffic?: boolean;
  provider?: ProviderName;
};

export type GeoStaticRequest = {
  width?: number;
  height?: number;
  markers?: Array<GeoPoint & { color?: string; label?: string }>;
  path?: GeoPoint[];
  center?: GeoPoint;
  zoom?: number;
  style?: string;
  provider?: ProviderName;
};
