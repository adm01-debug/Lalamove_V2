/**
 * Etapa 16 — Timeline oficial de status Lalamove.
 *
 * A API v3 e a UAPI usam nomes de status diferentes dos legados persistidos em
 * `lalamove_status_history`. Este módulo normaliza tudo para o enum canônico,
 * reconstrói o trilho oficial do fluxo feliz e sinaliza eventos fora de ordem
 * (webhooks podem chegar duplicados ou invertidos).
 */
import {
  ORDER_STATUS_RANK,
  TERMINAL_ORDER_STATUSES,
  type LalamoveOrderStatus,
} from '@/types/lalamove';

/** Trilho do fluxo feliz exibido na UI. */
export const CANONICAL_STAGES: readonly LalamoveOrderStatus[] = [
  'ASSIGNING_DRIVER',
  'ON_GOING',
  'PICKED_UP',
  'DELIVERING',
  'COMPLETED',
];

export const STATUS_LABEL_PT: Readonly<Record<LalamoveOrderStatus, string>> = {
  ASSIGNING_DRIVER: 'Buscando motorista',
  ON_GOING: 'Motorista a caminho',
  PICKED_UP: 'Coletado',
  DELIVERING: 'Em entrega',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado',
  REJECTED: 'Rejeitado',
  EXPIRED: 'Expirado',
};

/** Aliases legados/UAPI → enum canônico. */
const STATUS_ALIASES: Readonly<Record<string, LalamoveOrderStatus>> = {
  PENDING: 'ASSIGNING_DRIVER',
  ASSIGNING_DRIVER: 'ASSIGNING_DRIVER',
  MATCHED: 'ON_GOING',
  ACCEPTED: 'ON_GOING',
  ON_GOING: 'ON_GOING',
  ONGOING: 'ON_GOING',
  PICKED_UP: 'PICKED_UP',
  PICKEDUP: 'PICKED_UP',
  DELIVERING: 'DELIVERING',
  IN_TRANSIT: 'DELIVERING',
  COMPLETED: 'COMPLETED',
  DELIVERED: 'COMPLETED',
  CANCELED: 'CANCELED',
  CANCELLED: 'CANCELED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
};

/** Converte qualquer rótulo conhecido no status canônico; `null` se desconhecido. */
export function normalizeOrderStatus(raw: unknown): LalamoveOrderStatus | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS_ALIASES[key] ?? null;
}

export type StageState = 'done' | 'current' | 'pending' | 'skipped' | 'aborted';

export interface TimelineStage {
  status: LalamoveOrderStatus;
  label: string;
  reachedAt: string | null;
  state: StageState;
}

export interface TimelineEventInput {
  id: string;
  status: string;
  old_status?: string | null;
  changed_by?: string | null;
  change_reason?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface TimelineEvent extends TimelineEventInput {
  canonical: LalamoveOrderStatus | null;
  label: string;
  /** Duração desde o evento anterior, em milissegundos (`null` no primeiro). */
  durationMsFromPrevious: number | null;
  /** Evento que regride/repete um status já alcançado (webhook fora de ordem). */
  outOfOrder: boolean;
}

export interface OrderTimeline {
  events: TimelineEvent[];
  stages: TimelineStage[];
  currentStatus: LalamoveOrderStatus | null;
  isTerminal: boolean;
  /** Terminou de forma diferente de COMPLETED (cancelado/rejeitado/expirado). */
  abortedAs: LalamoveOrderStatus | null;
  totalDurationMs: number | null;
}

function rankOf(status: LalamoveOrderStatus | null): number {
  return status === null ? -1 : ORDER_STATUS_RANK[status];
}

/** Reconstrói a linha do tempo canônica a partir do histórico persistido. */
export function buildOrderTimeline(entries: readonly TimelineEventInput[]): OrderTimeline {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));

  const reachedAt = new Map<LalamoveOrderStatus, string>();
  let highestRank = -1;
  let currentStatus: LalamoveOrderStatus | null = null;

  const events: TimelineEvent[] = sorted.map((entry, index) => {
    const canonical = normalizeOrderStatus(entry.status);
    const previous = index > 0 ? sorted[index - 1] : null;
    const prevTime = previous ? Date.parse(previous.created_at) : NaN;
    const time = Date.parse(entry.created_at);

    const rank = rankOf(canonical);
    const alreadyReached = canonical !== null && reachedAt.has(canonical);
    const outOfOrder = canonical !== null && (alreadyReached || rank < highestRank);

    if (canonical !== null && !alreadyReached) {
      reachedAt.set(canonical, entry.created_at);
    }
    if (canonical !== null && rank >= highestRank) {
      highestRank = rank;
      currentStatus = canonical;
    }

    return {
      ...entry,
      canonical,
      label: canonical ? STATUS_LABEL_PT[canonical] : entry.status,
      durationMsFromPrevious:
        Number.isFinite(prevTime) && Number.isFinite(time) ? time - prevTime : null,
      outOfOrder,
    };
  });

  const abortedAs =
    currentStatus !== null &&
    currentStatus !== 'COMPLETED' &&
    (TERMINAL_ORDER_STATUSES as readonly string[]).includes(currentStatus)
      ? currentStatus
      : null;

  const currentRank = rankOf(currentStatus);

  const stages: TimelineStage[] = CANONICAL_STAGES.map((status) => {
    const at = reachedAt.get(status) ?? null;
    let state: StageState;
    if (at !== null) {
      state = status === currentStatus ? 'current' : 'done';
    } else if (abortedAs !== null) {
      state = 'aborted';
    } else if (ORDER_STATUS_RANK[status] < currentRank) {
      // Etapa nunca reportada, mas o pedido já passou dela.
      state = 'skipped';
    } else {
      state = 'pending';
    }
    return { status, label: STATUS_LABEL_PT[status], reachedAt: at, state };
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalDurationMs =
    first && last && Number.isFinite(Date.parse(first.created_at))
      ? Date.parse(last.created_at) - Date.parse(first.created_at)
      : null;

  return {
    events,
    stages,
    currentStatus,
    isTerminal:
      currentStatus !== null &&
      (TERMINAL_ORDER_STATUSES as readonly string[]).includes(currentStatus),
    abortedAs,
    totalDurationMs,
  };
}

/** Formata uma duração em ms como "1h 12m", "45s" etc. */
export function formatDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}
