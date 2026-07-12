import { useCallback, useEffect, useState } from 'react';
import type { AdvancedReportFilters } from '@/hooks/useAdvancedReports';
import { logger } from '@/utils/logger';

/** Preset de filtros salvo localmente pelo usuário. */
export interface ReportPreset {
  id: string;
  name: string;
  filters: AdvancedReportFilters;
  createdAt: string;
}

const STORAGE_KEY = 'advanced-reports-presets:v1';

function readPresets(): ReportPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportPreset[]) : [];
  } catch (err) {
    logger.error('Erro ao ler presets de relatórios:', err);
    return [];
  }
}

/**
 * Gerencia presets de filtros persistidos em localStorage.
 * Escopo local ao dispositivo/navegador — sem dependência de backend.
 */
export function useReportPresets() {
  const [presets, setPresets] = useState<ReportPreset[]>([]);

  useEffect(() => {
    setPresets(readPresets());
  }, []);

  const persist = useCallback((next: ReportPreset[]) => {
    setPresets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      logger.error('Erro ao salvar presets de relatórios:', err);
    }
  }, []);

  const savePreset = useCallback(
    (name: string, filters: AdvancedReportFilters) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: ReportPreset = {
        id: crypto.randomUUID(),
        name: trimmed,
        filters,
        createdAt: new Date().toISOString(),
      };
      // Substitui preset de mesmo nome (case-insensitive), senão adiciona.
      const filtered = presets.filter((p) => p.name.toLowerCase() !== trimmed.toLowerCase());
      persist([...filtered, preset].sort((a, b) => a.name.localeCompare(b.name)));
    },
    [presets, persist],
  );

  const deletePreset = useCallback(
    (id: string) => persist(presets.filter((p) => p.id !== id)),
    [presets, persist],
  );

  return { presets, savePreset, deletePreset };
}
