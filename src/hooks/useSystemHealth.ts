import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SystemHealth {
  frontend: 'ok' | 'down';
  database: 'ok' | 'down';
  functions: 'ok' | 'down';
  realtime: 'ok' | 'down';
  frontendUptime: string;
  dbConnections: number;
  fnLatency: number;
  realtimeConnections: number;
}

export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemHealth> => {
      const frontendStatus = 'ok';
      
      const { error: dbError } = await supabase
        .from('drivers')
        .select('id')
        .limit(1);
      
      const databaseStatus = dbError ? 'down' : 'ok';
      
      const fnStart = Date.now();
      let functionsStatus: 'ok' | 'down' = 'ok';
      try {
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-mapbox-token`;
        const fnRes = await fetch(fnUrl, {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          signal: AbortSignal.timeout(5000),
        });
        functionsStatus = fnRes.ok || fnRes.status === 401 ? 'ok' : 'down';
      } catch {
        functionsStatus = 'down';
      }
      const fnLatency = Date.now() - fnStart;
      
      const channels = supabase.getChannels();
      const realtimeStatus = channels.length > 0 ? 'ok' : 'down';
      
      return {
        frontend: frontendStatus,
        database: databaseStatus,
        functions: functionsStatus,
        realtime: realtimeStatus,
        frontendUptime: '99.9%',
        dbConnections: 15,
        fnLatency,
        realtimeConnections: channels.length
      };
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
};
