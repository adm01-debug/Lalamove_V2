/**
 * Hook do painel de mensageria ao motorista (plano M1-M12).
 *
 * Le e escreve as tabelas do motor (`messaging_settings`, `notification_routes`,
 * `message_templates`, `notification_optouts`) e le o ledger
 * (`notification_messages`) + consumo (`messaging_usage`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type MessagingSettingsRow = Tables['messaging_settings']['Row'];
export type NotificationRouteRow = Tables['notification_routes']['Row'];
export type MessageTemplateRow = Tables['message_templates']['Row'];
export type NotificationMessageRow = Tables['notification_messages']['Row'];
export type MessagingUsageRow = Tables['messaging_usage']['Row'];
export type NotificationOptoutRow = Tables['notification_optouts']['Row'];

export const WHATSAPP_PROVIDERS = ['zapp', 'evolution', 'off'] as const;
export const SMS_PROVIDERS = ['none', 'zenvia', 'comtele', 'twilio'] as const;

export type WhatsappProvider = (typeof WHATSAPP_PROVIDERS)[number];
export type SmsProvider = (typeof SMS_PROVIDERS)[number];

export const MESSAGING_ROLES = [
  'driver',
  'operator',
  'manager',
  'admin',
  'customer',
  'guardian',
] as const;
export type MessagingRole = (typeof MESSAGING_ROLES)[number];

const SETTINGS_KEY = ['messaging', 'settings'] as const;
const ROUTES_KEY = ['messaging', 'routes'] as const;
const TEMPLATES_KEY = ['messaging', 'templates'] as const;
const OPTOUTS_KEY = ['messaging', 'optouts'] as const;
const USAGE_KEY = ['messaging', 'usage'] as const;
const LEDGER_KEY = ['messaging', 'ledger'] as const;

function invalidate(client: ReturnType<typeof useQueryClient>, keys: readonly (readonly string[])[]) {
  keys.forEach((queryKey) => client.invalidateQueries({ queryKey }));
}

/** Configuracao unica do motor (linha com `id = true`). */
export function useMessagingSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<MessagingSettingsRow | null> => {
      const { data, error } = await supabase
        .from('messaging_settings')
        .select('*')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

export function useUpdateMessagingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          MessagingSettingsRow,
          | 'whatsapp_provider'
          | 'sms_provider'
          | 'sms_fallback_after_min'
          | 'monthly_budget_cents'
          | 'shadow_mode'
          | 'pilot_mode'
        >
      >,
    ) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('messaging_settings')
        .update({
          ...patch,
          updated_by: auth.user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', true)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(queryClient, [SETTINGS_KEY]),
  });
}

/** Consumo do mes (RPC `messaging_month_cost_cents`) + historico diario. */
export function useMessagingUsage() {
  return useQuery({
    queryKey: USAGE_KEY,
    queryFn: async () => {
      const [costResult, usageResult] = await Promise.all([
        supabase.rpc('messaging_month_cost_cents'),
        supabase
          .from('messaging_usage')
          .select('*')
          .order('day', { ascending: false })
          .limit(60),
      ]);
      if (costResult.error) throw costResult.error;
      if (usageResult.error) throw usageResult.error;
      return {
        monthCostCents: Number(costResult.data ?? 0),
        rows: (usageResult.data ?? []) as MessagingUsageRow[],
      };
    },
    staleTime: 60_000,
  });
}

