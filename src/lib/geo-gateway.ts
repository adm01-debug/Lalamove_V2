import { supabase } from '@/integrations/supabase/client';

/**
 * Cliente fino do geo-gateway (camada única de acesso a provedores de mapa).
 * Plano: claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md (Bloco 5).
 */

export interface GeoFieldError {
  field: string;
  message: string;
  code: string;
}

interface GeoErrorBody {
  error?: { code?: string; message?: string; fields?: GeoFieldError[] };
}

/** Erro do gateway já normalizado: carrega o `code` do contrato e o status HTTP. */
export class GeoGatewayError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: GeoFieldError[];

  constructor(message: string, code: string, status: number, fields: GeoFieldError[] = []) {
    super(message);
    this.name = 'GeoGatewayError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'GEO_NOT_FOUND';
  }
}

/** `FunctionsHttpError` guarda a Response original do edge em `context`. */
async function toGeoError(error: unknown): Promise<GeoGatewayError> {
  const response = (error as { context?: unknown } | null)?.context as Response | undefined;
  if (response && typeof response.text === 'function') {
    const status = typeof response.status === 'number' ? response.status : 0;
    let body: GeoErrorBody = {};
    try {
      body = JSON.parse(await response.text()) as GeoErrorBody;
    } catch {
      // corpo não-JSON: mantém a mensagem genérica por status
    }
    return new GeoGatewayError(
      body.error?.message ?? `geo-gateway respondeu ${status}`,
      body.error?.code ?? 'GEO_HTTP_ERROR',
      status,
      body.error?.fields ?? [],
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new GeoGatewayError(message, 'GEO_TRANSPORT_ERROR', 0);
}

/**
 * Chama uma action do geo-gateway e devolve o payload tipado.
 * Lança `GeoGatewayError` (com `code`/`status`/`fields` do contrato) em qualquer falha.
 */
export async function callGeo<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('geo-gateway', { body });
  if (error) throw await toGeoError(error);
  return data as T;
}

/** Registra 1 carregamento de mapa em geo_usage. Nunca lança — telemetria de uso é best-effort. */
export async function countMapLoad(provider: 'mapbox' | 'google'): Promise<void> {
  try {
    await supabase.functions.invoke('geo-gateway', { body: { action: 'count-map-load', provider } });
  } catch {
    // Silently fail - métrica de uso não pode travar o mapa
  }
}
