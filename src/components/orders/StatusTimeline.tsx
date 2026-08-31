import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, AlertTriangle, Check, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildOrderTimeline,
  formatDuration,
  type TimelineEventInput,
  type StageState,
} from '@/lib/lalamoveTimeline';
import type { LalamoveOrderStatus } from '@/types/lalamove';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'muted'> = {
  ASSIGNING_DRIVER: 'muted',
  ON_GOING: 'info',
  PICKED_UP: 'info',
  DELIVERING: 'warning',
  COMPLETED: 'success',
  CANCELED: 'destructive',
  REJECTED: 'destructive',
  EXPIRED: 'muted',
};

const STAGE_STYLE: Record<StageState, string> = {
  done: 'bg-primary text-primary-foreground border-primary',
  current: 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/40',
  pending: 'bg-muted text-muted-foreground border-border',
  skipped: 'bg-muted text-muted-foreground border-dashed border-border',
  aborted: 'bg-destructive/10 text-destructive border-destructive/40 border-dashed',
};

interface StatusTimelineProps {
  orderId: string;
  enabled?: boolean;
}

export function StatusTimeline({ orderId, enabled = true }: StatusTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async (): Promise<TimelineEventInput[]> => {
      const { data, error } = await supabase
        .from('lalamove_status_history')
        .select('id, status, old_status, changed_by, change_reason, notes, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimelineEventInput[];
    },
    enabled: enabled && !!orderId,
    staleTime: 15_000,
  });

  const timeline = useMemo(() => buildOrderTimeline(data ?? []), [data]);

  if (!enabled) return null;

  const totalDuration = formatDuration(timeline.totalDurationMs);

  return (
    <div className="glass-card p-4 rounded-lg">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <History className="w-4 h-4" />
        Timeline de Status
        {totalDuration && (
          <span className="ml-auto flex items-center gap-1 text-xs font-normal">
            <Clock className="w-3.5 h-3.5" /> {totalDuration}
          </span>
        )}
      </h3>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando histórico…
        </div>
      )}

      {!isLoading && timeline.events.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem transições registradas ainda.</p>
      )}

      {timeline.events.length > 0 && (
        <>
          {/* Trilho canônico do fluxo oficial Lalamove */}
          <ol className="flex flex-wrap items-center gap-1.5 mb-4" aria-label="Progresso oficial do pedido">
            {timeline.stages.map((stage, index) => (
              <li key={stage.status} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                    STAGE_STYLE[stage.state],
                  )}
                  title={
                    stage.reachedAt
                      ? new Date(stage.reachedAt).toLocaleString('pt-BR')
                      : 'Etapa não reportada'
                  }
                >
                  {stage.state === 'done' || stage.state === 'current' ? (
                    <Check className="w-3 h-3" aria-hidden />
                  ) : (
                    <Circle className="w-3 h-3" aria-hidden />
                  )}
                  <span>{stage.label}</span>
                </div>
                {index < timeline.stages.length - 1 && (
                  <span className="h-px w-3 bg-border" aria-hidden />
                )}
              </li>
            ))}
          </ol>

          {timeline.abortedAs && (
            <p className="mb-3 text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Fluxo interrompido —{' '}
              {timeline.abortedAs === 'CANCELED'
                ? 'pedido cancelado'
                : timeline.abortedAs === 'REJECTED'
                  ? 'pedido rejeitado'
                  : 'cotação expirada'}
              .
            </p>
          )}

          <ol className="relative border-l border-border/60 ml-2 space-y-4">
            {timeline.events.map((entry) => {
              const variant = STATUS_VARIANT[entry.canonical as LalamoveOrderStatus] ?? 'muted';
              const gap = formatDuration(entry.durationMsFromPrevious);
              return (
                <li key={entry.id} className="ml-4">
                  <span
                    className={cn(
                      'absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-2 ring-background',
                      entry.outOfOrder ? 'bg-warning' : 'bg-primary',
                    )}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={variant} size="sm">{entry.label}</Badge>
                    {gap && <span className="text-xs text-muted-foreground">+{gap}</span>}
                    {entry.outOfOrder && (
                      <span className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="w-3 h-3" aria-hidden /> fora de ordem
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {entry.changed_by && (
                      <span>
                        Origem: <span className="font-medium text-foreground/80">{entry.changed_by}</span>
                      </span>
                    )}
                    {entry.change_reason && (
                      <span>
                        Motivo: <span className="text-foreground/80">{entry.change_reason}</span>
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">{entry.notes}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
