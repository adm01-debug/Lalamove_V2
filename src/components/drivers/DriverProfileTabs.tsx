import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkline } from '@/components/ui/sparkline';
import {
  Package, CheckCircle2, Star, Target, Zap, AlertTriangle, Ban,
  TrendingUp, TrendingDown, Award, Activity, History, User, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DriverWithIncidents } from '@/hooks/useDrivers';

interface TabContentProps {
  driver: DriverWithIncidents;
  completionRate: number;
  failureRate: number;
  failedDeliveries: number;
  performanceData: number[];
}

export function OverviewTab({ driver, completionRate, failureRate, performanceData }: TabContentProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Package, label: 'Total Entregas', value: driver.totalDeliveries, color: 'primary' },
          { icon: CheckCircle2, label: 'Completadas', value: driver.completedDeliveries, color: 'success' },
          { icon: Star, label: 'Avaliação', value: driver.rating.toFixed(1), color: 'warning', suffix: '/5' },
          { icon: Target, label: 'Taxa Sucesso', value: `${completionRate.toFixed(1)}%`, color: 'accent' },
        ].map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <Card variant="glass" className="overflow-hidden">
              <CardContent className="p-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", `bg-${stat.color}/10`)}>
                  <stat.icon className={cn("w-5 h-5", `text-${stat.color}`)} />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}{stat.suffix && <span className="text-sm text-muted-foreground">{stat.suffix}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card variant="glass">
        <CardContent className="p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />Performance Recente
          </h4>
          <div className="h-20"><Sparkline data={performanceData} color="hsl(var(--primary))" height={80} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de Sucesso</span>
                <span className="font-semibold text-success">{completionRate.toFixed(1)}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de Falha</span>
                <span className="font-semibold text-destructive">{failureRate.toFixed(1)}%</span>
              </div>
              <Progress value={failureRate} className="h-2 [&>div]:bg-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {driver.incidentCount > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card variant="glass" className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-destructive mb-1">
                      {driver.incidentCount} Incidente{driver.incidentCount > 1 ? 's' : ''} Não Resolvido{driver.incidentCount > 1 ? 's' : ''}
                    </h4>
                    <p className="text-sm text-muted-foreground">Este motorista possui incidentes pendentes.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {driver.status === 'BLACKLIST' && driver.blacklistReason && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card variant="glass" className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                  <Ban className="w-4 h-4" />Motivo da Blacklist
                </h4>
                <p className="text-sm text-muted-foreground">{driver.blacklistReason}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PerformanceTab({ driver, completionRate, failedDeliveries }: TabContentProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Entregas Completadas</span>
              <Badge variant="success">{driver.completedDeliveries}</Badge>
            </div>
            <p className="text-3xl font-bold text-foreground">{driver.completedDeliveries}</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Entregas Pendentes</span>
              <Badge variant="destructive">{failedDeliveries}</Badge>
            </div>
            <p className="text-3xl font-bold text-foreground">{failedDeliveries}</p>
          </CardContent>
        </Card>
      </div>

      <Card variant="glass">
        <CardContent className="p-4 space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-warning" />Indicadores de Desempenho
          </h4>
          <div className="space-y-3">
            {[
              { label: 'Pontualidade', value: Math.max(0, 100 - driver.riskScore * 5), trend: 'up' as const },
              { label: 'Satisfação do Cliente', value: (driver.rating / 5) * 100, trend: driver.rating >= 4 ? 'up' as const : 'down' as const },
              { label: 'Taxa de Conclusão', value: completionRate, trend: completionRate >= 85 ? 'up' as const : 'down' as const },
            ].map((metric) => (
              <div key={metric.label} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">{metric.label}</span>
                    <div className="flex items-center gap-1">
                      {metric.trend === 'up' ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                      <span className="text-sm font-semibold">{metric.value.toFixed(0)}%</span>
                    </div>
                  </div>
                  <Progress
                    value={metric.value}
                    className={cn("h-2", metric.value >= 80 && "[&>div]:bg-success", metric.value >= 50 && metric.value < 80 && "[&>div]:bg-warning", metric.value < 50 && "[&>div]:bg-destructive")}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function HistoryTab({ driver }: Pick<TabContentProps, 'driver'>) {
  return (
    <div className="space-y-4">
      <Card variant="glass">
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />Atividade Recente
          </h4>
          <div className="space-y-4">
            {driver.lastActiveAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-info" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Última Atividade</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(driver.lastActiveAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            )}
            {driver.updatedAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                  <Target className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Última Atualização</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(driver.updatedAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            )}
            {driver.createdAt && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Cadastrado</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(driver.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
