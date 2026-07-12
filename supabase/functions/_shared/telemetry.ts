// ============================================================================
// Telemetria de uso de versões de contrato (deprecação).
//
// Objetivo: emitir log estruturado + persistir de forma AGREGADA (best-effort)
// cada requisição por (contrato, versão), destacando quando uma versão
// DESCONTINUADA (ex.: v1) é utilizada — para rastrear integradores pendentes e
// planejar a data efetiva de remoção (sunset).
//
// Princípios:
//  - Fire-and-forget: NUNCA deve quebrar ou atrasar o fluxo principal.
//  - Idempotente por dia: usa a RPC atômica `increment_contract_usage`.
//  - Log SEMPRE emitido (aparece nos logs da Edge Function); persistência é
//    condicional à disponibilidade de SUPABASE_URL + SERVICE_ROLE_KEY.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  buildContractUsageEvent,
  type ContractVersion,
} from "./contract.ts";

/**
 * Registra o uso de uma versão de contrato. Fire-and-forget: retorna
 * imediatamente e resolve a persistência em segundo plano, engolindo qualquer
 * erro para não afetar a resposta ao cliente.
 */
export function trackContractUsage(
  contractName: string,
  version: ContractVersion,
): void {
  const event = buildContractUsageEvent(contractName, version);

  // Log estruturado — rastreável nos logs da função mesmo sem persistência.
  const line = JSON.stringify({ tag: "contract_usage", ...event });
  if (event.deprecated) {
    // Aviso explícito: integrador ainda em versão descontinuada.
    console.warn(`[DEPRECATED_CONTRACT_USAGE] ${line}`);
  } else {
    console.log(`[contract_usage] ${line}`);
  }

  // Persistência agregada (best-effort). Não aguardamos o resultado.
  void persistUsage(event.contractName, event.contractVersion, event.deprecated);
}

async function persistUsage(
  contractName: string,
  version: ContractVersion,
  deprecated: boolean,
): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return; // Ambiente sem credenciais (ex.: testes): apenas log.

    const supabase = createClient(url, key);
    const { error } = await supabase.rpc("increment_contract_usage", {
      p_contract_name: contractName,
      p_contract_version: version,
      p_deprecated: deprecated,
    });
    if (error) {
      console.error(
        `[contract_usage] falha ao persistir telemetria: ${error.message}`,
      );
    }
  } catch (err) {
    console.error(`[contract_usage] exceção ao persistir telemetria:`, err);
  }
}
