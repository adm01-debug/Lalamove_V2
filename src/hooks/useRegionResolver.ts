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

/** Máximo de chaves por consulta ao backend (evita URLs longas no filtro `in`). */
const BACKEND_CHUNK = 100;

/**
 * Lê o cache compartilhado (L2) no backend para um conjunto de chaves.
 * Falhas são tratadas como cache-miss silencioso — o fluxo cai para o Mapbox.
 */
async function readBackendCache(keys: string[]): Promise<RegionCache> {
  const result: RegionCache = {};
  if (keys.length === 0) return result;
  try {
    for (let i = 0; i < keys.length; i += BACKEND_CHUNK) {
      const chunk = keys.slice(i, i + BACKEND_CHUNK);
      const { data, error } = await supabase
        .from('region_cache')
        .select('coord_key, region')
        .in('coord_key', chunk);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.coord_key && row.region) result[row.coord_key] = row.region;
      }
    }
  } catch (err) {
    logger.error('Erro ao ler cache compartilhado de regiões:', err);
  }
  return result;
}

/**
 * Grava (upsert) regiões recém-resolvidas no cache compartilhado (L2) para
 * que outros usuários as reaproveitem. Falhas não interrompem o fluxo local.
 */
async function writeBackendCache(entries: RegionCache): Promise<void> {
  const rows = Object.entries(entries).map(([coord_key, region]) => ({ coord_key, region }));
  if (rows.length === 0) return;
  try {
    // ignoreDuplicates: gravamos apenas inserts. Regiões são determinísticas
    // por coord_key — não há razão para sobrescrever, e isso permite remover
    // a policy UPDATE `USING (true)` (endurecimento de segurança do cache L2).
    const { error } = await supabase
      .from('region_cache')
      .upsert(rows, { onConflict: 'coord_key', ignoreDuplicates: true });
    if (error) throw error;
  } catch (err) {
    logger.error('Erro ao gravar cache compartilhado de regiões:', err);
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
    setActiveCount((n) => n + pending.length);

    (async () => {
      const resolved: RegionCache = {};

      // L2 — cache compartilhado no backend: reaproveita regiões já
      // resolvidas por outros usuários antes de gastar chamadas ao Mapbox.
      let toGeocode = pending;
      const fromBackend = await readBackendCache(pending.map(([key]) => key));
      if (Object.keys(fromBackend).length > 0) {
        Object.assign(resolved, fromBackend);
        fromBackend && Object.keys(fromBackend).forEach((key) => inFlight.current.delete(key));
        toGeocode = pending.filter(([key]) => !fromBackend[key]);
      }

      const freshlyGeocoded: RegionCache = {};
      for (let i = 0; i < toGeocode.length; i += CONCURRENCY) {
        if (cancelled) break;
        const chunk = toGeocode.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async ([key, c]) => {
            try {
              const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
                body: { action: 'reverse-geocode', lng: c.lng, lat: c.lat },
              });
              if (error) throw error;
              const region = pickRegion((data ?? {}) as ReverseResult);
              if (region) {
                resolved[key] = region;
                freshlyGeocoded[key] = region;
              }
            } catch (err) {
              logger.error('Reverse geocode falhou para', key, err);
            } finally {
              inFlight.current.delete(key);
            }
          }),
        );
      }

      // Compartilha as regiões recém-resolvidas com os demais usuários.
      if (Object.keys(freshlyGeocoded).length > 0) {
        void writeBackendCache(freshlyGeocoded);
      }

      setActiveCount((n) => Math.max(0, n - pending.length));

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

  return useMemo<RegionResolution>(() => {
    let resolvedCount = 0;
    for (const key of uniqueCoords.keys()) {
      if (regions[key]) resolvedCount += 1;
    }
    const total = uniqueCoords.size;
    return {
      regions,
      total,
      pending: Math.max(0, total - resolvedCount),
      isResolving: activeCount > 0,
    };
  }, [regions, uniqueCoords, activeCount]);
}
