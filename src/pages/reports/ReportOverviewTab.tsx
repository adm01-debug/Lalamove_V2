import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Activity, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend } from 'recharts';
import { motion } from 'framer-motion';
import type { DeliveryStats, DailyStats } from './useReportData';

interface ReportOverviewTabProps {
  dailyStats: DailyStats[];
  statusDistribution: { status: string; count: number }[];
  stats: DeliveryStats | null;
  completionRate: number;
}

export function ReportOverviewTab({ dailyStats, statusDistribution, stats, completionRate }: ReportOverviewTabProps) {
  return (
    <div className="space-y-6">
      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
        {/* Deliveries over time */}
        <Card variant="glass" hover="border" className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10"><Activity className="w-4 h-4 text-primary" /></div>
              <div><CardTitle className="text-lg">Entregas por Dia</CardTitle><CardDescription>Evolução das entregas no período</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="colorDeliveries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 10px 40px -10px hsl(var(--primary) / 0.2)' }} />
                  <Legend />
                  <Area type="monotone" dataKey="deliveries" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorDeliveries)" strokeWidth={2} name="Total" />
                  <Area type="monotone" dataKey="completed" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} name="Concluídas" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card variant="glass" hover="border" className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10"><Package className="w-4 h-4 text-info" /></div>
              <div><CardTitle className="text-lg">Status das Entregas</CardTitle><CardDescription>Distribuição por status</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="status" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 10px 40px -10px hsl(var(--primary) / 0.2)' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Completion Rate Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card variant="glass" className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <svg className="w-24 h-24">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                    <motion.circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--success))" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${completionRate * 2.51} 251`} transform="rotate(-90 48 48)" initial={{ strokeDasharray: "0 251" }} animate={{ strokeDasharray: `${completionRate * 2.51} 251` }} transition={{ duration: 1, ease: "easeOut" }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-success">{completionRate}%</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Taxa de Conclusão</h3>
                  <p className="text-muted-foreground text-sm">{stats?.completedDeliveries || 0} de {stats?.totalDeliveries || 0} entregas concluídas</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center p-4 rounded-xl bg-success/10">
                  <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="text-2xl font-bold text-success">{stats?.completedDeliveries || 0}</p>
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-destructive/10">
                  <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-2xl font-bold text-destructive">{stats?.cancelledDeliveries || 0}</p>
                  <p className="text-xs text-muted-foreground">Canceladas</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
