import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tendência de longo prazo do uso de versões de contrato, lida da tabela
 * agregada `contract_version_usage_monthly` (uma linha por
 * contrato/versão/mês). O rollup mensal (`rollup_contract_version_usage`)
 * consolida os dados diários com mais de 90 dias nesta série, mantendo
 * histórico extenso sem inchar a tabela diária.
 *
 * Acesso restrito a administradores via política RLS
 * (`has_role(auth.uid(), 'admin')`).
 */
export interface MonthlyVersionUsagePoint {
  /** Mês de referência no formato ISO `YYYY-MM-01`. */
  month: string;
  /** Total de chamadas no mês (todas as versões). */
  total: number;
  /** Chamadas por versão de contrato no mês. */
  byVersion: Record<string, number>;
  /** Proporção de `v1` no mês (0–100). */
  v1Ratio: number;
}

export interface MonthlyUsageRow {
  contract_version: string;
  usage_month: string;
  request_count: number;
}

export function aggregateMonthly(rows: MonthlyUsageRow[]): MonthlyVersionUsagePoint[] {
  const byMonth = new Map<string, MonthlyVersionUsagePoint>();

  for (const row of rows) {
    const month = row.usage_month;
    const count = Number(row.request_count) || 0;
    const version = row.contract_version;

    let point = byMonth.get(month);
    if (!point) {
      point = { month, total: 0, byVersion: {}, v1Ratio: 0 };
      byMonth.set(month, point);
    }

    point.total += count;
    point.byVersion[version] = (point.byVersion[version] ?? 0) + count;
  }

  const points = Array.from(byMonth.values());
  for (const point of points) {
    const v1 = point.byVersion["v1"] ?? 0;
    point.v1Ratio =
      point.total > 0 ? Math.round((v1 / point.total) * 1000) / 10 : 0;
  }

  // Ordem cronológica ascendente (mais antigo → mais recente).
  points.sort((a, b) => a.month.localeCompare(b.month));
  return points;
}

export function useContractVersionUsageMonthly(months = 12) {
  return useQuery({
    queryKey: ["contract-version-usage-monthly", months],
    queryFn: async (): Promise<MonthlyVersionUsagePoint[]> => {
      const since = new Date();
      since.setUTCDate(1);
      since.setUTCHours(0, 0, 0, 0);
      since.setUTCMonth(since.getUTCMonth() - Math.max(months - 1, 0));
      const sinceIso = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("contract_version_usage_monthly")
        .select("contract_version, usage_month, request_count")
        .gte("usage_month", sinceIso)
        .order("usage_month", { ascending: true });

      if (error) throw error;
      return aggregateMonthly((data ?? []) as MonthlyUsageRow[]);
    },
    staleTime: 300_000,
  });
}
