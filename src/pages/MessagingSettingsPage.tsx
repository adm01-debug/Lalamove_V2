import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Coins,
  MessageSquare,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Save,
  SendHorizonal,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryState } from '@/components/ui/query-state';
import { cn } from '@/lib/utils';
import {
  SMS_PROVIDERS,
  WHATSAPP_PROVIDERS,
  smsSegments,
  renderPreview,
  useAddNotificationOptout,
  useMessageTemplates,
  useMessagingSettings,
  useMessagingUsage,
  useNotificationLedger,
  useNotificationOptouts,
  useSendTestWhatsApp,
  useNotificationRoutes,
  useRemoveNotificationOptout,
  useSaveTemplateVersion,
  useUpdateMessagingSettings,
  useUpdateNotificationRoute,
  type MessageTemplateRow,
  type MessagingSettingsRow,
  type NotificationRouteRow,
} from '@/hooks/useMessaging';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatCents(cents: number): string {
  return brl.format((cents ?? 0) / 100);
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

const PREVIEW_VALUES: Record<string, string> = {
  driver_name: 'João',
  customer_name: 'Maria',
  order_code: 'LM-1234',
  pickup_address: 'Rua A, 100',
  delivery_address: 'Av. B, 200',
  eta_minutes: '12',
  company_name: 'Promo Brindes',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  queued: 'secondary',
  sent: 'outline',
  delivered: 'default',
  read: 'default',
  failed: 'destructive',
  suppressed: 'secondary',
  expired: 'outline',
};

export default function MessagingSettingsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Mensageria ao motorista</h2>
          <p className="text-muted-foreground">
            Avisos automáticos do pedido (M1–M12): canal, custo, templates e ledger.
          </p>
        </div>
      </div>

      <Tabs defaultValue="provedores" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="provedores">Provedores</TabsTrigger>
          <TabsTrigger value="custo">Uso e custo</TabsTrigger>
          <TabsTrigger value="rotas">Rotas</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="optouts">Opt-outs</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="provedores">
          <ProvidersTab />
        </TabsContent>
        <TabsContent value="custo">
          <UsageTab />
        </TabsContent>
        <TabsContent value="rotas">
          <RoutesTab />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="optouts">
          <OptoutsTab />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SettingsForm {
  whatsapp_provider: string;
  sms_provider: string;
  sms_fallback_after_min: string;
  budget_reais: string;
  shadow_mode: boolean;
  pilot_mode: boolean;
}

function toForm(row: MessagingSettingsRow): SettingsForm {
  return {
    whatsapp_provider: row.whatsapp_provider ?? 'off',
    sms_provider: row.sms_provider ?? 'none',
    sms_fallback_after_min: String(row.sms_fallback_after_min ?? 10),
    budget_reais: ((row.monthly_budget_cents ?? 0) / 100).toFixed(2),
    shadow_mode: row.shadow_mode !== false,
    pilot_mode: row.pilot_mode === true,
  };
}
function ProvidersTab() {
  const settings = useMessagingSettings();
  const update = useUpdateMessagingSettings();
  const send = useSendTestWhatsApp();
  const [draft, setDraft] = useState<SettingsForm | null>(null);
  const [testPhone, setTestPhone] = useState('');

  if (settings.isLoading) return <QueryState isLoading />;
  if (settings.isError) {
    return <QueryState isError error={settings.error as Error} onRetry={() => settings.refetch()} />;
  }
  if (!settings.data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Linha de configuração ausente em messaging_settings.
        </CardContent>
      </Card>
    );
  }

  const row = settings.data;
  const form = draft ?? toForm(row);
  const dirty =
    form.whatsapp_provider !== (row.whatsapp_provider ?? 'off') ||
    form.sms_provider !== (row.sms_provider ?? 'none') ||
    Number(form.sms_fallback_after_min) !== row.sms_fallback_after_min ||
    Math.round(Number(form.budget_reais) * 100) !== row.monthly_budget_cents ||
    form.shadow_mode !== (row.shadow_mode !== false) ||
    form.pilot_mode !== (row.pilot_mode === true);

  const sendBlockers: string[] = [];
  if (form.whatsapp_provider === 'off') sendBlockers.push('Provider de WhatsApp desligado');
  if (Number(form.budget_reais) <= 0) sendBlockers.push('Teto mensal em R$ zerado');
  if (form.shadow_mode) sendBlockers.push('Modo sombra ligado (registra sem enviar)');

  const save = () => {
    const budget = Number(form.budget_reais.replace(',', '.'));
    if (!Number.isFinite(budget) || budget < 0) {
      toast.error('Teto mensal inválido');
      return;
    }
    update.mutate(
      {
        whatsapp_provider: form.whatsapp_provider,
        sms_provider: form.sms_provider,
        sms_fallback_after_min: Math.max(0, Math.round(Number(form.sms_fallback_after_min) || 0)),
        monthly_budget_cents: Math.round(budget * 100),
        shadow_mode: form.shadow_mode,
        pilot_mode: form.pilot_mode,
      },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success('Configuração salva');
        },
        onError: (error) => toast.error(`Falha ao salvar: ${(error as Error).message}`),
      },
    );
  };

  const sendTest = () => {
    const phone = testPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error('Informe o telefone com DDD');
      return;
    }
    send.mutate(
      { phone },
      {
        onSuccess: (result) => {
          if (result.success) toast.success('Mensagem de teste enviada');
          else toast.error(result.message);
        },
        onError: (error) => toast.error(`Falha no teste: ${(error as Error).message}`),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Canal e limites
          </CardTitle>
          <CardDescription>
            Última alteração: {formatDateTime(row.updated_at)}
            {row.updated_by ? ` por ${row.updated_by.slice(0, 8)}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-provider">Provider de WhatsApp</Label>
            <Select
              value={form.whatsapp_provider}
              onValueChange={(value) => setDraft({ ...form, whatsapp_provider: value })}
            >
              <SelectTrigger id="whatsapp-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WHATSAPP_PROVIDERS.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sms-provider">Provider de SMS (fallback)</Label>
            <Select
              value={form.sms_provider}
              onValueChange={(value) => setDraft({ ...form, sms_provider: value })}
            >
              <SelectTrigger id="sms-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SMS_PROVIDERS.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sms-fallback">Fallback para SMS após (min)</Label>
            <Input
              id="sms-fallback"
              type="number"
              min={0}
              value={form.sms_fallback_after_min}
              onChange={(event) => setDraft({ ...form, sms_fallback_after_min: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Usado quando a rota não define prazo próprio. 0 desliga o fallback.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Teto mensal (R$)</Label>
            <Input
              id="budget"
              type="number"
              min={0}
              step="0.01"
              value={form.budget_reais}
              onChange={(event) => setDraft({ ...form, budget_reais: event.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              80% avisa, 100% bloqueia o envio (exceto cancelamento).
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Modo sombra</p>
              <p className="text-xs text-muted-foreground">Registra no ledger sem enviar.</p>
            </div>
            <Switch
              checked={form.shadow_mode}
              onCheckedChange={(checked) => setDraft({ ...form, shadow_mode: checked })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Modo piloto</p>
              <p className="text-xs text-muted-foreground">Restringe os eventos liberados.</p>
            </div>
            <Switch
              checked={form.pilot_mode}
              onCheckedChange={(checked) => setDraft({ ...form, pilot_mode: checked })}
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={!dirty || update.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={!dirty}>
              Descartar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {sendBlockers.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            Pré-requisitos para o envio real
          </CardTitle>
          <CardDescription>
            {sendBlockers.length === 0
              ? 'Configuração liberada: os avisos saem para o motorista sem operador.'
              : 'Enquanto houver bloqueio, as mensagens ficam registradas como suppressed.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {sendBlockers.length === 0 ? (
              <li className="text-emerald-700">Nenhum bloqueio de configuração.</li>
            ) : (
              sendBlockers.map((blocker) => (
                <li key={blocker} className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {blocker}
                </li>
              ))
            )}
            <li className="text-muted-foreground">
              Secrets da edge (ZAPP_API_URL, ZAPP_API_KEY) não aparecem aqui: são configurados no
              painel do Supabase, nunca no front.
            </li>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SendHorizonal className="h-5 w-5" /> Teste de envio
          </CardTitle>
          <CardDescription>
            Manda uma mensagem real pelo mesmo canal que o motor usa (Zapp quando configurado,
            senão Evolution). Teste com o seu número antes de liberar o envio automático.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="test-phone">Telefone de teste</Label>
            <Input
              id="test-phone"
              placeholder="(41) 99999-8888"
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
            />
          </div>
          <Button
            onClick={sendTest}
            disabled={send.isPending || testPhone.replace(/\D/g, '').length < 10}
          >
            <SendHorizonal className="mr-2 h-4 w-4" />
            {send.isPending ? 'Enviando...' : 'Enviar teste'}
          </Button>
        </CardContent>
        {send.data && (
          <CardContent className="pt-0">
            <p
              className={cn(
                'flex items-start gap-2 text-sm',
                send.data.success ? 'text-emerald-700' : 'text-destructive',
              )}
            >
              {send.data.success ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{send.data.message}</span>
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
function UsageTab() {
  const usage = useMessagingUsage();
  const settings = useMessagingSettings();

  if (usage.isLoading || settings.isLoading) return <QueryState isLoading />;
  if (usage.isError) {
    return <QueryState isError error={usage.error as Error} onRetry={() => usage.refetch()} />;
  }

  const budget = settings.data?.monthly_budget_cents ?? 0;
  const spent = usage.data?.monthCostCents ?? 0;
  const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const rows = usage.data?.rows ?? [];
  const totals = rows.reduce(
    (acc, row) => ({
      messages: acc.messages + (row.messages ?? 0),
      segments: acc.segments + (row.segments ?? 0),
      cost: acc.cost + (row.cost_cents ?? 0),
    }),
    { messages: 0, segments: 0, cost: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription>Gasto no mês</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Coins className="h-5 w-5" /> {formatCents(spent)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              {budget > 0
                ? `${percent}% de ${formatCents(budget)}`
                : 'Teto não definido — envio real bloqueado'}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription>Mensagens no mês</CardDescription>
            <CardTitle className="text-2xl">{totals.messages}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Somatório de messaging_usage</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription>Segmentos no mês</CardDescription>
            <CardTitle className="text-2xl">{totals.segments}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Custo: {formatCents(totals.cost)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consumo por dia e canal</CardTitle>
          <CardDescription>Últimos 60 registros de messaging_usage.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum consumo registrado. Em modo sombra as mensagens não geram custo.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Mensagens</TableHead>
                  <TableHead className="text-right">Segmentos</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.day}-${row.channel}-${row.provider}`}>
                    <TableCell>{row.day}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.channel}</Badge>
                    </TableCell>
                    <TableCell>{row.provider}</TableCell>
                    <TableCell className="text-right">{row.messages}</TableCell>
                    <TableCell className="text-right">{row.segments}</TableCell>
                    <TableCell className="text-right">{formatCents(row.cost_cents ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RoutesTab() {
  const routes = useNotificationRoutes();

  if (routes.isLoading) return <QueryState isLoading />;
  if (routes.isError) {
    return <QueryState isError error={routes.error as Error} onRetry={() => routes.refetch()} />;
  }

  const list = routes.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RouteIcon className="h-5 w-5" /> Rotas por evento
        </CardTitle>
        <CardDescription>
          Ordem dos canais, prazo de fallback e exigência de resposta. Desligar a rota silencia o
          evento sem perder o histórico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState isEmpty={list.length === 0} emptyText="Nenhuma rota configurada.">
          <div className="space-y-3">
            {list.map((route) => (
              <RouteRow key={route.event} route={route} />
            ))}
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}

function RouteRow({ route }: { route: NotificationRouteRow }) {
  const update = useUpdateNotificationRoute();
  const [draft, setDraft] = useState<{ fallback: string; timeout: string } | null>(null);
  const fallback = draft?.fallback ?? String(route.fallback_after_min ?? 0);
  const timeoutMin = draft?.timeout ?? String(route.reply_timeout_min ?? 0);

  const dirty =
    Number(fallback) !== (route.fallback_after_min ?? 0) ||
    Number(timeoutMin) !== (route.reply_timeout_min ?? 0);

  const save = () => {
    update.mutate(
      {
        event: route.event,
        patch: {
          fallback_after_min: Math.max(0, Math.round(Number(fallback) || 0)),
          reply_timeout_min: Math.max(0, Math.round(Number(timeoutMin) || 0)),
        },
      },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success(`Rota ${route.event} atualizada`);
        },
        onError: (error) => toast.error(`Falha: ${(error as Error).message}`),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <div className="min-w-[220px] flex-1">
        <p className="text-sm font-medium">{route.event}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {(route.channels ?? []).map((channel) => (
            <Badge key={channel} variant="secondary">
              {channel}
            </Badge>
          ))}
          {route.requires_reply ? <Badge variant="outline">exige resposta</Badge> : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground" htmlFor={`fallback-${route.event}`}>
          fallback (min)
        </Label>
        <Input
          id={`fallback-${route.event}`}
          type="number"
          min={0}
          className="w-20"
          value={fallback}
          onChange={(event) => setDraft({ fallback: event.target.value, timeout: timeoutMin })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground" htmlFor={`timeout-${route.event}`}>
          resposta (min)
        </Label>
        <Input
          id={`timeout-${route.event}`}
          type="number"
          min={0}
          className="w-20"
          value={timeoutMin}
          onChange={(event) => setDraft({ fallback, timeout: event.target.value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={route.is_enabled !== false}
          onCheckedChange={(checked) =>
            update.mutate(
              { event: route.event, patch: { is_enabled: checked } },
              {
                onSuccess: () =>
                  toast.success(`${route.event}: ${checked ? 'ligada' : 'desligada'}`),
                onError: (error) => toast.error(`Falha: ${(error as Error).message}`),
              },
            )
          }
        />
        <span className="text-xs text-muted-foreground">
          {route.is_enabled !== false ? 'ligada' : 'desligada'}
        </span>
      </div>

      <Button
        size="sm"
        variant={dirty ? 'default' : 'outline'}
        disabled={!dirty || update.isPending}
        onClick={save}
      >
        <Save className="mr-2 h-4 w-4" /> Salvar
      </Button>
    </div>
  );
}
function TemplatesTab() {
  const templates = useMessageTemplates();
  const [editing, setEditing] = useState<MessageTemplateRow | null>(null);

  if (templates.isLoading) return <QueryState isLoading />;
  if (templates.isError) {
    return (
      <QueryState isError error={templates.error as Error} onRetry={() => templates.refetch()} />
    );
  }

  const list = templates.data ?? [];
  const active = list.filter((template) => template.is_active !== false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="h-5 w-5" /> Templates ativos
        </CardTitle>
        <CardDescription>
          Salvar cria uma nova versão e desativa a anterior — o histórico nunca é sobrescrito.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState isEmpty={active.length === 0} emptyText="Nenhum template ativo.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Texto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.event}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{template.channel}</Badge>
                  </TableCell>
                  <TableCell>v{template.version}</TableCell>
                  <TableCell className="max-w-[380px] truncate text-sm text-muted-foreground">
                    {template.body}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setEditing(template)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </CardContent>

      {editing ? (
        <TemplateDialog key={editing.id} template={editing} onClose={() => setEditing(null)} />
      ) : null}
    </Card>
  );
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: MessageTemplateRow | null;
  onClose: () => void;
}) {
  const save = useSaveTemplateVersion();
  const [bodyDraft, setBodyDraft] = useState<string | null>(null);
  const body = bodyDraft ?? template?.body ?? '';

  const preview = useMemo(() => renderPreview(body, PREVIEW_VALUES), [body]);
  const segments = smsSegments(body);
  const overLimit = template?.channel === 'sms' && (template.max_length ?? 160) < body.length;

  const submit = () => {
    if (!template) return;
    if (!body.trim()) {
      toast.error('Texto vazio');
      return;
    }
    save.mutate(
      { template, body },
      {
        onSuccess: (created) => {
          toast.success(`Versão v${created.version} publicada`);
          onClose();
        },
        onError: (error) => toast.error(`Falha: ${(error as Error).message}`),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? `${template.event} · ${template.channel} · v${template.version}` : ''}
          </DialogTitle>
          <DialogDescription>
            Variáveis disponíveis: {(template?.variables ?? []).join(', ') || 'nenhuma'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={body}
            onChange={(event) => setBodyDraft(event.target.value)}
            rows={8}
            aria-label="Texto do template"
          />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>{body.length} caracteres</span>
            <span>{segments} segmento(s) SMS</span>
            {overLimit ? (
              <span className="text-destructive">
                Acima do limite de {template?.max_length} caracteres
              </span>
            ) : null}
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="mb-1 text-xs uppercase text-muted-foreground">Prévia</p>
            <p className="whitespace-pre-wrap">{preview}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending || overLimit}>
            {save.isPending ? 'Publicando…' : 'Publicar nova versão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function OptoutsTab() {
  const optouts = useNotificationOptouts();
  const add = useAddNotificationOptout();
  const remove = useRemoveNotificationOptout();
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');

  const submit = () => {
    add.mutate(
      { phone, reason: reason.trim() || null },
      {
        onSuccess: () => {
          toast.success('Número bloqueado para avisos');
          setPhone('');
          setReason('');
        },
        onError: (error) => toast.error(`Falha: ${(error as Error).message}`),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5" /> Bloquear número
          </CardTitle>
          <CardDescription>
            Números em opt-out não recebem nenhum aviso — o motor apenas registra a supressão.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="optout-phone">Telefone</Label>
            <Input
              id="optout-phone"
              value={phone}
              placeholder="5511999999999"
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="min-w-[240px] flex-1 space-y-2">
            <Label htmlFor="optout-reason">Motivo</Label>
            <Input
              id="optout-reason"
              value={reason}
              placeholder="pedido do motorista"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button onClick={submit} disabled={add.isPending || phone.trim().length === 0}>
            <Plus className="mr-2 h-4 w-4" /> {add.isPending ? 'Salvando…' : 'Bloquear'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Números bloqueados</CardTitle>
          <CardDescription>Consumido por is_phone_opted_out antes de cada envio.</CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={optouts.isLoading}
            isError={optouts.isError}
            error={optouts.error as Error}
            onRetry={() => optouts.refetch()}
            isEmpty={(optouts.data ?? []).length === 0}
            emptyText="Nenhum opt-out registrado."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Registrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(optouts.data ?? []).map((row) => (
                  <TableRow key={row.phone}>
                    <TableCell className="font-mono text-sm">{row.phone}</TableCell>
                    <TableCell>{row.reason ?? '—'}</TableCell>
                    <TableCell>{formatDateTime(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Remover opt-out de ${row.phone}`}
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate(row.phone, {
                            onSuccess: () => toast.success('Opt-out removido'),
                            onError: (error) => toast.error(`Falha: ${(error as Error).message}`),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}

function LedgerTab() {
  const [status, setStatus] = useState('all');
  const ledger = useNotificationLedger(status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Últimas mensagens
          </CardTitle>
          <CardDescription>Uma linha por tentativa: evento, canal, status e custo.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">todos</SelectItem>
              <SelectItem value="queued">queued</SelectItem>
              <SelectItem value="sent">sent</SelectItem>
              <SelectItem value="delivered">delivered</SelectItem>
              <SelectItem value="read">read</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="suppressed">suppressed</SelectItem>
              <SelectItem value="expired">expired</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => ledger.refetch()}>
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={ledger.isLoading}
          isError={ledger.isError}
          error={ledger.error as Error}
          onRetry={() => ledger.refetch()}
          isEmpty={(ledger.data ?? []).length === 0}
          emptyText="Nenhuma mensagem registrada para este filtro."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ledger.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(row.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{row.event}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.channel}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.recipient_phone ?? '—'}</TableCell>
                  <TableCell className="text-right">{formatCents(row.cost_cents ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </CardContent>
    </Card>
  );
}