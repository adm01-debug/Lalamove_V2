/**
 * Mapa canônico de erros Lalamove (Etapa 5 do roteiro).
 *
 * Cobre as duas superfícies:
 *  - REST v3: envelope `{ errors: [{ id, message, detail }] }`;
 *  - UAPI: código numérico `ret`.
 *
 * Toda mensagem exibida ao usuário nasce aqui — nenhum componente inventa texto.
 */

import type { LalamoveV3Error, LalamoveV3ErrorEnvelope } from '@/types/lalamove';

export interface LalamoveErrorInfo {
  /** Título curto exibido no toast/alerta. */
  title: string;
  /** Orientação de correção em PT-BR. */
  description: string;
  /** `true` quando repetir a mesma requisição pode resolver. */
  retryable: boolean;
  /** `true` quando o caminho de recuperação é gerar uma nova cotação. */
  requiresRequote?: boolean;
}

const UNKNOWN: LalamoveErrorInfo = {
  title: 'Erro na Lalamove',
  description: 'A Lalamove retornou um erro inesperado. Tente novamente em instantes.',
  retryable: true,
};

/** Erros REST v3 por `errors[0].id`. */
export const V3_ERROR_MAP: Readonly<Record<string, LalamoveErrorInfo>> = {
  ERR_INVALID_FIELD: {
    title: 'Dados inválidos',
    description: 'Um campo do pedido foi recusado pela Lalamove. Revise os dados destacados.',
    retryable: false,
  },
  ERR_INVALID_QUOTATION_ID: {
    title: 'Cotação expirada',
    description: 'A cotação expirou (validade de 5 minutos). Gere uma nova cotação para continuar.',
    retryable: false,
    requiresRequote: true,
  },
  ERR_ORDER_EDIT: {
    title: 'Pedido não editável',
    description: 'Não é possível editar o pedido enquanto ele estiver procurando motorista.',
    retryable: false,
  },
  ERR_CANCELLATION: {
    title: 'Cancelamento não permitido',
    description: 'Este pedido já foi cancelado ou não está mais em uma fase cancelável.',
    retryable: false,
  },
  ERR_INVALID_TIPS: {
    title: 'Bônus inválido',
    description: 'O bônus (priority fee) só pode ser aumentado. Informe um valor maior que o atual.',
    retryable: false,
  },
  ERR_ORDER_NOT_FOUND: {
    title: 'Pedido não encontrado',
    description: 'O identificador do pedido não existe na Lalamove.',
    retryable: false,
  },
  ERR_DRIVER_NOT_FOUND: {
    title: 'Motorista não encontrado',
    description: 'Ainda não há motorista atribuído a este pedido.',
    retryable: false,
  },
};

/** Detalhes (JSON pointer) mais comuns em `ERR_INVALID_FIELD`. */
const V3_FIELD_DETAILS: Readonly<Record<string, string>> = {
  '/data/stops': 'A cotação exige pelo menos 2 paradas (coleta e entrega).',
  '/data/serviceType': 'O tipo de veículo informado não é aceito nesta cidade.',
  '/data/scheduleAt': 'O agendamento deve estar no futuro e no máximo 30 dias à frente.',
  '/data/specialRequests/0': 'O serviço adicional escolhido não é compatível com o veículo selecionado.',
};

/** Erros UAPI por código numérico `ret`. */
export const UAPI_RET_MAP: Readonly<Record<number, LalamoveErrorInfo>> = {
  10002: { title: 'Parâmetros inválidos', description: 'A UAPI recusou os parâmetros enviados.', retryable: false },
  10004: { title: 'Rota inexistente', description: 'O endpoint UAPI chamado não existe.', retryable: false },
  10007: { title: 'Sessão expirada', description: 'O token UAPI expirou. A renovação automática será acionada.', retryable: true },
  10008: { title: 'Erro no servidor Lalamove', description: 'Falha interna na Lalamove. Tente novamente em instantes.', retryable: true },
  10010: { title: 'Assinatura rejeitada', description: 'O gateway de segurança da Lalamove recusou a assinatura da requisição.', retryable: true },
  10012: { title: 'Configuração operacional inválida', description: 'A conta possui uma configuração incompatível com esta operação.', retryable: false },
  10102: { title: 'Prazo de cancelamento expirado', description: 'A janela de cancelamento gratuito deste pedido já passou.', retryable: false },
  22018: { title: 'Opção de preço indisponível', description: 'A modalidade de preço escolhida não está mais disponível. Gere uma nova cotação.', retryable: false, requiresRequote: true },
  40304: { title: 'Erro de contrato', description: 'Há um problema de configuração no contrato corporativo.', retryable: false },
  42000: { title: 'Link expirado', description: 'O link de rastreamento deste pedido expirou.', retryable: false },
  42201: { title: 'Limite de requisições', description: 'Limite de chamadas da Lalamove atingido. Aguarde alguns instantes.', retryable: true },
  70004: { title: 'Falha em sistema externo', description: 'Um sistema dependente da Lalamove falhou. Tente novamente.', retryable: true },
  13001: { title: 'Carteira pós-paga inexistente', description: 'A conta não possui carteira pós-paga habilitada.', retryable: false },
  27103: { title: 'Carteira desabilitada', description: 'A carteira pós-paga da conta está desabilitada.', retryable: false },
  27104: { title: 'Carteira removida', description: 'A carteira pós-paga da conta foi removida.', retryable: false },
  27105: { title: 'Saldo insuficiente', description: 'Saldo insuficiente na carteira pós-paga.', retryable: false },
};

function isEnvelope(value: unknown): value is LalamoveV3ErrorEnvelope {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as LalamoveV3ErrorEnvelope).errors) &&
    (value as LalamoveV3ErrorEnvelope).errors.length > 0
  );
}

/** Resolve um envelope de erro v3 (ou HTTP status cru) em mensagem amigável. */
export function resolveV3Error(payload: unknown, httpStatus?: number): LalamoveErrorInfo {
  if (isEnvelope(payload)) {
    const first: LalamoveV3Error = payload.errors[0];
    const base = V3_ERROR_MAP[first.id] ?? UNKNOWN;
    if (first.id === 'ERR_INVALID_FIELD' && first.detail) {
      const hint = V3_FIELD_DETAILS[first.detail];
      return { ...base, description: hint ?? `${base.description} (campo: ${first.detail})` };
    }
    return base;
  }

  // Errata: falha de autenticação HMAC volta como 502 genérico, sem `errors[]`.
  if (httpStatus === 502) {
    return {
      title: 'Falha de autenticação com a Lalamove',
      description: 'As credenciais da integração foram recusadas. A equipe técnica foi notificada.',
      retryable: true,
    };
  }
  if (httpStatus === 429) return UAPI_RET_MAP[42201];

  return UNKNOWN;
}

/** Resolve um código `ret` da UAPI em mensagem amigável. `0` = sucesso. */
export function resolveUapiRet(ret: number): LalamoveErrorInfo | null {
  if (ret === 0) return null;
  return UAPI_RET_MAP[ret] ?? UNKNOWN;
}

/** `true` quando o erro indica que a cotação precisa ser refeita. */
export function requiresRequote(info: LalamoveErrorInfo | null): boolean {
  return info?.requiresRequote === true;
}
