import { Helmet } from 'react-helmet-async';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, AlertTriangle, Gauge, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useLalamoveQuota } from '@/hooks/useLalamoveQuota';

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'destructive' | 'success';
}) {
  const toneClass =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-yellow-600 dark:text-yellow-400'
        : tone === 'success'
          ? 'text-green-600 dark:text-green-400'
          : 'text-foreground';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function LalamoveQuotaPage() {
  const { rows, summary, endpoints, timeline, isLoading, error } = useLalamoveQuota();

  const currentUsagePct =
    summary.currentLimit && summary.currentRemaining !== null
      ? Number((((summary.currentLimit - summary.currentRemaining) / summary.currentLimit) * 100).toFixed(1))
      : null;

  const currentTone: 'destructive' | 'warning' | 'success' =
    summary.currentRemaining !== null && summary.currentRemaining <= 10
      ? 'destructive'
      : currentUsagePct !== null && currentUsagePct >= 70
        ? 'warning'
        : 'success';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Helmet>
        <title>Quota Lalamove | Painel de Rate Limit</title>
        <meta name="description" content="Monitoramento em tempo real dos rate limits da API Lalamove v3." />
      </Helmet>

      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quota Lalamove</h1>
          <p className="text-muted-foreground mt-1">
            Rate limits da API v3 nas últimas 24 horas — atualização automática a cada 30s.
          </p>
        </div>
        {summary.latestResetAt && (
          <Badge variant="outline" className="text-xs">
            Reset previsto:{' '}
            {formatDistanceToNow(new Date(summary.latestResetAt), { addSuffix: true, locale: ptBR })}
          </Badge>
        )}
      </header>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar dados: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Gauge}
          label="Uso atual"
          value={currentUsagePct !== null ? `${currentUsagePct}%` : '—'}
          hint={
            summary.currentLimit && summary.currentRemaining !== null
              ? `${summary.currentRemaining}/${summary.currentLimit} restantes`
              : 'Sem dados recentes'
          }
          tone={currentTone}
        />
        <StatCard
          icon={Activity}
          label="Chamadas (24h)"
          value={summary.totalCalls.toLocaleString('pt-BR')}
          hint="Total registrado em janela"
        />
        <StatCard
          icon={AlertTriangle}
          label="Quota crítica"
          value={summary.criticalCalls.toLocaleString('pt-BR')}
          hint="Remaining ≤ 10"
          tone={summary.criticalCalls > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={TrendingUp}
          label="Erros HTTP"
          value={summary.errorCalls.toLocaleString('pt-BR')}
          hint="Status ≥ 400"
          tone={summary.errorCalls > 0 ? 'destructive' : 'success'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Uso ao longo do tempo</CardTitle>
          <CardDescription>Média por hora do usage_ratio dos endpoints Lalamove v3.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas registradas nas últimas 24h.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="quotaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  labelFormatter={(v) => format(new Date(v as string), "dd/MM 'às' HH:mm")}
                  formatter={(value: number) => [`${value}%`, 'Uso médio']}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Area type="monotone" dataKey="usage" stroke="hsl(var(--primary))" fill="url(#quotaFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Endpoints mais chamados</CardTitle>
            <CardDescription>Top 8 por volume nas últimas 24h.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={endpoints.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="endpoint" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="calls" fill="hsl(var(--primary))" name="Chamadas" />
                  <Bar dataKey="errors" fill="hsl(var(--destructive))" name="Erros" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatísticas por endpoint</CardTitle>
            <CardDescription>Uso médio e menor remaining observado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="text-right">Chamadas</TableHead>
                    <TableHead className="text-right">Uso médio</TableHead>
                    <TableHead className="text-right">Min. rem.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((e) => (
                    <TableRow key={`${e.method}-${e.endpoint}`}>
                      <TableCell className="font-mono text-xs">
                        <Badge variant="outline" className="mr-2">
                          {e.method}
                        </Badge>
                        {e.endpoint}
                      </TableCell>
                      <TableCell className="text-right">{e.calls}</TableCell>
                      <TableCell className="text-right">{e.avgUsageRatio}%</TableCell>
                      <TableCell
                        className={`text-right ${
                          e.minRemaining !== null && e.minRemaining <= 10 ? 'text-destructive font-semibold' : ''
                        }`}
                      >
                        {e.minRemaining ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {endpoints.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nenhuma chamada registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chamadas recentes</CardTitle>
          <CardDescription>Últimas 50 requisições registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Tentativas</TableHead>
                  <TableHead className="text-right">Uso</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <Badge variant="outline" className="mr-2">
                        {r.method}
                      </Badge>
                      {r.endpoint}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.status >= 400 ? 'destructive' : 'secondary'}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.attempts}</TableCell>
                    <TableCell className="text-right">
                      {r.usage_ratio !== null ? `${r.usage_ratio}%` : '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        r.limit_remaining !== null && r.limit_remaining <= 10 ? 'text-destructive font-semibold' : ''
                      }`}
                    >
                      {r.limit_remaining ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Sem chamadas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
