import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMapSettings, type MapProvider } from './useMapSettings';

/** Família comercial por opção visual do mapa. OSM/Esri são raster gratuito, fora de `geo_settings`. */
export const PROVIDER_FAMILY: Record<MapProvider, 'mapbox' | 'google' | 'oss'> = {
  'mapbox-dark': 'mapbox',
  'mapbox-sat': 'mapbox',
  'google-roadmap': 'google',
  'google-hybrid': 'google',
  'google-3d': 'google',
  osm: 'oss',
  'esri-sat': 'oss',
};

export type TilesProvider = 'mapbox' | 'google' | 'off';

/**
 * `geo_settings.tiles` é a política do admin para o mapa base. Sem linha (ou `off`) a
 * política é fail-open: liberar todas as opções em vez de deixar o usuário sem mapa.
 */
export function useTilesProvider() {
  return useQuery<TilesProvider>({
    queryKey: ['geo', 'tiles-provider'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geo_settings')
        .select('provider')
        .eq('function', 'tiles')
        .maybeSingle();
      if (error) throw error;
      const value = data?.provider;
      return value === 'mapbox' || value === 'google' ? value : 'off';
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Opções visíveis no seletor do usuário, restritas ao que o admin habilitou. */
export function allowedProvidersFor(tilesProvider: TilesProvider): MapProvider[] {
  const all = Object.keys(PROVIDER_FAMILY) as MapProvider[];
  if (tilesProvider === 'off') return all;
  return all.filter((p) => {
    const family = PROVIDER_FAMILY[p];
    return family === 'oss' || family === tilesProvider;
  });
}

/** Opções visíveis no seletor do usuário, restritas ao que o admin habilitou. */
export function useAllowedMapProviders(): { allowed: MapProvider[]; tilesProvider: TilesProvider } {
  const { data } = useTilesProvider();
  const tilesProvider: TilesProvider = data ?? 'off';
  return { allowed: allowedProvidersFor(tilesProvider), tilesProvider };
}

/**
 * Provider efetivo: a escolha visual do usuário, ou a primeira opção permitida quando o
 * admin desliga a família escolhida. Não reescreve a preferência persistida — se o admin
 * religar o provedor, a escolha original do usuário volta.
 */
export function useEffectiveMapProvider(): { provider: MapProvider; allowed: MapProvider[] } {
  const preferred = useMapSettings((s) => s.preferredProvider);
  const { allowed } = useAllowedMapProviders();
  const provider = allowed.includes(preferred) ? preferred : (allowed[0] ?? 'mapbox-dark');
  return { provider, allowed };
}