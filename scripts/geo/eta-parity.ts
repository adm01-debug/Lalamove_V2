// Etapa 51 do plano Mapbox × Lalamove V2: paridade de ETA Google × Mapbox.
// Para cada par origem/destino: Directions `driving-traffic` do Mapbox e Routes
// `DRIVE` do Google (quando houver chave), lado a lado, com diferença em segundos e %.
// Critério (M4): |Δ| <= 20% em >= 80% dos pares. Acima disso, o ETA do Mapbox não é
// confiável para promessa ao cliente e o `eta_provider` deve preferir o Google.
//
// Uso: MAPBOX_SERVER_TOKEN=sk... [GOOGLE_MAPS_SERVER_KEY=...] \
//      deno run --allow-net --allow-env --allow-read scripts/geo/eta-parity.ts [pares.csv]
// CSV: origem_lat;origem_lng;destino_lat;destino_lng;rotulo
// Sem CSV, usa os 20 pares de Curitiba embutidos abaixo (mesma cidade do teste de campo).
// Saída: tabela em Markdown (colar em docs/MAPBOX.md) + resumo com o veredito.
// Nada é gravado no banco e nada é cacheado: cada execução consome 1 Directions Mapbox
// (e 1 Routes Google) por par.

const TOKEN = Deno.env.get("MAPBOX_SERVER_TOKEN") ?? Deno.env.get("MAPBOX_ACCESS_TOKEN");
const GOOGLE = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
if (!TOKEN) { console.error("MAPBOX_SERVER_TOKEN ausente"); Deno.exit(2); }
if (!GOOGLE) {
  console.warn("GOOGLE_MAPS_SERVER_KEY ausente: só a coluna Mapbox será medida e o veredito de paridade fica indefinido.\n");
}

