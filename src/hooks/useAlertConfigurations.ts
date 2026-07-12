import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';

type AlertType = Database['public']['Enums']['alert_type'];
type AlertConfigInsert = Database['public']['Tables']['alert_configurations']['Insert'];
type AlertConfigUpdate = Database['public']['Tables']['alert_configurations']['Update'];

export interface AlertConfiguration {
  id: string;
  alert_type: AlertType;
  name: string | null;
  channel: string;
  is_enabled: boolean | null;
  message_template: string | null;
  notify_whatsapp: boolean | null;
  notify_email: boolean | null;
  notify_slack: boolean | null;
  notify_bitrix24_task: boolean | null;
  notify_n8n_webhook: boolean | null;
  whatsapp_numbers: string[] | null;
  email_addresses: string[] | null;
  slack_channels: string[] | null;
  bitrix24_user_ids: number[] | null;
  n8n_webhook_url: string | null;
  min_interval_seconds: number | null;
  dedup_window_seconds: number;
  escalation_enabled: boolean;
  escalation_after_seconds: number;
  escalation_email_addresses: string[] | null;
  escalation_whatsapp_numbers: string[] | null;
  escalation_slack_channels: string[] | null;
  fallback_channel: string | null;
  fallback_recipients: string[] | null;
  conditions: Json | null;
  created_at: string;
  updated_at: string;
}

async function fetchAlertConfigurations(): Promise<AlertConfiguration[]> {
  const { data, error } = await supabase
    .from('alert_configurations')
    .select('*')
    .order('alert_type');

  if (error) throw error;
  return (data || []) as AlertConfiguration[];
}

async function updateAlertConfiguration(
  id: string, 
  updates: Partial<Omit<AlertConfiguration, 'id' | 'created_at' | 'alert_type'>>
): Promise<void> {
  const updateData: AlertConfigUpdate = { 
    ...updates, 
    updated_at: new Date().toISOString() 
  };
  
  const { error } = await supabase
    .from('alert_configurations')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
}

async function createAlertConfiguration(
  config: Omit<AlertConfiguration, 'id' | 'created_at' | 'updated_at'>
): Promise<AlertConfiguration> {
  const insertData: AlertConfigInsert = {
    alert_type: config.alert_type,
    channel: config.channel,
    name: config.name,
    is_enabled: config.is_enabled,
    message_template: config.message_template,
    notify_whatsapp: config.notify_whatsapp,
    notify_email: config.notify_email,
    notify_slack: config.notify_slack,
    notify_bitrix24_task: config.notify_bitrix24_task,
    notify_n8n_webhook: config.notify_n8n_webhook,
    whatsapp_numbers: config.whatsapp_numbers,
    email_addresses: config.email_addresses,
    slack_channels: config.slack_channels,
    bitrix24_user_ids: config.bitrix24_user_ids,
    n8n_webhook_url: config.n8n_webhook_url,
    min_interval_seconds: config.min_interval_seconds,
    dedup_window_seconds: config.dedup_window_seconds,
    escalation_enabled: config.escalation_enabled,
    escalation_after_seconds: config.escalation_after_seconds,
    escalation_email_addresses: config.escalation_email_addresses,
    escalation_whatsapp_numbers: config.escalation_whatsapp_numbers,
    escalation_slack_channels: config.escalation_slack_channels,
    fallback_channel: config.fallback_channel,
    fallback_recipients: config.fallback_recipients,
    conditions: config.conditions,
  };

  const { data, error } = await supabase
    .from('alert_configurations')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as AlertConfiguration;
}

async function deleteAlertConfiguration(id: string): Promise<void> {
  const { error } = await supabase
    .from('alert_configurations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function useAlertConfigurations() {
  return useQuery({
    queryKey: ['alert-configurations'],
    queryFn: fetchAlertConfigurations,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useUpdateAlertConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AlertConfiguration> }) =>
      updateAlertConfiguration(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configurations'] });
      toast.success('Configuração atualizada', {
        description: 'A configuração de alerta foi salva com sucesso.',
      });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar', {
        description: error.message,
      });
    },
  });
}

export function useCreateAlertConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAlertConfiguration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configurations'] });
      toast.success('Configuração criada', {
        description: 'Nova configuração de alerta criada com sucesso.',
      });
    },
    onError: (error) => {
      toast.error('Erro ao criar', {
        description: error.message,
      });
    },
  });
}

export function useDeleteAlertConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAlertConfiguration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configurations'] });
      toast.success('Configuração excluída', {
        description: 'A configuração foi removida com sucesso.',
      });
    },
    onError: (error) => {
      toast.error('Erro ao excluir', {
        description: error.message,
      });
    },
  });
}
