import { useCallback, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveUapiError, isUapiSessionMissing, UAPI_SESSION_MISSING_HINT, UAPI_SESSION_MISSING_MESSAGE } from '@/lib/uapiErrors';
import { isLalamoveConfigured } from '@/lib/lalamove-config';
import { parseWalletFlow } from '@/lib/lalamoveUapiPayload';
import { parseEdgeError } from '@/lib/edge-error';

/**
 * Camada de acesso às operações UAPI já expostas pela Edge Function
 * `lalamove-uapi`. Etapas 20–23: histórico com cursor, extratos/comprovantes,
 * cupons e frota (favoritos/bloqueados).
 *
 * Os hooks de leitura também devolvem `freshness` — a UAPI só responde de dentro
 * do navegador, então o painel costuma ser servido por uma cópia coletada pelo
 * robô e o operador precisa saber a idade dela.
 */

export interface UapiEnvelope<T> {
  ret: number;
  msg?: string;
  data?: T;
}

/** Procedência da resposta: se veio da cópia coletada pelo robô e quando foi coletada. */
export interface UapiFreshness {
  servedFromSnapshot: boolean;
  snapshotCollectedAt: string | null;
}

/** Formato padrão das listas UAPI: itens + procedência do dado. */
export interface UapiList<T> {
  items: T[];
  freshness: UapiFreshness;
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

interface UapiRawResponse<T> {
  data: T;
  freshness: UapiFreshness;
}

async function invokeUapiRaw<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<UapiRawResponse<T>> {
  const { data, error } = await supabase.functions.invoke('lalamove-uapi', {
    body: { action, ...body },
  });

  if (error) {
    const edge = await parseEdgeError(error);
    const raw = edge?.message || error.message || 'Falha ao contatar a Lalamove';
    if (isUapiSessionMissing(raw)) {
      throw new UapiError(-1, UAPI_SESSION_MISSING_MESSAGE, UAPI_SESSION_MISSING_HINT);
    }
    throw new UapiError(-1, raw);
  }

  const envelope = data as (UapiEnvelope<T> & { error?: string }) | null;
  if (!envelope) throw new UapiError(-1, 'Resposta vazia da Lalamove');
  if (typeof envelope.error === 'string') {
    if (isUapiSessionMissing(envelope.error)) {
      throw new UapiError(-1, UAPI_SESSION_MISSING_MESSAGE, UAPI_SESSION_MISSING_HINT);
    }
    throw new UapiError(-1, envelope.error);
  }

  if (typeof envelope.ret === 'number' && envelope.ret !== 0) {
    const info = resolveUapiError(envelope.ret, envelope.msg);
    throw new UapiError(info.code, info.message, info.hint);
  }

  const meta = (envelope as { _meta?: Partial<UapiFreshness> })._meta;
  return {
    data: (envelope.data ?? ({} as T)) as T,
    freshness: {
      servedFromSnapshot: meta?.servedFromSnapshot === true,
      snapshotCollectedAt: meta?.snapshotCollectedAt ?? null,
    },
  };
}

async function invokeUapi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  return (await invokeUapiRaw<T>(action, body)).data;
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
  freshness: UapiFreshness;
}

interface RawOrder {
  order_uuid?: string;
  order_display_id?: string;
  order_status?: number | string;
  order_time?: number | string;
  order_datetime_hts?: number | string;
  final_price_fen?: number | string;
  price_total_fen?: number | string;
  addr_info?: Array<{ addr?: string; name?: string }>;
}

const PAGE_SIZE = 20;

/** Número tolerante: a UAPI manda vários campos numéricos como texto. */
function toFiniteNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `list-orders` → `data.order_base_info` (a UAPI não usa `list`).
 *
 * Endereços vêm em `addr_info` (paradas na ordem), o valor em `final_price_fen`
 * e a data em `order_time` (epoch em segundos). O cursor é o `last_id` opaco
 * devolvido pelo próprio payload, encerrado quando `is_end` vem ligado.
 */
