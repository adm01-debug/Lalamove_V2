import { History, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TrackingEvent } from '@/hooks/useTrackingHistory';

interface MapHistoryPanelProps {
  driverName: string;
  history: TrackingEvent[];
  historyLoading: boolean;
  onClose: () => void;
}

export function MapHistoryPanel({ driverName, history, historyLoading, onClose }: MapHistoryPanelProps) {
  return (
    <div className="absolute bottom-4 right-4 glass-card px-4 py-3 rounded-lg max-w-xs">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Trajeto de {driverName}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {historyLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          Carregando trajeto...
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">{history.length} pontos registrados</span>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-success">Início:</span>{' '}
            {new Date(history[0].created_at).toLocaleTimeString('pt-BR')}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-destructive">Último:</span>{' '}
            {new Date(history[history.length - 1].created_at).toLocaleTimeString('pt-BR')}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Nenhum histórico encontrado</div>
      )}
    </div>
  );
}
