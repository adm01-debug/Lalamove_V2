import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCronJobsHealth, type CronJobHealth } from '@/hooks/useCronJobsHealth';

const formatDuration = (ms: number | null): string => {
  if (ms === null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return 'Nunca executado';
  return new Date(iso).toLocaleString('pt-BR');
};

interface StatusVisual {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  Icon: typeof CheckCircle2;
}

const resolveStatus = (job: CronJobHealth): StatusVisual => {
  if (job.active === false) {
    return { label: 'Inativo', variant: 'outline', Icon: AlertTriangle };
  }
  if (job.last_status === null) {
    return { label: 'Sem execuções', variant: 'secondary', Icon: Clock };
  }
  if (job.last_status === 'succeeded') {
    return { label: 'Sucesso', variant: 'default', Icon: CheckCircle2 };
  }
  return { label: 'Falha', variant: 'destructive', Icon: XCircle };
};

const CronJobCard = ({ job }: { job: CronJobHealth }) => {
  const status = resolveStatus(job);
  const failureRate = job.failure_rate ?? 0;
  const hasFailures = failureRate > 0;

  return (
    <Card className={cn('p-4 space-y-3', hasFailures && 'border-destructive/50')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{job.jobname ?? `job #${job.jobid}`}</h3>
          <p className="text-xs text-muted-foreground font-mono">{job.schedule ?? '—'}</p>
        </div>
        <Badge
          variant={status.variant}
          aria-label={`Status do job: ${status.label}`}
          className="flex items-center gap-1"
        >
          <status.Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {status.label}
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Última execução</dt>
          <dd>{formatDateTime(job.last_run_started)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Duração</dt>
          <dd>{formatDuration(job.last_run_duration_ms)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Execuções avaliadas</dt>
          <dd>{job.runs_considered ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Taxa de falha</dt>
          <dd className={cn(hasFailures && 'text-destructive font-semibold')}>
            {failureRate.toFixed(2)}% ({job.failed_runs ?? 0})
          </dd>
        </div>
      </dl>
    </Card>
  );
};

export const CronJobsHealthPanel = () => {
  const { data: jobs, isLoading, error } = useCronJobsHealth();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-4 flex items-center gap-3 border-destructive/50">
        <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-semibold">Não foi possível carregar a saúde dos jobs</p>
          <p className="text-sm text-muted-foreground">
            Requer permissão de administrador. {error.message}
          </p>
        </div>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Nenhum job agendado encontrado.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {jobs.map((job) => (
        <CronJobCard key={job.jobid} job={job} />
      ))}
    </div>
  );
};
