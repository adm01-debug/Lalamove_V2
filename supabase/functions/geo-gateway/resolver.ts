// Escolha do provedor por função: geo_settings (cache 60 s) + geo_budget_status() + modo auto + fallback.
// Rate guard local por (provider:api) com janela de 1 minuto.
import type { GeoFunction, ProviderName, ProviderSetting } from "./providers/types.ts";

export interface GeoSettingRow {
  function: GeoFunction;
  provider: ProviderSetting;
  fallback_provider: ProviderSetting | null;
  config: Record<string, unknown>;
}

export interface BudgetRow {
  provider: ProviderName;
  spent_usd: number;
  limit_usd: number;
  pct: number;
  blocked: boolean;
  warn: boolean;
}

export interface QuotaRow {
  provider: ProviderName;
  sku: string;
  free_quota_month: number;
  used: number;
}

export interface ResolverDeps {
  loadSettings: () => Promise<GeoSettingRow[]>;
  loadBudget: () => Promise<BudgetRow[]>;
  loadQuota: () => Promise<QuotaRow[]>;
  isConfigured: (p: ProviderName) => boolean; // token/chave presente
  supports: (p: ProviderName, fn: GeoFunction) => boolean;
  now?: () => number;
  ttlMs?: number;
}

/** SKU principal de cada função por provedor — usado pelo modo `auto` para olhar cota grátis restante. */
export const PRIMARY_SKU: Record<ProviderName, Partial<Record<GeoFunction, string>>> = {
  mapbox: {
    tiles: "map_load", autocomplete: "searchbox_session", geocode: "geocoding_temporary", reverse: "geocoding_temporary",
    route: "directions", matrix: "matrix", static: "static_image", snap: "map_matching", isochrone: "isochrone", optimization: "optimization",
  },
  google: {
    tiles: "dynamic_maps", autocomplete: "places_autocomplete_request", geocode: "geocoding", reverse: "geocoding",
    route: "routes_compute_routes", matrix: "routes_matrix", static: "static_maps", snap: "roads_nearest_road", validate: "address_validation",
  },
};

/**
 * Linha ausente em `geo_settings` nao significa "desligado": significa funcao que a tabela ainda
 * nao conhece. Sem completar com os defaults, `resolve()` cai em `off` e a acao responde 503 -
 * foi o que aconteceria com isochrone/optimization/tilequery, que nao tem seed.
 */
export function mergeSettings(rows: GeoSettingRow[], defaults: GeoSettingRow[]): GeoSettingRow[] {
  const known = new Set(rows.map((r) => r.function));
  return [...rows, ...defaults.filter((d) => !known.has(d.function))];
}

export class ProviderResolver {
  private settings: GeoSettingRow[] | null = null;
  private budget: BudgetRow[] | null = null;
  private quota: QuotaRow[] | null = null;
  private loadedAt = 0;
  private buckets = new Map<string, { minute: number; count: number }>();

  constructor(private deps: ResolverDeps) {}

  private now() { return this.deps.now ? this.deps.now() : Date.now(); }

  async refresh(force = false) {
    const ttl = this.deps.ttlMs ?? 60_000;
    if (!force && this.settings && this.now() - this.loadedAt < ttl) return;
    const [s, b, q] = await Promise.all([this.deps.loadSettings(), this.deps.loadBudget(), this.deps.loadQuota()]);
    this.settings = s; this.budget = b; this.quota = q; this.loadedAt = this.now();
  }

  setting(fn: GeoFunction): GeoSettingRow | undefined {
    return this.settings?.find((r) => r.function === fn);
  }

  budgetOf(p: ProviderName): BudgetRow | undefined {
    return this.budget?.find((b) => b.provider === p);
  }

  /** cota grátis restante no mês para o SKU principal da função (Infinity quando não há linha de preço) */
  freeLeft(p: ProviderName, fn: GeoFunction): number {
    const sku = PRIMARY_SKU[p][fn];
    if (!sku) return 0;
    const row = this.quota?.find((q) => q.provider === p && q.sku === sku);
    if (!row) return Number.POSITIVE_INFINITY;
    return row.free_quota_month - row.used;
  }

  private usable(p: ProviderName, fn: GeoFunction): boolean {
    return this.deps.isConfigured(p) && this.deps.supports(p, fn) && !(this.budgetOf(p)?.blocked ?? false);
  }

