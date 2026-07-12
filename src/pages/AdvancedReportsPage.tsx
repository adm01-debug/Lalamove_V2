import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, Legend, PieChart, Pie, Cell, Line, ComposedChart,
} from 'recharts';
import {
  Calendar, RefreshCw, FileBarChart, Loader2, Download, Filter, X,
  DollarSign, Gauge, MapPin, TrendingUp, TrendingDown, Minus, Clock, PackageCheck, Save, Bookmark, Trash2, User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useAdvancedReports, DEFAULT_FILTERS, type AdvancedReportFilters,
} from '@/hooks/useAdvancedReports';
import { useReportPresets } from '@/hooks/useReportPresets';
import { exportToCSV, exportToJSON, exportToExcel, exportToPDFText } from '@/utils/exportUtils';

const VEHICLE_LABELS: Record<string, string> = {
  MOTORCYCLE: 'Moto', CAR: 'Carro', VAN: 'Van', TRUCK: 'Caminhão', SEDAN: 'Sedan',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente', MATCHED: 'Atribuído', ON_GOING: 'Em andamento',
  PICKED_UP: 'Coletado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
  REJECTED: 'Rejeitado', EXPIRED: 'Expirado',
};
const CHART_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--info))', 'hsl(var(--success))',
  'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--accent))',
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 110, damping: 16 } },
};

const fmtCurrency = (v: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v || 0);

