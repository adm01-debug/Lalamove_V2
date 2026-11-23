import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RateLimitRow {
  id: string;
  endpoint: string;
  method: string;
  status: number;
  attempts: number;
  limit_total: number | null;
  limit_remaining: number | null;
  limit_reset_at: string | null;
  usage_ratio: number | null;
  request_id: string | null;
  created_at: string;
}

export interface EndpointStat {
  endpoint: string;
  method: string;
  calls: number;
  errors: number;
  avgUsageRatio: number;
  minRemaining: number | null;
  lastCall: string;
}

export interface QuotaSummary {
  totalCalls: number;
  criticalCalls: number;
  errorCalls: number;
  currentRemaining: number | null;
  currentLimit: number | null;
  latestResetAt: string | null;
}

interface UseLalamoveQuotaResult {
  rows: RateLimitRow[];
  summary: QuotaSummary;
  endpoints: EndpointStat[];
  timeline: Array<{ time: string; usage: number; remaining: number | null }>;
  isLoading: boolean;
  error: Error | null;
}

const HOURS_LOOKBACK = 24;

export function useLalamoveQuota(): UseLalamoveQuotaResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['lalamove-quota', HOURS_LOOKBACK],
    queryFn: async (): Promise<RateLimitRow[]> => {
      const since = new Date(Date.now() - HOURS_LOOKBACK * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('lalamove_rate_limits')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as RateLimitRow[];
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });

  const rows = data ?? [];

  const summary: QuotaSummary = (() => {
    const totalCalls = rows.length;
    const criticalCalls = rows.filter(
      (r) => r.limit_remaining !== null && r.limit_remaining <= 10,
    ).length;
    const errorCalls = rows.filter((r) => r.status >= 400).length;
    const latest = rows[0];
    return {
      totalCalls,
      criticalCalls,
      errorCalls,
      currentRemaining: latest?.limit_remaining ?? null,
      currentLimit: latest?.limit_total ?? null,
      latestResetAt: latest?.limit_reset_at ?? null,
    };
  })();

  const endpoints: EndpointStat[] = (() => {
    const grouped = new Map<string, RateLimitRow[]>();
    for (const r of rows) {
      const key = `${r.method} ${r.endpoint}`;
      const list = grouped.get(key) ?? [];
      list.push(r);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries())
      .map(([key, list]) => {
        const [method, endpoint] = key.split(' ');
        const ratios = list
          .map((r) => r.usage_ratio)
          .filter((r): r is number => r !== null);
        const remainings = list
          .map((r) => r.limit_remaining)
          .filter((r): r is number => r !== null);
        return {
          endpoint,
          method,
          calls: list.length,
          errors: list.filter((r) => r.status >= 400).length,
          avgUsageRatio: ratios.length
            ? Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(1))
            : 0,
          minRemaining: remainings.length ? Math.min(...remainings) : null,
          lastCall: list[0].created_at,
        };
      })
      .sort((a, b) => b.calls - a.calls);
  })();

  const timeline = (() => {
    // Bucket por hora (últimas 24h)
    const buckets = new Map<string, { usages: number[]; remainings: number[] }>();
    for (const r of rows) {
      const bucket = new Date(r.created_at);
      bucket.setMinutes(0, 0, 0);
      const key = bucket.toISOString();
      const entry = buckets.get(key) ?? { usages: [], remainings: [] };
      if (r.usage_ratio !== null) entry.usages.push(r.usage_ratio);
      if (r.limit_remaining !== null) entry.remainings.push(r.limit_remaining);
      buckets.set(key, entry);
    }
    return Array.from(buckets.entries())
      .map(([time, { usages, remainings }]) => ({
        time,
        usage: usages.length
          ? Number((usages.reduce((a, b) => a + b, 0) / usages.length).toFixed(1))
          : 0,
        remaining: remainings.length ? Math.min(...remainings) : null,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  })();

  return {
    rows,
    summary,
    endpoints,
    timeline,
    isLoading,
    error: (error as Error) ?? null,
  };
}