  /**
   * Resolve o provedor para a função. Ordem: configurado → fallback → erro.
   * `auto` = quem tem cota grátis restante; empate → mapbox.
   */
  async resolve(fn: GeoFunction, forced?: ProviderName): Promise<{ provider: ProviderName; reason: string }> {
    await this.refresh();
    if (forced) {
      if (this.usable(forced, fn)) return { provider: forced, reason: "forced" };
      throw new ResolveError(`Provedor ${forced} indisponível para ${fn}`, this.budgetOf(forced)?.blocked ? 429 : 503);
    }
    const row = this.setting(fn);
    const primary = row?.provider ?? "off";
    const fallback = row?.fallback_provider ?? null;

    const tryOne = (s: ProviderSetting | null, why: string): { provider: ProviderName; reason: string } | null => {
      if (!s || s === "off") return null;
      if (s === "auto") {
        const order: ProviderName[] = ["mapbox", "google"];
        const withFree = order.filter((p) => this.usable(p, fn) && this.freeLeft(p, fn) > 0);
        if (withFree.length) return { provider: withFree[0], reason: `${why}:auto:free-quota` };
        const any = order.filter((p) => this.usable(p, fn));
        return any.length ? { provider: any[0], reason: `${why}:auto:cheapest` } : null;
      }
      return this.usable(s, fn) ? { provider: s, reason: why } : null;
    };

    const r = tryOne(primary, "primary") ?? tryOne(fallback, "fallback");
    if (r) return r;
    const blocked = (["mapbox", "google"] as ProviderName[]).some((p) => this.budgetOf(p)?.blocked);
    throw new ResolveError(
      primary === "off" ? `Função ${fn} está desligada em geo_settings` : `Nenhum provedor disponível para ${fn}`,
      blocked ? 429 : 503,
    );
  }

  /**
   * Provedor alternativo para failover EM RUNTIME: o primário está usável mas a chamada falhou.
   * Candidatos: o fallback_provider declarado e, depois, o outro provedor do par — sempre
   * exigindo que o candidato seja usável agora (configurado, com suporte à função, sem bloqueio).
   * Retorna null quando não há para onde ir (ex.: Google sem chave) — o erro original sobe.
   */
  async failoverFor(fn: GeoFunction, primary: ProviderName): Promise<ProviderName | null> {
    await this.refresh();
    const row = this.setting(fn);
    const declared = row?.fallback_provider;
    const candidates: ProviderName[] = [];
    if (declared === "mapbox" || declared === "google") candidates.push(declared);
    for (const p of ["mapbox", "google"] as ProviderName[]) candidates.push(p);
    for (const p of candidates) {
      if (p === primary) continue;
      if (this.usable(p, fn)) return p;
    }
    return null;
  }

  /**
   * Token bucket por minuto: true = pode chamar. A janela é alinhada ao minuto cheio e
   * reinicia sozinha, então uma rajada no fim do minuto não afeta o próximo.
   */
  /** `consume` > 1 para lotes: um lote de 50 consultas gasta 50 slots, não 1. */
  rateGuard(provider: ProviderName, api: string, limitPerMin: number, consume = 1): boolean {
    const key = `${provider}:${api}`;
    const minute = Math.floor(this.now() / 60_000);
    const b = this.buckets.get(key);
    if (!b || b.minute !== minute) {
      // Um lote maior que o limite do minuto nunca cabe: recusa sem gravar o bucket.
      if (consume > limitPerMin) return false;
      this.buckets.set(key, { minute, count: consume }); return true;
    }
    if (b.count + consume > limitPerMin) return false;
    b.count += consume;
    return true;
  }

  /**
   * Etapa 76 — espera por capacidade em vez de recusar de imediato. Consulta o bucket
   * SEM consumir (`rateGuardPeek`) e, se estiver cheio, aguarda a virada da janela
   * (até `maxWaitMs`). Retorna `true` quando há folga; `false` se o limite continuar
   * esgotado após a espera — aí o provider aplica o 429 normalmente.
   */
  async waitForCapacity(
    provider: ProviderName,
    api: string,
    limitPerMin: number,
    maxWaitMs = 2_000,
  ): Promise<boolean> {
    const free = () => {
      const b = this.buckets.get(`${provider}:${api}`);
      const minute = Math.floor(this.now() / 60_000);
      return !b || b.minute !== minute ? limitPerMin : limitPerMin - b.count;
    };
    if (free() > 0) return true;
    if (maxWaitMs <= 0) return false;

    const minute = Math.floor(this.now() / 60_000);
    const waitMs = Math.min(maxWaitMs, (minute + 1) * 60_000 - this.now());
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    return free() > 0;
  }
}

export class ResolveError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ResolveError"; }
}
