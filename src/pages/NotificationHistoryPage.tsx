import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  Mail,
  MessageCircle,
  Hash,
  Briefcase,
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationHistory, useNotificationStats, NotificationSent } from '@/hooks/useNotificationHistory';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const channelIcons: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  email: Mail,
  slack: Hash,
  bitrix24: Briefcase,
  n8n: Webhook,
};

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  slack: 'Slack',
  bitrix24: 'Bitrix24',
  n8n: 'N8N',
};

const channelColors: Record<string, string> = {
  whatsapp: 'bg-success/10 text-success border-success/30',
  email: 'bg-info/10 text-info border-info/30',
  slack: 'bg-accent/10 text-accent border-accent/30',
  bitrix24: 'bg-warning/10 text-warning border-warning/30',
  n8n: 'bg-primary/10 text-primary border-primary/30',
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-warning', label: 'Pendente' },
  sent: { icon: Send, color: 'text-info', label: 'Enviado' },
  delivered: { icon: CheckCircle2, color: 'text-success', label: 'Entregue' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Falhou' },
};

const alertTypeLabels: Record<string, string> = {
  'DRIVER_BLOCKED': 'Motorista Bloqueado',
  'ROUTE_DEVIATION': 'Desvio de Rota',
  'DRIVER_STOPPED': 'Motorista Parado',
  'LATE_DELIVERY': 'Entrega Atrasada',
  'APPROVAL_REQUIRED': 'Aprovação Necessária',
  'ORDER_CANCELLED': 'Pedido Cancelado',
};

function StatsCards() {
  const { data: stats, isLoading } = useNotificationStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total', value: stats?.total || 0, icon: Bell, color: 'text-foreground' },
    { label: 'Entregues', value: stats?.delivered || 0, icon: CheckCircle2, color: 'text-success' },
    { label: 'Enviados', value: stats?.sent || 0, icon: Send, color: 'text-info' },
    { label: 'Pendentes', value: stats?.pending || 0, icon: Clock, color: 'text-warning' },
    { label: 'Falhas', value: stats?.failed || 0, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
              <card.icon className={cn("w-8 h-8", card.color, "opacity-50")} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NotificationRow({ notification }: { notification: NotificationSent }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const ChannelIcon = channelIcons[notification.channel] || Bell;
  const statusInfo = statusConfig[notification.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setShowDetails(true)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("gap-1", channelColors[notification.channel])}>
              <ChannelIcon className="w-3 h-3" />
              {channelLabels[notification.channel] || notification.channel}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          <div className="max-w-[200px] truncate text-sm">
            {notification.recipient}
          </div>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={cn("w-4 h-4", statusInfo.color)} />
                  <span className={cn("text-sm", statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>
              </TooltipTrigger>
              {notification.error_message && (
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">{notification.error_message}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>
          {notification.alert ? (
            <Badge variant="outline" className="text-xs">
              {alertTypeLabels[notification.alert.type] || notification.alert.type}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {notification.sent_at 
            ? format(new Date(notification.sent_at), "dd/MM HH:mm", { locale: ptBR })
            : '-'
          }
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(notification.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
        </TableCell>
        <TableCell>
          {notification.retry_count && notification.retry_count > 0 ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <RefreshCw className="w-3 h-3" />
              {notification.retry_count}
            </Badge>
          ) : null}
        </TableCell>
      </TableRow>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChannelIcon className="w-5 h-5" />
              Detalhes da Notificação
            </DialogTitle>
            <DialogDescription>
              {channelLabels[notification.channel]} para {notification.recipient}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <StatusIcon className={cn("w-4 h-4", statusInfo.color)} />
                  <span className={statusInfo.color}>{statusInfo.label}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tentativas</p>
                <p className="mt-1">{(notification.retry_count || 0) + 1}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Criado em</p>
                <p className="mt-1 text-sm">
                  {format(new Date(notification.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Enviado em</p>
                <p className="mt-1 text-sm">
                  {notification.sent_at 
                    ? format(new Date(notification.sent_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                    : '-'
                  }
                </p>
              </div>
            </div>

            {notification.delivered_at && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Entregue em</p>
                <p className="mt-1 text-sm">
                  {format(new Date(notification.delivered_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
              </div>
            )}

            {notification.error_message && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Erro
                </p>
                <p className="mt-1 text-sm text-destructive/80">
                  {notification.error_message}
                </p>
              </div>
            )}

            {notification.alert && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm font-medium text-muted-foreground">Alerta Relacionado</p>
                <p className="font-medium mt-1">{notification.alert.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{notification.alert.message}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NotificationHistoryPage() {
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const { data: notifications, isLoading, error, refetch } = useNotificationHistory({
    channel: channelFilter,
    status: statusFilter,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Histórico de Notificações</h2>
          <p className="text-muted-foreground">
            Acompanhe o status de entrega das notificações enviadas
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Filtros</CardTitle>
            </div>
            <CardDescription>
              {notifications?.length || 0} notificação(ões) encontrada(s)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Canais</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="bitrix24">Bitrix24</SelectItem>
                  <SelectItem value="n8n">N8N</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">Erro ao carregar histórico: {error.message}</p>
            </div>
          ) : notifications?.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma notificação encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                As notificações enviadas aparecerão aqui
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo de Alerta</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Retries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications?.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
