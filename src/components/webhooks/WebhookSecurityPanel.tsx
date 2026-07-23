import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ShieldAlert, ShieldCheck, Repeat, Clock, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useWebhookSecurityMetrics } from '@/hooks/useWebhookSecurityMetrics';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV } from '@/utils/exportUtils';
import { toast } from 'sonner';

const WINDOWS: Array<{ label: string; hours: number }> = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
];

function formatRelative(iso: string | null): string {
  if (!iso) return 'Sem ocorrências';
  return `há ${formatDistanceToNow(new Date(iso), { locale: ptBR })}`;
}

export function WebhookSecurityPanel() {
  const [windowHours, setWindowHours] = useState(24);
  const { data, isLoading } = useWebhookSecurityMetrics(windowHours);

  const totalRejections = useMemo(
    () => (data ? data.signatureInvalid + data.replayRejected : 0),
    [data]
  );

  const severity: 'ok' | 'warn' | 'critical' = useMemo(() => {
    if (!data) return 'ok';
    if (data.signatureInvalid > 0) return 'critical';
    if (data.replayRejected > 3) return 'warn';
    return 'ok';
  }, [data]);

  const severityStyles = {
    ok: { icon: ShieldCheck, className: 'text-success', bg: 'bg-success/10' },
    warn: { icon: ShieldAlert, className: 'text-warning', bg: 'bg-warning/10' },
    critical: { icon: AlertTriangle, className: 'text-destructive', bg: 'bg-destructive/10' },
  }[severity];

  const SeverityIcon = severityStyles.icon;

  return (
    <Card className="glass-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', severityStyles.bg)}>
            <SeverityIcon className={cn('w-5 h-5', severityStyles.className)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4" aria-hidden />
              Segurança de Webhooks
            </h3>
            <p className="text-xs text-muted-foreground">
              Assinaturas HMAC, proteção contra replay e idempotência
            </p>
          </div>
        </div>
        <div className="flex gap-1" role="group" aria-label="Janela de tempo">
          {WINDOWS.map((w) => (
            <Button
              key={w.hours}
              size="sm"
              variant={windowHours === w.hours ? 'default' : 'outline'}
              onClick={() => setWindowHours(w.hours)}
              aria-pressed={windowHours === w.hours}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard
            icon={<ShieldAlert className="w-4 h-4 text-destructive" />}
            label="Assinaturas inválidas"
            value={data?.signatureInvalid ?? 0}
            hint={formatRelative(data?.lastSignatureInvalidAt ?? null)}
            tone="destructive"
          />
          <MetricCard
            icon={<Clock className="w-4 h-4 text-warning" />}
            label="Replays rejeitados"
            value={data?.replayRejected ?? 0}
            hint={formatRelative(data?.lastReplayRejectedAt ?? null)}
            tone="warning"
          />
          <MetricCard
            icon={<Repeat className="w-4 h-4 text-primary" />}
            label="Duplicatas ignoradas"
            value={data?.duplicateIgnored ?? 0}
            hint={formatRelative(data?.lastDuplicateAt ?? null)}
            tone="info"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1">
          <span className="font-semibold text-foreground">{data?.totalReceived ?? 0}</span>
          eventos recebidos
        </Badge>
        <Badge variant="outline" className="gap-1">
          <span className="font-semibold text-foreground">{totalRejections}</span>
          rejeições de segurança
        </Badge>
        <span>
          Janela: últimos {windowHours < 24 ? `${windowHours}h` : `${windowHours / 24}d`} •
          atualização automática a cada 60s
        </span>
      </div>
    </Card>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: 'destructive' | 'warning' | 'info';
}

function MetricCard({ icon, label, value, hint, tone }: MetricCardProps) {
  const toneClass = {
    destructive: 'border-destructive/40 bg-destructive/5',
    warning: 'border-warning/40 bg-warning/5',
    info: 'border-primary/40 bg-primary/5',
  }[tone];

  return (
    <div className={cn('rounded-lg border p-3 space-y-1', toneClass)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
