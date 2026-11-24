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

// ─────────────────────────────────────────────────────────────────────────────
// Falta de sessão: não é falha, é configuração pendente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mensagens da edge `lalamove-uapi` quando não há sessão ativa. Ela responde
 * 401 com `{ error: 'No active UAPI session', message: '... set-token' }`, ou
 * seja: fora do formato único de erro (que usa `error` como objeto), sem `code`.
 */
const UAPI_SESSION_MISSING_PATTERNS: readonly RegExp[] = [
  /no active uapi session/i,
  /configure a uapi session token/i,
  /nenhuma sess[ãa]o uapi/i,
  /sess[ãa]o uapi (n[ãa]o )?(ativa|configurada|expirada|inv[áa]lida)/i,
];

/** `ret` da UAPI que significam "sem sessão válida". */
const UAPI_SESSION_MISSING_CODES: readonly number[] = [10001, 10007];

export const UAPI_SESSION_MISSING_MESSAGE = 'Sessão UAPI não configurada.';

export const UAPI_SESSION_MISSING_HINT =
  'Carteira, extrato, cupons e frota dependem dos 2 tokens do portal Lalamove ' +
  '(token e raw.refresh_token). Salve-os em Configurações → UAPI — depois disso a ' +
  'renovação é automática a cada 20 h.';

/**
 * `true` quando o erro é "não existe sessão UAPI" — caso em que a tela deve
 * mandar o operador configurar, e não sugerir um bug.
 */
export function isUapiSessionMissing(input: unknown): boolean {
  if (typeof input === 'string') {
    return UAPI_SESSION_MISSING_PATTERNS.some((pattern) => pattern.test(input));
  }

  if (!input || typeof input !== 'object') return false;

  const candidate = input as { message?: unknown; hint?: unknown; code?: unknown };
  if (typeof candidate.code === 'number' && UAPI_SESSION_MISSING_CODES.includes(candidate.code)) {
    return true;
  }

  return [candidate.message, candidate.hint].some(
    (text) =>
      typeof text === 'string' &&
      UAPI_SESSION_MISSING_PATTERNS.some((pattern) => pattern.test(text)),
  );
}
