import { useState, useEffect } from 'react';

/**
 * Hook para debounce de valores
 * Útil para inputs de busca e filtros
 * 
 * @param value - Valor a ser debounced
 * @param delay - Delay em milissegundos (padrão: 300ms)
 * @returns Valor debounced
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebouncedValue(searchTerm, 500);
 * 
 * useEffect(() => {
 *   // Busca só executa 500ms após usuário parar de digitar
 *   performSearch(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Cria timeout para atualizar valor
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpa timeout se value mudar antes do delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
