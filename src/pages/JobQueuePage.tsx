import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQueueStatistics, useJobQueue, useRetryJob, useDeleteJob, useProcessQueue } from '@/hooks/useJobQueue';
import { AlertCircle, CheckCircle2, Clock, Loader2, PlayCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function JobQueuePage() {
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const { data: stats, isLoading: statsLoading } = useQueueStatistics();
  const { data: jobs, isLoading: jobsLoading, refetch } = useJobQueue(selectedStatus, 100);
  const { retryJob } = useRetryJob();
  const { deleteJob } = useDeleteJob();
  const { processQueue } = useProcessQueue();
  const [processingQueue, setProcessingQueue] = useState(false);

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob(jobId);
      toast.success('Job marcado para retry');
      refetch();
    } catch (error) {
      toast.error('Erro ao fazer retry do job');
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      toast.success('Job deletado');
      refetch();
    } catch (error) {
      toast.error('Erro ao deletar job');
    }
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const result = await processQueue();
      toast.success(`${result.processed} jobs processados, ${result.errors} erros`);
      refetch();
    } catch (error) {
      toast.error('Erro ao processar fila');
    } finally {
      setProcessingQueue(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'PROCESSING':
        return <Badge variant="outline" className="bg-info/10 text-info border-info"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="bg-success/10 text-success border-success"><CheckCircle2 className="w-3 h-3 mr-1" />Completo</Badge>;
      case 'FAILED':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive"><AlertCircle className="w-3 h-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      webhook: 'bg-accent/10 text-accent border-accent',
      notification: 'bg-info/10 text-info border-info',
      evaluation: 'bg-warning/10 text-warning border-warning',
      sync_bitrix24: 'bg-primary/10 text-primary border-primary',
      cleanup: 'bg-muted text-muted-foreground border-border',
    };

    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type}
      </Badge>
    );
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fila de Jobs</h1>
          <p className="text-muted-foreground">
            Monitoramento e gerenciamento da fila assíncrona
          </p>
        </div>
        <Button onClick={handleProcessQueue} disabled={processingQueue}>
          {processingQueue ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <PlayCircle className="w-4 h-4 mr-2" />
          )}
          Processar Agora
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats?.totalPending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Processando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats?.totalProcessing || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completos (1h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {stats?.totalCompletedLastHour || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Falhados (1h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.totalFailedLastHour || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tempo Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(stats?.avgProcessingTimeSeconds || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mais Antigo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.oldestPendingMinutes
                ? `${Math.floor(stats.oldestPendingMinutes)}m`
                : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={selectedStatus === undefined ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus(undefined)}
            >
              Todos
            </Button>
            <Button
              variant={selectedStatus === 'PENDING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('PENDING')}
            >
              Pendentes
            </Button>
            <Button
              variant={selectedStatus === 'PROCESSING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('PROCESSING')}
            >
              Processando
            </Button>
            <Button
              variant={selectedStatus === 'COMPLETED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('COMPLETED')}
            >
              Completos
            </Button>
            <Button
              variant={selectedStatus === 'FAILED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('FAILED')}
            >
              Falhados
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs ({jobs?.length || 0})</CardTitle>
          <CardDescription>
            Últimos {jobs?.length || 0} jobs {selectedStatus ? `com status ${selectedStatus}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Próximo Retry</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs && jobs.length > 0 ? (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{getTypeBadge(job.type)}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        {job.attempts}/{job.maxAttempts}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(job.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.nextRetryAt ? formatDate(job.nextRetryAt) : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-destructive">
                        {job.errorMessage || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {job.status === 'FAILED' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRetryJob(job.id)}
                              title="Retry"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteJob(job.id)}
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhum job encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
