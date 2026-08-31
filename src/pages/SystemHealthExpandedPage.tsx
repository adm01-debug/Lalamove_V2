import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSystemHealthExpanded, type HealthStatus, type ComponentHealth } from '@/hooks/useSystemHealthExpanded';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  Database,
  Server,
  Wifi,
  Globe,
  Package,
  List,
} from 'lucide-react';

export default function SystemHealthExpandedPage() {
  const { data: health, isLoading, refetch, isFetching } = useSystemHealthExpanded(30000);

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'down':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <HelpCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: HealthStatus) => {
    const variants = {
      ok: 'bg-success/10 text-success border-success',
      degraded: 'bg-warning/10 text-warning border-warning',
      down: 'bg-destructive/10 text-destructive border-destructive',
      unknown: 'bg-muted text-muted-foreground border-border',
    };

    return (
      <Badge variant="outline" className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return '-';
    if (latency < 100) return `${latency.toFixed(0)}ms`;
    if (latency < 1000) return `${latency.toFixed(0)}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  const renderComponentCard = (
    title: string,
    component: ComponentHealth,
    icon: React.ReactNode,
    description?: string
  ) => {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            {getStatusBadge(component.status)}
          </div>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-2">
          {component.latency !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Latency:</span>
              <span className="font-mono font-medium">{formatLatency(component.latency)}</span>
            </div>
          )}
          {component.message && (
            <div className="text-xs text-muted-foreground">{component.message}</div>
          )}
          <div className="text-xs text-muted-foreground">
            Last checked: {new Date(component.lastChecked).toLocaleTimeString('pt-BR')}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Failed to load system health</h2>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {getStatusIcon(health.overall)}
            <h2 className="text-3xl font-bold">System Health</h2>
            {getStatusBadge(health.overall)}
          </div>
          <p className="text-muted-foreground mt-1">
            Complete system monitoring with external APIs
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card className={
        health.overall === 'ok' ? 'border-success/50' :
        health.overall === 'degraded' ? 'border-warning/50' :
        'border-destructive/50'
      }>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl">
              {health.overall === 'ok' ? '✅' : health.overall === 'degraded' ? '⚠️' : '🔴'}
            </div>
            <div>
              <h3 className="text-xl font-semibold">
                System Status: {health.overall === 'ok' ? 'All Systems Operational' :
                              health.overall === 'degraded' ? 'Partial Degradation' :
                              'System Down'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {health.overall === 'ok' ? 'All components are functioning normally' :
                 health.overall === 'degraded' ? 'Some components are experiencing issues' :
                 'Critical components are down'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Components */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Core Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderComponentCard(
            'Frontend',
            health.frontend,
            <Globe className="w-5 h-5 text-primary" />,
            'React application'
          )}
          
          {renderComponentCard(
            'Database',
            health.database,
            <Database className="w-5 h-5 text-primary" />,
            'PostgreSQL (Supabase)'
          )}
          
          {renderComponentCard(
            'Edge Functions',
            health.edgeFunctions,
            <Server className="w-5 h-5 text-primary" />,
            'Serverless functions'
          )}
          
          {renderComponentCard(
            'Realtime',
            health.realtime,
            <Wifi className="w-5 h-5 text-primary" />,
            'WebSocket connections'
          )}
        </div>
      </div>

      {/* Backend Systems */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Backend Systems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderComponentCard(
            'Cache System',
            health.cache,
            <Package className="w-5 h-5 text-primary" />,
            'Materialized Views'
          )}
          
          {renderComponentCard(
            'Job Queue',
            health.queue,
            <List className="w-5 h-5 text-primary" />,
            'Async job processing'
          )}
        </div>
      </div>

      {/* External APIs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">External APIs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderComponentCard(
            'Lalamove',
            health.externalAPIs.lalamove,
            <img src="/lalamove-icon.svg" className="w-5 h-5" alt="Lalamove" />,
            'Delivery API'
          )}
          
          {renderComponentCard(
            'Bitrix24',
            health.externalAPIs.bitrix24,
            <img src="/bitrix24-icon.svg" className="w-5 h-5" alt="Bitrix24" />,
            'CRM Integration'
          )}
          
          {renderComponentCard(
            'Evolution API',
            health.externalAPIs.evolutionApi,
            <img src="/whatsapp-icon.svg" className="w-5 h-5" alt="WhatsApp" />,
            'WhatsApp Gateway'
          )}
          
          {renderComponentCard(
            'Mapbox',
            health.externalAPIs.mapbox,
            <Globe className="w-5 h-5 text-primary" />,
            'Maps & Geocoding'
          )}
        </div>
      </div>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <div>
                <div className="font-medium">OK</div>
                <div className="text-xs text-muted-foreground">Fully operational</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div>
                <div className="font-medium">Degraded</div>
                <div className="text-xs text-muted-foreground">Reduced performance</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              <div>
                <div className="font-medium">Down</div>
                <div className="text-xs text-muted-foreground">Not responding</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Unknown</div>
                <div className="text-xs text-muted-foreground">Unable to check</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>About Health Checks</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            ⏱️ <strong>Auto-refresh:</strong> Health checks run automatically every 30 seconds
          </p>
          <p>
            📊 <strong>Latency thresholds:</strong> Database &gt;1s, Edge Functions &gt;2s are marked as degraded
          </p>
          <p>
            🔒 <strong>Security:</strong> External API checks are performed server-side to protect API keys
          </p>
          <p>
            📝 <strong>Logging:</strong> All health checks are logged for debugging and monitoring
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
