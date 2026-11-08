#!/usr/bin/env node
// Guard do budget de bundle inicial. Le dist/index.html, soma o gzip de todo JS
// carregado no first paint (script[type=module] + link[rel=modulepreload]) e do
// CSS (link[rel=stylesheet]) e compara com performance-budget.json.
//
// Falha (exit 1) quando initial-js ou initial-css passam do maxKB. O budget e
// medido em gzip porque e o que o navegador baixa da Vercel (br/gzip).
//
// PORTADO DO ZAPP_WEB_V2 (2026-11-08). O orcamento NAO veio de la: um teto medido
// em outro bundle nao vigia este. O `performance-budget.json` do Lalamove_V2 tem de
// nascer de uma medicao local:
//
//   npm run build && node scripts/ci/bundle-budget.mjs --update-budget
//
// NAO MEDIDO nesta sessao: `vite build` falha no estado atual da main — o
// `postcss.config.js` usa `tailwindcss: {}` (forma da v3) e o package.json/lock
// pinam tailwindcss 4.3.3, que exige `@tailwindcss/postcss`. Sem dist nao ha
// medicao, e um teto inventado seria guarda inutil; por isso este repo ainda nao
// tem `performance-budget.json` e a guarda sai 2 (fail-closed) ate a primeira
// medicao real.
//
// Uso: node scripts/ci/bundle-budget.mjs [--dist dist] [--budget performance-budget.json]
//      node scripts/ci/bundle-budget.mjs --update-budget   (grava o medido como teto)

import { gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function extractInitialAssets(html) {
  const js = new Set();
  const css = new Set();
  const tagRe = /<(script|link)\b([^>]*)>/giu;
  for (const match of html.matchAll(tagRe)) {
    const [, tag, attrs] = match;
    const attr = (name) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "iu"))?.[1] ?? null;
    if (tag.toLowerCase() === "script") {
      const src = attr("src");
      if (src && (attr("type") ?? "").toLowerCase() === "module") js.add(src);
      continue;
    }
    const rel = (attr("rel") ?? "").toLowerCase();
    const href = attr("href");
    // So assets do proprio dist (URL relativa a raiz); fontes/CSS externos
    // (fonts.googleapis.com) nao entram no budget do bundle.
    if (!href || !href.startsWith("/")) continue;
    if (rel === "modulepreload") js.add(href);
    if (rel === "stylesheet") css.add(href);
  }
  return { js: [...js].sort((a, b) => a.localeCompare(b)), css: [...css].sort((a, b) => a.localeCompare(b)) };
}

export function gzipKB(buffer) {
  return gzipSync(buffer, { level: 9 }).length / 1024;
}

function allAssetFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return allAssetFiles(root, file);
    if (!entry.isFile() || entry.name.endsWith(".map")) return [];
    return [{ file, href: `/${path.relative(root, file).replaceAll(path.sep, "/")}` }];
  });
}

