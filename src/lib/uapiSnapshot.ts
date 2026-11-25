/**
 * Idade da cópia coletada pelo robô (snapshot da UAPI).
 *
 * O gateway assinado da Lalamove recusa leitura direta feita fora do navegador
 * (`ret 10010`), então o painel é servido pela última coleta do robô (a cada
 * 30 min, validade de 6h no banco). Sem indicador, o operador não distingue
 * um saldo de 30 s de um saldo de 5 h.
 */

export type SnapshotTone = 'live' | 'fresh' | 'stale';

export interface UapiSnapshotInfo {
  servedFromSnapshot?: boolean;
  snapshotCollectedAt?: string | null;
}

export interface SnapshotDescription {
  tone: SnapshotTone;
  label: string;
  title: string;
}

/** O coletor roda a cada 30 min; dois ciclos perdidos (60 min) já indicam robô parado. */
export const SNAPSHOT_STALE_MINUTES = 60;

function humanizeAge(minutes: number): string {
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function formatCollectedAt(collectedMs: number): string {
  return new Date(collectedMs).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function describeSnapshotAge(
  info: UapiSnapshotInfo | null | undefined,
  now: number = Date.now(),
): SnapshotDescription {
  const collectedMs = info?.snapshotCollectedAt ? Date.parse(info.snapshotCollectedAt) : Number.NaN;

  if (!info?.servedFromSnapshot) {
    return {
      tone: 'live',
      label: 'Ao vivo',
      title: 'Dados lidos da Lalamove agora, sem usar a cópia do robô.',
    };
  }

  if (!Number.isFinite(collectedMs)) {
    return {
      tone: 'stale',
      label: 'Coleta sem horário',
      title: 'O painel está usando a cópia do robô, mas o horário da coleta não foi informado.',
    };
  }

  const minutes = Math.max(0, Math.floor((now - collectedMs) / 60_000));
  const tone: SnapshotTone = minutes >= SNAPSHOT_STALE_MINUTES ? 'stale' : 'fresh';

  return {
    tone,
    label: `Coleta há ${humanizeAge(minutes)}`,
    title: tone === 'stale'
      ? `Cópia do robô Lalamove de ${formatCollectedAt(collectedMs)}. O robô pode estar parado — confira a sessão UAPI.`
      : `Cópia do robô Lalamove de ${formatCollectedAt(collectedMs)}.`,
  };
}