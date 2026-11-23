/**
 * Hook para busca e persistência de contatos reutilizáveis.
 * Dedup por (owner_id, phone_e164) — insert-or-update via upsert.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { supabase } from '@/integrations/supabase/client';

export interface Contact {
  id: string;
  owner_id: string;
  name: string;
  phone_e164: string;
  address: string | null;
  kind: 'sender' | 'recipient' | 'both';
  usage_count: number;
  last_used_at: string;
}

export type ContactKind = Contact['kind'];

const CONTACTS_QUERY_KEY = ['contacts'] as const;

async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('last_used_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export function useContacts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: CONTACTS_QUERY_KEY,
    queryFn: fetchContacts,
    staleTime: 60_000,
  });

  const fuse = useMemo(() => {
    if (!query.data?.length) return null;
    return new Fuse(query.data, {
      keys: [
        { name: 'name', weight: 0.6 },
        { name: 'phone_e164', weight: 0.3 },
        { name: 'address', weight: 0.1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [query.data]);

  const search = (term: string, kind?: ContactKind, limit = 8): Contact[] => {
    const list = query.data ?? [];
    const filtered = kind
      ? list.filter(c => c.kind === kind || c.kind === 'both')
      : list;
    const trimmed = term.trim();
    if (!trimmed) return filtered.slice(0, limit);
    if (!fuse) return [];
    return fuse
      .search(trimmed)
      .map(r => r.item)
      .filter(c => (kind ? c.kind === kind || c.kind === 'both' : true))
      .slice(0, limit);
  };

  const upsertMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      phoneE164: string;
      address?: string | null;
      kind: ContactKind;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData.user?.id;
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Dedup: se o contato já existe (owner + phone), incrementa uso e atualiza campos.
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, usage_count, kind')
        .eq('owner_id', ownerId)
        .eq('phone_e164', input.phoneE164)
        .maybeSingle();

      if (existing) {
        const nextKind: ContactKind =
          existing.kind === input.kind ? existing.kind : 'both';
        const { data, error } = await supabase
          .from('contacts')
          .update({
            name: input.name,
            address: input.address ?? null,
            kind: nextKind,
            usage_count: (existing.usage_count ?? 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data as Contact;
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          owner_id: ownerId,
          name: input.name,
          phone_e164: input.phoneE164,
          address: input.address ?? null,
          kind: input.kind,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; name?: string; address?: string | null; kind?: ContactKind }) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase
        .from('contacts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    search,
    upsertContact: upsertMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    isMutating: updateMutation.isPending || deleteMutation.isPending,
  };
}

