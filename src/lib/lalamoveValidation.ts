/**
 * Validações do fluxo de cotação/pedido Lalamove v3.
 * Funções puras — sem side effects, sem dependências externas.
 */

// ---------------------------------------------------------------------------
// scheduleAt
// ---------------------------------------------------------------------------

export interface ScheduleAtValidation {
  valid: boolean;
  iso: string;
  error: string;
}

/**
 * Janela oficial Lalamove v3: 30 minutos a 30 dias no futuro.
 * Aceita string vazia como "imediato" (válido, ISO vazio).
 * `now` é injetável para testes determinísticos.
 */
export function validateScheduleAt(input: string, now: Date = new Date()): ScheduleAtValidation {
  if (!input) return { valid: true, iso: '', error: '' };
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return { valid: false, iso: '', error: 'Data/hora inválida' };
  const diffMin = (dt.getTime() - now.getTime()) / 60000;
  if (diffMin < 30) return { valid: false, iso: '', error: 'Agendamento mínimo: 30 minutos à frente' };
  if (diffMin > 30 * 24 * 60) return { valid: false, iso: '', error: 'Agendamento máximo: 30 dias' };
  return { valid: true, iso: dt.toISOString(), error: '' };
}

// ---------------------------------------------------------------------------
// specialRequests — matriz oficial Lalamove v3 BR
// ---------------------------------------------------------------------------

export const SPECIAL_REQUESTS_BY_VEHICLE: Readonly<Record<string, readonly string[]>> = {
  MOTORCYCLE: ['HELP_BUY', 'TOLL_FEE', 'DOOR_TO_DOOR', 'THERMAL_BAG_1', 'PURCHASE_SERVICE_1'],
  CAR: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR'],
  MPV: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR'],
  VAN: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
  UV_FIORINO: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE'],
  TRUCK175: ['TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
  TRUCK330: ['TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
} as const;

export interface SpecialRequestValidation {
  valid: boolean;
  allowed: readonly string[];
  invalid: string[];
  duplicates: string[];
  error: string;
}

/**
 * Valida uma lista de special requests para um `vehicleType`.
 * - Rejeita valores fora da matriz do veículo.
 * - Detecta duplicatas.
 * - Rejeita veículo desconhecido.
 */
export function validateSpecialRequests(
  vehicleType: string,
  requests: readonly string[],
): SpecialRequestValidation {
  const allowed = SPECIAL_REQUESTS_BY_VEHICLE[vehicleType];
  if (!allowed) {
    return {
      valid: false,
      allowed: [],
      invalid: [...requests],
      duplicates: [],
      error: `Tipo de veículo desconhecido: ${vehicleType}`,
    };
  }
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const invalid: string[] = [];
  for (const r of requests) {
    if (seen.has(r)) {
      duplicates.push(r);
      continue;
    }
    seen.add(r);
    if (!allowed.includes(r)) invalid.push(r);
  }
  if (invalid.length > 0) {
    return {
      valid: false,
      allowed,
      invalid,
      duplicates,
      error: `Special requests incompatíveis com ${vehicleType}: ${invalid.join(', ')}`,
    };
  }
  if (duplicates.length > 0) {
    return {
      valid: false,
      allowed,
      invalid,
      duplicates,
      error: `Special requests duplicadas: ${duplicates.join(', ')}`,
    };
  }
  return { valid: true, allowed, invalid: [], duplicates: [], error: '' };
}
