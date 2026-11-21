import { supabase } from '@/integrations/supabase/client';

/**
 * Cliente fino do geo-gateway (camada única de acesso a provedores de mapa).
 * Plano: claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md (Bloco 5).
 */

/** Registra 1 carregamento de mapa em geo_usage. Nunca lança — telemetria de uso é best-effort. */
export async function countMapLoad(provider: 'mapbox' | 'google'): Promise<void> {
  try {
    await supabase.functions.invoke('geo-gateway', { body: { action: 'count-map-load', provider } });
  } catch {
    // Silently fail - métrica de uso não pode travar o mapa
  }
}
