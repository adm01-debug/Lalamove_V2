import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Package, Clock, TrendingUp, Star, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DriverPerformance } from './useReportData';

interface ReportDriversTabProps {
  driverPerformance: DriverPerformance[];
}

export function ReportDriversTab({ driverPerformance }: ReportDriversTabProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      <Card variant="glass" className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-4 h-4 text-primary" /></div>
            <div><CardTitle className="text-lg">Top 10 Motoristas</CardTitle><CardDescription>Ranking por número de entregas concluídas</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          {driverPerformance.length > 0 ? (
            <div className="space-y-3">
              {driverPerformance.map((driver, index) => (
                <motion.div key={driver.id} className="flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl bg-card/50 border border-border/50 hover:bg-card/70 transition-all" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} whileHover={{ x: 4 }}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl font-bold text-sm ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30' :
                    index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-400/30' :
                    index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-600/30' :
                    'bg-primary/20 text-primary'
                  }`}>{index + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{driver.name}</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10">
                        <Star className="w-3 h-3 fill-warning text-warning" />
                        <span className="text-xs font-medium text-warning">{driver.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" />{driver.completedDeliveries} entregas</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{driver.avgTime > 0 ? `${driver.avgTime} min` : '-'}</span>
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{driver.onTimeRate}% pontual</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {driver.incidents > 0 && <Badge variant="warning" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" />{driver.incidents}</Badge>}
                    <Badge variant="success" className="text-xs font-semibold">{driver.onTimeRate}%</Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum dado de motorista disponível para o período</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
