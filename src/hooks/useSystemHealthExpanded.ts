import { useQuery } from '@tanstack/react-query';
import {
  type SystemHealth,
  type ComponentHealth,
  checkDatabase,
  checkEdgeFunctions,
  checkRealtime,
  checkCache,
  checkQueue,
  checkLalamoveAPI,
  checkBitrix24API,
  checkEvolutionAPI,
  checkMapboxAPI,
  getOverallStatus,
} from './healthChecks';

export type { HealthStatus, ComponentHealth, ExternalAPIHealth, SystemHealth } from './healthChecks';

export const useSystemHealthExpanded = (refetchInterval = 30000) => {
  return useQuery({
    queryKey: ['system-health-expanded'],
    queryFn: async (): Promise<SystemHealth> => {
      console.debug('Running system health check');
      
      const [
        database, edgeFunctions, realtime, cache, queue,
        lalamove, bitrix24, evolution, mapbox,
      ] = await Promise.all([
        checkDatabase(), checkEdgeFunctions(), checkRealtime(),
        checkCache(), checkQueue(),
        checkLalamoveAPI(), checkBitrix24API(), checkEvolutionAPI(), checkMapboxAPI(),
      ]);
      
      const frontend: ComponentHealth = {
        status: 'ok', latency: 0, message: 'Frontend running',
        lastChecked: new Date().toISOString(),
      };
      
      const health = {
        frontend, database, edgeFunctions, realtime, cache, queue,
        externalAPIs: { lalamove, bitrix24, evolutionApi: evolution, mapbox },
      };
      
      return { overall: getOverallStatus(health), ...health };
    },
    refetchInterval,
    staleTime: refetchInterval / 2,
  });
};
