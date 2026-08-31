import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * SLO (Service Level Objective) metrics para o sistema de entregas.
 *
 * Fontes de dados reais:
 *  - query_telemetry   → volume de requisições, latência (duration_ms) e severidade.
 *  - runtime_error_logs → falhas de frontend (occurrence_count).
 *  - webhook_events     → falhas de ingestão de webhooks (não processados / com erro).
 *
 * Definições de SLO (targets) — ajustáveis em SLO_TARGETS:
 *  - Disponibilidade: 99.9%  (razão de requisições bem-sucedidas)
 *  - Latência p95:    500ms  (percentil 95 das operações de banco/telemetria)
 *  - Taxa de falhas:  1%     (proporção de requisições com erro)
 */

export type SLOWindow = '1h' | '24h' | '7d' | '30d';

export const SLO_TARGETS = {
  /** Disponibilidade alvo em % (ex.: 99.9) */
  availability: 99.9,
  /** Latência p95 alvo em ms */
  latencyP95Ms: 500,
  /** Taxa de falhas máxima aceitável em % */
  failureRate: 1,
} as const;

const WINDOW_TO_MS: Record<SLOWindow, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const WINDOW_LABELS: Record<SLOWindow, string> = {
  '1h': 'Última hora',
  '24h': 'Últimas 24h',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
};

export type SLOStatus = 'healthy' | 'at_risk' | 'breached';

export interface SLOIndicator {
  /** Valor observado (unidade depende do indicador) */
  value: number;
  /** Target/objetivo configurado */
  target: number;
  /** Situação em relação ao SLO */
  status: SLOStatus;
  /** Orçamento de erro consumido em % (0-100+) */
  errorBudgetConsumed: number;
  /** Orçamento de erro restante em % (0-100) */
  errorBudgetRemaining: number;
}

export interface SLOTimePoint {
  /** Rótulo do bucket (ex.: "14h" ou "12/07") */
  label: string;
  /** Início do bucket (ISO) */
  timestamp: string;
  requests: number;
  failures: number;
  availability: number;
  avgLatency: number;
}

export interface SLOMetrics {
  window: SLOWindow;
  totalRequests: number;
  totalFailures: number;
  availability: SLOIndicator;
  latencyP95: SLOIndicator;
  failureRate: SLOIndicator;
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
  };
  failureSources: {
    databaseErrors: number;
    frontendErrors: number;
    webhookErrors: number;
  };
  timeline: SLOTimePoint[];
  generatedAt: string;
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

function classify(
  value: number,
  target: number,
  higherIsBetter: boolean,
): SLOStatus {
  if (higherIsBetter) {
    if (value >= target) return 'healthy';
    // Dentro de 0,1% do alvo ainda é "em risco"
    if (value >= target - 0.1) return 'at_risk';
    return 'breached';
  }
  if (value <= target) return 'healthy';
  if (value <= target * 1.25) return 'at_risk';
  return 'breached';
}

