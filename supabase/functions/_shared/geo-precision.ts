// Etapa 13 do plano Mapbox (docs/planos/PLANO_MAPBOX_100_ETAPAS.md): escala interna única de
// precisão de geocode, compartilhada entre provedores. Cada provedor devolve seu próprio
// vocabulário de precisão (Mapbox: `accuracy` do Search Box/Geocoding v6; Google: `location_type`
// do Geocoding API) — este arquivo é a única fonte da tradução pra `GeoPrecision`
// (`geo-gateway/providers/types.ts`), pra nenhum provedor inventar seu próprio mapeamento solto.

export type GeoPrecision = "exact" | "high" | "medium" | "low" | "unknown";

/**
 * Mapbox `properties.coordinates.accuracy` (Search Box retrieve / Geocoding v6 forward/reverse) →
 * escala interna. Valores possíveis: docs.mapbox.com/api/search/geocoding-v6 (`Accuracy`).
 */
export const MAPBOX_ACCURACY_TO_PRECISION: Record<string, GeoPrecision> = {
  rooftop: "exact",
  parcel: "exact",
  point: "high",
  interpolated: "medium",
  intersection: "medium",
  approximate: "low",
  street: "low",
};

/**
 * Google Geocoding API `location_type` → escala interna. Nenhum provider Google existe ainda
 * neste `geo-gateway` (ver `providers/` — só `mapbox.ts`); mapeamento documentado aqui porque a
 * etapa 13 pede a correspondência entre as duas escalas antes do provider Google ser portado, pra
 * quem escrever `providers/google.ts` importar daqui em vez de redescobrir os valores.
 */
export const GOOGLE_LOCATION_TYPE_TO_PRECISION: Record<string, GeoPrecision> = {
  ROOFTOP: "exact",
  RANGE_INTERPOLATED: "medium",
  GEOMETRIC_CENTER: "medium",
  APPROXIMATE: "low",
};
