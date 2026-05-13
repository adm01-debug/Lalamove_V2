import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ExternalTable = 'companies' | 'customers' | 'suppliers' | 'carriers' | 'contacts';

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
  [key: string]: any;
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
      if (error) throw error;
      return data as { data: ExternalRecord[]; count: number; table: string };
    },
    staleTime: 60_000,
  });
}

export function useExternalRecord(table: ExternalTable, id: string | null) {
  return useQuery({
    queryKey: ['external', table, id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: { action: 'get', table, id },
      });
      if (error) throw error;
      return data as { data: ExternalRecord };
    },
    enabled: !!id,
  });
}

export function useAddressSearch(search: string, enabled = true) {
  return useQuery({
    queryKey: ['external', 'address-search', search],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: { action: 'search_address', search, limit: 20 },
      });
      if (error) throw error;
      return data as { results: AddressSearchResult[] };
    },
    enabled: enabled && search.length >= 2,
    staleTime: 30_000,
  });
}

export function useExternalStats() {
  return useQuery({
    queryKey: ['external', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('external-companies', {
        body: { action: 'stats' },
      });
      if (error) throw error;
      return data as { counts: Record<string, number> };
    },
    staleTime: 5 * 60_000,
  });
}

export { TABLE_LABELS };
