import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, Send, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Etapas 62/63 do plano Google (docs/planos/PLANO_GOOGLE_MAPS_100_ETAPAS.md).
 *
 * O trigger geo_evaluate_tracking grava em order_geo_events e enfileira o aviso,
 * e send-notification atualiza notification_status — mas nenhuma tela lia a
 * tabela, então o operador não tinha como saber se o cliente foi avisado nem
 * reenviar um aviso perdido. Esta aba fecha o ciclo.
 */

interface GeoEventRow {
  id: string;
  event_type: string;
  stop_index: number;
  triggered_at: string;
  distance_m: number | null;
  eta_min: number | null;
  notification_status: string;
  notified_at: string | null;
}

const eventLabels: Record<string, string> = {
  DRIVER_APPROACHING_PICKUP: 'Motorista se aproximando da coleta',
  DRIVER_ARRIVED_PICKUP: 'Motorista chegou na coleta',
  DRIVER_APPROACHING_DELIVERY: 'Motorista se aproximando da entrega',
  DRIVER_ARRIVED_DELIVERY: 'Motorista chegou na entrega',
  ETA_DELAY: 'Atraso previsto',
  ROUTE_DEVIATION: 'Desvio de rota',
  DRIVER_STOPPED: 'Motorista parado',
  DRIVER_BLOCKED: 'Motorista bloqueado',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  queued: { label: 'Na fila', className: 'bg-muted text-muted-foreground' },
  sent: { label: 'Enviado', className: 'bg-success/15 text-success' },
  delivered: { label: 'Entregue', className: 'bg-success/15 text-success' },
  skipped: { label: 'Ignorado', className: 'bg-muted text-muted-foreground' },
  deferred: { label: 'Adiado (fora do horário)', className: 'bg-warning/15 text-warning' },
  no_recipient: { label: 'Sem destinatário', className: 'bg-destructive/15 text-destructive' },
  failed: { label: 'Falhou', className: 'bg-destructive/15 text-destructive' },
};

function formatDistance(m: number | null): string | null {
  if (m === null || !Number.isFinite(m)) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

interface OrderGeoEventsProps {
  orderId: string;
  driverId?: string | null;
}

export function OrderGeoEvents({ orderId, driverId }: OrderGeoEventsProps) {
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ['order-geo-events', orderId],
    queryFn: async (): Promise<GeoEventRow[]> => {
      const { data, error } = await supabase
        .from('order_geo_events')
        .select(
          'id, event_type, stop_index, triggered_at, distance_m, eta_min, notification_status, notified_at',
        )
        .eq('order_id', orderId)
        .order('triggered_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GeoEventRow[];
    },
    enabled: !!orderId,
  });

  const resend = useMutation({
    mutationFn: async (event: GeoEventRow) => {
      const label = eventLabels[event.event_type] ?? event.event_type;
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          alert_id: event.id,
          type: event.event_type,
          severity: 'INFO',
          title: label,
          message: `Reenvio manual: ${label}.`,
          order_id: orderId,
          driver_id: driverId ?? null,
          skip_dedup: true,
          metadata: { manual: true, geo_event_id: event.id, source: 'order_detail_geo_events' },
        },
      });
      if (error) throw error;
      const payload = data as { success?: boolean; error?: string; reason?: string } | null;
      if (payload?.success === false) {
        throw new Error(payload.error ?? payload.reason ?? 'Falha no reenvio');
      }
      return payload;
    },
    onSuccess: () => {
      toast.success('Aviso reenviado', {
        description: 'O envio foi registrado no histórico de notificações.',
      });
      queryClient.invalidateQueries({ queryKey: ['order-geo-events', orderId] });
    },
    onError: (err: Error) => toast.error('Erro ao reenviar aviso', { description: err.message }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="glass-card p-6 rounded-lg text-center">
        <Bell className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum evento geográfico registrado para este pedido.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Aproximação e chegada do motorista aparecem aqui quando o rastreio está ativo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const cfg = statusConfig[event.notification_status] ?? {
          label: event.notification_status,
          className: 'bg-muted text-muted-foreground',
        };
        const distance = formatDistance(event.distance_m);
        return (
          <div
            key={event.id}
            className="glass-card p-3 rounded-lg flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {eventLabels[event.event_type] ?? event.event_type}
                </span>
                <Badge variant="outline" className={cn('text-[10px]', cfg.className)}>
                  {cfg.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span>
                  {format(new Date(event.triggered_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
                {distance && <span>{distance} do ponto</span>}
                {event.eta_min !== null && <span>ETA {event.eta_min} min</span>}
                {event.notified_at && (
                  <span>
                    avisado {format(new Date(event.notified_at), 'HH:mm', { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={resend.isPending}
              onClick={() => resend.mutate(event)}
            >
              {resend.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : event.notification_status === 'no_recipient' ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Reenviar
            </Button>
          </div>
        );
      })}
    </div>
  );
}