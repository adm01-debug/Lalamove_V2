import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Activity, Gauge, AlertTriangle, RefreshCw, TrendingUp,
  ShieldCheck, Timer, Database, Bug, Webhook, CheckCircle2, XCircle, Clock,
  FileSpreadsheet, Sheet as SheetIcon, FileJson,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useSLOMetrics, WINDOW_LABELS, type SLOWindow, type SLOIndicator, type SLOStatus,
} from '@/hooks/useSLOMetrics';
import { exportToCSV, exportToExcel, exportToJSON } from '@/utils/exportUtils';


const STATUS_META: Record<SLOStatus, { label: string; text: string; bg: string; border: string; badge: 'default' | 'secondary' | 'destructive' }> = {
  healthy: { label: 'Saudável', text: 'text-success', bg: 'bg-success/10', border: 'border-success/30', badge: 'default' },
  at_risk: { label: 'Em risco', text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', badge: 'secondary' },
  breached: { label: 'Violado', text: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', badge: 'destructive' },
};

interface SLOCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  indicator: SLOIndicator;
  format: (v: number) => string;
  targetFormat: (v: number) => string;
}

function SLOCard({ title, description, icon, indicator, format, targetFormat }: SLOCardProps) {
  const meta = STATUS_META[indicator.status];
  return (
    <Card className={cn('relative overflow-hidden border', meta.border)}>
      <div className={cn('absolute inset-0 opacity-40', meta.bg)} aria-hidden />
      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between">
          <div className={cn('p-2.5 rounded-xl', meta.bg, meta.text)}>{icon}</div>
          <Badge variant={meta.badge}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-3">
        <div>
          <div className={cn('text-4xl font-bold tracking-tight', meta.text)}>{format(indicator.value)}</div>
          <div className="text-sm font-medium text-foreground mt-1">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Objetivo: {targetFormat(indicator.target)}</span>
          <span>Orçamento restante</span>
        </div>
        <div>
          <Progress
            value={indicator.errorBudgetRemaining}
            className={cn(
              'h-2',
              indicator.status === 'breached' && '[&>div]:bg-destructive',
              indicator.status === 'at_risk' && '[&>div]:bg-warning',
              indicator.status === 'healthy' && '[&>div]:bg-success',
            )}
          />
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">{indicator.errorBudgetConsumed}% consumido</span>
            <span className={cn('font-semibold', meta.text)}>{indicator.errorBudgetRemaining}% livre</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, icon, tone = 'default' }: { label: string; value: string; icon: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'destructive' }) {
  const toneMap = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  } as const;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-4">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className={cn('text-2xl font-bold', toneMap[tone])}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function SLODashboardPage() {
  const [window, setWindow] = useState<SLOWindow>('24h');
  const { data, isLoading, isFetching, refetch, error } = useSLOMetrics(window);

  const chartData = useMemo(
    () => (data?.timeline ?? []).map((p) => ({
      label: p.label,
      Disponibilidade: p.availability,
      Latência: p.avgLatency,
      Requisições: p.requests,
      Falhas: p.failures,
    })),
    [data],
  );

  const handleExport = async (fmt: 'csv' | 'excel' | 'json') => {
    if (!data) return;
    const base = `slo_${window}`;
    const indicatorRows = [
      { Indicador: 'Disponibilidade', Valor: data.availability.value, Objetivo: data.availability.target, Status: STATUS_META[data.availability.status].label, 'Budget consumido (%)': data.availability.errorBudgetConsumed, 'Budget livre (%)': data.availability.errorBudgetRemaining },
      { Indicador: 'Latência P95 (ms)', Valor: data.latencyP95.value, Objetivo: data.latencyP95.target, Status: STATUS_META[data.latencyP95.status].label, 'Budget consumido (%)': data.latencyP95.errorBudgetConsumed, 'Budget livre (%)': data.latencyP95.errorBudgetRemaining },
      { Indicador: 'Taxa de falhas (%)', Valor: data.failureRate.value, Objetivo: data.failureRate.target, Status: STATUS_META[data.failureRate.status].label, 'Budget consumido (%)': data.failureRate.errorBudgetConsumed, 'Budget livre (%)': data.failureRate.errorBudgetRemaining },
    ];
    const timelineRows = chartData;
    if (fmt === 'csv') { exportToCSV(indicatorRows, base); toast.success('CSV exportado!'); }
    else if (fmt === 'excel') {
      await exportToExcel([
        { name: 'Indicadores', rows: indicatorRows },
        { name: 'Série temporal', rows: timelineRows },
        { name: 'Latência', rows: [{ P50: data.latency.p50, P90: data.latency.p90, P95: data.latency.p95, P99: data.latency.p99, Média: data.latency.avg, Máx: data.latency.max }] },
        { name: 'Fontes de falha', rows: [{ 'Erros de banco': data.failureSources.databaseErrors, 'Erros de frontend': data.failureSources.frontendErrors, 'Erros de webhook': data.failureSources.webhookErrors }] },
      ], base);
      toast.success('Excel exportado!');
    }
    else { exportToJSON(data, base); toast.success('JSON exportado!'); }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gauge className="w-6 h-6 text-primary" />
            Dashboard de SLO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Objetivos de nível de serviço — disponibilidade, latência e taxa de falhas do sistema de entregas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={window} onValueChange={(v) => setWindow(v as SLOWindow)}>
            <SelectTrigger className="w-[170px]" aria-label="Período de análise">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(WINDOW_LABELS) as SLOWindow[]).map((w) => (
                <SelectItem key={w} value={w}>{WINDOW_LABELS[w]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => handleExport('csv')} disabled={!data} aria-label="Exportar como CSV">
            <FileSpreadsheet className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleExport('excel')} disabled={!data} aria-label="Exportar como Excel">
            <SheetIcon className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => handleExport('json')} disabled={!data} aria-label="Exportar como JSON">
            <FileJson className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar métricas">
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-3 py-4 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">Não foi possível carregar as métricas de SLO. Tente atualizar.</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void refetch()} disabled={isFetching}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SLO Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Indicadores de SLO">
        {!data ? (
          !isLoading && error
            ? null
            : Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)
        ) : (
          <>
            <SLOCard
              title="Disponibilidade"
              description="Requisições bem-sucedidas"
              icon={<ShieldCheck className="w-5 h-5" />}
              indicator={data.availability}
              format={(v) => `${v.toFixed(3)}%`}
              targetFormat={(v) => `${v}%`}
            />
            <SLOCard
              title="Latência (p95)"
              description="95% das operações abaixo de"
              icon={<Timer className="w-5 h-5" />}
              indicator={data.latencyP95}
              format={(v) => `${v}ms`}
              targetFormat={(v) => `${v}ms`}
            />
            <SLOCard
              title="Taxa de falhas"
              description="Proporção de erros"
              icon={<AlertTriangle className="w-5 h-5" />}
              indicator={data.failureRate}
              format={(v) => `${v.toFixed(3)}%`}
              targetFormat={(v) => `${v}%`}
            />
          </>
        )}
      </section>

      {/* Resumo de volume */}
      {data && !isLoading && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Resumo de volume">
          <StatTile label="Requisições monitoradas" value={data.totalRequests.toLocaleString('pt-BR')} icon={<Activity className="w-5 h-5" />} />
          <StatTile
            label="Total de falhas"
            value={data.totalFailures.toLocaleString('pt-BR')}
            icon={data.totalFailures > 0 ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            tone={data.totalFailures > 0 ? 'destructive' : 'success'}
          />
          <StatTile label="Latência média" value={`${data.latency.avg}ms`} icon={<Clock className="w-5 h-5" />} />
          <StatTile label="Latência máxima" value={`${data.latency.max}ms`} icon={<TrendingUp className="w-5 h-5" />} tone="warning" />
        </section>
      )}

      {/* Gráficos */}
      {data && !isLoading && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" /> Disponibilidade ao longo do tempo
              </CardTitle>
              <CardDescription>Percentual de requisições bem-sucedidas por período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[Math.min(90, ...chartData.map((d) => d.Disponibilidade)), 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="%" width={44} />
                  <RTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'Disponibilidade']}
                  />
                  <Area type="monotone" dataKey="Disponibilidade" stroke="hsl(var(--success))" fill="url(#availGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="w-4 h-4 text-primary" /> Latência média ao longo do tempo
              </CardTitle>
              <CardDescription>Tempo médio de resposta das operações (ms)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="ms" width={44} />
                  <RTooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [`${v}ms`, 'Latência média']}
                  />
                  <Line type="monotone" dataKey="Latência" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Percentis + fontes de falha */}
      {data && !isLoading && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" /> Distribuição de latência
              </CardTitle>
              <CardDescription>Percentis das operações no período</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { k: 'p50', label: 'Mediana (p50)', v: data.latency.p50 },
                { k: 'p90', label: 'p90', v: data.latency.p90 },
                { k: 'p95', label: 'p95', v: data.latency.p95 },
                { k: 'p99', label: 'p99', v: data.latency.p99 },
                { k: 'avg', label: 'Média', v: data.latency.avg },
                { k: 'max', label: 'Máxima', v: data.latency.max },
              ].map((p) => (
                <div key={p.k} className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{p.v}ms</div>
                  <div className="text-xs text-muted-foreground">{p.label}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Fontes de falha
              </CardTitle>
              <CardDescription>Origem das falhas contabilizadas no SLO</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3">
                <span className="flex items-center gap-2 text-sm"><Database className="w-4 h-4 text-info" /> Erros de banco/telemetria</span>
                <span className="font-bold">{data.failureSources.databaseErrors.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3">
                <span className="flex items-center gap-2 text-sm"><Bug className="w-4 h-4 text-warning" /> Erros de frontend (runtime)</span>
                <span className="font-bold">{data.failureSources.frontendErrors.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3">
                <span className="flex items-center gap-2 text-sm"><Webhook className="w-4 h-4 text-primary" /> Webhooks com falha</span>
                <span className="font-bold">{data.failureSources.webhookErrors.toLocaleString('pt-BR')}</span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {data && (
        <p className="text-xs text-muted-foreground text-center">
          Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')} · {WINDOW_LABELS[window]}
        </p>
      )}
    </div>
  );
}
