import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookEvent {
  id: string;
  event_type: string;
  lalamove_order_id: string | null;
  raw_payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  received_at: string;
}

interface WebhookFilters {
  eventType?: string;
  processed?: boolean | null;
  orderId?: string;
  startDate?: string;
  endDate?: string;
}

async function fetchWebhookEvents(filters: WebhookFilters): Promise<WebhookEvent[]> {
  let query = supabase
    .from('webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(100);

  if (filters.eventType && filters.eventType !== 'ALL') {
    query = query.eq('event_type', filters.eventType);
  }

  if (filters.processed !== null && filters.processed !== undefined) {
    query = query.eq('processed', filters.processed);
  }

  if (filters.orderId) {
    query = query.ilike('lalamove_order_id', `%${filters.orderId}%`);
  }

  if (filters.startDate) {
    query = query.gte('received_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('received_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as WebhookEvent[];
}

async function reprocessWebhook(id: string): Promise<void> {
  // Mark as unprocessed to trigger reprocessing
  const { error } = await supabase
    .from('webhook_events')
    .update({ 
      processed: false, 
      processed_at: null,
      error_message: null 
    })
    .eq('id', id);

  if (error) throw error;
}

async function markAsProcessed(id: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .update({ 
      processed: true, 
      processed_at: new Date().toISOString() 
    })
    .eq('id', id);

  if (error) throw error;
}

async function deleteWebhook(id: string): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

async function fetchEventTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('event_type')
    .order('event_type');

  if (error) throw error;
  
  const types = [...new Set((data || []).map(d => d.event_type))];
  return types;
}

export function useWebhookEvents(filters: WebhookFilters) {
  return useQuery({
    queryKey: ['webhook-events', filters],
    queryFn: () => fetchWebhookEvents(filters),
    refetchInterval: 30000,
  });
}

export function useEventTypes() {
  return useQuery({
    queryKey: ['webhook-event-types'],
    queryFn: fetchEventTypes,
  });
}

export function useReprocessWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: reprocessWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-events'] });
    },
  });
}

export function useMarkWebhookProcessed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: markAsProcessed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-events'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-events'] });
    },
  });
}
