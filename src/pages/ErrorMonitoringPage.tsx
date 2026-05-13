import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bug, AlertTriangle, AlertOctagon, Search, CheckCircle2,
  XCircle, Clock, Eye, EyeOff, RefreshCw, BarChart3, Layers
} from 'lucide-react';
import { useErrorLogs, useResolveError, useErrorStats, type RuntimeErrorLog } from '@/hooks/useErrorLogs';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const severityConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  warning: { color: 'bg-warning/10 text-warning border-warning/30', icon: AlertTriangle, label: 'Warning' },
  error: { color: 'bg-destructive/10 text-destructive border-destructive/30', icon: Bug, label: 'Error' },
  critical: { color: 'bg-destructive/20 text-destructive border-destructive/50', icon: AlertOctagon, label: 'Critical' },
};

const sourceLabels: Record<string, string> = {
  'react-boundary': 'React Boundary',
  'unhandled-error': 'Unhandled Error',
  'unhandled-rejection': 'Promise Rejection',
  'network': 'Network',
  'chunk-load': 'Chunk Load',
  'manual': 'Manual',
};

function StatsCards() {
  const { data: stats, isLoading } = useErrorStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Não Resolvidos', value: stats?.unresolved ?? 0, icon: XCircle, accent: 'text-destructive' },
    { label: 'Críticos', value: stats?.critical ?? 0, icon: AlertOctagon, accent: 'text-destructive' },
    { label: 'Últimas 24h', value: stats?.last24hCount ?? 0, icon: Clock, accent: 'text-warning' },
    { label: 'Ocorrências Totais', value: stats?.totalOccurrences ?? 0, icon: Layers, accent: 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold ${card.accent}`}>{card.value}</p>
              </div>
              <card.icon className={`h-5 w-5 ${card.accent} opacity-60`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorRow({ error, onResolve }: { error: RuntimeErrorLog; onResolve: (id: string, resolved: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[error.severity] ?? severityConfig.error;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`border rounded-lg p-4 transition-colors ${error.resolved ? 'opacity-60 border-border/30' : 'border-border'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-md ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">{error.error_name}</span>
            <Badge variant="outline" className="text-[10px] px-1.5">
              {sourceLabels[error.source] ?? error.source}
            </Badge>
            {error.occurrence_count > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">
                ×{error.occurrence_count}
              </Badge>
            )}
            {error.resolved && (
              <Badge className="bg-accent/50 text-accent-foreground border-accent/30 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resolvido
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{error.error_message}</p>

          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
            <span>
              Visto {formatDistanceToNow(new Date(error.last_seen_at), { addSuffix: true, locale: ptBR })}
            </span>
            {error.url && (
              <span className="truncate max-w-[200px]">{new URL(error.url).pathname}</span>
            )}
            {error.app_version && <span>v{error.app_version}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onResolve(error.id, !error.resolved)}
          >
            {error.resolved ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              {error.stack_trace && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Stack Trace</p>
                  <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-40 text-foreground/80">
                    {error.stack_trace}
                  </pre>
                </div>
              )}
              {error.component_stack && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Component Stack</p>
                  <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-32 text-foreground/80">
                    {error.component_stack}
                  </pre>
                </div>
              )}
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                <span>ID: {error.error_id}</span>
                <span>Fingerprint: {error.fingerprint}</span>
                <span>Primeiro: {format(new Date(error.first_seen_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ErrorMonitoringPage() {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);

  const { data: errors, isLoading, refetch } = useErrorLogs({
    severity: severity !== 'all' ? severity : undefined,
    source: source !== 'all' ? source : undefined,
    resolved: showResolved ? undefined : false,
    search: search || undefined,
  });

  const resolveError = useResolveError();

  const handleResolve = (id: string, resolved: boolean) => {
    resolveError.mutate(
      { errorId: id, resolved },
      {
        onSuccess: () => toast.success(resolved ? 'Erro marcado como resolvido' : 'Erro reaberto'),
      }
    );
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bug className="h-6 w-6 text-destructive" />
            Monitoramento de Erros
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Captura contínua de erros em runtime com deduplicação e agrupamento
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      <StatsCards />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Erros ({errors?.length ?? 0})
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar erro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 w-48"
                />
              </div>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-9 w-32">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas fontes</SelectItem>
                  <SelectItem value="react-boundary">React Boundary</SelectItem>
                  <SelectItem value="unhandled-error">Unhandled Error</SelectItem>
                  <SelectItem value="unhandled-rejection">Promise Rejection</SelectItem>
                  <SelectItem value="chunk-load">Chunk Load</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showResolved ? 'secondary' : 'outline'}
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setShowResolved(!showResolved)}
              >
                {showResolved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                Resolvidos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : errors?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-3 text-primary" />
              <p className="text-lg font-medium">Nenhum erro encontrado</p>
              <p className="text-sm">O sistema está funcionando sem erros detectados</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {errors?.map((error) => (
                    <ErrorRow key={error.id} error={error} onResolve={handleResolve} />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
