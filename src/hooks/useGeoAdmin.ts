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

export function useGeoUsageMonth() {
  return useQuery<GeoUsageMonthRow[]>({
    queryKey: ['geo', 'usage-month'],
    queryFn: async () => {
      const { data, error } = await supabase.from('geo_usage_month').select('*').order('provider').order('function');
      if (error) throw error;
      return (data ?? []) as GeoUsageMonthRow[];
    },
    refetchInterval: 120_000,
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