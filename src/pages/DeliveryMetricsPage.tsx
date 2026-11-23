import { 
  Package, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Loader2, Truck, User, Timer, BarChart3, Activity, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { QueryState } from '@/components/ui/query-state';
import { useDeliveryMetrics, useDriverDeliveryStats, useDeliveryTrends } from '@/hooks/useDeliveryMetrics';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart, Legend
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: 'hsl(var(--success))', CANCELLED: 'hsl(var(--destructive))',
  PENDING: 'hsl(var(--warning))', MATCHED: 'hsl(var(--primary))',
  ON_GOING: 'hsl(210 100% 50%)', PICKED_UP: 'hsl(280 100% 60%)',
  REJECTED: 'hsl(340 82% 52%)', EXPIRED: 'hsl(0 0% 50%)',
};
const VEHICLE_COLORS: Record<string, string> = {
  MOTORCYCLE: 'hsl(var(--primary))', CAR: 'hsl(var(--success))',
  VAN: 'hsl(var(--warning))', TRUCK: 'hsl(var(--destructive))',
};
const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Concluído', CANCELLED: 'Cancelado', PENDING: 'Pendente',
  MATCHED: 'Motorista Atribuído', ON_GOING: 'Em Andamento',
  PICKED_UP: 'Coletado', REJECTED: 'Rejeitado', EXPIRED: 'Expirado',
};
const VEHICLE_LABELS: Record<string, string> = { MOTORCYCLE: 'Moto', CAR: 'Carro', VAN: 'Van', TRUCK: 'Caminhão' };
const RISK_COLORS: Record<string, string> = { LOW: 'text-success', MEDIUM: 'text-warning', HIGH: 'text-destructive', CRITICAL: 'text-accent' };

const fmt = (m: number) => m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;

