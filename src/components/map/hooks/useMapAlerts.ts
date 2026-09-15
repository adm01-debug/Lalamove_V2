import { useEffect, useState } from 'react';
import type { TrackingData } from './useTrackingData';

export type EtaTrend = 'improving' | 'worsening' | 'stable';

export interface EtaIndicator {
  original: number;
  current: number;
  trend: EtaTrend;
}

/**
 * Deriva estados reativos de alertas (fora de rota, parado, tendência de ETA)
 * a partir do fluxo de tracking. Isolado do LiveMap para reduzir acoplamento
 * do render de marcadores com a máquina de estado dos alertas.
 */
export function useMapAlerts(trackingData: TrackingData[]) {
  const [offRouteAlerts, setOffRouteAlerts] = useState<Set<string>>(new Set());
  const [stoppedAlerts, setStoppedAlerts] = useState<Map<string, number>>(new Map());
  const [etaIndicator, setEtaIndicator] = useState<Map<string, EtaIndicator>>(new Map());

  useEffect(() => {
    const activeIds = new Set(trackingData.map(t => t.id));

    // Off-route: derivação direta de is_on_route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffRouteAlerts(prev => {
      const next = new Set<string>();
      trackingData.forEach(t => {
        if (t.is_on_route === false) next.add(t.id);
      });
      // Preserva referência se conteúdo idêntico (evita re-render em cascata).
      if (prev.size === next.size && [...prev].every(id => next.has(id))) return prev;
      return next;
    });

    // Stopped: timestamp inicial preservado enquanto continuar parado.
    setStoppedAlerts(prev => {
      const next = new Map(prev);
      let changed = false;

      trackingData.forEach(t => {
        const isStopped = t.is_stopped === true || t.speed === 0;
        if (isStopped) {
          if (!next.has(t.id)) {
            next.set(t.id, Date.now());
            changed = true;
          }
        } else if (next.has(t.id)) {
          next.delete(t.id);
          changed = true;
        }
      });

      // Cleanup de trackings que desapareceram.
      for (const id of next.keys()) {
        if (!activeIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }

      return changed ? next : prev;
    });

    // ETA trend: compara valor atual com o anterior armazenado.
    setEtaIndicator(prev => {
      const next = new Map(prev);
      let changed = false;

      trackingData.forEach(t => {
        if (t.eta_minutes === null || t.eta_minutes === undefined) return;
        const newEta = t.eta_minutes;
        const existing = next.get(t.id);

        if (!existing) {
          next.set(t.id, { original: newEta, current: newEta, trend: 'stable' });
          changed = true;
        } else if (existing.current !== newEta) {
          const trend: EtaTrend = newEta < existing.current ? 'improving' : 'worsening';
          next.set(t.id, { ...existing, current: newEta, trend });
          changed = true;
        }
      });

      for (const id of next.keys()) {
        if (!activeIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [trackingData]);

  return { offRouteAlerts, stoppedAlerts, etaIndicator };
}
