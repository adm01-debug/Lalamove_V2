import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractUsageRow {
  contract_name: string;
  contract_version: string;
  deprecated: boolean;
  usage_date: string;
  request_count: number;
  last_seen_at: string;
}

export interface ContractUsageDailyPoint {
  date: string;
  total: number;
  v1: number;
  v2: number;
  /** Proporção de chamadas em v1 (0–100). */
  v1Ratio: number;
}

/**
 * Análise de tendência da proporção de v1 — insumo para o alerta automático de
 * reversão (v1 "voltando a subir"), sinal de regressão na migração.
 */
export interface ContractUsageTrend {
  /** Verdadeiro quando a proporção de v1 está em alta relevante. */
  rising: boolean;
  /** Delta (p.p.) entre a média da 2ª metade e da 1ª metade do período. */
  delta: number;
  /** Delta (p.p.) entre a média dos últimos 3 dias e os 3 anteriores. */
  recentDelta: number;
  /** Média de v1Ratio na 1ª metade do período. */
  firstHalfAvg: number;
  /** Média de v1Ratio na 2ª metade do período. */
  secondHalfAvg: number;
  /** Amostra insuficiente para avaliar tendência (<4 pontos válidos). */
  insufficientData: boolean;
}

export interface ContractUsageSummary {
  points: ContractUsageDailyPoint[];
  totalRequests: number;
  totalV1: number;
  /** Proporção global de v1 no período (0–100). */
  overallV1Ratio: number;
  /** Data/hora da última chamada em v1, se houver. */
  lastV1Seen: string | null;
  /** Contratos que ainda receberam chamadas em v1 no período. */
  contractsUsingV1: string[];
  /** Tendência da proporção de v1 (alerta de reversão). */
  trend: ContractUsageTrend;
}

/** Limiar (p.p.) a partir do qual uma alta é considerada relevante. */
const TREND_RISE_THRESHOLD = 0.5;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Detecta reversão de tendência na proporção de v1 comparando metades do
 * período e a janela recente (últimos 3 vs 3 anteriores). Ignora pontos com
 * valores não finitos para robustez contra dados parciais.
 */
function detectTrend(points: ContractUsageDailyPoint[]): ContractUsageTrend {
  const valid = points.filter((p) => Number.isFinite(p.v1Ratio));
  if (valid.length < 4) {
    return {
      rising: false,
      delta: 0,
      recentDelta: 0,
      firstHalfAvg: 0,
      secondHalfAvg: 0,
      insufficientData: true,
    };
  }
  const avg = (arr: ContractUsageDailyPoint[]) =>
    arr.reduce((sum, p) => sum + p.v1Ratio, 0) / Math.max(arr.length, 1);
  const mid = Math.floor(valid.length / 2);
  const firstHalfAvg = round1(avg(valid.slice(0, mid)));
  const secondHalfAvg = round1(avg(valid.slice(mid)));
  const delta = round1(secondHalfAvg - firstHalfAvg);
  const recentDelta = round1(avg(valid.slice(-3)) - avg(valid.slice(-6, -3)));
  return {
    rising: delta > TREND_RISE_THRESHOLD || recentDelta > TREND_RISE_THRESHOLD,
    delta,
    recentDelta,
    firstHalfAvg,
    secondHalfAvg,
    insufficientData: false,
  };
}

function buildSummary(rows: ContractUsageRow[]): ContractUsageSummary {
  const byDate = new Map<string, ContractUsageDailyPoint>();
  let totalRequests = 0;
  let totalV1 = 0;
  let lastV1Seen: string | null = null;
  const contractsUsingV1 = new Set<string>();

  for (const row of rows) {
    const point = byDate.get(row.usage_date) ?? {
      date: row.usage_date,
      total: 0,
      v1: 0,
      v2: 0,
      v1Ratio: 0,
    };
    point.total += row.request_count;
    if (row.contract_version === "v1") {
      point.v1 += row.request_count;
      totalV1 += row.request_count;
      contractsUsingV1.add(row.contract_name);
      if (!lastV1Seen || row.last_seen_at > lastV1Seen) {
        lastV1Seen = row.last_seen_at;
      }
    } else if (row.contract_version === "v2") {
      point.v2 += row.request_count;
    }
    totalRequests += row.request_count;
    byDate.set(row.usage_date, point);
  }

  const points = Array.from(byDate.values())
    .map((p) => ({
      ...p,
      v1Ratio: p.total > 0 ? Math.round((p.v1 / p.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    points,
    totalRequests,
    totalV1,
    overallV1Ratio:
      totalRequests > 0 ? Math.round((totalV1 / totalRequests) * 1000) / 10 : 0,
    lastV1Seen,
    contractsUsingV1: Array.from(contractsUsingV1).sort(),
    trend: detectTrend(points),
  };
}

/**
 * Telemetria de uso de versões de contrato (deprecação).
 * Agrega os registros diários da tabela `contract_version_usage` numa série
 * temporal com a proporção de chamadas em `v1` — insumo para decidir a data
 * efetiva de remoção da versão descontinuada.
 */
export function useContractVersionUsage(days = 30) {
  return useQuery({
    queryKey: ["contract-version-usage", days],
    queryFn: async (): Promise<ContractUsageSummary> => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceDate = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("contract_version_usage")
        .select(
          "contract_name, contract_version, deprecated, usage_date, request_count, last_seen_at",
        )
        .gte("usage_date", sinceDate)
        .order("usage_date", { ascending: true });

      if (error) throw error;
      return buildSummary((data ?? []) as ContractUsageRow[]);
    },
    staleTime: 60_000,
  });
}
