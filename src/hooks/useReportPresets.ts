import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AdvancedReportFilters } from '@/hooks/useAdvancedReports';
import { logger } from '@/utils/logger';

/** Preset de filtros salvo pelo usuário. */
export interface ReportPreset {
  id: string;
  name: string;
  filters: AdvancedReportFilters;
  createdAt: string;
}

const STORAGE_KEY = 'advanced-reports-presets:v1';

/** Leitura local (fallback offline / usuário não autenticado). */
function readLocalPresets(): ReportPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportPreset[]) : [];
  } catch (err) {
    logger.error('Erro ao ler presets locais de relatórios:', err);
    return [];
  }
}

function writeLocalPresets(next: ReportPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    logger.error('Erro ao salvar presets locais de relatórios:', err);
  }
}

/** Normaliza uma linha do backend para o formato do domínio. */
function rowToPreset(row: {
  id: string;
  name: string;
  filters: unknown;
  created_at: string;
}): ReportPreset {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters as AdvancedReportFilters,
    createdAt: row.created_at,
  };
}

const sortByName = (a: ReportPreset, b: ReportPreset) => a.name.localeCompare(b.name);

/**
 * Gerencia presets de filtros persistidos no backend (por usuário, com RLS).
 * Faz fallback transparente para localStorage quando não há sessão ou o
 * backend está indisponível, garantindo que a UI nunca quebre.
 */
export function useReportPresets() {
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [remote, setRemote] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setRemote(false);
      setPresets(readLocalPresets().sort(sortByName));
      return;
    }
    const { data, error } = await supabase
      .from('report_presets')
      .select('id,name,filters,created_at')
      .order('name', { ascending: true });
    if (error) {
      logger.error('Erro ao carregar presets do backend, usando local:', error);
      setRemote(false);
      setPresets(readLocalPresets().sort(sortByName));
      return;
    }
    setRemote(true);
    setPresets((data ?? []).map(rowToPreset));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sincronização em tempo real: reflete criações/edições/exclusões feitas
  // em outras abas ou dispositivos do mesmo usuário instantaneamente.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled || !auth.user) return;

      channel = supabase
        .channel(`report_presets:${auth.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'report_presets',
            filter: `user_id=eq.${auth.user.id}`,
          },
          () => {
            void load();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const savePreset = useCallback(
    async (name: string, filters: AdvancedReportFilters) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      if (remote) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { error } = await supabase
            .from('report_presets')
            .upsert(
              [{ user_id: auth.user.id, name: trimmed, filters: filters as unknown as Record<string, string> }],
              { onConflict: 'user_id,name' },
            );
          if (error) {
            logger.error('Erro ao salvar preset no backend:', error);
          }
          await load();
          return;
        }
      }

      // Fallback local (substitui preset de mesmo nome, case-insensitive).
      const local = readLocalPresets().filter(
        (p) => p.name.toLowerCase() !== trimmed.toLowerCase(),
      );
      const next = [
        ...local,
        { id: crypto.randomUUID(), name: trimmed, filters, createdAt: new Date().toISOString() },
      ].sort(sortByName);
      writeLocalPresets(next);
      setPresets(next);
    },
    [remote, load],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      if (remote) {
        const { error } = await supabase.from('report_presets').delete().eq('id', id);
        if (error) {
          logger.error('Erro ao excluir preset no backend:', error);
        }
        await load();
        return;
      }
      const next = readLocalPresets().filter((p) => p.id !== id);
      writeLocalPresets(next);
      setPresets(next);
    },
    [remote, load],
  );

  return { presets, savePreset, deletePreset };
}
