import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isBitrixConfigured } from '@/lib/bitrix-config';
import { parseEdgeError, formatEdgeError } from '@/lib/edge-error';

export type ExternalTable =
  | 'companies'
  | 'customers'
  | 'suppliers'
  | 'carriers'
  | 'contacts'
  | 'supplier_branches';

export interface ExternalRecord {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  type?: string;
  [key: string]: unknown;
}

export interface AddressSearchResult extends ExternalRecord {
  source_table: ExternalTable;
  display_name: string;
  full_address: string;
}

const TABLE_LABELS: Record<ExternalTable, string> = {
  companies: 'Empresas',
  customers: 'Clientes',
  suppliers: 'Fornecedores',
  carriers: 'Transportadoras',
  contacts: 'Contatos',
  supplier_branches: 'Filiais',
};

export function useExternalList(table: ExternalTable, search?: string, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['external', table, search, page, pageSize],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: {
          action: 'list',
          table,
          search: search || undefined,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        },
      });
      if (error) await edgeThrow(error);
      return data as { data: ExternalRecord[]; count: number; table: string };
    },
    staleTime: 60_000,
    enabled: isBitrixConfigured(),
    retry: false,
  });
}

export function useExternalRecord(table: ExternalTable, id: string | null) {
  return useQuery({
    queryKey: ['external', table, id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: { action: 'get', table, id },
      });
      if (error) await edgeThrow(error);
      return data as { data: ExternalRecord };
    },
    enabled: !!id && isBitrixConfigured(),
    retry: false,
  });
}

export function useAddressSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: ['external', 'address-search', search],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: { action: 'search_address', search, limit: 20 },
      });
      if (error) await edgeThrow(error);
      return data as { results: AddressSearchResult[] };
    },
    enabled: enabled && search.length >= 2 && isBitrixConfigured(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useExternalStats() {
  return useQuery({
    queryKey: ['external', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: { action: 'stats' },
      });
      if (error) await edgeThrow(error);
      return data as { counts: Record<string, number> };
    },
    staleTime: 5 * 60_000,
    enabled: isBitrixConfigured(),
    retry: false,
  });
}

/** Relança o erro de uma Edge Function com a mensagem do formato único. */
async function edgeThrow(error: unknown): Promise<never> {
  const edge = await parseEdgeError(error);
  throw new Error(
    edge ? formatEdgeError(edge) : error instanceof Error ? error.message : 'Erro na Edge Function',
  );
}

export { TABLE_LABELS };
