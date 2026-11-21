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

  /** Token bucket por minuto: true = pode chamar. */
  rateGuard(provider: ProviderName, api: string, limitPerMin: number): boolean {
    const key = `${provider}:${api}`;
    const minute = Math.floor(this.now() / 60_000);
    const b = this.buckets.get(key);
    if (!b || b.minute !== minute) { this.buckets.set(key, { minute, count: 1 }); return true; }
    if (b.count >= limitPerMin) return false;
    b.count++;
    return true;
  }
}

export class ResolveError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ResolveError"; }
}
