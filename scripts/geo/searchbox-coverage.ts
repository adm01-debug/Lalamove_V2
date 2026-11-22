// Etapa 36 do plano Mapbox × Lalamove V2: cobertura BR do Search Box.
// Para cada endereço do CSV: Search Box suggest → retrieve (sessão) e, como controle, Geocoding v6
// forward (temporário, nada é gravado). Opcionalmente compara com Google Geocoding v4 se houver chave.
// Critério (M1): >= 90% dos endereços com accuracy rooftop|parcel|point e distância ao controle <= 50 m.
//
// Uso: MAPBOX_SERVER_TOKEN=sk... [GOOGLE_MAPS_SERVER_KEY=...] \
//      deno run --allow-net --allow-env --allow-read scripts/geo/searchbox-coverage.ts scripts/geo/enderecos.sample.csv
// Saída: tabela em Markdown (colar em docs/MAPBOX.md) + resumo com o veredito.

const TOKEN = Deno.env.get("MAPBOX_SERVER_TOKEN") ?? Deno.env.get("MAPBOX_ACCESS_TOKEN");
const GOOGLE = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
if (!TOKEN) { console.error("MAPBOX_SERVER_TOKEN ausente"); Deno.exit(2); }

const file = Deno.args[0] ?? "scripts/geo/enderecos.sample.csv";
const rows = (await Deno.readTextFile(file)).split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
// CSV: endereco;cidade;uf  (sem cabeçalho)
const GOOD = new Set(["rooftop", "parcel", "point"]);

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371008.8, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]), dLng = toR(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { endereco: string; cidade: string; uf: string; sb_accuracy: string; sb_type: string; sb_full: string; sb_coord: [number, number] | null; v6_accuracy: string; v6_coord: [number, number] | null; v6_conf: string; g_coord: [number, number] | null; d_sb_v6: number | null; d_sb_g: number | null; ok: boolean; ok_v6: boolean };

const out: Row[] = [];
for (const line of rows) {
  const [endereco, cidade, uf] = line.split(";").map((s) => s.trim());
  const q = `${endereco}, ${cidade}, ${uf}`;
  const session = crypto.randomUUID();
  const r: Row = { endereco, cidade, uf, sb_accuracy: "-", sb_type: "-", sb_full: "-", sb_coord: null, v6_accuracy: "-", v6_coord: null, v6_conf: "-", g_coord: null, d_sb_v6: null, d_sb_g: null, ok: false, ok_v6: false };
  try {
    const sug = await (await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(q)}&language=pt&country=br&limit=1&session_token=${session}&types=address,street,place&access_token=${TOKEN}`)).json();
    const id = sug.suggestions?.[0]?.mapbox_id;
    if (id) {
      const ret = await (await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${id}?session_token=${session}&access_token=${TOKEN}`)).json();
      const f = ret.features?.[0];
      if (f) {
        r.sb_accuracy = f.properties?.coordinates?.accuracy ?? "n/a";
        r.sb_type = f.properties?.feature_type ?? "-";
        r.sb_full = f.properties?.full_address ?? "-";
        r.sb_coord = f.geometry?.coordinates ?? null;
      }
    }
    const v6 = await (await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=br&language=pt&limit=1&autocomplete=false&permanent=false&access_token=${TOKEN}`)).json();
    const g = v6.features?.[0];
    if (g) { r.v6_coord = g.geometry?.coordinates ?? null; r.v6_accuracy = g.properties?.coordinates?.accuracy ?? "n/a"; r.v6_conf = g.properties?.match_code?.confidence ?? "-"; }
    if (GOOGLE) {
      const gg = await (await fetch(`https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(q)}?regionCode=BR&languageCode=pt-BR`, { headers: { "X-Goog-Api-Key": GOOGLE } })).json();
      const loc = gg.results?.[0]?.location;
      if (loc) r.g_coord = [loc.longitude, loc.latitude];
    }
    if (r.sb_coord && r.v6_coord) r.d_sb_v6 = Math.round(haversine(r.sb_coord, r.v6_coord));
    if (r.sb_coord && r.g_coord) r.d_sb_g = Math.round(haversine(r.sb_coord, r.g_coord));
    const control = r.d_sb_g ?? r.d_sb_v6;
    r.ok = GOOD.has(r.sb_accuracy) && (control == null || control <= 50);
    // Etapa 22: o modo 'geocoding' só vale a pena se o v6 entregar precisão >= Search Box.
    r.ok_v6 = GOOD.has(r.v6_accuracy) && (control == null || control <= 50);
  } catch (e) { r.sb_full = `ERRO: ${(e as Error).message}`; }
  out.push(r);
  await sleep(150); // Search Box: 10 req/s
}

console.log("| # | Endereço | Search Box accuracy | tipo | Geocoding v6 accuracy | d(SB,v6) m | d(SB,Google) m | OK SB | OK v6 |");
console.log("|---|---|---|---|---|---|---|---|---|");
out.forEach((r, i) => console.log(`| ${i + 1} | ${r.endereco}, ${r.cidade}/${r.uf} | ${r.sb_accuracy} | ${r.sb_type} | ${r.v6_accuracy} | ${r.d_sb_v6 ?? "-"} | ${r.d_sb_g ?? "-"} | ${r.ok ? "✅" : "❌"} | ${r.ok_v6 ? "✅" : "❌"} |`));
const pct = Math.round((out.filter((r) => r.ok).length / out.length) * 100);
const pctV6 = Math.round((out.filter((r) => r.ok_v6).length / out.length) * 100);
console.log(`\n**Search Box:** ${out.filter((r) => r.ok).length}/${out.length} (${pct}%)`);
console.log(`**Geocoding v6:** ${out.filter((r) => r.ok_v6).length}/${out.length} (${pctV6}%)`);
if (pct >= 90) {
  console.log(`\n**Veredito:** Search Box APROVADO para BR — M1 mantém \`mapbox_mode='searchbox'\` (default).`);
} else if (pctV6 >= 90) {
  console.log(`\n**Veredito:** Search Box REPROVADO (${pct}%) e Geocoding v6 APROVADO (${pctV6}%) — M1 → \`geo_settings.autocomplete.config.mapbox_mode='geocoding'\`.`);
} else {
  console.log(`\n**Veredito:** NENHUM modo Mapbox atinge 90% no BR (Search Box ${pct}%, Geocoding v6 ${pctV6}%).` +
    ` A flag \`mapbox_mode\` NÃO resolve a cobertura — o caminho é Google Geocoding v4 (etapa 94) ou enriquecer o dataset de entrada.`);
}
console.log(`Sessões Search Box consumidas: ${out.length} (grátis até 2.500/mês)`);
