// Failover em RUNTIME do geo-gateway.
// O resolver só troca de provedor quando o primário está INUTILIZÁVEL antes da chamada (sem chave,
// sem suporte, orçamento bloqueado). Quando o primário está usável mas FALHA na chamada (5xx,
// timeout, credencial revogada, rate limit), a requisição morria em 502. Este módulo faz a segunda
// tentativa no provedor alternativo de geo_settings em UM ciclo, e devolve qual provedor respondeu.
import type { GeoFunction, GeoProvider, ProviderName, ProviderResult } from "./providers/types.ts";
import { GeoProviderError } from "./providers/types.ts";

/** Erros que não mudam de provedor: a entrada é inválida ou o endereço/rota não existe. */
const NON_FAILOVER_CODES = new Set([
  "GEO_INVALID_INPUT",
  "GEO_NOT_FOUND",
  "GEO_NO_ROUTE",
]);
/** Vale tentar outro provedor? Falha do provedor (5xx), credencial, rate limit e rede/timeout sim. */
export function isFailoverWorthy(err: unknown): boolean {
  if (err instanceof GeoProviderError) return !NON_FAILOVER_CODES.has(err.code);
  return true; // erro de rede/abort/timeout não tipado: o outro provedor pode responder
}

export interface FailoverResolver {
  failoverFor(fn: GeoFunction, primary: ProviderName): Promise<ProviderName | null>;
}

export interface FailoverDeps {
  resolver: FailoverResolver;
  getProvider: (name: ProviderName) => GeoProvider;
  run: (provider: GeoProvider, name: ProviderName) => Promise<ProviderResult<unknown>>;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

export interface FailoverOutcome<T> extends ProviderResult<T> {
  /** provedor que de fato respondeu */
  provider: ProviderName;
  /** preenchido só quando houve troca em runtime */
  fallback?: { from: ProviderName; to: ProviderName; code: string; message: string };
}
/**
 * Executa a chamada no primário e, se ele falhar de forma recuperável, repete no alternativo.
 * Sem alternativo usável, o erro ORIGINAL sobe (é o diagnóstico mais útil).
 * Se o alternativo também falhar, o erro original sobe e a falha do alternativo é registrada.
 */
export async function callWithFailover<T>(
  fn: GeoFunction,
  primary: ProviderName,
  deps: FailoverDeps,
): Promise<FailoverOutcome<T>> {
  try {
    const r = await deps.run(deps.getProvider(primary), primary);
    return { ...r, data: r.data as T, provider: primary };
  } catch (err) {
    if (!isFailoverWorthy(err)) throw err;
    const original = err;
    const code = original instanceof GeoProviderError ? original.code : "GEO_TRANSPORT_ERROR";
    const message = original instanceof Error ? original.message : String(original);

    const alt = await deps.resolver.failoverFor(fn, primary);
    if (!alt) {
      deps.log?.("[geo-gateway] sem provedor de fallback usavel", { fn, primary, code, message });
      throw original;
    }

    deps.log?.("[geo-gateway] failover em runtime", { fn, primary, to: alt, code, message });
    try {
      const r = await deps.run(deps.getProvider(alt), alt);
      return {
        ...r,
        data: r.data as T,
        provider: alt,
        fallback: { from: primary, to: alt, code, message },
      };
    } catch (altErr) {
      const altCode = altErr instanceof GeoProviderError ? altErr.code : "GEO_TRANSPORT_ERROR";
      const altMessage = altErr instanceof Error ? altErr.message : String(altErr);
      deps.log?.("[geo-gateway] fallback tambem falhou", {
        fn, primary, to: alt, code, message, fallback_code: altCode, fallback_message: altMessage,
      });
      throw original;
    }
  }
}