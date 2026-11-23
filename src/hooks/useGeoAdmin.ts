import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type GeoProviderName = 'mapbox' | 'google';

/** Valor gravável em `geo_settings.provider` — inclui `auto` (etapa 64). */
export type GeoSettingProvider = GeoProviderName | 'auto' | 'off';

/** Funções do domínio geo (espelha o CHECK de `geo_settings.function`). */
export type GeoFunction =
  | 'tiles' | 'autocomplete' | 'geocode' | 'reverse' | 'route'
  | 'matrix' | 'static' | 'snap' | 'validate' | 'isochrone' | 'optimization' | 'tilequery';

export interface GeoSettingRow {
  function: GeoFunction;
  provider: GeoSettingProvider;
  fallback_provider: GeoSettingProvider | null;
  config?: Record<string, unknown>;
  updated_at?: string;
}

export interface GeoProviderStatus {
  provider: GeoProviderName;
  configured: boolean;
  implemented: boolean;
  budget: unknown;
}

export interface GeoProviderStatusResponse {
  providers: GeoProviderStatus[];
  settings: GeoSettingRow[];
}

export interface GeoBudgetRow {
  provider: GeoProviderName;
  monthly_limit_usd: number;
  hard_stop: boolean;
  alert_at_pct: number;
  warned_month: string | null;
  updated_at: string;
}

export interface GeoPriceRow {
  provider: string;
  sku: string;
  free_quota_month: number | null;
  unit_cost_per_1000: number;
  note: string | null;
}

export interface GeoUsageMonthRow {
  provider: string;
  function: string;
  sku: string;
  count: number;
  est_cost_usd: number;
}

/** Espelha `geo_budget_status()`: gasto do mês corrente por provedor. */
export interface GeoBudgetStatusRow {
  provider: string;
  spent_usd: number;
  limit_usd: number;
  pct: number | null;
  blocked: boolean;
  warn: boolean;
}

async function fetchProviderStatus(): Promise<GeoProviderStatusResponse> {
  const { data, error } = await supabase.functions.invoke('geo-gateway', {
    body: { action: 'provider-status' },
  });
  if (error) throw error;
  return data as GeoProviderStatusResponse;
}

