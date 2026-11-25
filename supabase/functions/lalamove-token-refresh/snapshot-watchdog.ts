/**
 * Regra do watchdog do snapshot UAPI, isolada do worker para poder ser testada
 * sem banco.
 *
 * O snapshot só serve o painel enquanto está fresco: a edge `lalamove-uapi`
 * responde do snapshot e para de responder quando `expires_at` vence. Medir a
 * idade da última coleta é o que transforma "coletor morreu" em alerta, em vez
 * de erro do gateway na cara do usuário.
 */

export type SnapshotHealthReason = 'fresh' | 'stale' | 'empty';

export interface SnapshotHealth {
  healthy: boolean;
  /** Idade da última coleta em minutos (1 casa decimal); null quando não há coleta. */
  ageMinutes: number | null;
  reason: SnapshotHealthReason;
}

export function evaluateSnapshotHealth(
  updatedAt: string | null,
  nowMs: number,
  staleAfterMinutes: number,
): SnapshotHealth {
  if (!updatedAt) return { healthy: false, ageMinutes: null, reason: 'empty' };

  const collectedMs = new Date(updatedAt).getTime();
  if (Number.isNaN(collectedMs)) return { healthy: false, ageMinutes: null, reason: 'empty' };

  const ageMinutes = Number(((nowMs - collectedMs) / 60_000).toFixed(1));
  const healthy = ageMinutes <= staleAfterMinutes;
  return { healthy, ageMinutes, reason: healthy ? 'fresh' : 'stale' };
}