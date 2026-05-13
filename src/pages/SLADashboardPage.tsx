import { useSLAMetrics } from '@/hooks/useSLAMetrics';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Truck,
  Gauge,
  Timer,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertCircle,
  Users,
  MapPin,
  Loader2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  PENDING: '#94a3b8',
  MATCHED: '#3b82f6',
  ON_GOING: '#8b5cf6',
  PICKED_UP: '#f59e0b',
  COMPLETED: '#22c55e',
  CANCELLED: '#ef4444',
  REJECTED: '#dc2626',
  EXPIRED: '#6b7280'
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  MATCHED: 'Atribuído',
  ON_GOING: 'Em Andamento',
  PICKED_UP: 'Coletado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rejeitado',
  EXPIRED: 'Expirado'
};

export function SLADashboardPage() {
  const { data: metrics, isLoading, error } = useSLAMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Erro ao carregar métricas</p>
        </div>
      </div>
    );
  }

  const getSLAStatus = (rate: number) => {
    if (rate >= 95) return { color: 'text-success', bg: 'bg-success/20', label: 'Excelente' };
    if (rate >= 85) return { color: 'text-info', bg: 'bg-info/20', label: 'Bom' };
    if (rate >= 70) return { color: 'text-warning', bg: 'bg-warning/20', label: 'Atenção' };
    return { color: 'text-destructive', bg: 'bg-destructive/20', label: 'Crítico' };
  };

  const slaStatus = getSLAStatus(metrics.onTimeRate);

  return (
    <div className="p-6 space-y-6">
      {/* Header with live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard SLA</h1>
            <p className="text-sm text-muted-foreground">Métricas de performance em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          <span className="text-xs font-medium text-success">AO VIVO</span>
        </div>
      </div>

      {/* Main SLA Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 glass-card p-6">
          <div className="text-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Taxa SLA (On-Time)</h3>
            <div className="relative w-48 h-48 mx-auto">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="80"
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="none"
                  strokeLinecap="round"
                  className={slaStatus.color}
                  strokeDasharray={`${(metrics.onTimeRate / 100) * 502.65} 502.65`}
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-5xl font-bold", slaStatus.color)}>
                  {metrics.onTimeRate}%
                </span>
                <Badge className={cn("mt-2", slaStatus.bg, slaStatus.color)}>
                  {slaStatus.label}
                </Badge>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-success">{metrics.onTimeDeliveries}</p>
                <p className="text-xs text-muted-foreground">No Prazo</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{metrics.atRiskDeliveries}</p>
                <p className="text-xs text-muted-foreground">Em Risco</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{metrics.lateDeliveries}</p>
                <p className="text-xs text-muted-foreground">Atrasadas</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Key Metrics */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Entregas Ativas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{metrics.totalActiveDeliveries}</p>
            <Progress value={Math.min((metrics.totalActiveDeliveries / 50) * 100, 100)} className="mt-2 h-1" />
          </Card>

          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-4 h-4 text-info" />
              <span className="text-xs text-muted-foreground">Tempo Médio</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{metrics.avgDeliveryTime}<span className="text-lg text-muted-foreground">min</span></p>
            <div className="mt-2 flex items-center gap-1 text-xs">
              {metrics.avgDeliveryTime < 45 ? (
                <>
                  <TrendingDown className="w-3 h-3 text-success" />
                  <span className="text-success">Dentro da meta</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 text-warning" />
                  <span className="text-warning">Acima da meta</span>
                </>
              )}
            </div>
          </Card>

          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Mais Rápida</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{metrics.fastestDelivery}<span className="text-lg text-muted-foreground">min</span></p>
            <p className="text-xs text-muted-foreground mt-2">Recorde do dia</p>
          </Card>

          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Mais Lenta</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{metrics.slowestDelivery}<span className="text-lg text-muted-foreground">min</span></p>
            <p className="text-xs text-muted-foreground mt-2">Pior caso</p>
          </Card>

          {/* Driver Metrics */}
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">Motoristas Ativos</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{metrics.activeDrivers}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="secondary" className="text-xs">
                <MapPin className="w-3 h-3 mr-1" />
                {metrics.stoppedDrivers} parados
              </Badge>
            </div>
          </Card>

          <Card className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-muted-foreground">Velocidade Média</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{metrics.avgDriverSpeed}<span className="text-lg text-muted-foreground">km/h</span></p>
            <Progress value={Math.min((metrics.avgDriverSpeed / 60) * 100, 100)} className="mt-2 h-1" />
          </Card>

          <Card className="glass-card p-4 bg-destructive/10 border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs text-destructive">Alertas Críticos</span>
            </div>
            <p className="text-3xl font-bold text-destructive">{metrics.criticalAlerts}</p>
            <p className="text-xs text-muted-foreground mt-2">
              + {metrics.warningAlerts} avisos
            </p>
          </Card>

          <Card className="glass-card p-4 bg-warning/10 border-warning/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-xs text-warning">Aprovações Pendentes</span>
            </div>
            <p className="text-3xl font-bold text-warning">{metrics.pendingApprovals}</p>
            <p className="text-xs text-muted-foreground mt-2">Aguardando revisão</p>
          </Card>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Performance */}
        <Card className="glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Performance por Hora (Hoje)
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.hourlyStats}>
                <defs>
                  <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="onTimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="hour" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="#8b5cf6" 
                  fill="url(#completedGradient)"
                  name="Concluídas"
                />
                <Area 
                  type="monotone" 
                  dataKey="onTime" 
                  stroke="#22c55e" 
                  fill="url(#onTimeGradient)"
                  name="No Prazo"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status Distribution */}
        <Card className="glass-card p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Distribuição por Status (Hoje)
          </h3>
          <div className="h-[250px] flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                  >
                    {metrics.statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value, name) => [value, statusLabels[name as string] || name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2">
              {metrics.statusBreakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: statusColors[item.status] || '#6b7280' }}
                    />
                    <span className="text-muted-foreground">
                      {statusLabels[item.status] || item.status}
                    </span>
                  </div>
                  <span className="font-medium text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Live Activity Feed */}
      <Card className="glass-card p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary animate-pulse" />
          Indicadores de Atenção
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.offRouteDrivers > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">{metrics.offRouteDrivers} motorista(s) fora da rota</p>
                <p className="text-xs text-muted-foreground">Requer verificação</p>
              </div>
            </div>
          )}
          {metrics.stoppedDrivers > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <MapPin className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">{metrics.stoppedDrivers} motorista(s) parado(s)</p>
                <p className="text-xs text-muted-foreground">Possível atraso</p>
              </div>
            </div>
          )}
          {metrics.atRiskDeliveries > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-warning">{metrics.atRiskDeliveries} entrega(s) em risco</p>
                <p className="text-xs text-muted-foreground">ETA próximo do limite</p>
              </div>
            </div>
          )}
          {metrics.offRouteDrivers === 0 && metrics.stoppedDrivers === 0 && metrics.atRiskDeliveries === 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30 col-span-full">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <div>
                <p className="font-medium text-success">Tudo funcionando normalmente</p>
                <p className="text-xs text-muted-foreground">Nenhum indicador de atenção no momento</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