function bucketConfig(windowMs: number): { count: number; sizeMs: number; fmt: (d: Date) => string } {
  const hour = 60 * 60 * 1000;
  if (windowMs <= hour) {
    return { count: 12, sizeMs: hour / 12, fmt: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` };
  }
  if (windowMs <= 24 * hour) {
    return { count: 24, sizeMs: hour, fmt: (d) => `${d.getHours()}h` };
  }
  if (windowMs <= 7 * 24 * hour) {
    return { count: 7, sizeMs: 24 * hour, fmt: (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
  }
  return { count: 30, sizeMs: 24 * hour, fmt: (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
}

interface TelemetryRow {
  duration_ms: number | null;
  severity: string | null;
  error_message: string | null;
  created_at: string;
}

interface ErrorRow {
  occurrence_count: number | null;
  created_at: string;
}

interface WebhookRow {
  processed: boolean | null;
  error_message: string | null;
  received_at: string;
}

async function fetchSLOMetrics(window: SLOWindow): Promise<SLOMetrics> {
  const windowMs = WINDOW_TO_MS[window];
  const now = Date.now();
  const since = new Date(now - windowMs).toISOString();

  const [telemetryRes, errorsRes, webhooksRes] = await Promise.all([
    supabase
      .from('query_telemetry')
      .select('duration_ms, severity, error_message, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000),
    supabase
      .from('runtime_error_logs')
      .select('occurrence_count, created_at')
      .gte('created_at', since)
      .limit(10000),
    supabase
      .from('webhook_events')
      .select('processed, error_message, received_at')
      .gte('received_at', since)
      .limit(10000),
  ]);

  if (telemetryRes.error) throw telemetryRes.error;
  if (errorsRes.error) throw errorsRes.error;
  if (webhooksRes.error) throw webhooksRes.error;

  const telemetry = (telemetryRes.data ?? []) as TelemetryRow[];
  const errors = (errorsRes.data ?? []) as ErrorRow[];
  const webhooks = (webhooksRes.data ?? []) as WebhookRow[];

  const isDbFailure = (r: TelemetryRow) =>
    r.error_message != null ||
    (r.severity != null && ['error', 'critical', 'fatal'].includes(r.severity.toLowerCase()));

  const databaseErrors = telemetry.filter(isDbFailure).length;
  const frontendErrors = errors.reduce((sum, e) => sum + (e.occurrence_count ?? 1), 0);
  const webhookErrors = webhooks.filter((w) => w.processed === false || w.error_message != null).length;

  const totalRequests = telemetry.length + webhooks.length;
  const totalFailures = databaseErrors + webhookErrors + frontendErrors;

  // Latência (apenas operações com duração medida)
  const durations = telemetry
    .map((r) => r.duration_ms)
    .filter((d): d is number => typeof d === 'number' && d >= 0)
    .sort((a, b) => a - b);

  const latency = {
    p50: Math.round(percentile(durations, 50)),
    p90: Math.round(percentile(durations, 90)),
    p95: Math.round(percentile(durations, 95)),
    p99: Math.round(percentile(durations, 99)),
    avg: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0,
    max: durations.length ? durations[durations.length - 1] : 0,
  };

  const availabilityValue =
    totalRequests > 0 ? ((totalRequests - totalFailures) / totalRequests) * 100 : 100;
  const failureRateValue = totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0;

  // Orçamento de erro: quanto do "budget" (1 - target) já foi consumido.
  const availBudget = 100 - SLO_TARGETS.availability; // ex.: 0.1%
  const availConsumed = availBudget > 0 ? Math.min((failureRateValue / availBudget) * 100, 999) : 0;

  const failBudget = SLO_TARGETS.failureRate;
  const failConsumed = failBudget > 0 ? Math.min((failureRateValue / failBudget) * 100, 999) : 0;

  const latBudget = SLO_TARGETS.latencyP95Ms;
  const latConsumed = latBudget > 0 ? Math.min((latency.p95 / latBudget) * 100, 999) : 0;

  const availability: SLOIndicator = {
    value: Math.round(availabilityValue * 1000) / 1000,
    target: SLO_TARGETS.availability,
    status: classify(availabilityValue, SLO_TARGETS.availability, true),
    errorBudgetConsumed: Math.round(availConsumed * 10) / 10,
    errorBudgetRemaining: Math.max(0, Math.round((100 - availConsumed) * 10) / 10),
  };

  const failureRate: SLOIndicator = {
    value: Math.round(failureRateValue * 1000) / 1000,
    target: SLO_TARGETS.failureRate,
    status: classify(failureRateValue, SLO_TARGETS.failureRate, false),
    errorBudgetConsumed: Math.round(failConsumed * 10) / 10,
    errorBudgetRemaining: Math.max(0, Math.round((100 - failConsumed) * 10) / 10),
  };

  const latencyP95: SLOIndicator = {
    value: latency.p95,
    target: SLO_TARGETS.latencyP95Ms,
    status: classify(latency.p95, SLO_TARGETS.latencyP95Ms, false),
    errorBudgetConsumed: Math.round(latConsumed * 10) / 10,
    errorBudgetRemaining: Math.max(0, Math.round((100 - latConsumed) * 10) / 10),
  };

  // Timeline agregada por buckets
  const { count, sizeMs, fmt } = bucketConfig(windowMs);
  const start = now - windowMs;
  const buckets: SLOTimePoint[] = Array.from({ length: count }, (_, i) => {
    const bStart = start + i * sizeMs;
    return {
      label: fmt(new Date(bStart)),
      timestamp: new Date(bStart).toISOString(),
      requests: 0,
      failures: 0,
      availability: 100,
      avgLatency: 0,
    };
  });
  const latencySum = new Array(count).fill(0);
  const latencyCount = new Array(count).fill(0);

  const idxOf = (t: number) => {
    const i = Math.floor((t - start) / sizeMs);
    return i < 0 ? 0 : i >= count ? count - 1 : i;
  };

  for (const r of telemetry) {
    const i = idxOf(new Date(r.created_at).getTime());
    buckets[i].requests += 1;
    if (isDbFailure(r)) buckets[i].failures += 1;
    if (typeof r.duration_ms === 'number' && r.duration_ms >= 0) {
      latencySum[i] += r.duration_ms;
      latencyCount[i] += 1;
    }
  }
  for (const w of webhooks) {
    const i = idxOf(new Date(w.received_at).getTime());
    buckets[i].requests += 1;
    if (w.processed === false || w.error_message != null) buckets[i].failures += 1;
  }

  for (let i = 0; i < count; i++) {
    buckets[i].availability =
      buckets[i].requests > 0
        ? Math.round(((buckets[i].requests - buckets[i].failures) / buckets[i].requests) * 1000) / 10
        : 100;
    buckets[i].avgLatency = latencyCount[i] > 0 ? Math.round(latencySum[i] / latencyCount[i]) : 0;
  }

  return {
    window,
    totalRequests,
    totalFailures,
    availability,
    latencyP95,
    failureRate,
    latency,
    failureSources: { databaseErrors, frontendErrors, webhookErrors },
    timeline: buckets,
    generatedAt: new Date().toISOString(),
  };
}

export function useSLOMetrics(window: SLOWindow = '24h', refetchInterval = 30000) {
  return useQuery({
    queryKey: ['slo-metrics', window],
    queryFn: () => fetchSLOMetrics(window),
    refetchInterval,
    staleTime: refetchInterval / 2,
  });
}
