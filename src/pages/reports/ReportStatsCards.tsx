import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, TrendingDown, Users, Package, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DeliveryStats } from './useReportData';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } }
};

const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { type: "spring" as const, stiffness: 400, damping: 17 } }
};

interface ReportStatsCardsProps {
  stats: DeliveryStats | null;
}

export function ReportStatsCards({ stats }: ReportStatsCardsProps) {
  return (
    <>
      {/* Total Deliveries */}
      <motion.div variants={itemVariants} initial="rest" whileHover="hover" animate="rest">
        <motion.div variants={cardHover}>
          <Card variant="glass" hover="lift" className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-info" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total de Entregas</p>
                  <motion.p className="text-3xl font-bold text-foreground mt-1" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: "spring" }}>
                    {stats?.totalDeliveries || 0}
                  </motion.p>
                </div>
                <motion.div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-info/20" whileHover={{ rotate: 10, scale: 1.1 }}>
                  <Package className="w-6 h-6 text-primary" />
                </motion.div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Badge variant="success" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />{stats?.completedDeliveries || 0}</Badge>
                <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />{stats?.cancelledDeliveries || 0}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Average Time */}
      <motion.div variants={itemVariants} initial="rest" whileHover="hover" animate="rest">
        <motion.div variants={cardHover}>
          <Card variant="glass" hover="lift" className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning to-warning/50" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Tempo Médio</p>
                  <motion.p className="text-3xl font-bold text-foreground mt-1" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, type: "spring" }}>
                    {stats?.avgDeliveryTime || 0} <span className="text-lg font-normal text-muted-foreground">min</span>
                  </motion.p>
                </div>
                <motion.div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10" whileHover={{ rotate: 10, scale: 1.1 }}>
                  <Clock className="w-6 h-6 text-warning" />
                </motion.div>
              </div>
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <TrendingDown className="w-4 h-4 text-success" />
                <span>Tempo entre coleta e entrega</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* On-Time Rate */}
      <motion.div variants={itemVariants} initial="rest" whileHover="hover" animate="rest">
        <motion.div variants={cardHover}>
          <Card variant="glass" hover="lift" className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success to-success/50" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Taxa de Pontualidade</p>
                  <motion.p className="text-3xl font-bold text-foreground mt-1" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, type: "spring" }}>
                    {stats?.onTimeRate || 0}%
                  </motion.p>
                </div>
                <motion.div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/10" whileHover={{ rotate: 10, scale: 1.1 }}>
                  <TrendingUp className="w-6 h-6 text-success" />
                </motion.div>
              </div>
              <div className="mt-4">
                <div className="flex-1 bg-secondary/50 rounded-full h-2.5 overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-success to-success/70 rounded-full" initial={{ width: 0 }} animate={{ width: `${stats?.onTimeRate || 0}%` }} transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Active Drivers */}
      <motion.div variants={itemVariants} initial="rest" whileHover="hover" animate="rest">
        <motion.div variants={cardHover}>
          <Card variant="glass" hover="lift" className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-info to-primary" />
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Motoristas Ativos</p>
                  <motion.p className="text-3xl font-bold text-foreground mt-1" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: "spring" }}>
                    {stats?.activeDrivers || 0}
                  </motion.p>
                </div>
                <motion.div className="p-3 rounded-xl bg-gradient-to-br from-info/20 to-primary/20" whileHover={{ rotate: 10, scale: 1.1 }}>
                  <Users className="w-6 h-6 text-info" />
                </motion.div>
              </div>
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Activity className="w-4 h-4 text-info" />
                <span>de {stats?.totalDrivers || 0} cadastrados</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </>
  );
}
