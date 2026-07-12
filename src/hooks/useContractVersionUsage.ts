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
