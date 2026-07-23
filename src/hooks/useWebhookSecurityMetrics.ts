import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebhookSecurityBucket {
  hour: string;
  signatureInvalid: number;
  replayRejected: number;
  duplicateIgnored: number;
}

export interface WebhookSecurityMetrics {
  windowHours: number;
  signatureInvalid: number;
  replayRejected: number;
  duplicateIgnored: number;
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  buckets: WebhookSecurityBucket[];
  lastSignatureInvalidAt: string | null;
  lastReplayRejectedAt: string | null;
  lastDuplicateAt: string | null;
}

const SECURITY_EVENT_TYPES = ['SIGNATURE_INVALID', 'REPLAY_REJECTED', 'DUPLICATE_IGNORED'] as const;

async function fetchMetrics(windowHours: number): Promise<WebhookSecurityMetrics> {
  const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('webhook_events')
    .select('event_type, received_at, processed, error_message')
    .gte('received_at', since)
    .order('received_at', { ascending: false })
    .limit(5000);

  if (error) throw error;

  const rows = data ?? [];
  const bucketsMap = new Map<string, WebhookSecurityBucket>();

  let signatureInvalid = 0;
  let replayRejected = 0;
  let duplicateIgnored = 0;
  let totalProcessed = 0;
  let totalFailed = 0;
  let lastSignatureInvalidAt: string | null = null;
  let lastReplayRejectedAt: string | null = null;
  let lastDuplicateAt: string | null = null;

  for (const row of rows) {
    const hourKey = row.received_at.slice(0, 13) + ':00';
    const bucket = bucketsMap.get(hourKey) ?? {
      hour: hourKey,
      signatureInvalid: 0,
      replayRejected: 0,
      duplicateIgnored: 0,
    };

    switch (row.event_type) {
      case 'SIGNATURE_INVALID':
        signatureInvalid++;
        bucket.signatureInvalid++;
        lastSignatureInvalidAt ??= row.received_at;
        break;
      case 'REPLAY_REJECTED':
        replayRejected++;
        bucket.replayRejected++;
        lastReplayRejectedAt ??= row.received_at;
        break;
      case 'DUPLICATE_IGNORED':
        duplicateIgnored++;
        bucket.duplicateIgnored++;
        lastDuplicateAt ??= row.received_at;
        break;
      default:
        if (row.processed) totalProcessed++;
        if (row.error_message) totalFailed++;
    }

    bucketsMap.set(hourKey, bucket);
  }

  const buckets = Array.from(bucketsMap.values()).sort((a, b) =>
    a.hour.localeCompare(b.hour)
  );

  return {
    windowHours,
    signatureInvalid,
    replayRejected,
    duplicateIgnored,
    totalReceived: rows.length,
    totalProcessed,
    totalFailed,
    buckets,
    lastSignatureInvalidAt,
    lastReplayRejectedAt,
    lastDuplicateAt,
  };
}

export function useWebhookSecurityMetrics(windowHours = 24) {
  return useQuery({
    queryKey: ['webhook-security-metrics', windowHours],
    queryFn: () => fetchMetrics(windowHours),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export { SECURITY_EVENT_TYPES };