export function useGeoProviderStatus() {
  return useQuery<GeoProviderStatusResponse>({
    queryKey: ['geo', 'provider-status'],
    queryFn: fetchProviderStatus,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useGeoBudgets() {
  return useQuery<GeoBudgetRow[]>({
    queryKey: ['geo', 'budget'],
    queryFn: async () => {
      const { data, error } = await supabase.from('geo_budget').select('*').order('provider');
      if (error) throw error;
      return (data ?? []) as GeoBudgetRow[];
    },
    retry: false,
  });
}

export function useGeoBudgetStatus() {
  return useQuery<GeoBudgetStatusRow[]>({
    queryKey: ['geo', 'budget-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('geo_budget_status');
      if (error) throw error;
      return (data ?? []) as GeoBudgetStatusRow[];
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useGeoPriceList() {
  return useQuery<GeoPriceRow[]>({
    queryKey: ['geo', 'price-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('geo_price_list').select('*').order('provider').order('sku');
      if (error) throw error;
      return (data ?? []) as GeoPriceRow[];
    },
    retry: false,
  });
}

/**
 * Etapa 90: parametros globais de geofence/notificacao (linha unica de `geo_defaults`).
 * O trigger geo_evaluate_tracking le esta linha quando o pedido nao define override.
 */
export interface GeoDefaultsRow {
  id: boolean;
  approach_radius_m: number;
  approach_eta_min: number;
  arrived_radius_m: number;
  off_route_threshold_m: number;
  notify_delivery_contact: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_tz: string;
  updated_at: string;
  updated_by: string | null;
}

export function useGeoDefaults() {
  return useQuery<GeoDefaultsRow | null>({
    queryKey: ['geo', 'defaults'],
    queryFn: async () => {
      const { data, error } = await supabase.from('geo_defaults').select('*').eq('id', true).maybeSingle();
      if (error) throw error;
      return (data as GeoDefaultsRow | null) ?? null;
    },
    retry: false,
  });
}

export function useUpdateGeoDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Partial<Omit<GeoDefaultsRow, 'id' | 'updated_at' | 'updated_by'>>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('geo_defaults')
        .update({ ...args, updated_by: userData.user?.id ?? null, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['geo', 'defaults'] });
    },
  });
}

export function useGeoUsageMonth() {
  return useQuery<GeoUsageMonthRow[]>({
    queryKey: ['geo', 'usage-month'],
    queryFn: async () => {
      const { data, error } = await supabase.from('geo_usage_month').select('*').order('provider').order('function');
      if (error) throw error;
      return (data ?? []) as GeoUsageMonthRow[];
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export interface GeoLatencyRow {
  provider: string;
  function: string;
  samples: number;
  p50: number;
  p95: number;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = (p / 100) * (sortedAsc.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedAsc[low];
  const weight = rank - low;
  return sortedAsc[low] * (1 - weight) + sortedAsc[high] * weight;
}

/** Agrega linhas de `query_telemetry` em p50/p95 por provedor e função. */
export function aggregateGeoLatency(
  rows: { operation: string | null; rpc_name: string | null; duration_ms: number | null }[],
): GeoLatencyRow[] {
  const groups = new Map<string, { provider: string; fn: string; durations: number[] }>();
  for (const row of rows) {
    if (row.duration_ms == null || !row.operation?.startsWith('geo:')) continue;
    const provider = row.operation.slice(4);
    const fn = row.rpc_name ?? '—';
    const key = `${provider}|${fn}`;
    const g = groups.get(key) ?? { provider, fn, durations: [] };
    g.durations.push(row.duration_ms);
    groups.set(key, g);
  }

  return Array.from(groups.values())
    .map((g) => {
      const sorted = [...g.durations].sort((a, b) => a - b);
      return {
        provider: g.provider,
        function: g.fn,
        samples: sorted.length,
        p50: Math.round(percentile(sorted, 50)),
        p95: Math.round(percentile(sorted, 95)),
      };
    })
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.function.localeCompare(b.function));
}

/** Etapa 80 — latência p50/p95 por provedor e função, a partir de `query_telemetry`. */
export function useGeoLatency(hours = 24) {
  return useQuery<GeoLatencyRow[]>({
    queryKey: ['geo', 'latency', hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 3_600_000).toISOString();
      const { data, error } = await supabase
        .from('query_telemetry')
        .select('operation, rpc_name, duration_ms')
        .eq('table_name', 'geo_gateway')
        .gte('created_at', since)
        .limit(10_000);
      if (error) throw error;
      return aggregateGeoLatency(data ?? []);
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

interface UpdateSettingArgs {
  function: GeoFunction;
  provider: GeoSettingProvider;
  fallback_provider: GeoSettingProvider | null;
}

/**
 * Troca o provedor de uma função geo sem deploy. O trigger `trg_geo_settings_audit`
 * grava o antes/depois em `audit_log` automaticamente.
 */
export function useUpdateGeoSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateSettingArgs) => {
      const { error } = await supabase
        .from('geo_settings')
        .upsert(
          {
            function: args.function,
            provider: args.provider,
            fallback_provider: args.fallback_provider,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'function' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['geo', 'provider-status'] });
    },
  });
}

interface UpdateBudgetArgs {
  provider: GeoProviderName;
  monthly_limit_usd: number;
  hard_stop: boolean;
  alert_at_pct: number;
}
export function useUpdateGeoBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateBudgetArgs) => {
      const { error } = await supabase
        .from('geo_budget')
        .upsert(
          {
            provider: args.provider,
            monthly_limit_usd: args.monthly_limit_usd,
            hard_stop: args.hard_stop,
            alert_at_pct: args.alert_at_pct,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'provider' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['geo', 'budget'] });
      void qc.invalidateQueries({ queryKey: ['geo', 'budget-status'] });
    },
  });
}

/** Detalhe do teste de saúde devolvido pelo `check-external-api` (etapa 67). */
export interface GeoHealthDetails {
  provider: string;
  sku: string;
  address: string;
  http_status: number;
  latency_ms: number;
  rate_limit_remaining: number | null;
  rate_limit_interval: number | null;
}

export interface GeoHealthResult {
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  message: string;
  latency: number;
  details?: GeoHealthDetails;
}

/** Geocoda um endereço fixo no provedor e devolve latência, SKU e rate limit. */
export function useGeoProviderHealth() {
  return useMutation({
    mutationFn: async (provider: GeoProviderName): Promise<GeoHealthResult> => {
      const { data, error } = await supabase.functions.invoke('check-external-api', {
        body: { service: provider },
      });
      if (error) throw error;
      return data as GeoHealthResult;
    },
  });
}