export function DeliveryMetricsPage() {
  const { data: dm, isLoading: l1, isError: e1, refetch: refetch1 } = useDeliveryMetrics();
  const { data: ds, isLoading: l2, isError: e2 } = useDriverDeliveryStats();
  const { data: trends, isLoading: l3, isError: e3 } = useDeliveryTrends(7);

  if (l1 || l2 || l3) return <QueryState isLoading />;
  if (e1 || e2 || e3) return <QueryState isError onRetry={refetch1} errorText="Não foi possível carregar as métricas de entrega." />;

  const statusData = dm ? Object.entries(dm.byStatus).map(([s, c]) => ({ name: STATUS_LABELS[s] || s, value: c, color: STATUS_COLORS[s] || 'hsl(var(--muted))' })).filter(d => d.value > 0) : [];
  const vehicleData = dm ? Object.entries(dm.byVehicleType).map(([t, c]) => ({ name: VEHICLE_LABELS[t] || t, value: c, color: VEHICLE_COLORS[t] || 'hsl(var(--primary))' })).filter(d => d.value > 0) : [];
  const trendData = trends?.map(t => ({ ...t, dateLabel: new Date(t.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }) })) || [];

  return (
    <div className="p-6 space-y-6">
      <div><h2 className="text-2xl font-bold text-foreground">Métricas de Entregas</h2><p className="text-sm text-muted-foreground">Taxa de conclusão, cancelamentos e performance</p></div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total de Pedidos', icon: Package, value: dm?.totalOrders || 0, sub: `Hoje: ${dm?.todayOrders || 0}`, color: '' },
          { title: 'Taxa de Conclusão', icon: TrendingUp, value: `${dm?.completionRate.toFixed(1) || 0}%`, sub: `${dm?.completedOrders || 0} concluídos`, color: 'text-success', border: 'border-success/30', progress: dm?.completionRate },
          { title: 'Taxa de Cancelamento', icon: TrendingDown, value: `${dm?.cancellationRate.toFixed(1) || 0}%`, sub: `${dm?.cancelledOrders || 0} cancelados`, color: 'text-destructive', border: 'border-destructive/30', progress: dm?.cancellationRate, progressClass: '[&>div]:bg-destructive' },
          { title: 'Tempo Médio', icon: Timer, value: fmt(dm?.avgDeliveryTimeMinutes || 0), sub: `${dm?.pendingOrders || 0} em andamento`, color: '' },
        ].map(c => (
          <Card key={c.title} className={`glass-card ${c.border || ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{c.title}</CardTitle><c.icon className={`h-4 w-4 ${c.color || 'text-muted-foreground'}`} /></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              {c.progress !== undefined && <div className="mt-2"><Progress value={c.progress} className={`h-2 ${c.progressClass || ''}`} /></div>}
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trend Chart */}
      <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />Tendência (7 dias)</CardTitle></CardHeader>
        <CardContent><div className="h-[300px]">{trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="dateLabel" className="text-xs" /><YAxis className="text-xs" /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} /><Legend />
            <Area type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} />
            <Area type="monotone" dataKey="completed" name="Concluídos" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" strokeWidth={2} />
            <Area type="monotone" dataKey="cancelled" name="Cancelados" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" strokeWidth={2} />
          </AreaChart></ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}</div></CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" />Por Status</CardTitle></CardHeader>
          <CardContent><div className="h-[250px]">{statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{statusData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}</div>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">{statusData.slice(0, 4).map(i => <Badge key={i.name} style={{ backgroundColor: i.color }} className="text-white">{i.name}: {i.value}</Badge>)}</div>
          </CardContent></Card>
        <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5" />Por Veículo</CardTitle></CardHeader>
          <CardContent><div className="h-[250px]">{vehicleData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%"><BarChart data={vehicleData}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" name="Pedidos" radius={[4, 4, 0, 0]}>{vehicleData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar></BarChart></ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-muted-foreground">Sem dados</div>}</div></CardContent></Card>
      </div>

      {/* Driver Stats */}
      <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Performance por Motorista</CardTitle></CardHeader>
        <CardContent>{ds && ds.length > 0 ? (
          <Table><TableHeader><TableRow>
            <TableHead>Motorista</TableHead><TableHead className="text-center">Total</TableHead>
            <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4 text-success" />OK</div></TableHead>
            <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><XCircle className="w-4 h-4 text-destructive" />Cancel</div></TableHead>
            <TableHead className="text-center">Taxa</TableHead><TableHead className="text-center"><div className="flex items-center justify-center gap-1"><Clock className="w-4 h-4" />Tempo</div></TableHead>
            <TableHead className="text-center">Rating</TableHead><TableHead className="text-center">Risco</TableHead>
          </TableRow></TableHeader>
          <TableBody>{ds.slice(0, 10).map(d => (
            <TableRow key={d.driverId}><TableCell className="font-medium">{d.driverName}</TableCell><TableCell className="text-center">{d.totalDeliveries}</TableCell>
              <TableCell className="text-center text-success">{d.completedDeliveries}</TableCell><TableCell className="text-center text-destructive">{d.cancelledDeliveries}</TableCell>
              <TableCell className="text-center"><div className="flex items-center justify-center gap-2"><Progress value={d.completionRate} className="w-16 h-2" /><span className="text-sm">{d.completionRate.toFixed(0)}%</span></div></TableCell>
              <TableCell className="text-center">{d.avgDeliveryTimeMinutes > 0 ? fmt(d.avgDeliveryTimeMinutes) : '-'}</TableCell>
              <TableCell className="text-center"><Badge variant="secondary">⭐ {d.rating.toFixed(1)}</Badge></TableCell>
              <TableCell className="text-center"><span className={RISK_COLORS[d.riskLevel] || 'text-muted-foreground'}>{d.riskLevel}</span></TableCell>
            </TableRow>
          ))}</TableBody></Table>
        ) : <div className="text-center text-muted-foreground py-8">Nenhum motorista com entregas</div>}</CardContent>
      </Card>

      {/* Today Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Package, label: 'Pedidos Hoje', value: dm?.todayOrders || 0, color: 'primary', border: '' },
          { icon: CheckCircle2, label: 'Concluídos Hoje', value: dm?.todayCompleted || 0, color: 'success', border: 'border-success/30' },
          { icon: XCircle, label: 'Cancelados Hoje', value: dm?.todayCancelled || 0, color: 'destructive', border: 'border-destructive/30' },
        ].map(s => (
          <Card key={s.label} className={`glass-card ${s.border}`}><CardContent className="flex items-center gap-4 p-6">
            <div className={`p-3 rounded-xl bg-${s.color}/20`}><s.icon className={`w-8 h-8 text-${s.color}`} /></div>
            <div><p className="text-sm text-muted-foreground">{s.label}</p><p className={`text-3xl font-bold text-${s.color}`}>{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