export function extractOrderPage(payload: unknown): { orders: UapiOrderSummary[]; nextCursor: string | null } {
  if (!payload || typeof payload !== 'object') return { orders: [], nextCursor: null };
  const record = payload as Record<string, unknown>;
  const candidate = record.order_base_info ?? record.list ?? record.orders ?? record.items;
  const raw = Array.isArray(candidate) ? (candidate as RawOrder[]) : [];

  const orders: UapiOrderSummary[] = [];
  for (const item of raw) {
    const orderUuid = typeof item?.order_uuid === 'string' ? item.order_uuid : '';
    if (!orderUuid) continue;
    const stops = Array.isArray(item.addr_info) ? item.addr_info : [];
    const first = stops[0];
    const last = stops[stops.length - 1];
    const createTime =
      toFiniteNumber(item.order_time) ?? (() => {
        const ms = toFiniteNumber(item.order_datetime_hts);
        return ms != null && ms > 0 ? Math.floor(ms / 1000) : undefined;
      })();
    const fee = toFiniteNumber(item.final_price_fen) ?? toFiniteNumber(item.price_total_fen);
    const status = toFiniteNumber(item.order_status);
    orders.push({
      order_uuid: orderUuid,
      ...(item.order_display_id ? { order_display_id: String(item.order_display_id) } : {}),
      ...(status != null ? { order_status: status } : {}),
      ...(createTime != null ? { create_time: createTime } : {}),
      ...(fee != null ? { total_fee_fen: fee } : {}),
      from_address: (first?.addr ?? first?.name ?? '').trim(),
      to_address: (last?.addr ?? last?.name ?? '').trim(),
    });
  }

  const isEnd = record.is_end === 1 || record.is_end === true;
  const lastId = typeof record.last_id === 'string' ? record.last_id : '';
  return { orders, nextCursor: !isEnd && lastId ? lastId : null };
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
      const { data: raw, freshness } = await invokeUapiRaw<unknown>('list-orders', {
        limit: PAGE_SIZE,
        last_id: (pageParam as string) || '',
        ...(statuses?.length ? { order_statuses: statuses } : {}),
      });
      const orders = extractOrderPage(raw);
      return {
        orders: orders.orders,
        nextCursor: orders.nextCursor,
        freshness,
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

/** Frescor da última página carregada (a coleta pode mudar entre páginas). */
export function lastPageFreshness(pages: OrderListPage[] | undefined): UapiFreshness | undefined {
  return pages?.[pages.length - 1]?.freshness;
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
  return useQuery<UapiList<UapiWalletTransaction>, UapiError>({
    queryKey: ['uapi', 'wallet-statement', page, startTime, endTime],
    queryFn: async () => {
      const { data: raw, freshness } = await invokeUapiRaw<unknown>('wallet-transactions', {
        page_no: page,
        page_size: PAGE_SIZE,
        ...(startTime ? { start_time: startTime } : {}),
        ...(endTime ? { end_time: endTime } : {}),
      });
      if (!raw || typeof raw !== 'object') return { items: [], freshness };
      // A UAPI devolve `flow_item_arr` com `date_time` textual; o parser central
      // converte para o shape da tabela (`create_time` em epoch, `amount_fen`).
      // Ler `record.list` cru deixava a tabela sempre vazia.
      const flow = parseWalletFlow({ data: raw });
      const items: UapiWalletTransaction[] = flow.items.map((tx) => ({
        flow_id: tx.id,
        amount_fen: tx.amount_fen,
        ...(tx.balance_fen != null ? { balance_fen: tx.balance_fen } : {}),
        remark: [tx.description, tx.remark].filter(Boolean).join(' · '),
        ...(tx.create_time != null ? { create_time: tx.create_time } : {}),
      }));
      return { items, total: flow.total, freshness };
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
  return useQuery<UapiList<UapiCoupon>, UapiError>({
    queryKey: ['uapi', 'coupons', page],
    queryFn: async () => {
      const { data: raw, freshness } = await invokeUapiRaw<unknown>('coupons', {
        page_no: page,
        page_size: PAGE_SIZE,
      });
      if (!raw || typeof raw !== 'object') return { items: [], freshness };
      const record = raw as Record<string, unknown>;
      const list = record.list ?? record.coupons ?? record.items ?? record.available_list;
      return {
        items: Array.isArray(list) ? (list as UapiCoupon[]) : [],
        freshness,
      };
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

/** Campos como a UAPI devolve em `get_fleet` (números também vêm como texto). */
interface RawFleetDriver {
  driver_fid?: string;
  name?: string;
  avg_rating?: number | string;
  physics_vehicle_name?: string;
  brand_series?: string;
}

export function useUapiFleet(kind: FleetKind, search?: string) {
  return useQuery<UapiList<UapiFleetDriver>, UapiError>({
    queryKey: ['uapi', 'fleet', kind, search ?? ''],
    queryFn: async () => {
      const { data: raw, freshness } = await invokeUapiRaw<unknown>(
        kind === 'favorites' ? 'fleet-favorites' : 'fleet-blocked',
        { page_no: 1, page_size: 50, ...(search ? { search } : {}) },
      );
      if (!raw || typeof raw !== 'object') return { items: [], freshness };
      const record = raw as Record<string, unknown>;
      // A UAPI devolve a frota em `driver_info` (não em `list`/`drivers`).
      const list = record.driver_info ?? record.list ?? record.drivers ?? record.items;
      const drivers = Array.isArray(list) ? (list as RawFleetDriver[]) : [];
      return {
        items: drivers
          .filter((d) => typeof d?.driver_fid === 'string' && d.driver_fid)
          .map((d) => {
            const rating = toFiniteNumber(d.avg_rating);
            const vehicle = (d.physics_vehicle_name ?? '').trim() || (d.brand_series ?? '').trim();
            return {
              driver_fid: d.driver_fid as string,
              ...(d.name ? { name: d.name } : {}),
              ...(vehicle ? { vehicle_type: vehicle } : {}),
              ...(rating != null ? { rating } : {}),
            };
          }),
        freshness,
      };
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
        driver_action: action,
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
