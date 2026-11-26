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

export interface UapiSnapshotMeta {
  servedFromSnapshot?: boolean;
  snapshotCollectedAt?: string | null;
}

/** `_meta` da edge `lalamove-uapi`: diz se o dado veio da cópia do robô e de quando. */
export function parseSnapshotMeta(res: LalamoveRawResponse | null | undefined): UapiSnapshotMeta {
  const meta = res?._meta;
  return {
    servedFromSnapshot: meta?.servedFromSnapshot === true,
    snapshotCollectedAt: meta?.snapshotCollectedAt ?? null,
  };
}

/** "2026-04-01 16:05:27" (hora local da UAPI) → epoch em segundos. */
export function epochFromUapiDateTime(value?: string | null): number | undefined {
  if (!value) return undefined;
  const text = value.trim();
  // A UAPI manda `date_time` como "YYYY-MM-DD HH:mm[:ss]" e alguns campos como
  // "YY-MM-DD HH:mm"; `Date.parse` não entende nenhum dos dois.
  const match = /^(\d{2,4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (match) {
    const rawYear = Number(match[1]);
    const year = match[1].length <= 2 ? 2000 + rawYear : rawYear;
    const date = new Date(
      year,
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
    );
    return Number.isFinite(date.getTime()) ? Math.floor(date.getTime() / 1000) : undefined;
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

export interface WalletFlowItem {
  id: string;
  description: string;
  remark?: string;
  created_at?: string;
  /** Epoch em segundos (a UAPI manda `date_time` como texto "YYYY-MM-DD HH:mm:ss"). */
  create_time?: number;
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
  create_time?: number;
}

/**
 * `wallet-transactions` → `data.flow_item_arr`.
 *
 * `data.list` é aceito como alternativa: era o que o envelope do proxy externo
 * devolvia e é o campo que o painel de extrato esperava, então ler os dois evita
 * extrato vazio caso o proxy legado volte a ser configurado.
 */
export function parseWalletFlow(res: LalamoveRawResponse | null | undefined): WalletFlow {
  const data = uapiData<{ flow_item_arr?: RawFlowItem[]; list?: RawFlowItem[]; total?: number }>(res);
  const raw = Array.isArray(data?.flow_item_arr)
    ? data.flow_item_arr
    : Array.isArray(data?.list)
      ? data.list
      : [];
  const items = raw.map((tx, i) => {
    const remark = [tx.sub_name, tx.user_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' · ');
    const createTime =
      typeof tx.create_time === 'number' && tx.create_time > 0
        ? tx.create_time
        : epochFromUapiDateTime(tx.date_time);
    return {
      id: `${tx.date_time ?? 'linha'}-${i}`,
      description: (tx.name ?? '').trim() || 'Transação',
      ...(remark ? { remark } : {}),
      ...(tx.date_time ? { created_at: tx.date_time } : {}),
      ...(createTime != null ? { create_time: createTime } : {}),
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
  const data = uapiData<{ city_info_item?: CityInfoItem[] } | CityInfoItem[]>(res);
  if (Array.isArray(data)) return data;
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