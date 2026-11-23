// Job Queue Hook - Simula fila de jobs usando dados reais das tabelas existentes
// Usa webhook_events como proxy para jobs de webhook
// Usa driver_evaluations como proxy para jobs de avaliação
// Usa bitrix24_sync como proxy para jobs de sincronização

import { logger } from '@/utils/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface QueueStatistics {
  totalPending: number;
  totalProcessing: number;
  totalCompletedLastHour: number;
  totalFailedLastHour: number;
  avgProcessingTimeSeconds: number;
  oldestPendingMinutes: number;
}

interface JobQueueItem {
  id: string;
  type: string;
  payload: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  nextRetryAt?: string;
}

type JobPayload = {
  deal_id?: number;
  order_id?: string;
  driver_id?: string;
  alert_type?: string;
  message?: string;
  [key: string]: unknown;
};

/**
 * Hook para monitorar estatísticas da fila de jobs
 * Usa dados reais de webhook_events, driver_evaluations e bitrix24_sync
 */
export const useQueueStatistics = () => {
  return useQuery({
    queryKey: ['queue-statistics'],
    queryFn: async (): Promise<QueueStatistics> => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Webhook events pendentes (não processados)
      const { count: pendingWebhooks } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('processed', false);

      // Webhook events processados na última hora
      const { count: completedWebhooks } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .eq('processed', true)
        .gte('processed_at', oneHourAgo.toISOString());

      // Webhook events com erro na última hora
      const { count: failedWebhooks } = await supabase
        .from('webhook_events')
        .select('*', { count: 'exact', head: true })
        .not('error_message', 'is', null)
        .gte('received_at', oneHourAgo.toISOString());

      // Bitrix sync pendentes
      const { count: pendingSync } = await supabase
        .from('bitrix24_sync')
        .select('*', { count: 'exact', head: true })
        .eq('sync_status', 'pending');

      // Driver evaluations na última hora
      const { count: completedEvaluations } = await supabase
        .from('driver_evaluations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo.toISOString());

      // Calcular webhook mais antigo pendente
      const { data: oldestPending } = await supabase
        .from('webhook_events')
        .select('received_at')
        .eq('processed', false)
        .order('received_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let oldestPendingMinutes = 0;
      if (oldestPending?.received_at) {
        const oldestTime = new Date(oldestPending.received_at);
        oldestPendingMinutes = Math.floor((now.getTime() - oldestTime.getTime()) / 60000);
      }

      return {
        totalPending: (pendingWebhooks || 0) + (pendingSync || 0),
        totalProcessing: 0, // Não temos como saber o que está em processamento
        totalCompletedLastHour: (completedWebhooks || 0) + (completedEvaluations || 0),
        totalFailedLastHour: failedWebhooks || 0,
        avgProcessingTimeSeconds: 2, // Estimativa
        oldestPendingMinutes
      };
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    staleTime: 5000,
  });
};

/**
 * Hook para listar jobs da fila
 * Combina dados de webhook_events, driver_evaluations e bitrix24_sync
 */
export const useJobQueue = (status?: string, limit = 50) => {
  return useQuery({
    queryKey: ['job-queue', status, limit],
    queryFn: async (): Promise<JobQueueItem[]> => {
      const jobs: JobQueueItem[] = [];

      // Buscar webhook_events
      let webhookQuery = supabase
        .from('webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(Math.floor(limit / 3));

      if (status === 'PENDING') {
        webhookQuery = webhookQuery.eq('processed', false);
      } else if (status === 'COMPLETED') {
        webhookQuery = webhookQuery.eq('processed', true);
      } else if (status === 'FAILED') {
        webhookQuery = webhookQuery.not('error_message', 'is', null);
      }

      const { data: webhooks } = await webhookQuery;

      webhooks?.forEach(webhook => {
        jobs.push({
          id: webhook.id,
          type: 'webhook',
          payload: webhook.raw_payload,
          status: webhook.error_message ? 'FAILED' : (webhook.processed ? 'COMPLETED' : 'PENDING'),
          attempts: 1,
          maxAttempts: 3,
          errorMessage: webhook.error_message || undefined,
          priority: 5,
          createdAt: webhook.received_at,
          updatedAt: webhook.processed_at || webhook.received_at,
          completedAt: webhook.processed_at || undefined,
        });
      });

      // Buscar driver_evaluations como jobs de avaliação
      const { data: evaluations } = await supabase
        .from('driver_evaluations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 3));

      evaluations?.forEach(eval_ => {
        jobs.push({
          id: eval_.id,
          type: 'evaluation',
          payload: { driver_id: eval_.driver_id, order_id: eval_.order_id, risk_factors: eval_.risk_factors },
          status: 'COMPLETED',
          attempts: 1,
          maxAttempts: 1,
          priority: 3,
          createdAt: eval_.created_at,
          updatedAt: eval_.evaluated_at,
          completedAt: eval_.evaluated_at,
        });
      });

      // Buscar bitrix24_sync como jobs de sincronização
      let syncQuery = supabase
        .from('bitrix24_sync')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(Math.floor(limit / 3));

      if (status === 'PENDING') {
        syncQuery = syncQuery.eq('sync_status', 'pending');
      } else if (status === 'COMPLETED') {
        syncQuery = syncQuery.eq('sync_status', 'synced');
      } else if (status === 'FAILED') {
        syncQuery = syncQuery.eq('sync_status', 'error');
      }

      const { data: syncs } = await syncQuery;

      syncs?.forEach(sync => {
        jobs.push({
          id: sync.id,
          type: 'sync_bitrix24',
          payload: { deal_id: sync.deal_id, order_id: sync.order_id, synced_fields: sync.synced_fields },
          status: sync.sync_status === 'synced' ? 'COMPLETED' : (sync.sync_status === 'error' ? 'FAILED' : 'PENDING'),
          attempts: 1,
          maxAttempts: 3,
          errorMessage: sync.last_error || undefined,
          priority: 4,
          createdAt: sync.created_at,
          updatedAt: sync.updated_at,
          completedAt: sync.sync_status === 'synced' ? sync.last_synced_at : undefined,
        });
      });

      // Ordenar por data de criação
      jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return jobs.slice(0, limit);
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });
};

/**
 * Hook para adicionar job à fila
 * Cria registros nas tabelas correspondentes
 */
export const useAddJob = () => {
  const queryClient = useQueryClient();

  const addJob = async (
    type: 'webhook' | 'notification' | 'evaluation' | 'sync_bitrix24' | 'cleanup',
    payload: JobPayload,
    priority = 5,
    maxAttempts = 3
  ): Promise<string> => {
    if (type === 'sync_bitrix24' && payload.deal_id && payload.order_id) {
      const { data, error } = await supabase
        .from('bitrix24_sync')
        .insert({
          deal_id: payload.deal_id,
          order_id: payload.order_id,
          sync_status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['job-queue'] });
      queryClient.invalidateQueries({ queryKey: ['queue-statistics'] });
      
      return data.id;
    }

    // Para outros tipos, retornamos um ID simulado
    logger.warn(`Job type "${type}" adicionado (simulado - sem tabela dedicada)`);
    return `simulated-${Date.now()}`;
  };

  return { addJob };
};

/**
 * Hook para retry manual de job falhado
 */
export const useRetryJob = () => {
  const queryClient = useQueryClient();

  const retryJob = async (jobId: string): Promise<void> => {
    // Tenta em webhook_events primeiro
    const { data: webhook } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('id', jobId)
      .maybeSingle();

    if (webhook) {
      await supabase
        .from('webhook_events')
        .update({ processed: false, error_message: null })
        .eq('id', jobId);
      
      queryClient.invalidateQueries({ queryKey: ['job-queue'] });
      queryClient.invalidateQueries({ queryKey: ['queue-statistics'] });
      return;
    }

    // Tenta em bitrix24_sync
    const { data: sync } = await supabase
      .from('bitrix24_sync')
      .select('id')
      .eq('id', jobId)
      .maybeSingle();

    if (sync) {
      await supabase
        .from('bitrix24_sync')
        .update({ sync_status: 'pending', last_error: null })
        .eq('id', jobId);
      
      queryClient.invalidateQueries({ queryKey: ['job-queue'] });
      queryClient.invalidateQueries({ queryKey: ['queue-statistics'] });
      return;
    }

    logger.warn(`Job ${jobId} não encontrado para retry`);
  };

  return { retryJob };
};

/**
 * Hook para deletar job
 * Nota: Por segurança, não deletamos registros reais
 */
export const useDeleteJob = () => {
  const deleteJob = async (jobId: string): Promise<void> => {
    logger.warn(`Delete de job ${jobId} ignorado (jobs são registros históricos)`);
    // Não deletamos registros de webhook_events, evaluations ou syncs
    // Eles são registros históricos importantes
  };

  return { deleteJob };
};

/**
 * Hook para processar fila manualmente
 * Invalida caches para forçar refresh
 */
export const useProcessQueue = () => {
  const queryClient = useQueryClient();

  const processQueue = async (): Promise<{ processed: number; errors: number }> => {
    // Invalida todos os caches relacionados
    await queryClient.invalidateQueries({ queryKey: ['job-queue'] });
    await queryClient.invalidateQueries({ queryKey: ['queue-statistics'] });
    await queryClient.invalidateQueries({ queryKey: ['webhook-events'] });
    
    return { processed: 0, errors: 0 };
  };

  return { processQueue };
};
