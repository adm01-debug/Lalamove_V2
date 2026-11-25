import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { describeSnapshotAge, type UapiSnapshotInfo } from '@/lib/uapiSnapshot';
import { cn } from '@/lib/utils';

interface UapiSnapshotBadgeProps {
  info: UapiSnapshotInfo | null | undefined;
  className?: string;
}

/**
 * Idade da cópia do robô usada pelo painel. Reavalia sozinho a cada minuto,
 * porque o dado envelhece sem que exista nova requisição.
 */
export function UapiSnapshotBadge({ info, className }: UapiSnapshotBadgeProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!info?.servedFromSnapshot) return null;

  const { tone, label, title } = describeSnapshotAge(info, now);
  const stale = tone === 'stale';

  return (
    <span
      role="status"
      title={title}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        stale
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          : 'border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      {stale ? <AlertTriangle className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
      {label}
    </span>
  );
}