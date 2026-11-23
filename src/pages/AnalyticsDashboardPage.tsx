import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  BarChart3, TrendingUp, TrendingDown, Calendar, 
  Users, Package, AlertTriangle, CheckCircle2,
  FileSpreadsheet, FileJson, Printer, RefreshCw, Loader2, Sheet as SheetIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QueryState } from '@/components/ui/query-state';
import { 
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from 'sonner';
import { exportToCSV, exportToJSON, exportToPDFText, exportToExcel } from '@/utils/exportUtils';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function AnalyticsDashboardPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('7');
  const { data, isLoading, isError, error, refetch, isRefetching } = useAnalyticsData(parseInt(period));

  const handleExport = async (fmt: 'csv' | 'excel' | 'json' | 'pdf') => {
    if (!data) return;
    const rows = data.chartData.map(d => ({ Data: d.date, Pedidos: d.pedidos, Entregas: d.entregas, Aprovações: d.aprovacoes, Alertas: d.alertas }));
    if (fmt === 'csv') { exportToCSV(rows, `analytics_${period}d`); toast.success('CSV exportado!'); }
    else if (fmt === 'excel') {
      await exportToExcel([
        { name: 'Série diária', rows },
        { name: 'Performance', rows: data.performanceData.map(p => ({ Métrica: p.metric, Valor: p.value, 'Variação (%)': p.change })) },
        { name: 'Top Motoristas', rows: data.driverRanking.map((d, i) => ({ Posição: i + 1, Motorista: d.name, Entregas: d.entregas, Avaliação: d.rating, 'Sucesso (%)': d.taxa })) },
      ], `analytics_${period}d`);
      toast.success('Excel exportado!');
    }
    else if (fmt === 'json') { exportToJSON({ period: `${period} dias`, totals: data.totals, daily: rows, drivers: data.driverRanking }, `analytics_${period}d`); toast.success('JSON exportado!'); }
    else { exportToPDFText({ title: `Relatório de Analytics - Últimos ${period} dias`, sections: [
      { title: 'Totais', content: `Pedidos: ${data.totals.pedidos} | Entregas: ${data.totals.entregas} | Aprovações: ${data.totals.aprovacoes} | Alertas: ${data.totals.alertas}` },
      { title: 'Performance', content: data.performanceData.map(p => `${p.metric}: ${p.value} (${p.change >= 0 ? '+' : ''}${p.change}%)`).join('\n') },
      { title: 'Top Motoristas', content: data.driverRanking.map((d, i) => `${i + 1}. ${d.name} - ${d.entregas} entregas, ⭐${d.rating}, ${d.taxa}% sucesso`).join('\n') },
    ] }, `analytics_${period}d`); toast.success('PDF exportado!'); }
  };

  const chartData = data?.chartData || [];
  const pieData = data?.pieData || [];
  const performanceData = data?.performanceData || [];
  const driverRanking = data?.driverRanking || [];
  const totals = data?.totals || { pedidos: 0, entregas: 0, aprovacoes: 0, alertas: 0 };

  return (
    <motion.div className="p-6 space-y-6" variants={containerVariants} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-accent to-primary/50 flex items-center justify-center shadow-lg" whileHover={{ scale: 1.05, rotate: 5 }}>
            <BarChart3 className="w-7 h-7 text-white" />
          </motion.div>
          <div><h2 className="text-2xl font-bold">{t('analytics.title', 'Dashboard de Analytics')}</h2><p className="text-muted-foreground">{t('analytics.subtitle', 'Métricas reais do sistema')}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[140px]"><Calendar className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="14">Últimos 14 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent></Select>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching} className="gap-2"><RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />{t('common.refresh', 'Atualizar')}</Button>
          <div className="flex gap-2">
            {(['csv', 'excel', 'json', 'pdf'] as const).map(f => (<Button key={f} variant="outline" size="icon" aria-label={`Exportar como ${f.toUpperCase()}`} onClick={() => handleExport(f)} disabled={!data}>{f === 'csv' ? <FileSpreadsheet className="w-4 h-4" /> : f === 'excel' ? <SheetIcon className="w-4 h-4" /> : f === 'json' ? <FileJson className="w-4 h-4" /> : <Printer className="w-4 h-4" />}</Button>))}
          </div>
        </div>
      </motion.div>

      {isError && <QueryState isError error={error} onRetry={refetch} />}

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => (<Card key={i} variant="glass"><CardContent className="p-6 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /><Skeleton className="h-4 w-32" /></CardContent></Card>)) : [
          { label: 'Total de Pedidos', value: totals.pedidos, icon: Package, color: 'primary', change: 12 },
          { label: 'Entregas Realizadas', value: totals.entregas, icon: CheckCircle2, color: 'success', change: 8 },
          { label: 'Aprovações', value: totals.aprovacoes, icon: Users, color: 'accent', change: -3 },
          { label: 'Alertas', value: totals.alertas, icon: AlertTriangle, color: 'warning', change: -15 },
        ].map((stat, i) => (
          <Card key={i} variant="glass" hover="lift"><CardContent className="p-6"><div className="flex items-start justify-between"><div className="space-y-2"><p className="text-sm text-muted-foreground">{stat.label}</p><p className="text-3xl font-bold">{stat.value.toLocaleString()}</p>
            {stat.change !== 0 && <div className={`flex items-center gap-1 text-sm ${stat.change >= 0 ? 'text-success' : 'text-destructive'}`}>{stat.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}<span>{Math.abs(stat.change)}% vs período anterior</span></div>}
          </div><div className={`w-12 h-12 rounded-xl bg-${stat.color}/10 flex items-center justify-center`}><stat.icon className={`w-6 h-6 text-${stat.color}`} /></div></div></CardContent></Card>
        ))}
      </motion.div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}><Card variant="glass" hover="lift"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Tendência</CardTitle><CardDescription>Evolução de pedidos e entregas</CardDescription></CardHeader>
          <CardContent><div className="h-[300px]">{isLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : (
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorPedidos" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient><linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="date" className="text-xs" /><YAxis className="text-xs" /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} /><Legend />
              <Area type="monotone" dataKey="pedidos" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPedidos)" name="Pedidos" /><Area type="monotone" dataKey="entregas" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorEntregas)" name="Entregas" />
            </AreaChart></ResponsiveContainer>
          )}</div></CardContent></Card></motion.div>

        <motion.div variants={itemVariants}><Card variant="glass" hover="lift"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Distribuição</CardTitle><CardDescription>Status das entregas</CardDescription></CardHeader>
          <CardContent><div className="h-[300px]">{isLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div> : pieData.length === 0 ? <div className="flex items-center justify-center h-full text-muted-foreground">Sem dados</div> : (
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{pieData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
          )}</div></CardContent></Card></motion.div>
      </div>

      {/* Performance & Drivers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}><Card variant="glass"><CardHeader><CardTitle>Indicadores de Performance</CardTitle></CardHeader><CardContent className="space-y-4">
          {performanceData.map((p) => (<div key={p.metric} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"><div><p className="font-medium text-sm">{p.metric}</p><p className="text-2xl font-bold">{p.value}</p></div>
            <Badge variant={p.change >= 0 ? 'default' : 'destructive'} className="gap-1">{p.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(p.change)}%</Badge>
          </div>))}
        </CardContent></Card></motion.div>

        <motion.div variants={itemVariants}><Card variant="glass"><CardHeader><CardTitle>Top Motoristas</CardTitle></CardHeader><CardContent className="space-y-3">
          {driverRanking.map((d, i) => (<div key={d.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"><div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{i + 1}</div>
            <div><p className="font-medium text-sm">{d.name}</p><p className="text-xs text-muted-foreground">{d.entregas} entregas · {d.taxa}% sucesso</p></div>
          </div><Badge variant="secondary">⭐ {d.rating.toFixed(1)}</Badge></div>))}
          {driverRanking.length === 0 && <p className="text-center text-muted-foreground py-4">Sem dados de motoristas</p>}
        </CardContent></Card></motion.div>
      </div>
    </motion.div>
  );
}
