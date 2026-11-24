import { useState } from 'react';
import { Bell, Mail, MessageCircle, Hash, Briefcase, Webhook, Edit, Save, X, Power, PowerOff, Send, Loader2, Sparkles, Settings2, Zap, Trash2, Navigation, MapPin, Clock, FileWarning, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateAlertConfiguration, useDeleteAlertConfiguration, AlertConfiguration } from '@/hooks/useAlertConfigurations';
import { useTestNotification, TestNotificationChannel } from '@/hooks/useTestNotification';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const alertTypeLabels: Record<string, string> = {
  'DRIVER_BLOCKED': 'Motorista Bloqueado', 'ROUTE_DEVIATION': 'Desvio de Rota', 'DRIVER_STOPPED': 'Motorista Parado',
  'LATE_DELIVERY': 'Entrega Atrasada', 'APPROVAL_REQUIRED': 'Aprovação Necessária', 'ORDER_CANCELLED': 'Pedido Cancelado',
  'INTEGRATION_FAILURE': 'Falha de Integração',
  // Eventos geo (plano Google Maps, etapa 72): sem rótulo aqui o card cai no fallback
  // `alert_type` cru e o operador não entende o que está ativando.
  'DRIVER_APPROACHING_PICKUP': 'Motorista aproximando da coleta',
  'DRIVER_ARRIVED_PICKUP': 'Motorista chegou na coleta',
  'DRIVER_APPROACHING_DELIVERY': 'Motorista aproximando da entrega',
  'DRIVER_ARRIVED_DELIVERY': 'Motorista chegou na entrega',
  'ETA_DELAY': 'Atraso previsto pelo ETA',
  'SUPPLIER_DELAY_NOTICE': 'Aviso de atraso ao fornecedor',
  'MISSING_POD': 'POD não anexado',
  'GEO_BUDGET_WARNING': 'Orçamento geo próximo do limite',
  // Tipos que faltavam aqui: sem entrada o card mostrava o enum cru ao operador.
  'DRIVER_ASSIGNED': 'Motorista atribuído ao pedido',
  'DRIVER_NO_CONFIRMATION': 'Motorista não confirmou a coleta',
};
const alertTypeDescriptions: Record<string, string> = {
  'DRIVER_BLOCKED': 'Notifica quando um motorista na blocklist é atribuído a um pedido',
  'ROUTE_DEVIATION': 'Alerta quando o motorista desvia significativamente da rota esperada',
  'DRIVER_STOPPED': 'Alerta quando o motorista fica parado por muito tempo',
  'LATE_DELIVERY': 'Notifica quando uma entrega ultrapassa o prazo estimado',
  'APPROVAL_REQUIRED': 'Avisa quando um motorista precisa de aprovação manual',
  'ORDER_CANCELLED': 'Notifica sobre cancelamentos de pedidos',
  'INTEGRATION_FAILURE': 'Notifica quando uma integração externa (Lalamove, UAPI, Bitrix24) falha',
  'DRIVER_APPROACHING_PICKUP': 'Dispara quando o motorista entra no raio de aproximação da coleta',
  'DRIVER_ARRIVED_PICKUP': 'Dispara quando o motorista chega na coleta (fora da janela de silêncio)',
  'DRIVER_APPROACHING_DELIVERY': 'Dispara quando o motorista entra no raio de aproximação da entrega',
  'DRIVER_ARRIVED_DELIVERY': 'Dispara quando o motorista chega na entrega (fora da janela de silêncio)',
  'ETA_DELAY': 'Dispara quando o ETA calculado passa do prazo combinado com o cliente',
  'SUPPLIER_DELAY_NOTICE': 'Avisa o fornecedor que a coleta vai atrasar',
  'MISSING_POD': 'Dispara quando o pedido é concluído sem comprovante de entrega',
  'GEO_BUDGET_WARNING': 'Avisa quando o gasto geo cruza o percentual de alerta do orçamento',
  'DRIVER_ASSIGNED': 'Avisa quando um motorista é atribuído a um pedido',
  'DRIVER_NO_CONFIRMATION': 'Dispara quando o motorista não responde ao pedido de confirmação da coleta no prazo',
};
const alertTypeIcons: Record<string, typeof Bell> = {
  'DRIVER_BLOCKED': Zap, 'ROUTE_DEVIATION': Settings2, 'DRIVER_STOPPED': Bell, 'LATE_DELIVERY': Bell,
  'APPROVAL_REQUIRED': Sparkles, 'ORDER_CANCELLED': Bell, 'INTEGRATION_FAILURE': Webhook,
  // Coleta e entrega usam ícones distintos para diferenciar os 4 eventos no painel.
  'DRIVER_APPROACHING_PICKUP': Navigation, 'DRIVER_ARRIVED_PICKUP': MapPin,
  'DRIVER_APPROACHING_DELIVERY': Navigation, 'DRIVER_ARRIVED_DELIVERY': MapPin,
  'ETA_DELAY': Clock, 'SUPPLIER_DELAY_NOTICE': Clock, 'MISSING_POD': FileWarning, 'GEO_BUDGET_WARNING': Wallet,
  'DRIVER_ASSIGNED': Bell, 'DRIVER_NO_CONFIRMATION': Clock,
};
const channelIcons = { whatsapp: MessageCircle, email: Mail, slack: Hash, bitrix24: Briefcase, n8n: Webhook };
const channelLabels = { whatsapp: 'WhatsApp', email: 'Email', slack: 'Slack', bitrix24: 'Bitrix24', n8n: 'N8N Webhook' };

