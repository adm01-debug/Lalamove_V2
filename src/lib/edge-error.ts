import { FunctionsHttpError } from '@supabase/supabase-js';

export interface EdgeFieldError {
  field: string;
  message: string;
  code?: string;
}

export interface EdgeErrorInfo {
  code: string;
  message: string;
  fields: EdgeFieldError[];
}

/**
 * Normaliza o erro de uma Edge Function para o formato único de erro
 * (`{ error: { code, message, fields } }`).
 *
 * - `FunctionsHttpError`: lê `error.context.json()` (o body da resposta).
 * - Caso o body siga o formato único, devolve `{ code, message, fields }`.
 * - Qualquer outro caso devolve `null` (o chamador mantém o fallback atual).
 */
export async function parseEdgeError(error: unknown): Promise<EdgeErrorInfo | null> {
  if (!(error instanceof FunctionsHttpError)) return null;

  let body: unknown;
  try {
    body = await error.context.json();
  } catch {
    return null;
  }

  if (!body || typeof body !== 'object') return null;
  const err = (body as { error?: unknown }).error;

  // Formato legado das edges mais antigas: `{ error: 'texto', message?: 'detalhe' }`
  // (ex.: `lalamove-uapi` responde 401 com `error: 'No active UAPI session'`).
  // Sem tratar isso, o operador via só "Edge Function returned a non-2xx status code".
  if (typeof err === 'string' && err.trim()) {
    const legacyMessage = (body as { message?: unknown }).message;
    return {
      code: 'LEGACY_ERROR',
      message:
        typeof legacyMessage === 'string' && legacyMessage.trim() ? legacyMessage : err.trim(),
      fields: [],
    };
  }

  if (!err || typeof err !== 'object') return null;

  const e = err as { code?: unknown; message?: unknown; fields?: unknown };
  return {
    code: typeof e.code === 'string' ? e.code : 'UNKNOWN',
    message: typeof e.message === 'string' ? e.message : 'Erro na Edge Function',
    fields: Array.isArray(e.fields)
      ? (e.fields as EdgeFieldError[]).filter(
          (f) => f && typeof f === 'object' && typeof f.field === 'string',
        )
      : [],
  };
}

/**
 * Gera a mensagem de erro para toast a partir de um `EdgeErrorInfo`.
 * Se houver `fields`, destaca o primeiro campo (`field: message`); senão usa `message`.
 */
export function formatEdgeError(info: EdgeErrorInfo): string {
  if (info.fields.length > 0) {
    const f = info.fields[0];
    return `${f.field}: ${f.message}`;
  }
  return info.message;
}
