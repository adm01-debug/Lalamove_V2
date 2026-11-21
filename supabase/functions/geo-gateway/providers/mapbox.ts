// Provider Mapbox — porta as actions do mapbox-proxy para a interface GeoProvider.
// Usa MAPBOX_SERVER_TOKEN (sk.) em produção; fallback para MAPBOX_ACCESS_TOKEN (pk.)
// durante a transição (etapa 3 do plano cria o sk.).
//
// TODOs por etapa do plano:
//   20 — autocomplete: Search Box suggest com session_token
//   21 — place-details: Search Box retrieve + fechar sessão
//   22 — fallback geocoding v6 autocomplete=true quando mapbox_mode='geocoding'
//   23 — geocode: structured input (CEP + número via ViaCEP)
//   25 — batch-geocode: POST /search/geocode/v6/batch até 50 itens
//   27 — matrix 1×1: rate guard 30 req/min driving-traffic
//   32 — erros: mapear NoRoute/NoSegment/InvalidInput → ERROR_CODES
//   33 — cache: withCache() por TTL do geo_settings.config.retention
//   33 — medição: geo_usage_increment() após cada chamada real

import type { GeoAction, GeoProvider, GeoProviderResult } from "../_types.ts";

export class MapboxProvider implements GeoProvider {
  name = "mapbox";

  private get token(): string {
    const t =
      Deno.env.get("MAPBOX_SERVER_TOKEN") ??
      Deno.env.get("MAPBOX_ACCESS_TOKEN");
    if (!t) throw new Error("MAPBOX_SERVER_TOKEN não configurado");
    return t;
  }

  async handle(
    action: GeoAction,
    params: Record<string, unknown>,
    _req: Request,
  ): Promise<GeoProviderResult> {
    switch (action) {
      case "autocomplete":   return this.autocomplete(params);
      case "place-details":  return this.placeDetails(params);
      case "geocode":        return this.geocode(params);
      case "reverse":        return this.reverse(params);
      case "route":          return this.route(params);
      case "matrix":         return this.matrix(params);
      case "static-map":     return this.staticMap(params);
      case "snap":           return this.snap(params);
      case "isochrone":      return this.isochrone(params);
      case "optimization":   return this.optimization(params);
      case "tilequery":      return this.tilequery(params);
      case "count-map-load": return { data: null, provider: "mapbox", sku: "map_load", units: 1 };
      default:
        throw new Error(`Mapbox: action '${action}' não suportada`);
    }
  }

  // ── Geocoding ────────────────────────────────────────────────────────────

