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
/**
 * Recursos que o painel consome e cuja ausência congela uma tela inteira.
 * O snapshot global pode parecer saudável (qualquer recurso gravado move o
 * `max(updated_at)`) enquanto um destes parou de ser coletado — a regra por
 * recurso é o que nomeia a tela congelada em vez de esconder o problema.
 */
export const CRITICAL_SNAPSHOT_RESOURCES = [
  'wallet_balance',
  'wallet_flow_list',
  'coupon_list_web',
  'order_list_new',
  'get_fleet',
] as const;

export interface SnapshotResourceRow {
  resource: string;
  updated_at: string;
}

export interface ResourceFreshness {
  /** Recurso crítico sem nenhuma linha no snapshot. */
  missing: string[];
  /** Recurso crítico com linha, mas parado há mais que a janela. */
  stale: { resource: string; ageMinutes: number }[];
  /** Recurso crítico mais antigo (base do alerta). */
  oldestAgeMinutes: number | null;
}

/** Chave do recurso sem o sufixo de página/cursor (`wallet_flow_list:p2`). */
export function baseResource(resource: string): string {
  const separator = resource.indexOf(':');
  return separator === -1 ? resource : resource.slice(0, separator);
}

export function evaluateResourceFreshness(
  rows: SnapshotResourceRow[],
  nowMs: number,
  staleAfterMinutes: number,
  critical: readonly string[] = CRITICAL_SNAPSHOT_RESOURCES,
): ResourceFreshness {
  const newestByResource = new Map<string, number>();
  for (const row of rows) {
    const collectedMs = new Date(row.updated_at).getTime();
    if (Number.isNaN(collectedMs)) continue;
    const key = baseResource(row.resource);
    const current = newestByResource.get(key);
    if (current === undefined || collectedMs > current) newestByResource.set(key, collectedMs);
  }

  const missing: string[] = [];
  const stale: { resource: string; ageMinutes: number }[] = [];

  for (const resource of critical) {
    const collectedMs = newestByResource.get(resource);
    if (collectedMs === undefined) {
      missing.push(resource);
      continue;
    }
    const ageMinutes = Number(((nowMs - collectedMs) / 60_000).toFixed(1));
    if (ageMinutes > staleAfterMinutes) stale.push({ resource, ageMinutes });
  }

  const ages = critical
    .map((resource) => newestByResource.get(resource))
    .filter((value): value is number => value !== undefined)
    .map((collectedMs) => (nowMs - collectedMs) / 60_000);

  return {
    missing,
    stale,
    oldestAgeMinutes: ages.length ? Number(Math.max(...ages).toFixed(1)) : null,
  };
}