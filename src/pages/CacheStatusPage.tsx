import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Database,
  TrendingUp,
  Activity
} from "lucide-react";
import { useCacheStats, useRefreshCache, formatRefreshDuration, formatLastRefresh } from "@/hooks/useCacheViews";
import { useCachedStats, useDashboardSummary } from "@/hooks/useCachedStats";

export default function CacheStatusPage() {
  const { data: cacheViews, isLoading: loadingStats } = useCacheStats();
  const { mutateAsync: refresh, isPending: isRefreshing } = useRefreshCache();
  const { data: cachedData } = useCachedStats();
  const summary = useDashboardSummary();

  const handleRefresh = async (viewName?: string) => {
    await refresh(viewName);
  };

  const handleRefreshAll = async () => {
    await refresh(undefined);
  };

  if (loadingStats) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const cacheStats = cacheViews || [];
  const totalViews = cacheStats.length || 0;
  const healthyViews = cacheStats.filter(s => s.status === 'success' && !s.is_stale).length || 0;
  const staleViews = cacheStats.filter(s => s.is_stale).length || 0;
  const failedViews = cacheStats.filter(s => s.status === 'failed').length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cache System Status</h1>
          <p className="text-muted-foreground">Sistema de cache com materialized views para performance otimizada</p>
        </div>
        <Button onClick={handleRefreshAll} disabled={isRefreshing} size="lg">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Atualizando...' : 'Atualizar Tudo'}
        </Button>
      </div>

      {(staleViews > 0 || failedViews > 0) && (
        <Alert variant={failedViews > 0 ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{failedViews > 0 ? 'Cache com Problemas' : 'Cache Necessita Atualização'}</AlertTitle>
          <AlertDescription>
            {failedViews > 0 && <span>{failedViews} view(s) com erro de atualização. </span>}
            {staleViews > 0 && <span>{staleViews} view(s) desatualizadas (&gt;1h). </span>}
            <Button variant="link" className="p-0 h-auto" onClick={handleRefreshAll}>Atualizar agora</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Views</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews}</div>
            <p className="text-xs text-muted-foreground">Materialized views ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saudáveis</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{healthyViews}</div>
            <p className="text-xs text-muted-foreground">Atualizadas recentemente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Desatualizadas</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{staleViews}</div>
            <p className="text-xs text-muted-foreground">Precisam de refresh</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedViews}</div>
            <p className="text-xs text-muted-foreground">Erros de atualização</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status das Views</CardTitle>
          <CardDescription>Informações detalhadas sobre cada materialized view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cacheStats.map((stat) => (
              <div key={stat.view_name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{stat.view_name}</h3>
                    {stat.status === 'success' && !stat.is_stale && (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />OK
                      </Badge>
                    )}
                    {stat.is_stale && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                        <Clock className="h-3 w-3 mr-1" />Stale
                      </Badge>
                    )}
                    {stat.status === 'failed' && (
                      <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Última atualização: {formatLastRefresh(stat.last_refresh)}</span>
                    {stat.refresh_duration_ms && <span>Duração: {formatRefreshDuration(stat.refresh_duration_ms)}</span>}
                    {stat.row_count && <span>Registros: {stat.row_count.toLocaleString()}</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleRefresh(stat.view_name)} disabled={isRefreshing}>
                  <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />Atualizar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Driver Stats</CardTitle>
            <CardDescription>{cachedData.driverStats.length} motoristas cacheados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cachedData.driverStats.slice(0, 5).map((driver) => (
                <div key={driver.id} className="flex justify-between text-sm">
                  <span className="truncate flex-1">{driver.name}</span>
                  <span className="text-muted-foreground">{driver.total_deliveries} entregas</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Metrics</CardTitle>
            <CardDescription>{cachedData.deliveryMetrics.length} dias de métricas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cachedData.deliveryMetrics.slice(0, 5).map((metric) => (
                <div key={metric.date} className="flex justify-between text-sm">
                  <span>{new Date(metric.date).toLocaleDateString('pt-BR')}</span>
                  <span className="text-muted-foreground">{metric.total_orders} pedidos</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Summary</CardTitle>
            <CardDescription>Métricas agregadas do cache</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Motoristas Ativos</span>
                </div>
                <span className="text-sm font-medium">{summary.activeDrivers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Pedidos (7d)</span>
                </div>
                <span className="text-sm font-medium">{summary.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Taxa Conclusão</span>
                </div>
                <span className="text-sm font-medium">
                  {summary.totalOrders > 0 ? Math.round((summary.completedOrders / summary.totalOrders) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
