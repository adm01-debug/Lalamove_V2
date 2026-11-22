/**
 * Escapa um termo de busca para uso em filtros `ilike` do PostgREST.
 *
 * PostgREST interpreta `,`, `(`, `)`, `.` e `%` como operadores/estrutura no
 * filtro `.or(...)`. Sem escapar, um termo de usuário como `a,b)c` quebra o
 * filtro ou injeta uma condição arbitrária. Remove os caracteres que têm
 * significado no DSL do PostgREST.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[,().%\\]/g, '');
}

/**
 * Monta um filtro `.or(...)` com `ilike` para vários campos.
 *
 * Retorna uma string no formato `campo1.ilike.%termo%,campo2.ilike.%termo%`.
 * Cada valor é passado por `escapeIlike` antes de interpolar.
 */
export function buildOrIlike(fields: string[], value: string): string {
  const term = `%${escapeIlike(value)}%`;
  return fields.map((f) => `${f}.ilike.${term}`).join(',');
}
