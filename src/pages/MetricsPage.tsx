import { useState, useCallback } from 'react';
import { 
  Users, 
  ShieldCheck, 
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3,
  Loader2,
  Activity,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDriverMetrics, useApprovalMetrics, useIncidentMetrics } from '@/hooks/useMetrics';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DataRefreshIndicator } from '@/components/ui/data-refresh-indicator';
import { ApprovalStatsPanel, IncidentSeverityPanel, IncidentTypePanel, WhitelistBlacklistSummary } from './MetricsPage.panels';

const RISK_COLORS = {
  low: 'hsl(var(--success))',
  medium: 'hsl(var(--warning))',
  high: 'hsl(var(--destructive))',
  critical: 'hsl(340 82% 52%)',
};

const STATUS_COLORS = {
  approved: 'hsl(var(--success))',
  pending: 'hsl(var(--warning))',
  blocked: 'hsl(var(--destructive))',
  whitelist: 'hsl(var(--primary))',
  blacklist: 'hsl(340 82% 52%)',
};

const typeLabels: Record<string, string> = {
  ROUTE_DEVIATION: 'Desvio de Rota',
  LONG_STOP: 'Parada Longa',
  LATE_DELIVERY: 'Atraso',
  CUSTOMER_COMPLAINT: 'Reclamação',
  DAMAGE: 'Dano',
  OTHER: 'Outro',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export function MetricsPage() {
  const { data: driverMetrics, isLoading: driversLoading } = useDriverMetrics();
  const { data: approvalMetrics, isLoading: approvalsLoading } = useApprovalMetrics();
  const { data: incidentMetrics, isLoading: incidentsLoading } = useIncidentMetrics();
  const queryClient = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['metrics', 'drivers'] });
    await queryClient.invalidateQueries({ queryKey: ['metrics', 'approvals'] });
    await queryClient.invalidateQueries({ queryKey: ['metrics', 'incidents'] });
    setLastRefreshed(new Date());
    setIsRefreshing(false);
  }, [queryClient]);

  const isLoading = driversLoading || approvalsLoading || incidentsLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-full blur-xl opacity-50 animate-pulse" />
            <Loader2 className="w-12 h-12 text-primary animate-spin relative" />
          </div>
          <p className="text-muted-foreground mt-4">Carregando métricas...</p>
        </motion.div>
      </div>
    );
  }

  const riskData = driverMetrics ? [
    { name: 'Baixo', value: driverMetrics.byRiskLevel.low, color: RISK_COLORS.low },
    { name: 'Médio', value: driverMetrics.byRiskLevel.medium, color: RISK_COLORS.medium },
    { name: 'Alto', value: driverMetrics.byRiskLevel.high, color: RISK_COLORS.high },
    { name: 'Crítico', value: driverMetrics.byRiskLevel.critical, color: RISK_COLORS.critical },
  ].filter(d => d.value > 0) : [];

  const statusData = driverMetrics ? [
    { name: 'Aprovado', value: driverMetrics.byStatus.approved },
    { name: 'Pendente', value: driverMetrics.byStatus.pending },
    { name: 'Bloqueado', value: driverMetrics.byStatus.blocked },
    { name: 'Whitelist', value: driverMetrics.byStatus.whitelist },
    { name: 'Blacklist', value: driverMetrics.byStatus.blacklist },
  ].filter(d => d.value > 0) : [];

  const incidentTypeData = incidentMetrics 
    ? Object.entries(incidentMetrics.byType).map(([type, count]) => ({
        name: typeLabels[type] || type,
        value: count,
      }))
    : [];

  const kpiCards = [
    { 
      title: 'Total Motoristas', 
      value: driverMetrics?.totalDrivers || 0, 
      subtitle: `Score médio: ${driverMetrics?.avgRiskScore.toFixed(1) || '0'}`,
      icon: Users, 
      color: 'primary' 
    },
    { 
      title: 'Taxa Auto-Aprovação', 
      value: `${approvalMetrics?.autoApprovalRate.toFixed(1) || 0}%`, 
      subtitle: 'Sem aprovação manual',
      icon: TrendingUp, 
      color: 'success' 
    },
    { 
      title: 'Aprovações Pendentes', 
      value: approvalMetrics?.pending || 0, 
      subtitle: `Tempo médio: ${approvalMetrics?.avgResponseTimeMinutes.toFixed(0) || 0} min`,
      icon: Clock, 
      color: 'warning' 
    },
    { 
      title: 'Incidentes Abertos', 
      value: incidentMetrics?.openIncidents || 0, 
      subtitle: `de ${incidentMetrics?.totalIncidents || 0} total`,
      icon: AlertTriangle, 
      color: 'destructive' 
    },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <motion.div 
        className="p-4 md:p-6 space-y-4 md:space-y-6"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Header */}
        <motion.div 
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4"
        >
          <div className="flex items-center gap-3 md:gap-4">
            <motion.div 
              className="relative"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-accent/50 rounded-xl md:rounded-2xl blur-xl opacity-50" />
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-info/20 flex items-center justify-center border border-primary/20 shadow-lg">
                <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent truncate">
                Dashboard de Métricas
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  Visão geral do sistema
                </p>
                {/* Mobile refresh indicator */}
                <div className="md:hidden">
                  <DataRefreshIndicator
                    lastUpdated={lastRefreshed}
                    isRefreshing={isRefreshing}
                    variant="minimal"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Desktop refresh */}
          <div className="hidden md:block">
            <DataRefreshIndicator
              lastUpdated={lastRefreshed}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              variant="compact"
            />
          </div>
        </motion.div>

        {/* KPI Cards */}
        <motion.div 
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4"
          variants={containerVariants}
        >
          {kpiCards.map((kpi, index) => (
            <motion.div key={kpi.title} variants={itemVariants}>
              <Card variant="glass" hover="lift" className="overflow-hidden">
                <div className={cn("h-1 bg-gradient-to-r", `from-${kpi.color} to-${kpi.color}/50`)} />
                <CardHeader className="flex flex-row items-center justify-between p-3 md:p-4 pb-1 md:pb-2">
                  <CardTitle className="text-[10px] md:text-sm font-medium text-muted-foreground truncate">{kpi.title}</CardTitle>
                  <div className={cn("p-1.5 md:p-2 rounded-lg shrink-0", `bg-${kpi.color}/10`)}>
                    <kpi.icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4", `text-${kpi.color}`)} />
                  </div>
                </CardHeader>
                <CardContent className="p-3 md:p-4 pt-0">
                  <motion.div 
                    className={cn("text-lg md:text-2xl font-bold", `text-${kpi.color}`)}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    {kpi.value}
                  </motion.div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate">{kpi.subtitle}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row */}
        <motion.div 
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6"
          variants={containerVariants}
        >
          {/* Risk Distribution */}
          <motion.div variants={itemVariants}>
            <Card variant="glass" className="overflow-hidden">
              <CardHeader className="relative border-b border-border/30 p-3 md:p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-info/5" />
                <CardTitle className="relative flex items-center gap-2 text-sm md:text-base">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                    <Activity className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                  </div>
                  <span className="truncate">Distribuição por Nível de Risco</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:pt-4">
                <div className="h-[180px] md:h-[250px]">
                  {riskData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {riskData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Target className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Sem dados</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-3 md:mt-4 justify-center">
                  {riskData.map((item) => (
                    <Badge key={item.name} style={{ backgroundColor: item.color }} className="text-white shadow-sm text-[10px] md:text-xs">
                      {item.name}: {item.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Status Distribution */}
          <motion.div variants={itemVariants}>
            <Card variant="glass" className="overflow-hidden">
              <CardHeader className="relative border-b border-border/30 p-3 md:p-4">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-info/5" />
                <CardTitle className="relative flex items-center gap-2 text-sm md:text-base">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                  </div>
                  <span className="truncate">Motoristas por Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:pt-4">
                <div className="h-[180px] md:h-[250px]">
                  {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusData} layout="vertical">
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis type="category" dataKey="name" width={60} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--primary))" 
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Users className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Sem dados</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Bottom Row */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
          variants={containerVariants}
        >
        <ApprovalStatsPanel data={approvalMetrics} />
        <IncidentSeverityPanel data={incidentMetrics} />
        <IncidentTypePanel data={incidentTypeData} />
      </motion.div>

      <WhitelistBlacklistSummary data={driverMetrics} />
      </motion.div>
    </PullToRefresh>
  );
}