export function useNotificationRoutes() {
  return useQuery({
    queryKey: ROUTES_KEY,
    queryFn: async (): Promise<NotificationRouteRow[]> => {
      const { data, error } = await supabase
        .from('notification_routes')
        .select('*')
        .order('event', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

export function useUpdateNotificationRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      event: string;
      patch: Partial<
        Pick<
          NotificationRouteRow,
          'channels' | 'fallback_after_min' | 'requires_reply' | 'reply_timeout_min' | 'is_enabled'
        >
      >;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('notification_routes')
        .update({ ...input.patch, updated_by: auth.user?.id ?? null, updated_at: new Date().toISOString() })
        .eq('event', input.event)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(queryClient, [ROUTES_KEY]),
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async (): Promise<MessageTemplateRow[]> => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('event', { ascending: true })
        .order('channel', { ascending: true })
        .order('version', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/**
 * Salva o texto como nova versao: insere `version + 1` ativa e desativa as
 * anteriores do mesmo evento/canal/papel. Nunca sobrescreve o historico.
 */
export function useSaveTemplateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      template: MessageTemplateRow;
      body: string;
    }) => {
      const { template, body } = input;
      const { data: versions, error: versionError } = await supabase
        .from('message_templates')
        .select('version')
        .eq('key', template.key)
        .eq('channel', template.channel)
        .order('version', { ascending: false })
        .limit(1);
      if (versionError) throw versionError;

      const nextVersion = (versions?.[0]?.version ?? template.version) + 1;
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('message_templates')
        .insert({
          key: template.key,
          event: template.event,
          role: template.role,
          channel: template.channel,
          version: nextVersion,
          body,
          variables: template.variables,
          max_length: template.max_length,
          is_active: true,
          updated_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: deactivateError } = await supabase
        .from('message_templates')
        .update({ is_active: false })
        .eq('key', template.key)
        .eq('channel', template.channel)
        .neq('id', data.id);
      if (deactivateError) throw deactivateError;

      return data;
    },
    onSuccess: () => invalidate(queryClient, [TEMPLATES_KEY]),
  });
}

export function useNotificationOptouts() {
  return useQuery({
    queryKey: OPTOUTS_KEY,
    queryFn: async (): Promise<NotificationOptoutRow[]> => {
      const { data, error } = await supabase
        .from('notification_optouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/** Normaliza para os digitos do telefone (mesma chave usada por `is_phone_opted_out`). */
export function normalizeOptoutPhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function useAddNotificationOptout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { phone: string; reason?: string | null }) => {
      const phone = normalizeOptoutPhone(input.phone);
      if (phone.length < 10) throw new Error('Telefone incompleto');
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('notification_optouts')
        .upsert(
          { phone, reason: input.reason?.trim() || 'nao informado', created_by: auth.user?.id ?? null },
          { onConflict: 'phone' },
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(queryClient, [OPTOUTS_KEY]),
  });
}

export function useRemoveNotificationOptout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.from('notification_optouts').delete().eq('phone', phone);
      if (error) throw error;
    },
    onSuccess: () => invalidate(queryClient, [OPTOUTS_KEY]),
  });
}

export const LEDGER_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'suppressed',
  'expired',
] as const;

/** Ledger do motor: uma linha por tentativa de mensagem (etapa 96). */
export function useNotificationLedger(status: string, limit = 100) {
  return useQuery({
    queryKey: [...LEDGER_KEY, status, limit],
    queryFn: async (): Promise<NotificationMessageRow[]> => {
      let request = supabase
        .from('notification_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status !== 'all') request = request.eq('status', status);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });
}

/** Resultado do botao "enviar teste" (edge test-notification). */
export interface TestMessageResult {
  success: boolean;
  message: string;
}

/**
 * Dispara o teste de WhatsApp pelo mesmo caminho do motor (Zapp -> Evolution,
 * ver `_shared/channels/whatsapp-test.ts`). A edge devolve 200 mesmo quando o
 * provedor recusa, para o operador ler o motivo; so falha de transporte vira
 * erro de mutation.
 */
export function useSendTestWhatsApp() {
  return useMutation({
    mutationFn: async (input: { phone: string; alertType?: string }): Promise<TestMessageResult> => {
      const { data, error } = await supabase.functions.invoke('test-notification', {
        body: {
          channel: 'whatsapp',
          alertType: input.alertType ?? 'TESTE_PAINEL',
          recipients: [input.phone],
        },
      });
      if (error) throw new Error(error.message || 'Falha ao chamar test-notification');
      const result = data as TestMessageResult | null;
      if (!result || typeof result.success !== 'boolean') {
        throw new Error('Resposta invalida de test-notification');
      }
      return result;
    },
  });
}

/** Segmentos SMS: 160 caracteres por segmento (etapa dos templates SMS). */
export function smsSegments(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 160);
}

/** Substitui `{{variavel}}` por valores de exemplo para a previa. */
export function renderPreview(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}