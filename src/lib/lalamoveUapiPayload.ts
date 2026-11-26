/**
 * Leitura das respostas da UAPI no front.
 *
 * O gateway devolve o payload cru da UAPI (`{ ret, data, msg }`) e a edge
 * `lalamove-uapi` acrescenta `_meta`. O envelope `{ ok, body: { data },
 * formatted }` é do proxy externo legado (`LALAMOVE_UNIFIED_PROXY_URL`), que
 * não está configurado em produção. O front lia só o legado; por isso saldo,
 * perfil, extrato, veículos e áreas apareciam vazios ou zerados.
 */

export interface LalamoveRawResponse {
  ok?: boolean;
  ret?: number;
  msg?: string;
  data?: unknown;
  /** Bloco acrescentado pela edge `lalamove-uapi` quando serve do snapshot. */
  _meta?: {
    tokenRefreshed?: boolean;
    servedFromSnapshot?: boolean;
    snapshotCollectedAt?: string;
  };
  /** @deprecated envelope do proxy externo legado (não configurado em produção). */
  body?: { data?: unknown };
  /** @deprecated idem. */
  formatted?: string;
  [key: string]: unknown;
}

/** Desembrulha `data` nos dois formatos (payload cru da UAPI e envelope legado). */
export function uapiData<T>(res: LalamoveRawResponse | null | undefined): T | undefined {
  const legacy = res?.body?.data;
  if (legacy !== undefined) return legacy as T;
  if (res?.data !== undefined) return res.data as T;
  return undefined;
}

/** Centavos → "R$ 1.234,56". */
export function formatBRLFromFen(fen: number): string {
  return (fen / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface WalletSummary {
  cents: number;
  formatted: string;
}

/** `wallet-balance` → `data.balance_fen` (centavos). */
export function parseWallet(res: LalamoveRawResponse | null | undefined): WalletSummary {
  const raw = Number(uapiData<{ balance_fen?: number }>(res)?.balance_fen ?? 0);
  const cents = Number.isFinite(raw) ? raw : 0;
  return { cents, formatted: res?.formatted ?? formatBRLFromFen(cents) };
}

export interface WalletFlowItem {
  id: string;
  description: string;
  remark?: string;
  created_at?: string;
  amount_fen: number;
  balance_fen?: number;
}

export interface WalletFlow {
  items: WalletFlowItem[];
  total: number;
}

interface RawFlowItem {
  name?: string;
  sub_name?: string;
  user_name?: string;
  amount?: number;
  balance_fen?: number;
  date_time?: string;
}

/** `wallet-transactions` → `data.flow_item_arr` (a UAPI não usa o campo `list`). */
export function parseWalletFlow(res: LalamoveRawResponse | null | undefined): WalletFlow {
  const data = uapiData<{ flow_item_arr?: RawFlowItem[]; total?: number }>(res);
  const raw = Array.isArray(data?.flow_item_arr) ? data.flow_item_arr : [];
  const items = raw.map((tx, i) => {
    const remark = [tx.sub_name, tx.user_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ');
    return {
      id: `${tx.date_time ?? 'linha'}-${i}`,
      description: (tx.name ?? '').trim() || 'Transação',
      ...(remark ? { remark } : {}),
      ...(tx.date_time ? { created_at: tx.date_time } : {}),
      amount_fen: Number.isFinite(Number(tx.amount)) ? Number(tx.amount) : 0,
      ...(tx.balance_fen != null ? { balance_fen: Number(tx.balance_fen) } : {}),
    };
  });
  const total = Number(data?.total);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

interface CityInfoItem {
  name?: string;
  city_id?: number | string;
  vehicle_item?: Array<{ name?: string; vehicle_desc?: string }>;
}

function cityInfoItems(res: LalamoveRawResponse | null | undefined): CityInfoItem[] {
  const data = uapiData<{ city_info_item?: CityInfoItem[] }>(res);
  return Array.isArray(data?.city_info_item) ? data.city_info_item : [];
}

export interface UapiVehicle {
  id: string;
  name: string;
  description?: string;
}

/** `city-info` → `data.city_info_item[].vehicle_item[]` (sem repetir por cidade). */
export function parseVehicles(res: LalamoveRawResponse | null | undefined): UapiVehicle[] {
  const byName = new Map<string, UapiVehicle>();
  for (const city of cityInfoItems(res)) {
    for (const v of city.vehicle_item ?? []) {
      const name = (v?.name ?? '').trim();
      if (!name || byName.has(name)) continue;
      const description = (v?.vehicle_desc ?? '').trim();
      byName.set(name, { id: name, name, ...(description ? { description } : {}) });
    }
  }
  return [...byName.values()];
}

export interface UapiServiceArea {
  id: string;
  name: string;
}

/** `city-info` → `data.city_info_item[]` (cidades que a UAPI devolve para a sessão). */
export function parseServiceAreas(res: LalamoveRawResponse | null | undefined): UapiServiceArea[] {
  const byId = new Map<string, UapiServiceArea>();
  for (const city of cityInfoItems(res)) {
    const name = (city?.name ?? '').trim();
    if (!name) continue;
    const id = city.city_id != null ? String(city.city_id) : name;
    if (!byId.has(id)) byId.set(id, { id, name });
  }
  return [...byId.values()];
}