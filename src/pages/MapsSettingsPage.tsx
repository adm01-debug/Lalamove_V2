import { useMemo, useState } from 'react';
import { ArrowLeft, Activity, DollarSign, Layers, MapPin, ShieldAlert, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
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
  useGeoProviderStatus,
  useGeoUsageMonth,
  useUpdateGeoBudget,
  useUpdateGeoSetting,
  type GeoBudgetRow,
  type GeoFunction,
  type GeoProviderName,
} from '@/hooks/useGeoAdmin';

/** Rótulo de negócio para cada função geo (a chave é o CHECK do banco). */
const FUNCTION_LABEL: Record<GeoFunction, { label: string; hint: string }> = {
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

export default function MapsSettingsPage() {
  const status = useGeoProviderStatus();
  const budgets = useGeoBudgets();
  const budgetStatus = useGeoBudgetStatus();
  const priceList = useGeoPriceList();
  const usage = useGeoUsageMonth();
  const updateSetting = useUpdateGeoSetting();
  const updateBudget = useUpdateGeoBudget();

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