import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';
import type { OrderStatus } from '@/types';

interface StatusTimelineEntry {
  id: string;
  status: OrderStatus;
  old_status: string | null;
  changed_by: string | null;
  change_reason: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  MATCHED: 'Atribuído',
  ON_GOING: 'Em Trânsito',
  PICKED_UP: 'Coletado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rejeitado',
  EXPIRED: 'Expirado',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'muted'> = {
  PENDING: 'muted',
  MATCHED: 'info',
  ON_GOING: 'warning',
  PICKED_UP: 'info',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  REJECTED: 'destructive',
  EXPIRED: 'muted',
};

interface StatusTimelineProps {
  orderId: string;
  enabled?: boolean;
}

export function StatusTimeline({ orderId, enabled = true }: StatusTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async (): Promise<StatusTimelineEntry[]> => {
      const { data, error } = await supabase
        .from('lalamove_status_history')
        .select('id, status, old_status, changed_by, change_reason, notes, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StatusTimelineEntry[];
    },
    enabled: enabled && !!orderId,
    staleTime: 15_000,
  });

  if (!enabled) return null;

  return (
    <div className="glass-card p-4 rounded-lg">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <History className="w-4 h-4" />
        Timeline de Status
      </h3>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando histórico…
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <p className="text-xs text-muted-foreground">Sem transições registradas ainda.</p>
      )}

      {data && data.length > 0 && (
        <ol className="relative border-l border-border/60 ml-2 space-y-4">
          {data.map((entry) => {
            const variant = STATUS_VARIANT[entry.status] ?? 'muted';
            const label = STATUS_LABEL[entry.status] ?? entry.status;
            const from = entry.old_status ? STATUS_LABEL[entry.old_status] ?? entry.old_status : null;
            return (
              <li key={entry.id} className="ml-4">
                <span
                  className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary ring-2 ring-background"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={variant} size="sm">{label}</Badge>
                  {from && (
                    <span className="text-xs text-muted-foreground">
                      (de <span className="font-medium">{from}</span>)
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
      )}
    </div>
  );
}
