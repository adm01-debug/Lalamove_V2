import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
} from 'lucide-react';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

interface ApprovalMetricsData {
  totalApprovals: number;
  approved: number;
  rejected: number;
  pending: number;
  todayApprovals: number;
  todayRejections: number;
}

interface IncidentMetricsData {
  bySeverity: { low: number; medium: number; high: number; critical: number };
  avgResolutionTimeHours: number;
}

interface DriverMetricsListData {
  whitelistCount: number;
  blacklistCount: number;
}

export function ApprovalStatsPanel({ data }: { data: ApprovalMetricsData | undefined }) {
  return (
    <motion.div variants={itemVariants}>
      <Card variant="glass" className="overflow-hidden h-full">
        <CardHeader className="relative border-b border-border/30">
          <div className="absolute inset-0 bg-gradient-to-r from-success/5 to-transparent" />
          <CardTitle className="relative flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center border border-success/30">
              <ShieldCheck className="w-4 h-4 text-success" />
            </div>
            Aprovações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-bold">{data?.totalApprovals || 0}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-success/10 border border-success/20">
            <span className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" />Aprovados</span>
            <span className="font-bold text-success">{data?.approved || 0}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <span className="text-sm flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" />Rejeitados</span>
            <span className="font-bold text-destructive">{data?.rejected || 0}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-warning/10 border border-warning/20">
            <span className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-warning" />Pendentes</span>
            <span className="font-bold text-warning">{data?.pending || 0}</span>
          </div>
          <div className="border-t border-border/30 pt-4 mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Hoje: Aprovados</span>
              <Badge variant="success" className="shadow-sm">{data?.todayApprovals || 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Hoje: Rejeitados</span>
              <Badge variant="destructive" className="shadow-sm">{data?.todayRejections || 0}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function IncidentSeverityPanel({ data }: { data: IncidentMetricsData | undefined }) {
  return (
    <motion.div variants={itemVariants}>
      <Card variant="glass" className="overflow-hidden h-full">
        <CardHeader className="relative border-b border-border/30">
          <div className="absolute inset-0 bg-gradient-to-r from-destructive/5 to-transparent" />
          <CardTitle className="relative flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center border border-destructive/30">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            Incidentes por Severidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
            <span className="text-sm text-muted-foreground">Baixa</span>
            <Badge variant="secondary">{data?.bySeverity.low || 0}</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-warning/10 border border-warning/20">
            <span className="text-sm text-warning">Média</span>
            <Badge variant="warning">{data?.bySeverity.medium || 0}</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <span className="text-sm text-destructive">Alta</span>
            <Badge variant="destructive">{data?.bySeverity.high || 0}</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-accent/10 border border-accent/20">
            <span className="text-sm text-accent">Crítica</span>
            <Badge className="bg-accent shadow-sm">{data?.bySeverity.critical || 0}</Badge>
          </div>
          <div className="border-t border-border/30 pt-4 mt-4">
            <div className="text-sm text-muted-foreground mb-1">Tempo médio de resolução</div>
            <div className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {data?.avgResolutionTimeHours.toFixed(1) || 0}h
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function IncidentTypePanel({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <motion.div variants={itemVariants}>
      <Card variant="glass" className="overflow-hidden h-full">
        <CardHeader className="relative border-b border-border/30">
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent" />
          <CardTitle className="relative flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
              <BarChart3 className="w-4 h-4 text-accent" />
            </div>
            Incidentes por Tipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {data.length > 0 ? (
            data.map((item, index) => (
              <motion.div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <span className="text-sm truncate">{item.name}</span>
                <Badge variant="secondary" className="shadow-sm">{item.value}</Badge>
              </motion.div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-success opacity-50" />
              <p>Nenhum incidente registrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function WhitelistBlacklistSummary({ data }: { data: DriverMetricsListData | undefined }) {
  return (
    <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={itemVariants}>
        <Card variant="glass" hover="lift" className="border-primary/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
          <CardContent className="flex items-center gap-4 p-6">
            <motion.div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30" whileHover={{ scale: 1.1, rotate: 5 }} transition={{ type: 'spring', stiffness: 400 }}>
              <ShieldCheck className="w-8 h-8 text-primary" />
            </motion.div>
            <div>
              <p className="text-sm text-muted-foreground">Whitelist</p>
              <motion.p className="text-3xl font-bold text-primary" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>{data?.whitelistCount || 0}</motion.p>
              <p className="text-xs text-muted-foreground">Motoristas de confiança</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      <motion.div variants={itemVariants}>
        <Card variant="glass" hover="lift" className="border-destructive/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-destructive to-destructive/50" />
          <CardContent className="flex items-center gap-4 p-6">
            <motion.div className="p-4 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10 border border-destructive/30" whileHover={{ scale: 1.1, rotate: -5 }} transition={{ type: 'spring', stiffness: 400 }}>
              <ShieldX className="w-8 h-8 text-destructive" />
            </motion.div>
            <div>
              <p className="text-sm text-muted-foreground">Blacklist</p>
              <motion.p className="text-3xl font-bold text-destructive" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>{data?.blacklistCount || 0}</motion.p>
              <p className="text-xs text-muted-foreground">Motoristas bloqueados</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
