import { useMemo, useState } from 'react';
import { ArrowLeft, Activity, DollarSign, Download, Layers, MapPin, ShieldAlert, TrendingUp, Zap, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useGeoBudgets,
  useGeoBudgetStatus,
  useGeoPriceList,
  useGeoProviderHealth,
  useGeoProviderStatus,
  useGeoUsageMonth,
  useUpdateGeoBudget,
  useUpdateGeoSetting,
  type GeoBudgetRow,
  type GeoFunction,
  type GeoHealthResult,
  type GeoProviderName,
} from '@/hooks/useGeoAdmin';

/** Rótulo de negócio para cada função geo (a chave é o CHECK do banco). */const FUNCTION_LABEL: Record<GeoFunction, { label: string; hint: string }> = {
  tiles: { label: 'Mapa (tiles)', hint: 'Carregamento do mapa no painel e no rastreio' },
  autocomplete: { label: 'Autocomplete de endereço', hint: 'Sugestões enquanto o operador digita' },
  geocode: { label: 'Geocodificação', hint: 'Endereço digitado para coordenada' },
  reverse: { label: 'Geocodificação reversa', hint: 'Coordenada do GPS para endereço' },
  route: { label: 'Rota', hint: 'Traçado e tempo de viagem ponta a ponta' },
  matrix: { label: 'Matriz de distância', hint: 'Vários veículos por destino de uma vez' },
  static: { label: 'Mini-mapa estático', hint: 'Imagem de mapa em PDF, e-mail e relatório' },
  snap: { label: 'Encaixe na via', hint: 'Corrige o pino do GPS para a rua mais próxima' },
  validate: { label: 'Validação de endereço', hint: 'Confere se o endereço existe antes de salvar' },
  isochrone: { label: 'Área de alcance', hint: 'Até onde dá para chegar em N minutos' },
  optimization: { label: 'Otimização de rota', hint: 'Melhor sequência de entregas' },
};

const PROVIDER_LABEL: Record<string, string> = {
  mapbox: 'Mapbox',
  google: 'Google Maps',
  off: 'Desligado',
};

function providerLabel(value: string | null): string {
  if (!value) return '—';
  return PROVIDER_LABEL[value] ?? value;
}

function fmtMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

/**
 * Etapa 70 do plano Mapbox: o que muda de verdade ao trocar de provedor.
 * Fonte: `docs/MAPBOX.md` (paridade ETA, cobertura BR, decisões M1–M10).
 */
const PARITY_ROWS: Array<{ tema: string; mapbox: string; google: string; impacto: 'igual' | 'mapbox' | 'google' }> = [
  {
    tema: 'Validação de endereço',
    mapbox: 'Não oferece',
    google: 'Valida e corrige o CEP antes de salvar',
    impacto: 'google',
  },
  {
    tema: 'Moto (entrega de duas rodas)',
    mapbox: 'Perfil `driving` — não tem perfil de moto',
    google: 'Também não tem perfil de moto',
    impacto: 'igual',
  },
  {
    tema: 'Encaixe do GPS na via (snap)',
    mapbox: 'Incluído na franquia gratuita de Map Matching',
    google: 'Cobra por Roads API desde a primeira chamada',
    impacto: 'mapbox',
  },
  {
    tema: 'Área de alcance (isócrona)',
    mapbox: 'Incluída, desenha o polígono em 1 chamada',
    google: 'Sem endpoint equivalente — só simulando várias rotas',
    impacto: 'mapbox',
  },
  {
    tema: 'Autocomplete',
    mapbox: 'Cobra por sessão (várias teclas = 1 sessão)',
    google: 'Cobra por requisição, inclusive cada tecla',
    impacto: 'mapbox',
  },
  {
    tema: 'Retenção de dados',
    mapbox: 'Chamada temporária não é gravada pelo provedor',
    google: 'Guarda o resultado conforme o termo de uso',
    impacto: 'mapbox',
  },
  {
    tema: 'ETA e traçado de rota',
    mapbox: 'Paridade medida contra a Lalamove em `docs/MAPBOX.md`',
    google: 'Também tem trânsito em tempo real',
    impacto: 'igual',
  },
];

