import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationSent {
  id: string;
  alert_id: string | null;
  channel: string;
  recipient: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  retry_count: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  alert?: {
    id: string;
    title: string;
    type: string;
    severity: string;
    message: string;
  };
}

interface NotificationFilters {
  channel?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

const HISTORY_LIMIT = 200;

const LEDGER_SELECT = `
  id,
  alert_id,
  channel,
  recipient_phone,
  status,
  sent_at,
  delivered_at,
  error_code,
  attempt,
  event,
  role,
  provider,
  template_key,
  body_preview,
  direction,
  created_at,
  alert:alerts(id, title, type, severity, message)
`;

/** Linha crua de `notification_messages` (ledger do motor de mensageria). */
export interface NotificationLedgerRow {
  id: string;
  alert_id: string | null;
  channel: string;
  recipient_phone: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_code: string | null;
  attempt: number | null;
  event: string | null;
  role: string | null;
  provider: string | null;
  template_key: string | null;
  body_preview: string | null;
  direction: string | null;
  created_at: string;
  alert: NotificationSent['alert'] | null;
}

/**
 * Etapa 138 do plano de mensageria: a timeline passa a ler o ledger
 * (`notification_messages`), que tem evento, papel, provedor, tentativa e corpo.
 * `alerts_sent` continua aparecendo como legado ? as duas fontes sao unidas e
 * ordenadas por data, entao nada do que ja foi despachado some da tela.
 */
export function mapLedgerRow(row: NotificationLedgerRow): NotificationSent {
  return {
    id: row.id,
    alert_id: row.alert_id,
    channel: row.channel,
    recipient: row.recipient_phone ?? '',
    status: row.status,
    sent_at: row.sent_at,
    delivered_at: row.delivered_at,
    error_message: row.error_code,
    retry_count: Math.max(0, (row.attempt ?? 1) - 1),
    metadata: {
      event: row.event,
      role: row.role,
      provider: row.provider,
      template_key: row.template_key,
      body_preview: row.body_preview,
      direction: row.direction,
    },
    created_at: row.created_at,
    alert: row.alert ?? undefined,
  };
}

async function fetchLedger(filters: NotificationFilters): Promise<NotificationSent[]> {
  let query = supabase
    .from('notification_messages')
    .select(LEDGER_SELECT)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (filters.channel && filters.channel !== 'ALL') {
    query = query.eq('channel', filters.channel);
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as unknown as NotificationLedgerRow[]).map(mapLedgerRow);
}

async function fetchLegacy(filters: NotificationFilters): Promise<NotificationSent[]> {
  let query = supabase
    .from('alerts_sent')
    .select(`
      *,
      alert:alerts(id, title, type, severity, message)
    `)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (filters.channel && filters.channel !== 'ALL') {
    query = query.eq('channel', filters.channel);
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as unknown as NotificationSent[];
}

async function fetchNotificationHistory(filters: NotificationFilters): Promise<NotificationSent[]> {
  const [ledger, legacy] = await Promise.all([fetchLedger(filters), fetchLegacy(filters)]);

  return [...ledger, ...legacy]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, HISTORY_LIMIT);
}

/**
 * Contagens da tela. Le as duas fontes com o mesmo criterio dos cards:
 * `read` conta como entregue, `expired`/`uncertain`/`suppressed` como falha.
 */
export function summarizeNotificationStatus(rows: { status: string | null }[]) {
  const stats = {
    total: rows.length,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
  };

  for (const row of rows) {
    switch (row.status) {
      case 'sent':
        stats.sent += 1;
        break;
      case 'delivered':
      case 'read':
        stats.delivered += 1;
        break;
      case 'failed':
      case 'expired':
      case 'uncertain':
      case 'suppressed':
        stats.failed += 1;
        break;
      case 'pending':
      case 'queued':
        stats.pending += 1;
        break;
      default:
        break;
    }
  }

  return stats;
}

async function fetchNotificationStats() {
  const [ledger, legacy] = await Promise.all([
    supabase.from('notification_messages').select('channel, status').limit(5000),
    supabase.from('alerts_sent').select('channel, status'),
  ]);

  if (ledger.error) throw ledger.error;
  if (legacy.error) throw legacy.error;

  const rows = [...(ledger.data ?? []), ...(legacy.data ?? [])] as {
    channel: string | null;
    status: string | null;
  }[];

  const stats = { ...summarizeNotificationStatus(rows), byChannel: {} as Record<string, number> };

  for (const row of rows) {
    if (!row.channel) continue;
    stats.byChannel[row.channel] = (stats.byChannel[row.channel] || 0) + 1;
  }

  return stats;
}

export function useNotificationHistory(filters: NotificationFilters) {
  return useQuery({
    queryKey: ['notification-history', filters],
    queryFn: () => fetchNotificationHistory(filters),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: ['notification-stats'],
    queryFn: fetchNotificationStats,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
}
/**
 * Etapa 73 do plano Google Maps: eventos geo que **não** viraram mensagem.
 *
 * `alerts_sent` só registra o que foi efetivamente despachado — enquanto o aviso
 * está na fila (`queued`), fora da janela de silêncio (`deferred`) ou o pedido não
 * tinha destinatário válido (`no_recipient`), não existe linha lá. Esses três são
 * justamente os casos em que o operador precisa agir, então o histórico da página
 * `alerts_sent` sozinho mostrava tudo "verde" enquanto o cliente não recebia nada.
 */
export interface GeoEventPending {
  id: string;
  order_id: string;
  event_type: string;
  stop_index: number;
  triggered_at: string;
  distance_m: number | null;
  eta_min: number | null;
  notification_status: string;
  notified_at: string | null;
}

const ACTIONABLE_GEO_STATUSES = ['queued', 'deferred', 'no_recipient', 'failed'] as const;

async function fetchPendingGeoEvents(orderId?: string): Promise<GeoEventPending[]> {
  let query = supabase
    .from('order_geo_events')
    .select('id, order_id, event_type, stop_index, triggered_at, distance_m, eta_min, notification_status, notified_at')
    .in('notification_status', ACTIONABLE_GEO_STATUSES as unknown as string[])
    .order('triggered_at', { ascending: false })
    .limit(100);

  if (orderId) {
    query = query.eq('order_id', orderId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as GeoEventPending[];
}

export function usePendingGeoEvents(orderId?: string) {
  return useQuery({
    queryKey: ['pending-geo-events', orderId ?? 'all'],
    queryFn: () => fetchPendingGeoEvents(orderId),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
}
