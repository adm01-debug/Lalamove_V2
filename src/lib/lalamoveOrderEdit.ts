/**
 * Bloco B (Etapas 7–12) — matriz canônica de operações pós-criação de pedido.
 *
 * A API v3 BR recusa operações fora de janela com erros específicos
 * (`ERR_ORDER_EDIT`, `ERR_CANCELLATION`, `ERR_INVALID_TIPS`). Em vez de
 * descobrir isso via 4xx, o front avalia a janela localmente e só habilita a
 * ação quando ela é legítima — o erro remoto vira apenas rede de segurança.
 *
 * Fonte: docs/LALAMOVE_MASTER_ANALYSIS.md (Bloco B) + errata de produção.
 */

import type { LalamoveOrderStatus } from '@/types/lalamove';

/** Operações pós-criação suportadas pelo hub. */
export type OrderOperation = 'edit' | 'cancel' | 'priorityFee' | 'changeDriver';

export interface OperationVerdict {
  /** `true` quando a operação pode ser tentada contra a Lalamove. */
  allowed: boolean;
  /** Motivo em PT-BR — exibido como tooltip/hint quando bloqueado. */
  reason: string;
  /** Erro que a Lalamove devolveria caso a operação fosse forçada. */
  expectedError?: 'ERR_ORDER_EDIT' | 'ERR_CANCELLATION' | 'ERR_INVALID_TIPS';
}

/** Aliases internos/legados do hub mapeados para o enum canônico da v3. */
const STATUS_ALIASES: Readonly<Record<string, LalamoveOrderStatus>> = {
  PENDING: 'ASSIGNING_DRIVER',
  MATCHING: 'ASSIGNING_DRIVER',
  ASSIGNING_DRIVER: 'ASSIGNING_DRIVER',
  MATCHED: 'ON_GOING',
  ONGOING: 'ON_GOING',
  ON_GOING: 'ON_GOING',
  PICKED_UP: 'PICKED_UP',
  DELIVERING: 'DELIVERING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELED',
  CANCELED: 'CANCELED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
};

/** Normaliza qualquer rótulo de status conhecido para o enum canônico. */
export function normalizeOrderStatus(raw: string | null | undefined): LalamoveOrderStatus | null {
  if (!raw) return null;
  return STATUS_ALIASES[raw.trim().toUpperCase()] ?? null;
}

const TERMINAL: readonly LalamoveOrderStatus[] = ['COMPLETED', 'CANCELED', 'REJECTED', 'EXPIRED'];

/** `true` quando o pedido já chegou a um estado final e nada mais é mutável. */
export function isTerminalStatus(raw: string | null | undefined): boolean {
  const status = normalizeOrderStatus(raw);
  return status !== null && TERMINAL.includes(status);
}

export interface OrderEditContext {
  status: string | null | undefined;
  /** `""` quando não há motorista atribuído (errata BR). */
  driverId?: string | null;
  /** Bônus já aplicado, em reais — usado na guarda `ERR_INVALID_TIPS`. */
  currentPriorityFee?: number;
}

/** Teto operacional de bônus definido pelo hub (política interna). */
export const MAX_PRIORITY_FEE_BRL = 500;

/**
 * Avalia uma operação contra o estado atual do pedido.
 *
 * Regras (v3 BR):
 *  - `edit`: apenas após atribuição do motorista e antes da coleta. Durante
 *    `ASSIGNING_DRIVER` a Lalamove responde `ERR_ORDER_EDIT`.
 *  - `cancel`: permitido até a coleta; depois responde `ERR_CANCELLATION`.
 *  - `priorityFee`: permitido enquanto o pedido não foi coletado; o valor só
 *    pode ser aumentado, caso contrário `ERR_INVALID_TIPS`.
 *  - `changeDriver`: exige motorista atribuído e coleta ainda não realizada.
 */
export function evaluateOrderOperation(
  operation: OrderOperation,
  context: OrderEditContext,
): OperationVerdict {
  const status = normalizeOrderStatus(context.status);

  if (status === null) {
    return { allowed: false, reason: 'Status do pedido desconhecido — recarregue os dados.' };
  }

  if (TERMINAL.includes(status)) {
    return { allowed: false, reason: 'O pedido já foi finalizado e não aceita alterações.' };
  }

  const pickedUp = status === 'PICKED_UP' || status === 'DELIVERING';
  const hasDriver = (context.driverId ?? '').trim().length > 0;

  switch (operation) {
    case 'edit':
      if (status === 'ASSIGNING_DRIVER') {
        return {
          allowed: false,
          reason: 'Não é possível editar enquanto a Lalamove procura um motorista.',
          expectedError: 'ERR_ORDER_EDIT',
        };
      }
      if (pickedUp) {
        return {
          allowed: false,
          reason: 'A carga já foi coletada — o pedido não pode mais ser editado.',
          expectedError: 'ERR_ORDER_EDIT',
        };
      }
      return { allowed: true, reason: 'Edição liberada até a coleta da carga.' };

    case 'cancel':
      if (pickedUp) {
        return {
          allowed: false,
          reason: 'Cancelamento indisponível após a coleta. Acione o suporte Lalamove.',
          expectedError: 'ERR_CANCELLATION',
        };
      }
      return { allowed: true, reason: 'Cancelamento permitido até a coleta.' };

    case 'priorityFee':
      if (pickedUp) {
        return {
          allowed: false,
          reason: 'O bônus só pode ser aplicado antes da coleta.',
          expectedError: 'ERR_INVALID_TIPS',
        };
      }
      return { allowed: true, reason: 'Bônus permitido — o valor só pode ser aumentado.' };

    case 'changeDriver':
      if (!hasDriver) {
        return { allowed: false, reason: 'Ainda não há motorista atribuído a este pedido.' };
      }
      if (pickedUp) {
        return { allowed: false, reason: 'A troca de motorista não é possível após a coleta.' };
      }
      return { allowed: true, reason: 'Troca de motorista disponível.' };

    default:
      return { allowed: false, reason: 'Operação não suportada.' };
  }
}

export interface PriorityFeeValidation {
  valid: boolean;
  /** Valor normalizado em reais quando válido. */
  amount: number | null;
  error: string | null;
}

/**
 * Valida o novo bônus antes da chamada: a Lalamove só aceita incrementos
 * (`ERR_INVALID_TIPS` caso contrário) e o hub impõe teto de R$ 500.
 */
export function validatePriorityFee(raw: string, currentFee = 0): PriorityFeeValidation {
  const normalized = raw.replace(',', '.').trim();
  const amount = Number.parseFloat(normalized);

  if (!normalized || !Number.isFinite(amount)) {
    return { valid: false, amount: null, error: 'Informe um valor numérico para o bônus.' };
  }
  if (amount <= 0) {
    return { valid: false, amount: null, error: 'O bônus deve ser maior que zero.' };
  }
  if (amount <= currentFee) {
    return {
      valid: false,
      amount: null,
      error: `O bônus só pode ser aumentado. Valor atual: R$ ${currentFee.toFixed(2)}.`,
    };
  }
  if (amount > MAX_PRIORITY_FEE_BRL) {
    return {
      valid: false,
      amount: null,
      error: `O bônus máximo permitido é R$ ${MAX_PRIORITY_FEE_BRL.toFixed(2)}.`,
    };
  }

  return { valid: true, amount: Number(amount.toFixed(2)), error: null };
}
