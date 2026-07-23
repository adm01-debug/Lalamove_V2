/**
 * Utilidades para CEP brasileiro:
 * - Validação de formato (8 dígitos, não sequencial)
 * - Máscara automática (00000-000)
 * - Consulta ViaCEP com timeout e normalização de endereço
 */

const CEP_DIGITS = /^\d{8}$/;
// CEPs "poison" comuns (00000000, 11111111, ...): sempre rejeitar
const SEQUENTIAL_CEP = /^(\d)\1{7}$/;

export interface CepValidation {
  valid: boolean;
  digits: string; // 8 dígitos, sem máscara
  masked: string; // 00000-000
  error: string;
}

export function sanitizeCep(raw: string): string {
  return (raw || '').replace(/\D+/g, '').slice(0, 8);
}

export function maskCep(raw: string): string {
  const d = sanitizeCep(raw);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function validateCep(raw: string): CepValidation {
  const digits = sanitizeCep(raw);
  const masked = maskCep(digits);
  if (digits.length === 0) {
    return { valid: false, digits, masked, error: 'CEP obrigatório' };
  }
  if (!CEP_DIGITS.test(digits)) {
    return { valid: false, digits, masked, error: 'CEP deve conter 8 dígitos' };
  }
  if (SEQUENTIAL_CEP.test(digits)) {
    return { valid: false, digits, masked, error: 'CEP inválido' };
  }
  return { valid: true, digits, masked, error: '' };
}

export interface ViaCepAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  formatted: string;
}

interface ViaCepRaw {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

/**
 * Consulta ViaCEP (API pública gratuita) com timeout de 4s.
 * Retorna endereço normalizado ou lança Error com mensagem PT-BR.
 */
export async function lookupCep(rawCep: string, signal?: AbortSignal): Promise<ViaCepAddress> {
  const v = validateCep(rawCep);
  if (!v.valid) throw new Error(v.error);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const composedSignal = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${v.digits}/json/`, {
      signal: composedSignal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Falha ao consultar CEP (${res.status})`);
    const data = (await res.json()) as ViaCepRaw;
    if (data?.erro) throw new Error('CEP não encontrado');

    const logradouro = (data.logradouro ?? '').trim();
    const bairro = (data.bairro ?? '').trim();
    const cidade = (data.localidade ?? '').trim();
    const uf = (data.uf ?? '').trim().toUpperCase();

    if (!cidade || !uf) throw new Error('CEP incompleto na base pública');

    const parts = [logradouro, bairro, `${cidade} - ${uf}`, v.masked].filter(Boolean);
    return {
      cep: v.masked,
      logradouro,
      bairro,
      cidade,
      uf,
      formatted: parts.join(', '),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Tempo esgotado ao consultar CEP');
    }
    throw err instanceof Error ? err : new Error('Erro ao consultar CEP');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normaliza um endereço mesclando número/complemento fornecidos pelo usuário
 * com o endereço base retornado do ViaCEP.
 */
export function composeAddress(
  base: ViaCepAddress,
  extras: { number?: string; complement?: string } = {},
): string {
  const number = (extras.number ?? '').trim();
  const complement = (extras.complement ?? '').trim();
  const street = base.logradouro
    ? number
      ? `${base.logradouro}, ${number}`
      : base.logradouro
    : '';
  const parts = [
    street,
    complement,
    base.bairro,
    `${base.cidade} - ${base.uf}`,
    base.cep,
  ].filter(Boolean);
  return parts.join(', ');
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = (): void => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}
