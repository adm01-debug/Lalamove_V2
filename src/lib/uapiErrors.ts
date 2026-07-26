/**
 * Etapa 22 — Tradução PT-BR dos códigos de retorno (`ret`) da UAPI Lalamove.
 *
 * A UAPI devolve sempre `{ ret, msg, data }`. `ret === 0` é sucesso; qualquer
 * outro valor é erro. A família `qp*` (13001, 27103–27105) cobre cupons e
 * pagamento pós-pago, exigida pelo fluxo de cupons.
 */

export interface UapiErrorInfo {
  /** Código numérico devolvido pela UAPI. */
  code: number;
  /** Mensagem amigável em PT-BR exibida ao operador. */
  message: string;
  /** Ação sugerida (quando existe caminho de recuperação claro). */
  hint?: string;
  /** Erros que exigem intervenção imediata do time (auth/sessão). */
  critical?: boolean;
}

export const UAPI_ERROR_MAP: Readonly<Record<number, UapiErrorInfo>> = Object.freeze({
  0: { code: 0, message: 'Operação concluída com sucesso.' },

  // ── Sessão / autenticação ────────────────────────────────────────────────
  10007: {
    code: 10007,
    message: 'Sessão UAPI expirada ou inválida.',
    hint: 'Renove o token em Configurações → UAPI. O refresh automático roda a cada 20 h.',
    critical: true,
  },
  10001: {
    code: 10001,
    message: 'Requisição não autenticada pela UAPI.',
    hint: 'Verifique o token ativo e o device_id da sessão.',
    critical: true,
  },
  10002: {
    code: 10002,
    message: 'Permissão insuficiente para esta operação na conta Lalamove.',
  },

  // ── Cupons e pagamento (família `qp`) ────────────────────────────────────
  13001: {
    code: 13001,
    message: 'Cupom inválido ou inexistente.',
    hint: 'Confira o código digitado — ele é sensível a maiúsculas.',
  },
  27103: {
    code: 27103,
    message: 'Cupom já utilizado.',
    hint: 'Cada cupom só pode ser resgatado uma vez por conta.',
  },
  27104: {
    code: 27104,
    message: 'Cupom expirado.',
    hint: 'Solicite um novo código ao time comercial da Lalamove.',
  },
  27105: {
    code: 27105,
    message: 'Cupom não elegível para esta conta ou cidade.',
    hint: 'Cupons são vinculados a cidade, serviço e faixa de valor.',
  },

  // ── Pedido ───────────────────────────────────────────────────────────────
  20001: { code: 20001, message: 'Pedido não encontrado na Lalamove.' },
  20002: {
    code: 20002,
    message: 'Pedido não pode ser cancelado no estado atual.',
    hint: 'Após a coleta o cancelamento precisa ser tratado pelo suporte.',
  },

  // ── Saldo ────────────────────────────────────────────────────────────────
  30001: {
    code: 30001,
    message: 'Saldo insuficiente na carteira Lalamove.',
    hint: 'Recarregue a carteira antes de criar novos pedidos.',
  },

  // ── Rate limit ───────────────────────────────────────────────────────────
  42201: {
    code: 42201,
    message: 'Limite de requisições da Lalamove atingido.',
    hint: 'Aguarde a janela de reset — o painel de quota mostra o horário.',
  },
});

/** Resolve um `ret` da UAPI para mensagem amigável, com fallback seguro. */
export function resolveUapiError(ret: number, rawMessage?: string | null): UapiErrorInfo {
  const known = UAPI_ERROR_MAP[ret];
  if (known) return known;

  return {
    code: ret,
    message: rawMessage?.trim()
      ? `Erro Lalamove (${ret}): ${rawMessage.trim()}`
      : `Erro Lalamove não catalogado (código ${ret}).`,
  };
}

/** `true` quando o erro indica falha de autenticação e deve gerar alerta. */
export function isUapiAuthFailure(ret: number): boolean {
  return UAPI_ERROR_MAP[ret]?.critical === true;
}