const PARITY_IMPACT_LABEL: Record<'igual' | 'mapbox' | 'google', string> = {
  igual: 'Igual nos dois',
  mapbox: 'Só no Mapbox',
  google: 'Só no Google',
};

export default function MapsSettingsPage() {
  const status = useGeoProviderStatus();
  const budgets = useGeoBudgets();
  const budgetStatus = useGeoBudgetStatus();
  const priceList = useGeoPriceList();
  const usage = useGeoUsageMonth();
  const updateSetting = useUpdateGeoSetting();
  const updateBudget = useUpdateGeoBudget();
  const health = useGeoProviderHealth();
  const [healthResults, setHealthResults] = useState<Record<string, GeoHealthResult>>({});

  const settingsByFunction = useMemo(() => {
    const map = new Map<GeoFunction, { provider: string; fallback: string | null }>();
    for (const row of status.data?.settings ?? []) {
      map.set(row.function, { provider: row.provider, fallback: row.fallback_provider });
    }
    return map;
  }, [status.data]);

  const budgetStatusByProvider = useMemo(() => {
    const map = new Map<string, { spent: number; limit: number; blocked: boolean; warn: boolean }>();
    for (const row of budgetStatus.data ?? []) {
      map.set(row.provider, {
        spent: Number(row.spent_usd ?? 0),
        limit: Number(row.limit_usd ?? 0),
        blocked: !!row.blocked,
        warn: !!row.warn,
      });
    }
    return map;
  }, [budgetStatus.data]);

  /** Só as edições locais; os valores salvos vêm de `budgets.data` (evita efeito de sincronização). */
  const [budgetEdits, setBudgetEdits] = useState<Record<string, Partial<GeoBudgetRow>>>({});
  const draftBudgets = useMemo(() => {
    const map: Record<string, GeoBudgetRow> = {};
    for (const row of budgets.data ?? []) map[row.provider] = { ...row, ...budgetEdits[row.provider] };
    return map;
  }, [budgets.data, budgetEdits]);

  const patchBudget = (provider: string, patch: Partial<GeoBudgetRow>) =>
    setBudgetEdits((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));

  const functions = Object.keys(FUNCTION_LABEL) as GeoFunction[];

  const handleChangeProvider = (fn: GeoFunction, value: string) => {
    const current = settingsByFunction.get(fn);
    updateSetting.mutate(
      {
        function: fn,
        provider: value as GeoProviderName | 'off',
        fallback_provider: value === 'off' ? null : ((current?.fallback as GeoProviderName | null) ?? null),
      },
      {
        onSuccess: () => toast.success(`${FUNCTION_LABEL[fn].label}: agora usa ${providerLabel(value)}`),
        onError: (err) => toast.error(`Falha ao trocar provedor: ${(err as Error).message}`),
      },
    );
  };

  const handleSaveBudget = (provider: GeoProviderName) => {
    const draft = draftBudgets[provider];
    if (!draft) return;
    updateBudget.mutate(
      {
        provider,
        monthly_limit_usd: Number(draft.monthly_limit_usd),
        hard_stop: draft.hard_stop,
        alert_at_pct: Number(draft.alert_at_pct),
      },
      {
        onSuccess: () => toast.success(`Teto de ${providerLabel(provider)} atualizado`),
        onError: (err) => toast.error(`Falha ao salvar teto: ${(err as Error).message}`),
      },
    );
  };

  const usageByProvider = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of usage.data ?? []) {
      map.set(row.provider, (map.get(row.provider) ?? 0) + Number(row.count ?? 0));
    }
    return map;
  }, [usage.data]);

  const runHealth = (provider: GeoProviderName) => {
    health.mutate(provider, {
      onSuccess: (result) => {
        setHealthResults((prev) => ({ ...prev, [provider]: result }));
        if (result.status === 'ok') toast.success(`${providerLabel(provider)} respondeu em ${result.latency} ms`);
        else toast.error(`${providerLabel(provider)}: ${result.message}`);
      },
      onError: (err) => toast.error(`Falha no teste: ${(err as Error).message}`),
    });
  };

  /**
   * Etapa 68: uso por função com as séries dos dois provedores, a franquia
   * gratuita do SKU principal e o custo estimado do mês.
   */
  const usageByFunction = useMemo(() => {
    const quotaBySku = new Map<string, number>();
    for (const row of priceList.data ?? []) {
      if (row.free_quota_month) quotaBySku.set(`${row.provider}|${row.sku}`, row.free_quota_month);
    }
    const rows = new Map<
      string,
      { function: string; label: string; mapbox: number; google: number; quota: number; cost: number }
    >();
    for (const row of usage.data ?? []) {
      const key = row.function;
      if (!rows.has(key)) {
        rows.set(key, {
          function: key,
          label: FUNCTION_LABEL[key as GeoFunction]?.label ?? key,
          mapbox: 0,
          google: 0,
          quota: 0,
          cost: 0,
        });
      }
      const entry = rows.get(key)!;
      if (row.provider === 'mapbox') entry.mapbox += Number(row.count ?? 0);
      if (row.provider === 'google') entry.google += Number(row.count ?? 0);
      entry.quota = Math.max(entry.quota, quotaBySku.get(`${row.provider}|${row.sku}`) ?? 0);
      entry.cost += Number(row.est_cost_usd ?? 0);
    }
    return [...rows.values()].sort((a, b) => b.mapbox + b.google - (a.mapbox + a.google));
  }, [usage.data, priceList.data]);

  const exportUsageCsv = () => {
    const header = ['funcao', 'rotulo', 'mapbox_chamadas', 'google_chamadas', 'franquia_gratis', 'custo_estimado_usd'];
    const lines = usageByFunction.map((row) =>
      [row.function, row.label, row.mapbox, row.google, row.quota, row.cost.toFixed(4)].join(';'),
    );
    const csv = [header.join(';'), ...lines].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geo-uso-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings">
            <ArrowLeft className="w-4 h-4 mr-1" /> Configurações
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Provedores de mapa</h1>
          <p className="text-sm text-muted-foreground">
            Escolha qual serviço de mapa e endereço o sistema usa. A troca vale imediatamente, sem deploy.
          </p>
        </div>
      </div>

      {/* Saúde e orçamento por provedor */}
      <div className="grid gap-4 md:grid-cols-2">
        {status.isLoading && <Skeleton className="h-40 w-full" />}
        {status.data?.providers.map((p) => {
          const budget = budgetStatusByProvider.get(p.provider);
          const used = usageByProvider.get(p.provider) ?? 0;
          return (
            <Card key={p.provider}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="w-4 h-4" />
                    {providerLabel(p.provider)}
                  </CardTitle>
                  <Badge variant={p.configured && p.implemented ? 'default' : 'destructive'}>
                    {p.configured && p.implemented ? 'Operacional' : p.configured ? 'Só configurado' : 'Sem credencial'}
                  </Badge>
                </div>
                <CardDescription>
                  {budget ? `${fmtMoney(budget.spent)} de ${fmtMoney(budget.limit)} neste mês` : 'Sem consumo registrado neste mês'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Requisições no mês</p>
                    <p className="font-semibold tabular-nums">{used.toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Situação do teto</p>
                    <p className={`font-semibold ${budget?.blocked ? 'text-destructive' : budget?.warn ? 'text-amber-500' : ''}`}>
                      {budget?.blocked ? 'Bloqueado' : budget?.warn ? 'Perto do teto' : 'Dentro do teto'}
                    </p>
                  </div>
                </div>

                {/* Teste de saúde do provedor (etapa 67) */}
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Teste real de geocodificação</p>
                      {healthResults[p.provider] ? (
                        <p className="text-xs">
                          <span className="font-semibold tabular-nums">{healthResults[p.provider].latency} ms</span>
                          {' · '}
                          {healthResults[p.provider].details?.sku ?? '—'}
                          {' · '}
                          {healthResults[p.provider].details?.rate_limit_remaining != null
                            ? `${healthResults[p.provider].details?.rate_limit_remaining} req restantes/min`
                            : 'sem header de rate limit'}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Ainda não testado</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runHealth(p.provider)}
                      disabled={health.isPending && health.variables === p.provider}
                    >
                      {health.isPending && health.variables === p.provider ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 mr-1" />
                      )}
                      Testar {providerLabel(p.provider)}
                    </Button>
                  </div>
                  {healthResults[p.provider] && (
                    <p
                      className={`text-xs ${
                        healthResults[p.provider].status === 'ok'
                          ? 'text-green-600 dark:text-green-400'
                          : healthResults[p.provider].status === 'unknown'
                            ? 'text-muted-foreground'
                            : 'text-destructive'
                      }`}
                    >
                      {healthResults[p.provider].message}
                    </p>
                  )}
                </div>
                {draftBudgets[p.provider] && (
                  <div className="space-y-2 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`limit-${p.provider}`} className="text-xs">Teto mensal (US$)</Label>
                        <Input
                          id={`limit-${p.provider}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={draftBudgets[p.provider].monthly_limit_usd}
                          onChange={(e) => patchBudget(p.provider, { monthly_limit_usd: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`alert-${p.provider}`} className="text-xs">Alerta em (%)</Label>
                        <Input
                          id={`alert-${p.provider}`}
                          type="number"
                          min="1"
                          max="100"
                          value={draftBudgets[p.provider].alert_at_pct}
                          onChange={(e) => patchBudget(p.provider, { alert_at_pct: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`hard-${p.provider}`}
                          checked={draftBudgets[p.provider].hard_stop}
                          onCheckedChange={(checked) => patchBudget(p.provider, { hard_stop: checked })}
                        />
                        <Label htmlFor={`hard-${p.provider}`} className="text-xs">
                          Parar de chamar ao atingir o teto
                        </Label>
                      </div>
                      <Button size="sm" onClick={() => handleSaveBudget(p.provider)} disabled={updateBudget.isPending}>
                        Salvar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Matriz de funções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-4 h-4" /> Qual serviço atende cada função
          </CardTitle>
          <CardDescription>
            Desligar uma função faz o sistema operar sem ela, nunca quebrar. O provedor reserva só entra se o principal falhar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="w-[190px]">Provedor</TableHead>
                  <TableHead className="w-[190px]">Reserva</TableHead>
                  <TableHead className="text-xs">Onde é usado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {functions.map((fn) => {
                  const current = settingsByFunction.get(fn);
                  return (
                    <TableRow key={fn}>
                      <TableCell className="font-medium">{FUNCTION_LABEL[fn].label}</TableCell>
                      <TableCell>
                        <Select
                          value={current?.provider ?? 'off'}
                          onValueChange={(value) => handleChangeProvider(fn, value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mapbox">Mapbox</SelectItem>
                            <SelectItem value="google">Google Maps</SelectItem>
                            <SelectItem value="off">Desligado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {providerLabel(current?.fallback ?? null)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{FUNCTION_LABEL[fn].hint}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Custo por SKU */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-4 h-4" /> Tabela de preços e franquia gratuita
          </CardTitle>
          <CardDescription>
            Cada linha é um item cobrado pelo provedor. A franquia é mensal e gratuita até o limite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priceList.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Grátis/mês</TableHead>
                  <TableHead className="text-right">US$ / 1.000</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(priceList.data ?? []).map((row) => (
                  <TableRow key={`${row.provider}-${row.sku}`}>
                    <TableCell>{providerLabel(row.provider)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.free_quota_month ? row.free_quota_month.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.unit_cost_per_1000).toFixed(4)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Painel de uso lado a lado (etapa 68) */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-4 h-4" /> Uso lado a lado: Google × Mapbox
            </CardTitle>
            <CardDescription>
              Chamadas do mês por função, com a franquia gratuita do item e o custo estimado.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={exportUsageCsv} disabled={usageByFunction.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          {usage.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : usageByFunction.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma chamada registrada neste mês — o gráfico aparece no primeiro uso real do mapa ou do endereço.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usageByFunction} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                    <RechartsTooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      formatter={(value, name) => [Number(value ?? 0).toLocaleString('pt-BR'), String(name)]}
                    />
                    <Legend />
                    <Bar dataKey="mapbox" fill="hsl(var(--primary))" name="Mapbox" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="google" fill="hsl(var(--chart-2, var(--primary)))" name="Google" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Mapbox</TableHead>
                    <TableHead className="text-right">Google</TableHead>
                    <TableHead className="text-right">Franquia grátis</TableHead>
                    <TableHead className="text-right">% da franquia</TableHead>
                    <TableHead className="text-right">Custo estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageByFunction.map((row) => {
                    const total = row.mapbox + row.google;
                    const pct = row.quota > 0 ? (total / row.quota) * 100 : null;
                    return (
                      <TableRow key={row.function}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.mapbox.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.google.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.quota > 0 ? row.quota.toLocaleString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${
                            pct !== null && pct >= 100 ? 'text-destructive font-semibold' : pct !== null && pct >= 80 ? 'text-amber-500' : ''
                          }`}
                        >
                          {pct === null ? '—' : `${pct.toFixed(1)}%`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(row.cost)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uso detalhado do mês */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-4 h-4" /> Consumo do mês corrente
          </CardTitle>
          <CardDescription>
            Soma real de chamadas feitas pelo sistema, por provedor e por item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (usage.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma chamada registrada neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Custo estimado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usage.data ?? []).map((row) => (
                  <TableRow key={`${row.provider}-${row.function}-${row.sku}`}>
                    <TableCell>{providerLabel(row.provider)}</TableCell>
                    <TableCell>{FUNCTION_LABEL[row.function as GeoFunction]?.label ?? row.function}</TableCell>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.count).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(Number(row.est_cost_usd ?? 0))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Matriz de paridade (etapa 70) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="w-4 h-4" /> O que muda ao trocar de provedor
          </CardTitle>
          <CardDescription>
            Impacto real de negócio em cada função. Fonte: <code>docs/MAPBOX.md</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tema</TableHead>
                <TableHead>Mapbox</TableHead>
                <TableHead>Google Maps</TableHead>
                <TableHead className="w-[130px]">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PARITY_ROWS.map((row) => (
                <TableRow key={row.tema}>
                  <TableCell className="font-medium">{row.tema}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.mapbox}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.google}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.impacto === 'igual' ? 'secondary' : row.impacto === 'mapbox' ? 'default' : 'outline'
                      }
                    >
                      {PARITY_IMPACT_LABEL[row.impacto]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-4 h-4" /> Auditoria e permissão
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Somente perfis administrador alteram provedor e teto. Toda alteração fica registrada em <code>audit_log</code> com o valor anterior e o novo.</p>
          <p>Gerentes e administradores veem o consumo; demais perfis não acessam esta tela.</p>
          <p className="flex items-center gap-1 pt-2">
            <Activity className="w-3.5 h-3.5" />
            Última leitura de saúde: {status.dataUpdatedAt ? new Date(status.dataUpdatedAt).toLocaleString('pt-BR') : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}