import { Database, RefreshCw, CheckCircle2, AlertTriangle, Clock, Activity, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCacheStats, useCacheViews, useRefreshCache, CacheView } from '@/hooks/useCacheViews';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TABLE_DESCRIPTIONS: Record<string, { label: string; description: string; icon: typeof Database }> = {
  driver_stats_cache: { label: 'Estatísticas Motoristas', description: 'Cache de estatísticas dos motoristas', icon: Database },
  delivery_metrics_cache: { label: 'Métricas de Entrega', description: 'Métricas de entregas agregadas', icon: Activity },
  hourly_metrics_cache: { label: 'Métricas por Hora', description: 'Cache de métricas horárias', icon: BarChart3 },
  lalamove_orders: { label: 'Pedidos Lalamove', description: 'Pedidos de entrega ativos e histórico', icon: Database },
  drivers: { label: 'Motoristas', description: 'Cadastro e status dos motoristas', icon: Database },
  alerts: { label: 'Alertas', description: 'Alertas do sistema e notificações', icon: AlertTriangle },
  driver_evaluations: { label: 'Avaliações', description: 'Avaliações de risco dos motoristas', icon: Activity },
  driver_incidents: { label: 'Incidentes', description: 'Registro de incidentes e ocorrências', icon: AlertTriangle },
  active_tracking: { label: 'Rastreamento Ativo', description: 'Posições em tempo real dos motoristas', icon: Activity },
  webhook_events: { label: 'Eventos Webhook', description: 'Eventos recebidos via webhook', icon: BarChart3 },
  driver_approval_queue: { label: 'Fila de Aprovações', description: 'Motoristas aguardando aprovação', icon: Clock }
};

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success': return 'default';
    case 'stale': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'outline';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'success': return 'Atualizado';
    case 'stale': return 'Desatualizado';
    case 'failed': return 'Falha';
    default: return 'Desconhecido';
  }
}

export function CacheMonitoringPage() {
  const { data: stats, isLoading: statsLoading, refetch } = useCacheStats();
  const { data: views, isLoading: viewsLoading } = useCacheViews();
  const refreshCache = useRefreshCache();

  const isLoading = statsLoading || viewsLoading;

  const handleRefreshAll = async () => {
    await refreshCache.mutateAsync(undefined);
    await refetch();
  };

  const handleRefreshTable = async (tableName: string) => {
    await refreshCache.mutateAsync(tableName);
    await refetch();
  };

  const totalViews = stats?.length || 0;
  const healthyViews = stats?.filter(s => s.status === 'success' && !s.is_stale).length || 0;
  const staleViews = stats?.filter(s => s.is_stale).length || 0;
  const failedViews = stats?.filter(s => s.status === 'failed').length || 0;

  const healthPercentage = totalViews > 0 
    ? Math.round((healthyViews / totalViews) * 100) 
    : 0;

  const lastChecked = stats?.[0]?.last_refresh;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Monitoramento de Cache</h1>
          <p className="text-sm text-muted-foreground">Status em tempo real das tabelas monitoradas</p>
        </div>
        <Button onClick={handleRefreshAll} disabled={refreshCache.isPending} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", refreshCache.isPending && "animate-spin")} />
          Atualizar Tudo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tabelas Monitoradas</p>
                <p className="text-3xl font-bold text-foreground">{totalViews}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Database className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saudáveis</p>
                <p className="text-3xl font-bold text-success">{healthyViews}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Desatualizadas</p>
                <p className="text-3xl font-bold text-warning">{staleViews}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Falha</p>
                <p className="text-3xl font-bold text-destructive">{failedViews}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saúde Geral do Cache</CardTitle>
              <CardDescription>
                Última verificação: {lastChecked 
                  ? formatDistanceToNow(new Date(lastChecked), { addSuffix: true, locale: ptBR })
                  : 'Nunca'}
              </CardDescription>
            </div>
            <Badge variant={healthPercentage >= 80 ? 'default' : healthPercentage >= 50 ? 'secondary' : 'destructive'}>
              {healthPercentage}% saudável
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={healthPercentage} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6"><div className="h-20 bg-muted rounded" /></CardContent>
            </Card>
          ))
        ) : (
          views?.map((view: CacheView) => {
            const config = TABLE_DESCRIPTIONS[view.view_name] || { label: view.view_name, description: 'Tabela do sistema', icon: Database };
            const Icon = config.icon;

            return (
              <Card key={view.view_name} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Badge variant={getStatusVariant(view.refresh_status)} className="text-xs">
                      {getStatusLabel(view.refresh_status)}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{config.label}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2">{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Registros</span>
                      <span className="font-semibold text-foreground">{view.row_count.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Latência</span>
                      <span className="text-xs font-mono">{view.refresh_duration_ms}ms</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleRefreshTable(view.view_name)} disabled={refreshCache.isPending}>
                      {refreshCache.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                      Atualizar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CacheMonitoringPage;