function KpiCard({ icon: Icon, label, value, hint }: {
  icon: React.ElementType; label: string; value: string; hint?: string;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Card variant="glass" hover="border" className="overflow-hidden">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CompareStat({ label, current, delta, suffix, positiveIsGood }: {
  label: string; current: string; delta: number; suffix: string; positiveIsGood: boolean;
}) {
  const isFlat = delta === 0;
  const isUp = delta > 0;
  const isGood = isFlat ? true : isUp === positiveIsGood;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const toneClass = isFlat
    ? 'text-muted-foreground'
    : isGood
      ? 'text-success'
      : 'text-destructive';
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <p className="text-sm text-muted-foreground truncate">{label}</p>
      <p className="text-xl font-bold text-foreground">{current}</p>
      <div className={`flex items-center gap-1 text-sm font-medium ${toneClass}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{isUp ? '+' : ''}{delta}{suffix}</span>
      </div>
    </div>
  );
}

export default function AdvancedReportsPage() {
  const [filters, setFilters] = useState<AdvancedReportFilters>(DEFAULT_FILTERS);
  const [presetName, setPresetName] = useState('');
  const { presets, savePreset, deletePreset } = useReportPresets();
  const {
    loading, refreshing, fetchData, filterOptions, filteredRows,
    cost, performance, geography, daily, comparison,
  } = useAdvancedReports(filters);

  const setFilter = <K extends keyof AdvancedReportFilters>(key: K, value: AdvancedReportFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status !== 'all') n++;
    if (filters.vehicleType !== 'all') n++;
    if (filters.costCenter !== 'all') n++;
    if (filters.department !== 'all') n++;
    if (filters.driver !== 'all') n++;
    if (filters.urgency !== 'all') n++;
    if (filters.search.trim()) n++;
    if (filters.costMin.trim()) n++;
    if (filters.costMax.trim()) n++;
    return n;
  }, [filters]);

  const resetFilters = () =>
    setFilters((prev) => ({ ...DEFAULT_FILTERS, period: prev.period }));

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName, filters);
    setPresetName('');
  };

  const buildDetailRows = () =>
    filteredRows.map((r) => ({
      Pedido: r.internal_order_id || r.lalamove_id || r.id,
      Status: STATUS_LABELS[r.status] || r.status,
      Veiculo: VEHICLE_LABELS[r.vehicle_type || ''] || r.vehicle_type || '',
      Cliente: r.customer_name || '',
      Motorista: r.driver?.name || '',
      Departamento: r.department || '',
      'Centro de Custo': r.cost_center || '',
      'Custo': r.total_cost ?? '',
      Moeda: r.currency || '',
      'Distancia (km)': r.distance_meters ? (r.distance_meters / 1000).toFixed(1) : '',
      'Duracao (min)': r.duration_minutes ?? '',
      'Atraso (min)': r.delay_minutes ?? '',
      Urgente: r.is_urgent ? 'Sim' : 'Não',
      Entrega: r.delivery_address || '',
      Data: new Date(r.created_at).toLocaleString('pt-BR'),
    }));

  const handleExportCSV = () => {
    exportToCSV(buildDetailRows(), `relatorio_avancado_${filters.period}d`);
  };

  const handleExportExcel = () => {
    exportToExcel(
      [
        { name: 'Entregas', rows: buildDetailRows() },
        {
          name: 'Custo por grupo',
          rows: cost.byGroup.map((g) => ({
            Grupo: g.label,
            Entregas: g.count,
            'Custo total': g.total,
            'Custo médio': g.avg,
            '% do total': g.percentage,
          })),
        },
        {
          name: 'Geografia',
          rows: geography.map((g) => ({
            Região: g.region,
            Entregas: g.count,
            'Custo total': g.totalCost,
            'Distância média (km)': g.avgDistanceKm,
            'Atraso médio (min)': g.avgDelay,
            'Pontualidade (%)': g.onTimeRate,
          })),
        },
      ],
      `relatorio_avancado_${filters.period}d`,
    );
  };

  const handleExportJSON = () => {
    exportToJSON(
      { filtros: filters, custo: cost, performance, geografia: geography, diario: daily },
      `relatorio_avancado_${filters.period}d`,
    );
  };

  const handleExportPDF = () => {
    exportToPDFText(
      {
        title: `Relatório Avançado de Entregas — Últimos ${filters.period} dias`,
        sections: [
          {
            title: 'Custo',
            content: `Custo total: ${fmtCurrency(cost.totalCost, cost.currency)}\nCusto médio/entrega: ${fmtCurrency(cost.avgCost, cost.currency)}\nCusto por km: ${fmtCurrency(cost.costPerKm, cost.currency)}\n\nPor departamento/centro de custo:\n${cost.byGroup.map((g) => `• ${g.label}: ${fmtCurrency(g.total, cost.currency)} (${g.count} entregas, ${g.percentage}%)`).join('\n')}`,
          },
          {
            title: 'Performance',
            content: `Total: ${performance.total} | Concluídas: ${performance.completed} | Canceladas: ${performance.cancelled}\nTaxa de conclusão: ${performance.completionRate}%\nTaxa de cancelamento: ${performance.cancellationRate}%\nDuração média: ${performance.avgDuration} min\nAtraso médio: ${performance.avgDelay} min\nPontualidade: ${performance.onTimeRate}%\nConformidade POD: ${performance.podComplianceRate}%`,
          },
          {
            title: 'Geografia (Top regiões)',
            content: geography.map((g) => `• ${g.region}: ${g.count} entregas, ${fmtCurrency(g.totalCost, cost.currency)}, ${g.avgDistanceKm} km méd., atraso ${g.avgDelay} min, pontualidade ${g.onTimeRate}%`).join('\n'),
          },
        ],
      },
      `relatorio_avancado_${filters.period}d`,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Carregando relatórios avançados...</p>
        </motion.div>
      </div>
    );
  }

  const statusPie = performance.total
    ? [
        { name: 'Concluídas', value: performance.completed },
        { name: 'Canceladas', value: performance.cancelled },
        { name: 'Outras', value: Math.max(performance.total - performance.completed - performance.cancelled, 0) },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <motion.div className="p-6 space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-info/30 blur-xl rounded-2xl" />
            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-info shadow-lg">
              <FileBarChart className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios Avançados</h1>
            <p className="text-muted-foreground">Custo, performance e geografia com filtros e exportação</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={refreshing} aria-label="Atualizar">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON} className="gap-2">
            <Download className="w-4 h-4" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </motion.div>

      {/* Filtros avançados */}
      <motion.div variants={itemVariants}>
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" /> Filtros avançados
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto gap-1 text-muted-foreground">
                  <X className="w-3 h-3" /> Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <Select value={filters.period} onValueChange={(v) => setFilter('period', v)}>
              <SelectTrigger><Calendar className="w-4 h-4 mr-2 text-primary" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {filterOptions.statuses.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.vehicleType} onValueChange={(v) => setFilter('vehicleType', v)}>
              <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os veículos</SelectItem>
                {filterOptions.vehicles.map((v) => (
                  <SelectItem key={v} value={v}>{VEHICLE_LABELS[v] || v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.department} onValueChange={(v) => setFilter('department', v)}>
              <SelectTrigger><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {filterOptions.departments.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.costCenter} onValueChange={(v) => setFilter('costCenter', v)}>
              <SelectTrigger><SelectValue placeholder="Centro de custo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os centros</SelectItem>
                {filterOptions.costCenters.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.urgency} onValueChange={(v) => setFilter('urgency', v as AdvancedReportFilters['urgency'])}>
              <SelectTrigger><SelectValue placeholder="Urgência" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Urgentes e normais</SelectItem>
                <SelectItem value="urgent">Somente urgentes</SelectItem>
                <SelectItem value="normal">Somente normais</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.driver} onValueChange={(v) => setFilter('driver', v)}>
              <SelectTrigger><User className="w-4 h-4 mr-2 text-primary" /><SelectValue placeholder="Motorista" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motoristas</SelectItem>
                {filterOptions.drivers.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Custo mín."
                value={filters.costMin}
                onChange={(e) => setFilter('costMin', e.target.value)}
                aria-label="Custo mínimo"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Custo máx."
                value={filters.costMax}
                onChange={(e) => setFilter('costMax', e.target.value)}
                aria-label="Custo máximo"
              />
            </div>

            <Input
              placeholder="Buscar cliente, pedido, endereço, motorista..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="xl:col-span-2"
            />

            {/* Presets de filtros persistidos */}
            <div className="col-span-full flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 mt-1">
              <Bookmark className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-muted-foreground">Presets:</span>
              {presets.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Nenhum preset salvo</span>
              )}
              {presets.map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => setFilters(p.filters)}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreset(p.id)}
                    aria-label={`Excluir preset ${p.name}`}
                    className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <Input
                  placeholder="Nome do preset"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); }}
                  className="h-8 w-40"
                />
                <Button variant="outline" size="sm" onClick={handleSavePreset} disabled={!presetName.trim()} className="gap-1">
                  <Save className="w-3.5 h-3.5" /> Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>


      {/* KPIs globais */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={PackageCheck} label="Entregas (filtradas)" value={String(performance.total)} hint={`${performance.completed} concluídas`} />
        <KpiCard icon={DollarSign} label="Custo total" value={fmtCurrency(cost.totalCost, cost.currency)} hint={`${fmtCurrency(cost.avgCost, cost.currency)} / entrega`} />
        <KpiCard icon={Gauge} label="Pontualidade" value={`${performance.onTimeRate}%`} hint={`Atraso médio ${performance.avgDelay} min`} />
        <KpiCard icon={MapPin} label="Regiões atendidas" value={String(geography.length)} hint={`Custo/km ${fmtCurrency(cost.costPerKm, cost.currency)}`} />
      </motion.div>

      {/* Comparação com período anterior */}
      <motion.div variants={itemVariants}>
        <Card variant="glass">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Comparação vs. período anterior
              <span className="text-xs font-normal text-muted-foreground">
                (últimos {filters.period} dias vs. {filters.period} dias anteriores)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!comparison.hasPrevious ? (
              <p className="text-sm text-muted-foreground">Sem dados no período anterior para comparar.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <CompareStat label="Entregas" current={String(comparison.current.deliveries)} delta={comparison.deltas.deliveries} suffix="%" positiveIsGood />
                <CompareStat label="Custo total" current={fmtCurrency(comparison.current.totalCost, cost.currency)} delta={comparison.deltas.totalCost} suffix="%" positiveIsGood={false} />
                <CompareStat label="Pontualidade" current={`${comparison.current.onTimeRate}%`} delta={comparison.deltas.onTimeRate} suffix=" pts" positiveIsGood />
                <CompareStat label="Cancelamento" current={`${comparison.current.cancellationRate}%`} delta={comparison.deltas.cancellationRate} suffix=" pts" positiveIsGood={false} />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>


      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="cost" className="space-y-6">
          <TabsList className="backdrop-blur-xl bg-card/50 border border-border/50 p-1">
            <TabsTrigger value="cost" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><DollarSign className="w-4 h-4" /> Custo</TabsTrigger>
            <TabsTrigger value="performance" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Gauge className="w-4 h-4" /> Performance</TabsTrigger>
            <TabsTrigger value="geography" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><MapPin className="w-4 h-4" /> Geografia</TabsTrigger>
          </TabsList>

          {/* CUSTO */}
          <TabsContent value="cost" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="glass">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Custo diário</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={daily}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip formatter={(v) => fmtCurrency(Number(v), cost.currency)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Area type="monotone" dataKey="cost" name="Custo" stroke="hsl(var(--primary))" fill="url(#costGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card variant="glass">
                <CardHeader><CardTitle className="text-base">Custo por departamento / centro de custo</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={cost.byGroup.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="label" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip formatter={(v) => fmtCurrency(Number(v), cost.currency)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Bar dataKey="total" name="Custo" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            <Card variant="glass">
              <CardHeader><CardTitle className="text-base">Detalhamento de custos</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-right">Entregas</TableHead>
                      <TableHead className="text-right">Custo total</TableHead>
                      <TableHead className="text-right">Custo médio</TableHead>
                      <TableHead className="text-right">% do total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cost.byGroup.map((g) => (
                      <TableRow key={g.label}>
                        <TableCell className="font-medium">{g.label}</TableCell>
                        <TableCell className="text-right">{g.count}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(g.total, cost.currency)}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(g.avg, cost.currency)}</TableCell>
                        <TableCell className="text-right">{g.percentage}%</TableCell>
                      </TableRow>
                    ))}
                    {cost.byGroup.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem dados de custo para os filtros atuais.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERFORMANCE */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={PackageCheck} label="Taxa de conclusão" value={`${performance.completionRate}%`} />
              <KpiCard icon={X} label="Taxa de cancelamento" value={`${performance.cancellationRate}%`} />
              <KpiCard icon={Clock} label="Duração média" value={`${performance.avgDuration} min`} />
              <KpiCard icon={PackageCheck} label="Conformidade POD" value={`${performance.podComplianceRate}%`} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card variant="glass">
                <CardHeader><CardTitle className="text-base">Volume e atraso médio por dia</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="deliveries" name="Entregas" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Atraso médio (min)" stroke="hsl(var(--warning))" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card variant="glass">
                <CardHeader><CardTitle className="text-base">Distribuição de status</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                        {statusPie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GEOGRAFIA */}
          <TabsContent value="geography" className="space-y-6">
            <Card variant="glass">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Entregas por região</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={geography} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="region" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                    <Bar dataKey="count" name="Entregas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card variant="glass">
              <CardHeader><CardTitle className="text-base">Indicadores por região</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Região</TableHead>
                      <TableHead className="text-right">Entregas</TableHead>
                      <TableHead className="text-right">Custo total</TableHead>
                      <TableHead className="text-right">Dist. média</TableHead>
                      <TableHead className="text-right">Atraso médio</TableHead>
                      <TableHead className="text-right">Pontualidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {geography.map((g) => (
                      <TableRow key={g.region}>
                        <TableCell className="font-medium max-w-[220px] truncate">{g.region}</TableCell>
                        <TableCell className="text-right">{g.count}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(g.totalCost, cost.currency)}</TableCell>
                        <TableCell className="text-right">{g.avgDistanceKm} km</TableCell>
                        <TableCell className="text-right">{g.avgDelay} min</TableCell>
                        <TableCell className="text-right">{g.onTimeRate}%</TableCell>
                      </TableRow>
                    ))}
                    {geography.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem dados geográficos para os filtros atuais.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
