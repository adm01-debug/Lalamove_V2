// Resolução do provedor ativo com base em geo_settings (ou override explícito).
// TODO (etapa 64): ler geo_settings do banco para modo 'auto'.

import type { GeoProvider } from "./_types.ts";
import { MapboxProvider } from "./providers/mapbox.ts";
import { GoogleProvider } from "./providers/google.ts";

const _mapbox = new MapboxProvider();
const _google = new GoogleProvider();

/**
 * Retorna o GeoProvider correto.
 * - Override explícito (campo `provider` no body) tem prioridade.
 * - Padrão atual: Mapbox (todos os serviços disponíveis; Google ainda não implementado).
 */
export function resolveProvider(requested?: string): GeoProvider {
  if (requested === "google") return _google;
  return _mapbox;
}