/** Pares em Curitiba: pontos de coleta/entrega reais da operação (centro, Batel, Pinheiros, CIC). */
const DEFAULT_PAIRS: Array<[number, number, number, number, string]> = [
  [-25.4284, -49.2733, -25.4372, -49.2767, "Centro -> Batel"],
  [-25.4284, -49.2733, -25.4479, -49.2865, "Centro -> Agua Verde"],
  [-25.4284, -49.2733, -25.4095, -49.3195, "Centro -> Barreirinha"],
  [-25.4372, -49.2767, -25.4523, -49.3187, "Batel -> Pinheiros"],
  [-25.4523, -49.3187, -25.4683, -49.2902, "Pinheiros -> Portao"],
  [-25.4683, -49.2902, -25.4795, -49.3312, "Portao -> CIC"],
  [-25.4795, -49.3312, -25.4284, -49.2733, "CIC -> Centro"],
  [-25.4095, -49.3195, -25.4284, -49.2733, "Barreirinha -> Centro"],
  [-25.4284, -49.2733, -25.5127, -49.2896, "Centro -> Novo Mundo"],
  [-25.5127, -49.2896, -25.4372, -49.2767, "Novo Mundo -> Batel"],
  [-25.4372, -49.2767, -25.3831, -49.2712, "Batel -> Santa Felicidade"],
  [-25.3831, -49.2712, -25.4284, -49.2733, "Santa Felicidade -> Centro"],
  [-25.4284, -49.2733, -25.4847, -49.2175, "Centro -> Boqueirao"],
  [-25.4847, -49.2175, -25.4523, -49.3187, "Boqueirao -> Pinheiros"],
  [-25.4523, -49.3187, -25.4795, -49.3312, "Pinheiros -> CIC"],
  [-25.4795, -49.3312, -25.5127, -49.2896, "CIC -> Novo Mundo"],
  [-25.4683, -49.2902, -25.4284, -49.2733, "Portao -> Centro"],
  [-25.4284, -49.2733, -25.4182, -49.2531, "Centro -> Juveve"],
  [-25.4182, -49.2531, -25.4095, -49.3195, "Juveve -> Barreirinha"],
  [-25.4095, -49.3195, -25.4523, -49.3187, "Barreirinha -> Pinheiros"],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pares origem/destino do CSV, ou os embutidos quando nenhum arquivo foi passado. */
async function loadPairs(): Promise<Array<[number, number, number, number, string]>> {
  const file = Deno.args[0];
  if (!file) return DEFAULT_PAIRS;
  const rows = (await Deno.readTextFile(file))
    .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  return rows.map((line) => {
    const [a, b, c, d, label] = line.split(";").map((s) => s.trim());
    return [Number(a), Number(b), Number(c), Number(d), label ?? ""] as [number, number, number, number, string];
  });
}

/** Directions mapbox/driving-traffic — devolve segundos, metros e perfil efetivo. */
async function mapboxEta(oLat: number, oLng: number, dLat: number, dLng: number) {
  const coords = `${oLng},${oLat};${dLng},${dLat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&steps=false&access_token=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false as const, status: res.status, seconds: null, meters: null };
  const json = await res.json();
  const route = json.routes?.[0];
  return route
    ? { ok: true as const, status: res.status, seconds: Math.round(route.duration), meters: Math.round(route.distance) }
    : { ok: false as const, status: res.status, seconds: null, meters: null };
}

/** Routes API do Google — 1×1 com trânsito (`TRAFFIC_AWARE`). */
async function googleEta(oLat: number, oLng: number, dLat: number, dLng: number) {
  if (!GOOGLE) return { ok: false as const, status: 0, seconds: null, meters: null };
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: oLat, longitude: oLng } } },
      destination: { location: { latLng: { latitude: dLat, longitude: dLng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    }),
  });
  if (!res.ok) return { ok: false as const, status: res.status, seconds: null, meters: null };
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) return { ok: false as const, status: res.status, seconds: null, meters: null };
  return {
    ok: true as const,
    status: res.status,
    // `duration` vem como "1234s"
    seconds: Math.round(Number(String(route.duration ?? "0").replace("s", ""))),
    meters: Math.round(Number(route.distanceMeters ?? 0)),
  };
}

type Row = {
  label: string;
  mb_s: number | null;
  g_s: number | null;
  delta_s: number | null;
  delta_pct: number | null;
  dentro: boolean;
};

const pairs = await loadPairs();
const rows: Row[] = [];

for (const [oLat, oLng, dLat, dLng, label] of pairs) {
  const mb = await mapboxEta(oLat, oLng, dLat, dLng);
  const g = await googleEta(oLat, oLng, dLat, dLng);
  // Δ só faz sentido com as duas pontas medidas; senão fica indefinido, nunca 0.
  const delta_s = mb.seconds != null && g.seconds != null ? mb.seconds - g.seconds : null;
  const delta_pct = delta_s != null && g.seconds ? (delta_s / g.seconds) * 100 : null;
  rows.push({
    label,
    mb_s: mb.seconds,
    g_s: g.seconds,
    delta_s,
    delta_pct,
    dentro: delta_pct != null && Math.abs(delta_pct) <= 20,
  });
  // Directions traffic: 300 req/min. 250 ms já mantém folga confortável.
  await sleep(250);
}

const fmt = (v: number | null, suffix = "") => (v == null ? "-" : `${v}${suffix}`);
console.log("\n| Par | Mapbox (s) | Google (s) | Δ (s) | Δ (%) | ≤20% |");
console.log("|---|---|---|---|---|---|");
for (const r of rows) {
  console.log(
    `| ${r.label} | ${fmt(r.mb_s)} | ${fmt(r.g_s)} | ${fmt(r.delta_s)} | ${
      r.delta_pct == null ? "-" : r.delta_pct.toFixed(1)
    } | ${r.delta_pct == null ? "-" : r.dentro ? "sim" : "não"} |`,
  );
}

const comparaveis = rows.filter((r) => r.delta_pct != null);
const dentro = comparaveis.filter((r) => r.dentro).length;
const pct = comparaveis.length ? (dentro / comparaveis.length) * 100 : 0;

console.log(`\nPares medidos: ${rows.length} · comparáveis Google×Mapbox: ${comparaveis.length}`);
console.log(`Dentro de 20%: ${dentro}/${comparaveis.length} (${pct.toFixed(1)}%)`);
if (!GOOGLE) {
  console.log("VEREDITO: indefinido — defina GOOGLE_MAPS_SERVER_KEY para comparar com o Google.");
} else if (!comparaveis.length) {
  console.log("VEREDITO: indefinido — nenhum par teve as duas rotas calculadas.");
} else if (pct >= 80) {
  console.log("VEREDITO: APROVADO — ETA do Mapbox é comparável ao do Google (≥ 80% dos pares em 20%).");
} else {
  console.log("VEREDITO: REPROVADO — mantenha `eta_provider='google'` ou restrinja o Mapbox a driving (sem trânsito).");
}