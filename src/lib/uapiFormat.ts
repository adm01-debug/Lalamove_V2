/** Formatadores compartilhados dos payloads UAPI (valores em `fen` = centavos). */

export function formatFen(fen?: number | null): string {
  const cents = typeof fen === 'number' && Number.isFinite(fen) ? fen : 0;
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** A UAPI envia epoch em segundos (às vezes em milissegundos). */
export function formatUapiTime(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
  const ms = value > 1e11 ? value : value * 1000;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}
