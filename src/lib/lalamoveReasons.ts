/**
 * Motivos canônicos das operações pós-criação da Lalamove v3 BR.
 *
 * A API só aceita os códigos abaixo; qualquer string livre é recusada com
 * `ERR_INVALID_FIELD`. Centralizar aqui (em vez de duplicar arrays inline nos
 * componentes) garante que UI, testes e telemetria falem exatamente o mesmo
 * vocabulário — e que uma mudança no contrato tenha um único ponto de edição.
 */

/** Motivos aceitos em `POST /orders/{id}/drivers/{driverId}` (troca). */
export const CHANGE_DRIVER_REASONS = [
  'DRIVER_UNRESPONSIVE',
  'DRIVER_LATE',
  'DRIVER_ASKED_CHANGE',
  'DRIVER_RUDE',
  'DRIVER_ASKED_FOR_MORE_MONEY',
] as const;

export type ChangeDriverReason = (typeof CHANGE_DRIVER_REASONS)[number];

/** Motivos aceitos em `DELETE /orders/{id}` (cancelamento). */
export const CANCEL_ORDER_REASONS = [
  'USER_REQUESTED',
  'INCORRECT_ORDER_DETAILS',
  'WRONG_ADDRESS',
  'MISTAKEN_ORDER',
  'PRICE_TOO_HIGH',
  'DELIVERY_ETA_TOO_LONG',
  'DRIVER_UNRESPONSIVE',
  'DRIVER_LATE',
  'DRIVER_ASKED_CANCEL',
  'DRIVER_ASKED_FOR_MORE_MONEY',
  'NO_CAPACITY',
  'OTHER',
] as const;

export type CancelOrderReason = (typeof CANCEL_ORDER_REASONS)[number];

const REASON_LABELS: Readonly<Record<ChangeDriverReason | CancelOrderReason, string>> = {
  DRIVER_UNRESPONSIVE: 'Motorista não responde',
  DRIVER_LATE: 'Motorista atrasado',
  DRIVER_ASKED_CHANGE: 'Motorista pediu troca',
  DRIVER_RUDE: 'Motorista rude',
  DRIVER_ASKED_FOR_MORE_MONEY: 'Motorista pediu mais dinheiro',
  DRIVER_ASKED_CANCEL: 'Motorista pediu cancelamento',
  USER_REQUESTED: 'Solicitado pelo cliente',
  INCORRECT_ORDER_DETAILS: 'Detalhes do pedido incorretos',
  WRONG_ADDRESS: 'Endereço incorreto',
  MISTAKEN_ORDER: 'Pedido criado por engano',
  PRICE_TOO_HIGH: 'Preço muito alto',
  DELIVERY_ETA_TOO_LONG: 'Tempo de entrega muito longo',
  NO_CAPACITY: 'Sem capacidade disponível',
  OTHER: 'Outro motivo',
};


export interface ReasonOption {
  value: string;
  label: string;
}

/** Rótulo PT-BR do motivo; devolve o próprio código quando desconhecido. */
export function reasonLabel(code: string): string {
  return REASON_LABELS[code as ChangeDriverReason] ?? code;
}

function toOptions(codes: readonly string[]): ReasonOption[] {
  return codes.map((value) => ({ value, label: reasonLabel(value) }));
}

export const changeDriverReasonOptions: ReasonOption[] = toOptions(CHANGE_DRIVER_REASONS);
export const cancelOrderReasonOptions: ReasonOption[] = toOptions(CANCEL_ORDER_REASONS);

/** Guarda de runtime: impede enviar um motivo fora do contrato. */
export function isChangeDriverReason(value: string): value is ChangeDriverReason {
  return (CHANGE_DRIVER_REASONS as readonly string[]).includes(value);
}

export function isCancelOrderReason(value: string): value is CancelOrderReason {
  return (CANCEL_ORDER_REASONS as readonly string[]).includes(value);
}
