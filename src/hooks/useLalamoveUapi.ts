import { useCallback, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveUapiError } from '@/lib/uapiErrors';
import { isLalamoveConfigured } from '@/lib/lalamove-config';

/**
 * Camada de acesso às operações UAPI já expostas pela Edge Function
 * `lalamove-uapi`. Etapas 20–23: histórico com cursor, extratos/comprovantes,
 * cupons e frota (favoritos/bloqueados).
 */

export interface UapiEnvelope<T> {
  ret: number;
  msg?: string;
  data?: T;
}

export class UapiError extends Error {
  readonly code: number;
  readonly hint?: string;

  constructor(code: number, message: string, hint?: string) {
    super(message);
    this.name = 'UapiError';
    this.code = code;
    this.hint = hint;
  }
}

async function invokeUapi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('lalamove-uapi', {
    body: { action, ...body },
  });

  if (error) throw new UapiError(-1, error.message || 'Falha ao contatar a Lalamove');

  const envelope = data as (UapiEnvelope<T> & { error?: string }) | null;
  if (!envelope) throw new UapiError(-1, 'Resposta vazia da Lalamove');
  if (typeof envelope.error === 'string') throw new UapiError(-1, envelope.error);

  if (typeof envelope.ret === 'number' && envelope.ret !== 0) {
    const info = resolveUapiError(envelope.ret, envelope.msg);
    throw new UapiError(info.code, info.message, info.hint);
  }

  return (envelope.data ?? ({} as T)) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 20 — histórico paginado por cursor (`last_id`)
// ─────────────────────────────────────────────────────────────────────────────

export interface UapiOrderSummary {
  order_uuid: string;
  order_display_id?: string;
  order_status?: number;
  create_time?: number;
  total_fee_fen?: number;
  from_address?: string;
  to_address?: string;
}

