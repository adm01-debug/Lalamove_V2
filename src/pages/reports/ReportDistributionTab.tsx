import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, CheckCircle2, Bike, Car } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';
import type { DailyStats, VehicleDistribution } from './useReportData';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

function getVehicleIcon(type: string) {
  switch (type) {
    case 'Moto': return Bike;
    case 'Carro': return Car;
    case 'Van': return Truck;
    case 'Caminhão': return Truck;
    default: return Bike;
  }
}

interface ReportDistributionTabProps {
  dailyStats: DailyStats[];
  vehicleDistribution: VehicleDistribution[];
}

export function ReportDistributionTab({ dailyStats, vehicleDistribution }: ReportDistributionTabProps) {
  return (
    <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
      {/* Vehicle type distribution */}
      <Card variant="glass" hover="border" className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning/10"><Truck className="w-4 h-4 text-warning" /></div>
            <div><CardTitle className="text-lg">Distribuição por Veículo</CardTitle><CardDescription>Tipos de veículos utilizados</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vehicleDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="type">
                  {vehicleDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {vehicleDistribution.map((item, index) => {
              const VehicleIcon = getVehicleIcon(item.type);
              return (
                <motion.div key={item.type} className="flex items-center gap-3 p-3 rounded-xl backdrop-blur-xl bg-card/50 border border-border/50" whileHover={{ scale: 1.02 }}>
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${CHART_COLORS[index % CHART_COLORS.length]}20` }}>
                    <VehicleIcon className="w-4 h-4" style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.type}</p>
                    <p className="text-xs text-muted-foreground">{item.count} ({item.percentage}%)</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Completion rate over time */}
      <Card variant="glass" hover="border" className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="w-4 h-4 text-success" /></div>
            <div><CardTitle className="text-lg">Taxa de Conclusão</CardTitle><CardDescription>Concluídas vs Canceladas por dia</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                <Legend />
                <Bar dataKey="completed" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Concluídas" />
                <Bar dataKey="cancelled" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Canceladas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
