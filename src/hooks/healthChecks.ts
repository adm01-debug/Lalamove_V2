import { supabase } from '@/integrations/supabase/client';

export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';

export interface ComponentHealth {
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastChecked: string;
}

export interface ExternalAPIHealth {
  lalamove: ComponentHealth;
  bitrix24: ComponentHealth;
  evolutionApi: ComponentHealth;
  mapbox: ComponentHealth;
}

export interface SystemHealth {
  overall: HealthStatus;
  frontend: ComponentHealth;
  database: ComponentHealth;
  edgeFunctions: ComponentHealth;
  realtime: ComponentHealth;
  externalAPIs: ExternalAPIHealth;
  cache: ComponentHealth;
  queue: ComponentHealth;
}

export async function checkDatabase(): Promise<ComponentHealth> {
  const startTime = performance.now();
  try {
    const { error } = await supabase.from('drivers').select('id').limit(1);
    const latency = performance.now() - startTime;
    if (error) {
      console.error('Database health check failed', error.message);
      return { status: 'down', latency, message: error.message, lastChecked: new Date().toISOString() };
    }
    return { status: latency > 1000 ? 'degraded' : 'ok', latency, lastChecked: new Date().toISOString() };
  } catch (error) {
    return { status: 'down', message: error instanceof Error ? error.message : 'Unknown error', lastChecked: new Date().toISOString() };
  }
}

export async function checkEdgeFunctions(): Promise<ComponentHealth> {
  const startTime = performance.now();
  try {
    const { error } = await supabase.functions.invoke('get-mapbox-token', { body: { healthCheck: true } });
    const latency = performance.now() - startTime;
    if (error) {
      return { status: 'down', latency, message: error.message, lastChecked: new Date().toISOString() };
    }
    return { status: latency > 2000 ? 'degraded' : 'ok', latency, lastChecked: new Date().toISOString() };
  } catch (error) {
    return { status: 'down', message: error instanceof Error ? error.message : 'Unknown error', lastChecked: new Date().toISOString() };
  }
}

export async function checkRealtime(): Promise<ComponentHealth> {
  try {
    const channels = supabase.getChannels();
    const hasActiveChannels = channels.length > 0;
    return {
      status: hasActiveChannels ? 'ok' : 'degraded',
      message: hasActiveChannels ? `${channels.length} active channels` : 'No active channels',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return { status: 'down', message: error instanceof Error ? error.message : 'Unknown error', lastChecked: new Date().toISOString() };
  }
}

export async function checkCache(): Promise<ComponentHealth> {
  const startTime = performance.now();
  try {
    const { count: ordersCount, error: ordersError } = await supabase.from('lalamove_orders').select('*', { count: 'exact', head: true });
    const { count: driversCount, error: driversError } = await supabase.from('drivers').select('*', { count: 'exact', head: true });
    const latency = performance.now() - startTime;
    if (ordersError || driversError) {
      return { status: 'degraded', latency, message: 'Some tables unreachable', lastChecked: new Date().toISOString() };
    }
    const { data: recentOrder } = await supabase.from('lalamove_orders').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    let status: HealthStatus = 'ok';
    let message = `Monitorando ${(ordersCount || 0) + (driversCount || 0)} registros`;
    if (recentOrder?.updated_at) {
      const lastUpdate = new Date(recentOrder.updated_at);
      if (lastUpdate < fiveMinutesAgo) {
        status = 'degraded';
        message = 'Dados podem estar desatualizados';
      }
    }
    return { status, latency, message, lastChecked: new Date().toISOString() };
  } catch (error) {
    return { status: 'down', message: error instanceof Error ? error.message : 'Unknown error', lastChecked: new Date().toISOString() };
  }
}

export async function checkQueue(): Promise<ComponentHealth> {
  const startTime = performance.now();
  try {
    const { count: pendingWebhooks, error: webhooksError } = await supabase.from('webhook_events').select('*', { count: 'exact', head: true }).eq('processed', false);
    const { count: pendingSyncs, error: syncsError } = await supabase.from('bitrix24_sync').select('*', { count: 'exact', head: true }).eq('sync_status', 'pending');
    const latency = performance.now() - startTime;
    if (webhooksError || syncsError) {
      return { status: 'degraded', latency, message: 'Unable to check queue status', lastChecked: new Date().toISOString() };
    }
    const totalPending = (pendingWebhooks || 0) + (pendingSyncs || 0);
    let status: HealthStatus = 'ok';
    let message = `${totalPending} jobs pendentes`;
    if (totalPending > 100) {
      status = 'down';
      message = `Fila congestionada: ${totalPending} jobs`;
    } else if (totalPending > 50) {
      status = 'degraded';
      message = `Alto número de jobs pendentes: ${totalPending}`;
    }
    return { status, latency, message, lastChecked: new Date().toISOString() };
  } catch (error) {
    return { status: 'down', message: error instanceof Error ? error.message : 'Unknown error', lastChecked: new Date().toISOString() };
  }
}

async function checkExternalAPI(service: string): Promise<ComponentHealth> {
  const startTime = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke('check-external-api', { body: { service } });
    const latency = performance.now() - startTime;
    if (error) {
      return { status: 'down', latency, message: error.message, lastChecked: new Date().toISOString() };
    }
    return { status: data?.status || 'unknown', latency, message: data?.message, lastChecked: new Date().toISOString() };
  } catch (error) {
    return { status: 'unknown', message: 'Unable to check', lastChecked: new Date().toISOString() };
  }
}

export const checkLalamoveAPI = () => checkExternalAPI('lalamove');
export const checkBitrix24API = () => checkExternalAPI('bitrix24');
export const checkEvolutionAPI = () => checkExternalAPI('evolution');
export const checkMapboxAPI = () => checkExternalAPI('mapbox');

export function getOverallStatus(health: Omit<SystemHealth, 'overall'>): HealthStatus {
  const statuses: HealthStatus[] = [
    health.frontend.status, health.database.status, health.edgeFunctions.status,
    health.realtime.status, health.cache.status, health.queue.status,
    health.externalAPIs.lalamove.status, health.externalAPIs.bitrix24.status,
    health.externalAPIs.evolutionApi.status, health.externalAPIs.mapbox.status,
  ];
  if (health.database.status === 'down' || health.edgeFunctions.status === 'down') return 'down';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.includes('down')) return 'degraded';
  return 'ok';
}
