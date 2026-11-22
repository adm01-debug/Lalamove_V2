import { useState } from 'react';
import { Bell, Webhook, X, Plus, Loader2 } from 'lucide-react';
import { useAlertConfigurations, useCreateAlertConfiguration } from '@/hooks/useAlertConfigurations';
import type { Database } from '@/integrations/supabase/types';

type AlertConfigurationDbType = Database['public']['Enums']['alert_type'];
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertConfigCard } from './alert-configurations/AlertConfigCard';

// O par (alert_type, channel) e unico no banco. Alertas sem configuracao nao
// podem ser desligados nem escalados, por isso a tela precisa permitir criar.
const ALL_ALERT_TYPES: { value: string; label: string }[] = [
  { value: 'DRIVER_BLOCKED', label: 'Motorista Bloqueado' },
  { value: 'ROUTE_DEVIATION', label: 'Desvio de Rota' },
  { value: 'DRIVER_STOPPED', label: 'Motorista Parado' },
  { value: 'LATE_DELIVERY', label: 'Entrega Atrasada' },
  { value: 'APPROVAL_REQUIRED', label: 'Aprovacao Necessaria' },
  { value: 'ORDER_CANCELLED', label: 'Pedido Cancelado' },
  { value: 'INTEGRATION_FAILURE', label: 'Falha de Integracao' },
  // Eventos geo (plano Google Maps, etapa 72): sem estas linhas o formulário
  // "Nova config." não permitia criar configuração para um tipo geo — só apareciam
  // os que já tinham seed na migration `geo_foundation`. Um tipo geo sem config
  // (ex.: deletado pelo operador) não podia ser recriado pela UI.
  { value: 'DRIVER_APPROACHING_PICKUP', label: 'Motorista aproximando da coleta' },
  { value: 'DRIVER_ARRIVED_PICKUP', label: 'Motorista chegou na coleta' },
  { value: 'DRIVER_APPROACHING_DELIVERY', label: 'Motorista aproximando da entrega' },
  { value: 'DRIVER_ARRIVED_DELIVERY', label: 'Motorista chegou na entrega' },
  { value: 'ETA_DELAY', label: 'Atraso previsto pelo ETA' },
  { value: 'SUPPLIER_DELAY_NOTICE', label: 'Aviso de atraso ao fornecedor' },
  { value: 'MISSING_POD', label: 'POD não anexado' },
  { value: 'GEO_BUDGET_WARNING', label: 'Orçamento geo próximo do limite' },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} variant="glass" className="animate-pulse">
          <div className="p-6"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-72" /></div></div></div>
          <div className="px-6 pb-6"><Skeleton className="h-12 w-full rounded-xl" /></div>
        </Card>
      ))}
    </div>
  );
}

