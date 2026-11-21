// Tipos centrais do geo-gateway — interface GeoProvider e ações suportadas.

export type GeoAction =
  | "autocomplete"
  | "place-details"
  | "geocode"
  | "reverse"
  | "batch-geocode"
  | "route"
  | "matrix"
  | "static-map"
  | "snap"
  | "isochrone"
  | "optimization"
  | "tilequery"
  | "count-map-load";

export interface GeoProviderResult {
  data: unknown;
  provider: string;
  /** SKU de faturamento (ex: geocoding_temporary, matrix, directions). */
  sku?: string;
  /** Número de unidades cobradas nesta chamada (ex: sources×destinations na Matrix). */
  units?: number;
  /** true quando a resposta veio do geo_cache (sem custo externo). */
  cached?: boolean;
}

export interface GeoProvider {
  name: string;
  /**
   * Executa a ação solicitada e retorna o resultado normalizado.
   * Lança erro em caso de falha da API externa ou ação não suportada.
   */
  handle(
    action: GeoAction,
    params: Record<string, unknown>,
    req: Request,
  ): Promise<GeoProviderResult>;
}

export interface GeoRequest {
  action: GeoAction;
  /** Sobrescreve o provedor configurado em geo_settings para esta chamada. */
  provider?: "mapbox" | "google" | "auto";
  /** Quando true, coordenadas geocodificadas podem ser persistidas (Mapbox permanent=true). */
  persist?: boolean;
  [key: string]: unknown;
}
