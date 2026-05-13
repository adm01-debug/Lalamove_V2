import { useMemo } from 'react';
import Fuse, { IFuseOptions, FuseResult, FuseResultMatch } from 'fuse.js';

/**
 * Type utility: extends T with optional Fuse.js match metadata
 */
export type WithMatches<T> = T & { _matches?: readonly FuseResultMatch[] };

/**
 * Custom hook for fuzzy searching with Fuse.js
 * Provides typo-tolerant, intelligent search across any data set
 * 
 * Extended Search Operators:
 * - =term     : Exact match (items must include "term" exactly)
 * - ^term     : Prefix match (items must start with "term")
 * - term$     : Suffix match (items must end with "term")
 * - !term     : Negation (items must NOT include "term")
 * - 'term     : Include match (items must include "term")
 * - |         : OR operator (term1 | term2)
 * 
 * @param items - Array of items to search through
 * @param keys - Array of keys to search within each item (supports nested paths like 'user.name')
 * @param query - Search query string
 * @param options - Optional Fuse.js configuration options
 * @returns Filtered array of items matching the search query
 */
export function useFuseSearch<T>(
  items: T[],
  keys: string[],
  query: string,
  options?: Partial<IFuseOptions<T>>
): T[] {
  // Create Fuse instance with memoization
  const fuse = useMemo(() => {
    const defaultOptions: IFuseOptions<T> = {
      keys,
      threshold: 0.3, // 0.0 = exact match, 1.0 = match anything
      distance: 100, // How close the match must be to the location
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      ignoreLocation: false, // When true, doesn't care about where in the string the pattern appears
      useExtendedSearch: true, // Extended search allows for exact match (=), prefix (^), suffix ($), negation (!), include (')
      ...options,
    };
    
    return new Fuse(items, defaultOptions);
  }, [items, keys, options]);

  // Perform search with memoization
  const results = useMemo(() => {
    if (!query || query.trim().length === 0) {
      return items;
    }

    const searchResults: FuseResult<T>[] = fuse.search(query.trim());
    return searchResults.map(result => result.item);
  }, [fuse, query, items]);

  return results;
}

/**
 * Extended hook that also returns match metadata
 * Supports extended search operators: =exact, ^prefix, suffix$, !negation, 'include, term1|term2
 */
export function useFuseSearchWithMatches<T>(
  items: T[],
  keys: string[],
  query: string,
  options?: Partial<IFuseOptions<T>>
): FuseResult<T>[] {
  const fuse = useMemo(() => {
    const defaultOptions: IFuseOptions<T> = {
      keys,
      threshold: 0.3,
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      shouldSort: true,
      findAllMatches: true,
      useExtendedSearch: true,
      ...options,
    };
    
    return new Fuse(items, defaultOptions);
  }, [items, keys, options]);

  const results = useMemo(() => {
    if (!query || query.trim().length === 0) {
      return items.map((item, index) => ({
        item,
        refIndex: index,
        score: 0,
      }));
    }

    return fuse.search(query.trim());
  }, [fuse, query, items]);

  return results;
}

/**
 * Hook with configurable presets for common search scenarios
 */
export type FusePreset = 'strict' | 'balanced' | 'fuzzy';

const presetOptions: Record<FusePreset, Partial<IFuseOptions<unknown>>> = {
  strict: {
    threshold: 0.1,
    distance: 50,
    minMatchCharLength: 3,
  },
  balanced: {
    threshold: 0.3,
    distance: 100,
    minMatchCharLength: 2,
  },
  fuzzy: {
    threshold: 0.5,
    distance: 200,
    minMatchCharLength: 1,
    ignoreLocation: true,
  },
};

export function useFuseSearchWithPreset<T>(
  items: T[],
  keys: string[],
  query: string,
  preset: FusePreset = 'balanced'
): T[] {
  return useFuseSearch(items, keys, query, presetOptions[preset] as Partial<IFuseOptions<T>>);
}

/**
 * Utility function for one-time search without React hooks
 * Supports extended search operators: =exact, ^prefix, suffix$, !negation, 'include, term1|term2
 */
export function fuseSearch<T>(
  items: T[],
  keys: string[],
  query: string,
  options?: Partial<IFuseOptions<T>>
): T[] {
  if (!query || query.trim().length === 0) {
    return items;
  }

  const fuse = new Fuse(items, {
    keys,
    threshold: 0.3,
    distance: 100,
    includeScore: true,
    shouldSort: true,
    useExtendedSearch: true,
    ...options,
  });

  return fuse.search(query.trim()).map(result => result.item);
}

/**
 * Extended search syntax helper - provides info about available operators
 */
export const EXTENDED_SEARCH_HELP = {
  operators: [
    { symbol: '=', name: 'Exact', description: 'Exact match', example: '=john' },
    { symbol: '^', name: 'Prefix', description: 'Starts with', example: '^john' },
    { symbol: '$', name: 'Suffix', description: 'Ends with', example: 'john$' },
    { symbol: '!', name: 'Negation', description: 'Does not include', example: '!john' },
    { symbol: "'", name: 'Include', description: 'Must include', example: "'john" },
    { symbol: '|', name: 'OR', description: 'Match either', example: 'john | jane' },
  ],
  examples: [
    { query: '=João Silva', description: 'Find exact "João Silva"' },
    { query: '^ORD-', description: 'Find orders starting with "ORD-"' },
    { query: '@gmail.com$', description: 'Find emails ending with "@gmail.com"' },
    { query: '!cancelled', description: 'Exclude cancelled items' },
    { query: 'pending | approved', description: 'Find pending OR approved' },
    { query: "^ORD- !cancelled", description: 'Orders starting with ORD- excluding cancelled' },
  ],
};