  private async geocode(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { query, permanent = false } = p;
    const qs = new URLSearchParams({
      access_token: this.token,
      limit: "5",
      language: "pt",
      country: "br",
      ...(permanent ? { permanent: "true" } : {}),
    });
    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(String(query))}&${qs}`,
    );
    if (!res.ok) throw new Error(`Mapbox geocode ${res.status}: ${await res.text()}`);
    return {
      data: await res.json(),
      provider: "mapbox",
      sku: permanent ? "geocoding_permanent" : "geocoding_temporary",
      units: 1,
    };
  }

  private async reverse(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { lng, lat, permanent = false } = p;
    const qs = new URLSearchParams({
      access_token: this.token,
      language: "pt",
      types: "place,locality,neighborhood",
      ...(permanent ? { permanent: "true" } : {}),
    });
    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&${qs}`,
    );
    if (!res.ok) throw new Error(`Mapbox reverse ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "geocoding_temporary", units: 1 };
  }

  private async autocomplete(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { query, session_token, proximity } = p;
    const qs = new URLSearchParams({
      access_token: this.token,
      q: String(query),
      session_token: String(session_token),
      language: "pt",
      country: "br",
      limit: "5",
      types: "address,street,place,poi",
    });
    if (proximity) qs.set("proximity", String(proximity));
    const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${qs}`);
    if (!res.ok) throw new Error(`Mapbox suggest ${res.status}: ${await res.text()}`);
    // Sessão cobrada 1× por session_token novo (na primeira chamada suggest).
    return { data: await res.json(), provider: "mapbox", sku: "searchbox_session", units: 1 };
  }

  private async placeDetails(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { mapbox_id, session_token } = p;
    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapbox_id}?session_token=${session_token}&access_token=${this.token}`,
    );
    if (!res.ok) throw new Error(`Mapbox retrieve ${res.status}: ${await res.text()}`);
    // retrieve fecha a sessão — units=0 (já contado no suggest)
    return { data: await res.json(), provider: "mapbox", sku: "searchbox_session", units: 0 };
  }

  // ── Roteamento e ETA ─────────────────────────────────────────────────────

  private async route(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { coordinates, profile = "driving-traffic" } = p;
    const coords = (coordinates as number[][]).map((c) => c.join(",")).join(";");
    const qs = new URLSearchParams({
      access_token: this.token,
      geometries: "polyline6",
      overview: "full",
      steps: "false",
      annotations: "duration,distance",
      language: "pt",
    });
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox directions ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "directions", units: 1 };
  }

  private async matrix(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { sources, destinations, profile = "driving-traffic" } = p;
    const src = sources as number[][];
    const dst = destinations as number[][];
    const all = [...src, ...dst];
    const coords = all.map((c) => c.join(",")).join(";");
    const srcIdx = src.map((_, i) => i).join(";");
    const dstIdx = dst.map((_, i) => src.length + i).join(";");
    const qs = new URLSearchParams({
      access_token: this.token,
      annotations: "duration,distance",
      sources: srcIdx,
      destinations: dstIdx,
    });
    const res = await fetch(
      `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coords}?${qs}`,
    );
    if (!res.ok) throw new Error(`Mapbox matrix ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "matrix", units: src.length * dst.length };
  }

  // ── Snap, Static, Isochrone, Optimization, Tilequery ────────────────────

  private async snap(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { coordinates } = p;
    const coords = (coordinates as number[][]).map((c) => c.join(",")).join(";");
    const radiuses = (coordinates as number[][]).map(() => "25").join(";");
    const qs = new URLSearchParams({
      access_token: this.token,
      geometries: "geojson",
      tidy: "true",
      radiuses,
    });
    const res = await fetch(`https://api.mapbox.com/matching/v5/mapbox/driving/${coords}?${qs}`);
    if (!res.ok) throw new Error(`Mapbox matching ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "map_matching", units: 1 };
  }

  private async staticMap(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { style = "streets-v12", overlay = "", width = 600, height = 300 } = p;
    const url = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlay}/auto/${width}x${height}@2x?access_token=${this.token}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox static ${res.status}`);
    const buf = await res.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return {
      data: { image: `data:image/png;base64,${base64}` },
      provider: "mapbox",
      sku: "static_image",
      units: 1,
    };
  }

  private async isochrone(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { lng, lat, profile = "driving", contours_minutes = "10,20,30" } = p;
    const qs = new URLSearchParams({
      access_token: this.token,
      contours_minutes: String(contours_minutes),
      polygons: "true",
    });
    const res = await fetch(
      `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}?${qs}`,
    );
    if (!res.ok) throw new Error(`Mapbox isochrone ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "isochrone", units: 1 };
  }

  private async optimization(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { coordinates, profile = "driving" } = p;
    const coords = (coordinates as number[][]).map((c) => c.join(",")).join(";");
    const qs = new URLSearchParams({ access_token: this.token, geometries: "geojson", overview: "full" });
    const res = await fetch(
      `https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}/${coords}?${qs}`,
    );
    if (!res.ok) throw new Error(`Mapbox optimization ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "optimization", units: 1 };
  }

  private async tilequery(p: Record<string, unknown>): Promise<GeoProviderResult> {
    const { tileset, lng, lat, radius = 0, limit = 5 } = p;
    const qs = new URLSearchParams({
      access_token: this.token,
      radius: String(radius),
      limit: String(limit),
    });
    const res = await fetch(
      `https://api.mapbox.com/v4/${tileset}/tilequery/${lng},${lat}.json?${qs}`,
    );
    if (!res.ok) throw new Error(`Mapbox tilequery ${res.status}: ${await res.text()}`);
    return { data: await res.json(), provider: "mapbox", sku: "tilequery", units: 1 };
  }
}
