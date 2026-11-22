/**
 * Precisao de geocodificacao — fonte unica do mapeamento `accuracy` do Mapbox
 * (`properties.coordinates.accuracy`) para o vocabulario de negocio `GeoPrecision`.
 *
 * Etapa 13 do plano de 100 etapas: o mapa vivia so dentro de
 * `geo-gateway/providers/mapbox.ts`. Extraido para ca porque o `geo-gateway` nao e o
 * unico produtor de coordenada — qualquer edge que persista coordenada precisa falar a
 * mesma escala, senao "exact" de um lado e "rooftop" do outro viram grandezas
 * incomparaveis no relatorio.
 */

export type GeoPrecision = "exact" | "high" | "medium" | "low" | "unknown";

/** Mapeamento oficial Mapbox Geocoding v6 `accuracy` -> precisao de negocio. */
export const ACCURACY_TO_PRECISION: Readonly<Record<string, GeoPrecision>> = {
  rooftop: "exact",
  parcel: "exact",
  point: "high",
  interpolated: "medium",
  intersection: "medium",
  approximate: "low",
  street: "low",
};

/** Converte o `accuracy` bruto do provedor; desconhecido nunca vira "exact". */
export function precisionFromAccuracy(accuracy: string | null | undefined): GeoPrecision {
  if (!accuracy) return "unknown";
  return ACCURACY_TO_PRECISION[accuracy] ?? "unknown";
}
