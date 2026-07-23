import { useState } from 'react';
import { 
  useWebhookEvents, 
  useEventTypes,
  useReprocessWebhook, 
  useMarkWebhookProcessed,
  useDeleteWebhook,
  WebhookEvent
} from '@/hooks/useWebhookEvents';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Webhook, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Eye,
  Trash2,
  Loader2,
  AlertCircle,
  Filter,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function WebhooksPage() {
  const [filters, setFilters] = useState({
    eventType: 'ALL',
    processed: null as boolean | null,
    orderId: '',
  });
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEvent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: webhooks, isLoading, error, refetch } = useWebhookEvents({
    eventType: filters.eventType,
    processed: filters.processed,
    orderId: filters.orderId || undefined,
  });
  const { data: eventTypes } = useEventTypes();
  
  const reprocessMutation = useReprocessWebhook();
  const markProcessedMutation = useMarkWebhookProcessed();
  const deleteMutation = useDeleteWebhook();

  const handleReprocess = async (id: string) => {
    try {
      await reprocessMutation.mutateAsync(id);
      toast.success('Webhook marcado para reprocessamento');
    } catch (err) {
      toast.error('Falha ao reprocessar webhook');
    }
  };

  const handleMarkProcessed = async (id: string) => {
    try {
      await markProcessedMutation.mutateAsync(id);
      toast.success('Webhook marcado como processado');
    } catch (err) {
      toast.error('Falha ao marcar webhook');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Webhook removido');
      setDeletingId(null);
    } catch (err) {
      toast.error('Falha ao remover webhook');
    }
  };

  const getStatusBadge = (webhook: WebhookEvent) => {
    if (webhook.error_message) {
      return (
        <Badge className="bg-destructive/20 text-destructive gap-1">
          <XCircle className="w-3 h-3" />
          Erro
        </Badge>
      );
    }
    if (webhook.processed) {
      return (
        <Badge className="bg-success/20 text-success gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Processado
        </Badge>
      );
    }
    return (
      <Badge className="bg-warning/20 text-warning gap-1">
        <Clock className="w-3 h-3" />
        Pendente
      </Badge>
    );
  };

  const stats = {
    total: webhooks?.length || 0,
    processed: webhooks?.filter(w => w.processed && !w.error_message).length || 0,
    pending: webhooks?.filter(w => !w.processed && !w.error_message).length || 0,
    errors: webhooks?.filter(w => w.error_message).length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Erro ao carregar webhooks</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Webhook className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Webhooks Lalamove</h2>
            <p className="text-sm text-muted-foreground">
              Visualize e gerencie eventos recebidos da API Lalamove
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Segurança de webhooks (Etapa 20) */}
      <WebhookSecurityPanel />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Webhook className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.processed}</p>
              <p className="text-xs text-muted-foreground">Processados</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20">
              <Clock className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <XCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.errors}</p>
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="w-[200px]">
            <Select
              value={filters.eventType}
              onValueChange={(value) => setFilters({ ...filters, eventType: value })}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os tipos</SelectItem>
                {eventTypes?.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[180px]">
            <Select
              value={filters.processed === null ? 'ALL' : filters.processed.toString()}
              onValueChange={(value) => setFilters({ 
                ...filters, 
                processed: value === 'ALL' ? null : value === 'true'
              })}
            >
              <SelectTrigger className="bg-background/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="true">Processados</SelectItem>
                <SelectItem value="false">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={filters.orderId}
                onChange={(e) => setFilters({ ...filters, orderId: e.target.value })}
                placeholder="Buscar por Order ID..."
                className="pl-9 bg-background/50"
              />
            </div>
          </div>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setFilters({ eventType: 'ALL', processed: null, orderId: '' })}
          >
            Limpar
          </Button>
        </div>
      </Card>

      {/* Webhooks List */}
      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Recebido</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Tipo</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Order ID</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Processado em</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {webhooks?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Webhook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum webhook encontrado</p>
                  </td>
                </tr>
              ) : (
                webhooks?.map((webhook) => (
                  <tr 
                    key={webhook.id} 
                    className={cn(
                      "border-b border-border/30 hover:bg-muted/30 transition-colors",
                      webhook.error_message && "bg-destructive/5"
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-foreground">
                            {format(new Date(webhook.received_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(webhook.received_at), 'HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-mono text-xs">
                        {webhook.event_type}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-mono text-foreground">
                        {webhook.lalamove_order_id || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(webhook)}
                    </td>
                    <td className="p-4">
                      {webhook.processed_at ? (
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(webhook.processed_at), 'dd/MM HH:mm')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedWebhook(webhook)}
                          title="Ver payload"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!webhook.processed && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkProcessed(webhook.id)}
                            disabled={markProcessedMutation.isPending}
                            title="Marcar como processado"
                          >
                            <CheckCircle2 className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        {(webhook.processed || webhook.error_message) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReprocess(webhook.id)}
                            disabled={reprocessMutation.isPending}
                            title="Reprocessar"
                          >
                            <RefreshCw className="w-4 h-4 text-info" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(webhook.id)}
                          className="text-destructive hover:text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payload Dialog */}
      <Dialog open={!!selectedWebhook} onOpenChange={() => setSelectedWebhook(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Payload do Webhook
            </DialogTitle>
            <DialogDescription>
              {selectedWebhook?.event_type} - {selectedWebhook?.lalamove_order_id || 'Sem Order ID'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Recebido em</p>
                <p className="font-medium text-foreground">
                  {selectedWebhook && format(new Date(selectedWebhook.received_at), 'dd/MM/yyyy HH:mm:ss')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                {selectedWebhook && getStatusBadge(selectedWebhook)}
              </div>
            </div>

            {/* Error Message */}
            {selectedWebhook?.error_message && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm font-medium text-destructive mb-1">Mensagem de Erro</p>
                <p className="text-sm text-destructive/80">{selectedWebhook.error_message}</p>
              </div>
            )}

            {/* Payload */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Payload JSON</p>
              <ScrollArea className="h-[300px] rounded-lg border border-border bg-muted/30">
                <pre className="p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(selectedWebhook?.raw_payload, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este webhook? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