export function AlertConfigurationsPage() {
  const { data: configs, isLoading, error } = useAlertConfigurations();
  const createMutation = useCreateAlertConfiguration();
  const [isCreating, setIsCreating] = useState(false);
  const [newType, setNewType] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmails, setNewEmails] = useState('');
  const [newSlack, setNewSlack] = useState('');

  const availableTypes = ALL_ALERT_TYPES.filter(
    (t) => !(configs ?? []).some((c) => c.alert_type === t.value),
  );

  const handleCreate = () => {
    if (!newType) return;
    createMutation.mutate(
      {
        alert_type: newType as AlertConfigurationDbType,
        channel: 'email',
        name: ALL_ALERT_TYPES.find((t) => t.value === newType)?.label ?? newType,
        is_enabled: true,
        message_template: null,
        notify_whatsapp: newWhatsapp.trim().length > 0,
        notify_email: newEmails.trim().length > 0,
        notify_slack: newSlack.trim().length > 0,
        notify_bitrix24_task: false,
        notify_n8n_webhook: false,
        whatsapp_numbers: newWhatsapp ? newWhatsapp.split(',').map((s) => s.trim()).filter(Boolean) : [],
        email_addresses: newEmails ? newEmails.split(',').map((s) => s.trim()).filter(Boolean) : [],
        slack_channels: newSlack ? newSlack.split(',').map((s) => s.trim()).filter(Boolean) : [],
        bitrix24_user_ids: [],
        n8n_webhook_url: null,
        min_interval_seconds: 300,
        dedup_window_seconds: 300,
        escalation_enabled: false,
        escalation_after_seconds: 900,
        escalation_email_addresses: [],
        escalation_whatsapp_numbers: [],
        escalation_slack_channels: [],
        fallback_channel: null,
        fallback_recipients: [],
        conditions: null,
      },
      {
        onSuccess: () => {
          setIsCreating(false);
          setNewType('');
          setNewWhatsapp('');
          setNewEmails('');
          setNewSlack('');
        },
      },
    );
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight"><span className="gradient-text">Configurações</span> de Alertas</h2>
          <p className="text-muted-foreground">Gerencie os canais de notificação e templates para cada tipo de alerta</p>
        </div>
        <div className="flex items-center gap-3"><Badge variant="gradient" size="lg" className="gap-1.5"><Bell className="w-4 h-4" />{configs?.filter(c => c.is_enabled).length || 0} ativos</Badge><Button variant="gradient" size="sm" className="gap-1.5" onClick={() => setIsCreating(true)} disabled={availableTypes.length === 0}><Plus className="w-4 h-4" />Nova config.</Button></div>
      </div>

      <Card variant="glass" className="border-warning/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-amber/5" />
        <CardContent className="flex items-center gap-4 py-5 relative">
          <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-amber/20 shadow-lg shadow-warning/10"><Webhook className="w-6 h-6 text-warning" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Secrets de notificação pendentes</p>
            <p className="text-sm text-muted-foreground mt-0.5">Configure <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">EVOLUTION_API_KEY</code>, <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">RESEND_API_KEY</code> e <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">SLACK_WEBHOOK_URL</code> para ativar as notificações.</p>
          </div>
          <Button variant="warning" size="sm">Configurar</Button>
        </CardContent>
      </Card>

      {isLoading ? <LoadingSkeleton /> : error ? (
        <Card variant="glass" className="border-destructive/40"><CardContent className="py-8 text-center"><div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4"><X className="w-8 h-8 text-destructive" /></div><p className="text-destructive font-medium">Erro ao carregar configurações</p><p className="text-sm text-muted-foreground mt-1">{error.message}</p></CardContent></Card>
      ) : configs?.length === 0 ? (
        <Card variant="gradient" className="border-dashed"><CardContent className="py-16 text-center"><div className="p-4 rounded-2xl bg-primary/10 w-fit mx-auto mb-4"><Bell className="w-12 h-12 text-primary" /></div><p className="text-lg font-medium text-foreground">Nenhuma configuração encontrada</p><p className="text-muted-foreground mt-1">As configurações de alerta aparecerão aqui</p><Button variant="gradient" className="mt-5 gap-1.5" onClick={() => setIsCreating(true)} disabled={availableTypes.length === 0}><Plus className="w-4 h-4" />Criar primeira config.</Button></CardContent></Card>
      ) : (
        <div className="space-y-4">{configs?.map((config, index) => <AlertConfigCard key={config.id} config={config} index={index} />)}</div>
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><div className="p-2 rounded-lg bg-primary/10"><Bell className="w-5 h-5 text-primary" /></div>Nova configuração de alerta</DialogTitle>
            <DialogDescription>Escolha o tipo de alerta e os destinatários iniciais. Você pode ajustar tudo depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de alerta</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (números, separados por vírgula)</Label>
              <Input value={newWhatsapp} onChange={(e) => setNewWhatsapp(e.target.value)} placeholder="5511999999999" />
            </div>
            <div className="space-y-2">
              <Label>Email (endereços, separados por vírgula)</Label>
              <Input value={newEmails} onChange={(e) => setNewEmails(e.target.value)} placeholder="operacoes@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Slack (canais, separados por vírgula)</Label>
              <Input value={newSlack} onChange={(e) => setNewSlack(e.target.value)} placeholder="#alertas" />
            </div>
            <p className="text-xs text-muted-foreground">O escalonamento automático começa desligado. Ative por configuração depois de validar os canais.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}><X className="w-4 h-4 mr-1" />Cancelar</Button>
            <Button variant="gradient" onClick={handleCreate} disabled={!newType || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
