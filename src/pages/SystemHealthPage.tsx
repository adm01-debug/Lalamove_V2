import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Database, Zap, Wifi } from 'lucide-react';
import { useSystemHealth } from '@/hooks/useSystemHealth';

export const SystemHealthPage = () => {
  const { data: health, isLoading } = useSystemHealth();
  
  if (isLoading) return <div>Carregando...</div>;
  
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">System Health</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <Activity className="h-8 w-8 mb-2" />
          <h3 className="font-semibold">Frontend</h3>
          <Badge 
            variant={health?.frontend === 'ok' ? 'default' : 'destructive'}
            aria-label={`Status do Frontend: ${health?.frontend === 'ok' ? 'Operacional' : 'Fora do ar'}`}
          >
            {health?.frontend === 'ok' ? '✅ OK' : '❌ DOWN'}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Uptime: {health?.frontendUptime}
          </p>
        </Card>
        
        <Card className="p-4">
          <Database className="h-8 w-8 mb-2" />
          <h3 className="font-semibold">Database</h3>
          <Badge variant={health?.database === 'ok' ? 'default' : 'destructive'}>
            {health?.database === 'ok' ? '✅ OK' : '❌ DOWN'}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Connections: {health?.dbConnections}/100
          </p>
        </Card>
        
        <Card className="p-4">
          <Zap className="h-8 w-8 mb-2" />
          <h3 className="font-semibold">Edge Functions</h3>
          <Badge variant={health?.functions === 'ok' ? 'default' : 'destructive'}>
            {health?.functions === 'ok' ? '✅ OK' : '❌ DOWN'}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Latency: {health?.fnLatency}ms
          </p>
        </Card>
        
        <Card className="p-4">
          <Wifi className="h-8 w-8 mb-2" />
          <h3 className="font-semibold">Realtime</h3>
          <Badge variant={health?.realtime === 'ok' ? 'default' : 'destructive'}>
            {health?.realtime === 'ok' ? '✅ OK' : '❌ DOWN'}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            Active: {health?.realtimeConnections}
          </p>
        </Card>
      </div>
    </div>
  );
};