/**
 * Etapa 72 do plano Google Maps: preview do template no próprio card.
 * `message_template` usa `{{variavel}}` (renderizado por `_shared/template.ts`
 * na edge). Antes o modal ensinava `{variavel}` com chave simples, então quem
 * seguia a dica gravava um template que saía literal na mensagem do cliente.
 */
const TEMPLATE_SAMPLE: Record<string, string> = {
  driver_name: 'João Silva',
  driver_plate: 'ABC1D23',
  driver_id: 'drv_123',
  eta_min: '6',
  distance_m: '820',
  order_ref: '#1042',
  order_id: '1042',
  pickup_address: 'Rua XV de Novembro, 100 - Centro',
  pickup_contact_name: 'Maria',
  delivery_address: 'Av. Sete de Setembro, 3000 - Batel',
  share_link: 'https://tinyurl.com/exemplo',
  static_map_url: 'https://.../mapa.png',
  risk_score: '0.82',
  severity: 'INFO',
};

const TEMPLATE_VARIABLES = Object.keys(TEMPLATE_SAMPLE);

function renderPreview(template: string): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, name: string) => TEMPLATE_SAMPLE[name] ?? match);
}

export function AlertConfigCard({ config, index }: { config: AlertConfiguration; index: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState(config.message_template || '');
  const [editedWhatsapp, setEditedWhatsapp] = useState(config.whatsapp_numbers?.join(', ') || '');
  const [editedEmails, setEditedEmails] = useState(config.email_addresses?.join(', ') || '');
  const [editedSlack, setEditedSlack] = useState(config.slack_channels?.join(', ') || '');
  const [editedN8nUrl, setEditedN8nUrl] = useState(config.n8n_webhook_url || '');
  const updateMutation = useUpdateAlertConfiguration();
  const deleteMutation = useDeleteAlertConfiguration();
  const testMutation = useTestNotification();
  const AlertIcon = alertTypeIcons[config.alert_type] || Bell;

  const handleToggleEnabled = () => { updateMutation.mutate({ id: config.id, updates: { is_enabled: !config.is_enabled } }); };
  const handleToggleChannel = (channel: string, currentValue: boolean | null) => {
    const fieldMap: Record<string, string> = { whatsapp: 'notify_whatsapp', email: 'notify_email', slack: 'notify_slack', bitrix24: 'notify_bitrix24_task', n8n: 'notify_n8n_webhook' };
    updateMutation.mutate({ id: config.id, updates: { [fieldMap[channel]]: !currentValue } });
  };
  const handleSaveEdit = () => { updateMutation.mutate({ id: config.id, updates: { message_template: editedTemplate, whatsapp_numbers: editedWhatsapp ? editedWhatsapp.split(',').map(s => s.trim()) : null, email_addresses: editedEmails ? editedEmails.split(',').map(s => s.trim()) : null, slack_channels: editedSlack ? editedSlack.split(',').map(s => s.trim()) : null, n8n_webhook_url: editedN8nUrl || null } }); setIsEditing(false); };
  const handleTestChannel = (channelKey: TestNotificationChannel) => {
    let recipients: string[] | undefined; let webhookUrl: string | undefined;
    if (channelKey === 'whatsapp') recipients = config.whatsapp_numbers || [];
    else if (channelKey === 'email') recipients = config.email_addresses || [];
    else if (channelKey === 'slack') recipients = config.slack_channels || [];
    else if (channelKey === 'n8n') webhookUrl = config.n8n_webhook_url || undefined;
    testMutation.mutate({ channel: channelKey, alertType: config.alert_type, recipients, webhookUrl });
  };

  const channels = [
    { key: 'whatsapp', enabled: config.notify_whatsapp, recipients: config.whatsapp_numbers },
    { key: 'email', enabled: config.notify_email, recipients: config.email_addresses },
    { key: 'slack', enabled: config.notify_slack, recipients: config.slack_channels },
    { key: 'bitrix24', enabled: config.notify_bitrix24_task, recipients: config.bitrix24_user_ids?.map(String) },
    { key: 'n8n', enabled: config.notify_n8n_webhook, recipients: config.n8n_webhook_url ? ['Webhook configurado'] : null },
  ];
  const activeChannels = channels.filter(c => c.enabled);

  return (
    <Card variant={config.is_enabled ? "glass" : "default"} hover="lift" className={cn("animate-fade-up group relative overflow-hidden", !config.is_enabled && "opacity-60")} style={{ animationDelay: `${index * 100}ms` }}>
      <div className={cn("absolute top-0 left-0 right-0 h-1 transition-opacity duration-300", config.is_enabled ? "bg-gradient-to-r from-primary via-accent to-primary opacity-100" : "bg-muted opacity-50")} />
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl transition-all duration-300", config.is_enabled ? "bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg shadow-primary/10" : "bg-muted")}><AlertIcon className={cn("w-5 h-5 transition-colors", config.is_enabled ? "text-primary" : "text-muted-foreground")} /></div>
              <div><CardTitle className="text-lg font-semibold">{alertTypeLabels[config.alert_type] || config.alert_type}</CardTitle><CardDescription className="mt-0.5">{alertTypeDescriptions[config.alert_type] || config.name}</CardDescription></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.is_enabled ? <Badge variant="glow-success" size="sm" dot pulse>Ativo</Badge> : <Badge variant="inactive" size="sm">Inativo</Badge>}
            <Button variant="ghost" size="icon-sm" onClick={() => setIsEditing(true)} aria-label="Editar configuração" className="opacity-0 group-hover:opacity-100 transition-opacity"><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon-sm" onClick={() => { if (window.confirm(`Excluir a configuração de ${alertTypeLabels[config.alert_type] || config.alert_type}? O alerta para de ser notificado.`)) deleteMutation.mutate(config.id); }} disabled={deleteMutation.isPending} title="Excluir configuração" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            <Button variant={config.is_enabled ? "outline" : "gradient"} size="sm" onClick={handleToggleEnabled} disabled={updateMutation.isPending} className="gap-1.5">{config.is_enabled ? <><PowerOff className="w-3.5 h-3.5" />Desativar</> : <><Power className="w-3.5 h-3.5" />Ativar</>}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Canais de Notificação</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <TooltipProvider>
              {channels.map((channel) => {
                const Icon = channelIcons[channel.key as keyof typeof channelIcons];
                const isTestingThis = testMutation.isPending && testMutation.variables?.channel === channel.key;
                return (
                  <div key={channel.key} className={cn("flex items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-200", channel.enabled ? "bg-primary/10 border-primary/30 shadow-sm" : "bg-secondary/50 border-transparent hover:border-border")}>
                    <Switch checked={channel.enabled || false} onCheckedChange={() => handleToggleChannel(channel.key, channel.enabled)} disabled={updateMutation.isPending} className="scale-75" />
                    <Icon className={cn("w-4 h-4 shrink-0 transition-colors", channel.enabled ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("text-xs font-medium flex-1 transition-colors", channel.enabled ? "text-foreground" : "text-muted-foreground")}>{channelLabels[channel.key as keyof typeof channelLabels]}</span>
                    {channel.enabled && <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0" onClick={() => handleTestChannel(channel.key as TestNotificationChannel)} disabled={testMutation.isPending}>{isTestingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}</Button></TooltipTrigger><TooltipContent><p>Testar {channelLabels[channel.key as keyof typeof channelLabels]}</p></TooltipContent></Tooltip>}
                  </div>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
        {activeChannels.length > 0 && (
          <Accordion type="single" collapsible className="w-full"><AccordionItem value="recipients" className="border-none"><AccordionTrigger className="text-sm text-muted-foreground hover:no-underline py-2">Ver destinatários configurados ({activeChannels.length} canal(is) ativo(s))</AccordionTrigger><AccordionContent><div className="space-y-2 pt-2">{activeChannels.map((channel) => <div key={channel.key} className="flex items-start gap-2 text-sm"><span className="font-medium min-w-[80px]">{channelLabels[channel.key as keyof typeof channelLabels]}:</span><span className="text-muted-foreground">{channel.recipients?.join(', ') || 'Não configurado'}</span></div>)}</div></AccordionContent></AccordionItem></Accordion>
        )}
        {config.message_template && <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Template da Mensagem</Label><div className="p-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-muted-foreground font-mono backdrop-blur-sm">{config.message_template.length > 150 ? config.message_template.substring(0, 150) + '...' : config.message_template}</div></div>}
      </CardContent>
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><div className="p-2 rounded-lg bg-primary/10"><AlertIcon className="w-5 h-5 text-primary" /></div>Editar {alertTypeLabels[config.alert_type] || config.alert_type}</DialogTitle><DialogDescription>Configure o template e os destinatários das notificações</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Template da Mensagem</Label><Textarea value={editedTemplate} onChange={(e) => setEditedTemplate(e.target.value)} placeholder="Use {{driver_name}}, {{order_ref}}, {{eta_min}} como variáveis..." rows={4} className="font-mono text-sm" /><p className="text-xs text-muted-foreground">Variáveis disponíveis: {TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(', ')}</p>{editedTemplate.trim() && <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 space-y-1"><Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prévia com dados de exemplo</Label><p className="text-sm text-foreground/90 whitespace-pre-wrap">{renderPreview(editedTemplate)}</p></div>}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-success" />WhatsApp (números)</Label><Input value={editedWhatsapp} onChange={(e) => setEditedWhatsapp(e.target.value)} placeholder="5511999999999, 5511888888888" /></div>
              <div className="space-y-2"><Label className="flex items-center gap-2"><Mail className="w-4 h-4 text-info" />Email (endereços)</Label><Input value={editedEmails} onChange={(e) => setEditedEmails(e.target.value)} placeholder="email@empresa.com" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="flex items-center gap-2"><Hash className="w-4 h-4 text-accent" />Slack (canais)</Label><Input value={editedSlack} onChange={(e) => setEditedSlack(e.target.value)} placeholder="#alertas, #operacoes" /></div>
              <div className="space-y-2"><Label className="flex items-center gap-2"><Webhook className="w-4 h-4 text-warning" />N8N Webhook URL</Label><Input value={editedN8nUrl} onChange={(e) => setEditedN8nUrl(e.target.value)} placeholder="https://n8n.example.com/webhook/..." /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsEditing(false)}><X className="w-4 h-4 mr-1" />Cancelar</Button><Button variant="gradient" onClick={handleSaveEdit} disabled={updateMutation.isPending}><Save className="w-4 h-4 mr-1" />Salvar</Button></div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
