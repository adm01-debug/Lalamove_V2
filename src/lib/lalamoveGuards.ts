/**
 * Guardas de errata de produção Lalamove (Etapa 3 do roteiro).
 *
 * A documentação oficial diverge do comportamento real da API BR em alguns
 * pontos. Estas funções isolam essas divergências para que nenhum componente
 * volte a assumir a forma "documentada".
 *
 * Errata coberta:
 *  1. `driverId` é sempre `string`; ausência é `""` — nunca `null`/`undefined`.
 *  2. Cidades expõem `services`, não `serviceTypes`.
 *  3. `cancelParty` / `cancelledReason` não existem no BR.
 *  4. `DELETE /orders/{id}` responde `204` sem corpo.
 *  5. `priceBreakdown.total` é string decimal — nunca number.
 */

import type { LalamoveOrderStatus } from '@/types/lalamove';
import { ORDER_STATUS_RANK, TERMINAL_ORDER_STATUSES } from '@/types/lalamove';

/** Normaliza qualquer forma de driverId para string (`""` quando ausente). */
export function normalizeDriverId(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return '';
}

/** `true` somente quando há motorista real atribuído. */
export function hasAssignedDriver(raw: unknown): boolean {
  return normalizeDriverId(raw).length > 0;
}

/**
 * Extrai a lista de serviços de um payload de cidade tolerando o campo legado
 * `serviceTypes` (que a documentação cita, mas a API BR não retorna).
 */
export function extractCityServices(city: unknown): string[] {
  if (!city || typeof city !== 'object') return [];
  const record = city as Record<string, unknown>;
  const source = Array.isArray(record.services)
    ? record.services
    : Array.isArray(record.serviceTypes)
      ? record.serviceTypes
      : [];

  return source
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const key = (entry as Record<string, unknown>).key;
        if (typeof key === 'string') return key;
      }
      return '';
    })
    .filter((key): key is string => key.length > 0);
}

/** Converte `priceBreakdown.total` (string decimal) em número seguro. */
export function parseMoney(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;
  const parsed = Number.parseFloat(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Decide se um evento de webhook deve ser aplicado. Webhooks podem chegar
 * fora de ordem: nunca regredimos o status nem sobrescrevemos um estado final.
 */
export function shouldApplyStatusTransition(current: string, incoming: string): boolean {
  if (current === incoming) return false;
  if (isTerminalStatus(current)) return false;

  const currentRank = ORDER_STATUS_RANK[current as LalamoveOrderStatus];
  const incomingRank = ORDER_STATUS_RANK[incoming as LalamoveOrderStatus];
  if (currentRank === undefined || incomingRank === undefined) return true;
  return incomingRank > currentRank;
}

/** `DELETE /orders/{id}` responde 204 sem corpo — 200 com corpo também é sucesso. */
export function isCancellationSuccess(status: number): boolean {
  return status === 204 || status === 200;
}
