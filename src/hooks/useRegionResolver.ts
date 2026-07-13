import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

/**
 * Resolve coordenadas de entrega em regiões precisas (bairro/cidade) via
 * reverse geocoding do Mapbox, com cache persistente em localStorage para
 * evitar chamadas repetidas e respeitar limites de taxa.
 *
 * A resolução é assíncrona e incremental: a UI usa o fallback textual até que
 * as regiões sejam resolvidas, momento em que o estado é atualizado.
 */

export interface Coord {
  lat: number;
  lng: number;
}

const CACHE_KEY = 'mapbox-region-cache:v1';
/** ~110m de precisão — agrupa entregas próximas no mesmo ponto de consulta. */
const PRECISION = 3;
/** Máximo de coordenadas novas resolvidas por execução (proteção de custo). */
const MAX_PER_RUN = 60;
/** Requisições simultâneas ao proxy. */
const CONCURRENCY = 5;

type RegionCache = Record<string, string>;

/** Chave estável para uma coordenada arredondada. */
export function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(PRECISION)},${lng.toFixed(PRECISION)}`;
}

function readCache(): RegionCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as RegionCache) : {};
  } catch (err) {
    logger.error('Erro ao ler cache de regiões:', err);
    return {};
  }
}

function writeCache(cache: RegionCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    logger.error('Erro ao gravar cache de regiões:', err);
  }
}

interface MapboxContextEntry {
  id: string;
  text: string;
}

interface MapboxFeatureLike {
  text: string;
  place_name?: string;
  place_type?: string[];
  context?: MapboxContextEntry[];
}

interface ReverseResult {
  features?: MapboxFeatureLike[];
}

/**
 * Extrai a região mais representativa de um resultado de reverse geocode.
 * Preferência: bairro → localidade → cidade. Usa o `context` como reforço.
 */
export function pickRegion(result: ReverseResult): string | null {
  const features = result.features ?? [];
  if (features.length === 0) return null;

  const byType = (type: string) =>
    features.find((f) => f.place_type?.includes(type))?.text;

  const fromContext = (prefix: string) => {
    for (const f of features) {
      const hit = f.context?.find((c) => c.id.startsWith(prefix));
      if (hit?.text) return hit.text;
    }
    return undefined;
  };

  return (
    byType('neighborhood') ||
    fromContext('neighborhood') ||
    byType('locality') ||
    fromContext('locality') ||
    byType('place') ||
    fromContext('place') ||
    features[0]?.text ||
    null
  );
}

export interface RegionResolution {
  /** Mapa de chave-de-coordenada → região resolvida. */
  regions: RegionCache;
  /** Total de coordenadas únicas válidas consideradas. */
  total: number;
  /** Quantas ainda faltam ser resolvidas (aguardando reverse geocode). */
  pending: number;
  /** True enquanto há coordenadas sendo resolvidas em segundo plano. */
  isResolving: boolean;
}

export function useRegionResolver(coords: Coord[]): RegionCache {
  return useRegionResolution(coords).regions;
}

export function useRegionResolution(coords: Coord[]): RegionResolution {
  const [regions, setRegions] = useState<RegionCache>(() => readCache());
  const [activeCount, setActiveCount] = useState(0);
  const inFlight = useRef<Set<string>>(new Set());

  // Estabiliza a lista de coordenadas únicas válidas por chave.
  const uniqueCoords = useMemo(() => {
    const map = new Map<string, Coord>();
    for (const c of coords) {
      if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
      if (c.lat === 0 && c.lng === 0) continue;
      map.set(coordKey(c.lat, c.lng), c);
    }
    return map;
  }, [coords]);

  useEffect(() => {
    const pending: Array<[string, Coord]> = [];
    for (const [key, c] of uniqueCoords) {
      if (regions[key] || inFlight.current.has(key)) continue;
      pending.push([key, c]);
      if (pending.length >= MAX_PER_RUN) break;
    }
    if (pending.length === 0) return;

    let cancelled = false;
    pending.forEach(([key]) => inFlight.current.add(key));

    (async () => {
      const resolved: RegionCache = {};
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        if (cancelled) break;
        const chunk = pending.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async ([key, c]) => {
            try {
              const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
                body: { action: 'reverse-geocode', lng: c.lng, lat: c.lat },
              });
              if (error) throw error;
              const region = pickRegion((data ?? {}) as ReverseResult);
              if (region) resolved[key] = region;
            } catch (err) {
              logger.error('Reverse geocode falhou para', key, err);
            } finally {
              inFlight.current.delete(key);
            }
          }),
        );
      }

      if (cancelled || Object.keys(resolved).length === 0) return;
      setRegions((prev) => {
        const next = { ...prev, ...resolved };
        writeCache(next);
        return next;
      });
    })();

    return () => {
      cancelled = true;
      pending.forEach(([key]) => inFlight.current.delete(key));
    };
  }, [uniqueCoords, regions]);

  return regions;
}