interface OrderListPage {
  orders: UapiOrderSummary[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

function extractOrders(payload: unknown): UapiOrderSummary[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const candidate = record.list ?? record.orders ?? record.items;
  return Array.isArray(candidate) ? (candidate as UapiOrderSummary[]) : [];
}

/**
 * A UAPI não devolve `total`; a paginação é por cursor opaco (`last_id` = uuid
 * do último item). A página seguinte só existe quando a atual veio cheia.
 */
export function useUapiOrderHistory(statuses?: number[]) {
  return useInfiniteQuery<OrderListPage, UapiError>({
    queryKey: ['uapi', 'order-history', statuses ?? 'all'],
    initialPageParam: '',
    queryFn: async ({ pageParam }) => {
      const raw = await invokeUapi<unknown>('list-orders', {
        limit: PAGE_SIZE,
        last_id: (pageParam as string) || '',
        ...(statuses?.length ? { order_statuses: statuses } : {}),
      });
      const orders = extractOrders(raw);
      const last = orders[orders.length - 1];
      return {
        orders,
        nextCursor: orders.length === PAGE_SIZE && last ? last.order_uuid : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    enabled: isLalamoveConfigured(),
    retry: false,
  });
}

/** Achata as páginas removendo duplicatas por `order_uuid`. */
export function flattenOrderPages(pages: OrderListPage[] | undefined): UapiOrderSummary[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const result: UapiOrderSummary[] = [];
  for (const page of pages) {
    for (const order of page.orders) {
      if (!order?.order_uuid || seen.has(order.order_uuid)) continue;
      seen.add(order.order_uuid);
      result.push(order);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 21 — extratos e comprovantes
// ─────────────────────────────────────────────────────────────────────────────

export interface UapiWalletTransaction {
  id?: string;
  flow_id?: string;
  amount_fen?: number;
  balance_fen?: number;
  remark?: string;
  create_time?: number;
  trans_type?: number;
}

export function useUapiWalletStatement(page: number, startTime?: string, endTime?: string) {
  return useQuery<UapiWalletTransaction[], UapiError>({
    queryKey: ['uapi', 'wallet-statement', page, startTime, endTime],
    queryFn: async () => {
      const raw = await invokeUapi<unknown>('wallet-transactions', {
        page_no: page,
        page_size: PAGE_SIZE,
        ...(startTime ? { start_time: startTime } : {}),
        ...(endTime ? { end_time: endTime } : {}),
      });
      if (!raw || typeof raw !== 'object') return [];
      const record = raw as Record<string, unknown>;
      const list = record.list ?? record.items;
      return Array.isArray(list) ? (list as UapiWalletTransaction[]) : [];
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
  });
}

/** Extrai a URL do PDF de comprovante devolvida pela UAPI. */
function extractReceiptUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  for (const key of ['url', 'pdf_url', 'receipt_url', 'download_url']) {
    const value = record[key];
    if (typeof value === 'string' && value.startsWith('http')) return value;
  }
  return null;
}

export function useDownloadReceipt() {
  return useMutation<string, UapiError, string>({
    mutationFn: async (orderUuid: string) => {
      const raw = await invokeUapi<unknown>('download-receipt', { order_uuid: orderUuid });
      const url = extractReceiptUrl(raw);
      if (!url) throw new UapiError(-1, 'A Lalamove não devolveu um comprovante para este pedido.');
      return url;
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 22 — cupons
// ─────────────────────────────────────────────────────────────────────────────

export interface UapiCoupon {
  coupon_id?: string;
  name?: string;
  amount_fen?: number;
  expire_time?: number;
  status?: number;
  description?: string;
}

export function useUapiCoupons(page = 1) {
  return useQuery<UapiCoupon[], UapiError>({
    queryKey: ['uapi', 'coupons', page],
    queryFn: async () => {
      const raw = await invokeUapi<unknown>('coupons', { page_no: page, page_size: PAGE_SIZE });
      if (!raw || typeof raw !== 'object') return [];
      const record = raw as Record<string, unknown>;
      const list = record.list ?? record.coupons ?? record.items;
      return Array.isArray(list) ? (list as UapiCoupon[]) : [];
    },
    staleTime: 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
  });
}

export function useExchangeCoupon() {
  const qc = useQueryClient();
  return useMutation<unknown, UapiError, string>({
    mutationFn: (code: string) => invokeUapi('exchange-coupon', { code: code.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['uapi', 'coupons'] });
      void qc.invalidateQueries({ queryKey: ['uapi', 'wallet'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Etapa 23 — frota (favoritos e bloqueados)
// ─────────────────────────────────────────────────────────────────────────────

export type FleetKind = 'favorites' | 'blocked';

export interface UapiFleetDriver {
  driver_fid: string;
  name?: string;
  phone?: string;
  plate_number?: string;
  vehicle_type?: string;
  rating?: number;
}

export function useUapiFleet(kind: FleetKind, search?: string) {
  return useQuery<UapiFleetDriver[], UapiError>({
    queryKey: ['uapi', 'fleet', kind, search ?? ''],
    queryFn: async () => {
      const raw = await invokeUapi<unknown>(
        kind === 'favorites' ? 'fleet-favorites' : 'fleet-blocked',
        { page_no: 1, page_size: 50, ...(search ? { search } : {}) },
      );
      if (!raw || typeof raw !== 'object') return [];
      const record = raw as Record<string, unknown>;
      const list = record.list ?? record.drivers ?? record.items;
      return Array.isArray(list) ? (list as UapiFleetDriver[]) : [];
    },
    staleTime: 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
  });
}

export interface FleetMutationInput {
  driverFid: string;
  action: 'add' | 'remove' | 'block' | 'unblock';
}

export function useFleetMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, UapiError, FleetMutationInput>({
    mutationFn: ({ driverFid, action }) =>
      invokeUapi(action === 'add' || action === 'remove' ? 'favorite-driver' : 'block-driver', {
        driver_fid: driverFid,
        action,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['uapi', 'fleet'] });
    },
  });
}

/** Estado local reutilizável para busca com debounce simples em painéis. */
export function useFleetSearch() {
  const [term, setTerm] = useState('');
  const reset = useCallback(() => setTerm(''), []);
  return { term, setTerm, reset };
}
