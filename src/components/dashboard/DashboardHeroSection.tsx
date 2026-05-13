import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Truck,
  Target,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sparkline, MiniSparkline } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';
import { DashboardStats } from '@/types';

// Re-export extracted components
export { QuickActionsPanel, WelcomeBanner } from './DashboardQuickActions';

interface DashboardHeroSectionProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

function generateSparklineData(currentValue: number, variance: number = 0.2, points: number = 12): number[] {
  const data: number[] = [];
  let value = currentValue * (1 - variance);
  for (let i = 0; i < points - 1; i++) {
    const change = (Math.random() - 0.5) * currentValue * variance * 0.5;
    value = Math.max(0, value + change);
    data.push(Math.round(value));
  }
  data.push(currentValue);
  return data;
}

function calculateTrend(data: number[]): { direction: 'up' | 'down' | 'neutral'; percentage: number } {
  if (data.length < 2) return { direction: 'neutral', percentage: 0 };
  const first = data[0];
  const last = data[data.length - 1];
  const diff = last - first;
  const percentage = first > 0 ? Math.abs((diff / first) * 100) : 0;
  return {
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
    percentage: Math.round(percentage * 10) / 10,
  };
}

interface EnhancedMetricProps {
  title: string;
  value: number;
  format?: 'number' | 'percentage' | 'time';
  icon: React.ElementType;
  color: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  sparklineData?: number[];
  onClick?: () => void;
  comparison?: string;
  index?: number;
}

function EnhancedMetricCard({
  title, value, format = 'number', icon: Icon, color, sparklineData, onClick, comparison, index = 0,
}: EnhancedMetricProps) {
  const trend = sparklineData ? calculateTrend(sparklineData) : null;
  const colorStyles = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
    success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
    warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
    destructive: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
    info: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  };
  const styles = colorStyles[color];
  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage': return `${val.toFixed(1)}%`;
      case 'time': return `${val}min`;
      default: return val.toLocaleString('pt-BR');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: onClick ? 1.02 : 1, y: onClick ? -2 : 0 }}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-sm p-4 transition-all duration-300",
        styles.border,
        onClick && "cursor-pointer hover:shadow-lg"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", styles.bg)} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <motion.div whileHover={{ rotate: 5, scale: 1.1 }} className={cn("p-2 rounded-xl", styles.bg)}>
            <Icon className={cn("w-5 h-5", styles.text)} />
          </motion.div>
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold tracking-tight">{formatValue(value)}</span>
          {trend && trend.percentage > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                trend.direction === 'up' ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
            >
              {trend.direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.percentage}%
            </motion.div>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="mb-2">
            <Sparkline data={sparklineData} color={`hsl(var(--${color}))`} height={28} showArea animated highlightMax />
          </div>
        )}
        {comparison && <p className="text-xs text-muted-foreground">{comparison}</p>}
      </div>
      <div className={cn("absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-2xl", styles.bg)} />
    </motion.div>
  );
}

export function DashboardHeroSection({ stats, isLoading }: DashboardHeroSectionProps) {
  const navigate = useNavigate();
  const sparklines = useMemo(() => {
    if (!stats) return null;
    return {
      orders: generateSparklineData(stats.totalOrders, 0.3, 12),
      deliveries: generateSparklineData(stats.activeDeliveries, 0.4, 12),
      onTime: generateSparklineData(stats.onTimeRate, 0.1, 12),
      avgTime: generateSparklineData(stats.avgDeliveryTime, 0.2, 12),
      completed: generateSparklineData(stats.completedToday, 0.25, 8),
    };
  }, [stats]);

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedMetricCard title="Pedidos Hoje" value={stats.totalOrders} icon={Package} color="primary" sparklineData={sparklines?.orders} onClick={() => navigate('/orders')} comparison="vs. ontem" index={0} />
        <EnhancedMetricCard title="Entregas Ativas" value={stats.activeDeliveries} icon={Truck} color="info" sparklineData={sparklines?.deliveries} onClick={() => navigate('/map')} comparison="em tempo real" index={1} />
        <EnhancedMetricCard title="Taxa On-Time" value={stats.onTimeRate} format="percentage" icon={Target} color={stats.onTimeRate >= 90 ? 'success' : stats.onTimeRate >= 70 ? 'warning' : 'destructive'} sparklineData={sparklines?.onTime} onClick={() => navigate('/sla')} comparison="meta: 95%" index={2} />
        <EnhancedMetricCard title="Tempo Médio" value={stats.avgDeliveryTime} format="time" icon={Clock} color="success" sparklineData={sparklines?.avgTime} onClick={() => navigate('/delivery-metrics')} comparison="últimas 4h" index={3} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="w-4 h-4 text-success" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Completadas</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{stats.completedToday}</span>
              {sparklines?.completed && <MiniSparkline data={sparklines.completed} width={40} height={14} />}
            </div>
          </div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
          <div className={cn("p-2 rounded-lg", stats.pendingApprovals > 5 ? "bg-warning/10" : "bg-primary/10")}>
            <Users className={cn("w-4 h-4", stats.pendingApprovals > 5 ? "text-warning" : "text-primary")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Aprovações</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{stats.pendingApprovals}</span>
              {stats.pendingApprovals > 5 && <Badge variant="warning" className="text-[10px] px-1.5">urgente</Badge>}
            </div>
          </div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
          <div className={cn("p-2 rounded-lg", stats.alertsCount > 0 ? "bg-destructive/10" : "bg-success/10")}>
            <AlertTriangle className={cn("w-4 h-4", stats.alertsCount > 0 ? "text-destructive" : "text-success")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Alertas</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{stats.alertsCount}</span>
              {stats.alertsCount > 0 && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
            </div>
          </div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 }} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
          <div className="p-2 rounded-lg bg-info/10"><Activity className="w-4 h-4 text-info" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Motoristas</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{stats.activeDrivers}</span>
              <Badge variant="success" className="text-[10px] px-1.5">online</Badge>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