export function measure(distDir, html) {
  const assets = extractInitialAssets(html);
  const resolve = (href) => path.join(distDir, href.replace(/^\//u, ""));
  const size = (list) => list.map((href) => {
    const file = resolve(href);
    if (!existsSync(file)) throw new Error(`asset referenciado no index.html nao existe: ${href}`);
    return { href, kb: gzipKB(readFileSync(file)) };
  });
  const js = size(assets.js);
  const css = size(assets.css);
  const sum = (items) => items.reduce((total, item) => total + item.kb, 0);
  const allAssets = allAssetFiles(distDir).map(({ file, href }) => ({
    href,
    gzipKB: gzipKB(readFileSync(file)),
  }));
  // Diferentemente de initial-js, este limite tambem cobre chunks lazy. Eles
  // afetam diretamente a latencia percebida na primeira navegacao daquela rota.
  const largestChunkKB = allAssets
    .filter(({ href }) => href.endsWith(".js"))
    .reduce((largest, item) => Math.max(largest, item.gzipKB), 0);
  const totalAssetsKB = allAssets.reduce((total, item) => total + item.gzipKB, 0);
  return {
    js,
    css,
    jsKB: sum(js),
    cssKB: sum(css),
    largestChunkKB,
    totalAssetsKB,
  };
}

export function evaluate(result, budgets) {
  const failures = [];
  const jsMax = budgets["initial-js"]?.maxKB;
  const cssMax = budgets["initial-css"]?.maxKB;
  if (typeof jsMax === "number" && result.jsKB > jsMax) {
    failures.push(`initial-js: ${result.jsKB.toFixed(1)} KB gzip > budget ${jsMax} KB`);
  }
  if (typeof cssMax === "number" && result.cssKB > cssMax) {
    failures.push(`initial-css: ${result.cssKB.toFixed(1)} KB gzip > budget ${cssMax} KB`);
  }
  const largestChunkMax = budgets["largest-chunk"]?.maxKB;
  if (typeof largestChunkMax === "number" && result.largestChunkKB > largestChunkMax) {
    failures.push(`largest-chunk: ${result.largestChunkKB.toFixed(1)} KB gzip > budget ${largestChunkMax} KB`);
  }
  const totalAssetsMax = budgets["total-assets"]?.maxKB;
  if (typeof totalAssetsMax === "number" && result.totalAssetsKB > totalAssetsMax) {
    failures.push(`total-assets: ${result.totalAssetsKB.toFixed(1)} KB gzip > budget ${totalAssetsMax} KB`);
  }
  return failures;
}

function parseArgs(argv) {
  const args = { dist: "dist", budget: "performance-budget.json", updateBudget: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dist") args.dist = argv[++index];
    else if (argv[index] === "--budget") args.budget = argv[++index];
    else if (argv[index] === "--update-budget") args.updateBudget = true;
    else throw new Error(`Argumento desconhecido: ${argv[index]}`);
  }
  return args;
}

/**
 * Orcamento a partir de uma medicao real: o teto E o medido, sem folga inventada.
 * Afrouxar depois e um diff visivel no JSON — que e o ponto do ratchet.
 */
export function budgetFromMeasurement(result, medidoEm = new Date().toISOString().slice(0, 10)) {
  const arredonda = (kb) => Math.ceil(kb * 10) / 10;
  return {
    budgets: {
      "initial-js": { maxKB: arredonda(result.jsKB), description: `Medido em ${medidoEm} (gzip, npm run build).` },
      "initial-css": { maxKB: arredonda(result.cssKB), description: `Medido em ${medidoEm} (gzip, npm run build).` },
      "largest-chunk": { maxKB: arredonda(result.largestChunkKB), description: `Medido em ${medidoEm} (gzip, inclui chunk lazy).` },
      "total-assets": { maxKB: arredonda(result.totalAssetsKB), description: `Medido em ${medidoEm} (gzip, sem sourcemaps).` },
    },
    notes: "Teto = medicao local. Regerar com: npm run build && node scripts/ci/bundle-budget.mjs --update-budget",
  };
}

export function main(argv = process.argv.slice(2), root = process.cwd()) {
  const args = parseArgs(argv);
  const distDir = path.resolve(root, args.dist);
  const indexPath = path.join(distDir, "index.html");
  if (!existsSync(indexPath)) {
    console.error(`ERRO: ${indexPath} nao existe. Rode o build antes.`);
    return 2;
  }
  const budgetPath = path.resolve(root, args.budget);
  const result = measure(distDir, readFileSync(indexPath, "utf8"));

  if (args.updateBudget) {
    const orcamento = budgetFromMeasurement(result);
    writeFileSync(budgetPath, `${JSON.stringify(orcamento, null, 2)}\n`, "utf8");
    console.log(`Orcamento gravado em ${budgetPath}:`);
    for (const [chave, valor] of Object.entries(orcamento.budgets)) {
      console.log(`  ${chave}: ${valor.maxKB} KB gzip`);
    }
    return 0;
  }

  if (!existsSync(budgetPath)) {
    console.error(
      `ERRO: ${budgetPath} nao existe — sem teto nao ha guarda (fail-closed).\n` +
        "Gere a partir de uma medicao real: npm run build && node scripts/ci/bundle-budget.mjs --update-budget",
    );
    return 2;
  }
  const budgets = JSON.parse(readFileSync(budgetPath, "utf8")).budgets ?? {};

  console.log("Bundle inicial (gzip):");
  for (const item of [...result.js].sort((a, b) => b.kb - a.kb)) {
    console.log(`  ${item.kb.toFixed(1).padStart(7)} KB  ${item.href}`);
  }
  console.log(`  JS inicial:  ${result.jsKB.toFixed(1)} KB (budget ${budgets["initial-js"]?.maxKB ?? "-"} KB, ${result.js.length} chunks)`);
  console.log(`  CSS inicial: ${result.cssKB.toFixed(1)} KB (budget ${budgets["initial-css"]?.maxKB ?? "-"} KB)`);
  console.log(`  Maior chunk JS (inclui lazy): ${result.largestChunkKB.toFixed(1)} KB gzip (budget ${budgets["largest-chunk"]?.maxKB ?? "-"} KB)`);
  console.log(`  Assets totais: ${result.totalAssetsKB.toFixed(1)} KB gzip, sem maps (budget ${budgets["total-assets"]?.maxKB ?? "-"} KB)`);

  const failures = evaluate(result, budgets);
  if (failures.length) {
    console.error("\nFALHA: budget de bundle estourado:");
    for (const failure of failures) console.error(`  ${failure}`);
    console.error("Verifique imports estaticos de libs pesadas no grafo do entry (vite.config.ts codeSplitting).");
    return 1;
  }
  console.log("OK: bundle inicial dentro do budget.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main());
}
