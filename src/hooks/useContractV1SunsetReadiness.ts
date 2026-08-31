import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Prontidão para desativação (sunset) da versão de contrato `v1`, calculada
 * no servidor via RPC `get_contract_v1_sunset_readiness` (admin-only,
 * SECURITY DEFINER). Centraliza a regra de negócio no banco e reduz o payload
 * trafegado ao cliente — ideal para decidir a data efetiva de remoção.
 */
export interface ContractV1SunsetReadiness {
  /** Janela de análise efetivamente considerada (em dias). */
  windowDays: number;
  /** Total de chamadas no período (todas as versões). */
  totalRequests: number;
  /** Total de chamadas em `v1` no período. */
  totalV1: number;
  /** Proporção de `v1` no período (0–100). */
  v1Ratio: number;
  /** Última chamada observada em `v1`, se houver. */
  lastV1Seen: string | null;
  /** Contratos que ainda receberam chamadas em `v1`. */
  contractsUsingV1: string[];
  /** `true` quando a proporção de `v1` já está no/abaixo do limite seguro. */
  safeToRemove: boolean;
  /** Limite (p.p.) usado para decidir a remoção segura. */
  threshold: number;
}

interface SunsetReadinessRow {
  window_days: number;
  total_requests: number;
  total_v1: number;
  v1_ratio: number;
  last_v1_seen: string | null;
  contracts_using_v1: string[] | null;
  safe_to_remove: boolean;
  threshold: number;
}

function mapRow(row: SunsetReadinessRow): ContractV1SunsetReadiness {
  return {
    windowDays: Number(row.window_days),
    totalRequests: Number(row.total_requests),
    totalV1: Number(row.total_v1),
    v1Ratio: Number(row.v1_ratio),
    lastV1Seen: row.last_v1_seen,
    contractsUsingV1: row.contracts_using_v1 ?? [],
    safeToRemove: Boolean(row.safe_to_remove),
    threshold: Number(row.threshold),
  };
}

export function useContractV1SunsetReadiness(days = 30, threshold = 1.0) {
  return useQuery({
    queryKey: ["contract-v1-sunset-readiness", days, threshold],
    queryFn: async (): Promise<ContractV1SunsetReadiness | null> => {
      const { data, error } = await supabase.rpc(
        "get_contract_v1_sunset_readiness",
        { p_days: days, p_threshold: threshold },
      );
      if (error) throw error;
      const rows = (data ?? []) as SunsetReadinessRow[];
      return rows.length > 0 ? mapRow(rows[0]) : null;
    },
    staleTime: 60_000,
  });
}
