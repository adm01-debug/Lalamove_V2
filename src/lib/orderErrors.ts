/**
 * Traduz mensagens de erro cruas da Edge Function `lalamove-api`
 * em mensagens amigáveis PT-BR e destaca o campo do formulário
 * correspondente para o usuário corrigir.
 */

export type OrderErrorField = 'senderPhone' | 'recipientPhone' | 'schedule' | 'address' | null;

export interface ParsedOrderError {
  /** Título curto exibido no toast/alerta. */
  title: string;
  /** Descrição orientando a correção. */
  description: string;
  /** Campo do formulário responsável pelo erro, quando identificável. */
  field: OrderErrorField;
  /** Índice do destinatário (0-based) quando `field === 'recipientPhone'`. */
  recipientIndex?: number;
}

const RECIPIENTS_REGEX = /recipients\[(\d+)\]/i;

/**
 * Extrai contexto estruturado de mensagens como:
 *   "Telefone inválido em sender: esperado formato E.164 (+5511...)"
 *   "Telefone inválido em recipients[0]: ..."
 *   "Lalamove API: 400 - INVALID_PHONE_NUMBER"
 */
export function parseOrderError(raw: string): ParsedOrderError {
  const msg = (raw ?? '').trim();
  const lower = msg.toLowerCase();

  // 0) Código canônico ERR_* propagado pela API v3 (Etapa 5).
  const codeMatch = msg.match(/ERR_[A-Z_]+/);
  if (codeMatch && V3_ERROR_MAP[codeMatch[0]] && !lower.includes('telefone')) {
    const info = V3_ERROR_MAP[codeMatch[0]];
    return {
      title: info.title,
      description: info.description,
      field: codeMatch[0] === 'ERR_INVALID_QUOTATION_ID' ? null : null,
    };
  }


  // 1) Falha do guard-rail server-side (assertE164).
  if (lower.includes('telefone inválido em sender')) {
    return {
      title: 'Telefone do remetente inválido',
      description:
        'O número informado não passou na validação E.164 do servidor. Confira o DDD, o nono dígito e refaça a cotação.',
      field: 'senderPhone',
    };
  }

  const recipientMatch = msg.match(RECIPIENTS_REGEX);
  if (lower.includes('telefone inválido em recipients')) {
    return {
      title: 'Telefone do destinatário inválido',
      description:
        'O número informado não passou na validação E.164 do servidor. Confira o DDD, o nono dígito e refaça a cotação.',
      field: 'recipientPhone',
      recipientIndex: recipientMatch ? Number.parseInt(recipientMatch[1], 10) : 0,
    };
  }

  // 2) Erros propagados diretamente pela API oficial Lalamove.
  if (
    lower.includes('invalid_phone') ||
    lower.includes('invalid phone') ||
    (lower.includes('phone') && lower.includes('invalid'))
  ) {
    return {
      title: 'Telefone rejeitado pela Lalamove',
      description:
        'A Lalamove recusou o número. Verifique se é um celular BR real, com DDD válido e nono dígito, e refaça a cotação.',
      field: 'senderPhone',
    };
  }

  // 3) Erros de agendamento/endereço para orientação adicional.
  if (lower.includes('schedule') || lower.includes('agendamento')) {
    return {
      title: 'Agendamento inválido',
      description: 'A Lalamove aceita agendamentos entre 30 minutos e 30 dias no futuro.',
      field: 'schedule',
    };
  }

  if (lower.includes('address') || lower.includes('endereço') || lower.includes('stop')) {
    return {
      title: 'Endereço inválido',
      description: 'Confira os endereços de coleta e entrega — CEP, número e cidade são obrigatórios.',
      field: 'address',
    };
  }

  return {
    title: 'Erro ao criar pedido',
    description: msg || 'Não foi possível criar o pedido. Tente novamente em instantes.',
    field: null,
  };
}
