import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { budgetFromMeasurement, evaluate, extractInitialAssets, main, measure } from "./bundle-budget.mjs";

// `node --test` roda este .mjs direto, sem transpilar TypeScript, entao nao da
// para importar `src/lib/secureRandom.ts` (S2245 fora do src cai como
// javascript:S2245). O `crypto` global (Web Crypto, Node 18+) entrega o mesmo
// byte uniforme 0-255 que o sorteio pseudoaleatorio anterior produzia, so que sem
// o gerador previsivel. Uma chamada por byte, mesma quantidade de sorteios.
const randomByte = () => crypto.getRandomValues(new Uint8Array(1))[0];

const html = [
  '<!doctype html><html><head>',
  '<link rel="modulepreload" crossorigin href="/assets/vendor-core-abc.js">',
  '<link rel="stylesheet" crossorigin href="/assets/index-abc.css">',
  '<link rel="preload" href="/fonts/x.woff2" as="font">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit">',
  '</head><body><script type="module" crossorigin src="/assets/index-abc.js"></script>',
  '<script src="/legacy.js"></script></body></html>',
].join("\n");

test("extrai somente script module, modulepreload e stylesheet", () => {
  assert.deepEqual(extractInitialAssets(html), {
    js: ["/assets/index-abc.js", "/assets/vendor-core-abc.js"],
    css: ["/assets/index-abc.css"],
  });
});

const fixtureDirs = [];
after(() => { for (const dir of fixtureDirs) rmSync(dir, { recursive: true, force: true }); });

function fixture(sizeKB) {
  const dir = mkdtempSync(path.join(tmpdir(), "bundle-budget-"));
  fixtureDirs.push(dir);
  mkdirSync(path.join(dir, "assets"));
  // Conteudo aleatorio nao comprime: gzip ~= tamanho bruto.
  const noise = Buffer.from(Array.from({ length: sizeKB * 1024 }, () => randomByte()));
  const secondNoise = Buffer.from(Array.from({ length: sizeKB * 1024 }, () => randomByte()));
  writeFileSync(path.join(dir, "assets", "index-abc.js"), noise);
  writeFileSync(path.join(dir, "assets", "vendor-core-abc.js"), noise);
  writeFileSync(path.join(dir, "assets", "index-abc.css"), "body{margin:0}");
  writeFileSync(path.join(dir, "assets", "lazy-module.js"), Buffer.concat([noise, secondNoise]));
  writeFileSync(path.join(dir, "assets", "lazy-image.png"), noise);
  writeFileSync(path.join(dir, "assets", "ignored.js.map"), noise);
  writeFileSync(path.join(dir, "index.html"), html);
  return dir;
}

test("soma gzip dos chunks iniciais e compara com o budget", () => {
  const dir = fixture(4);
  const result = measure(dir, html);
  assert.equal(result.js.length, 2);
  assert.ok(result.jsKB > 7.5 && result.jsKB < 9, `jsKB inesperado: ${result.jsKB}`);
  assert.ok(result.largestChunkKB > 7.5 && result.largestChunkKB < 9);
  assert.ok(result.totalAssetsKB > 20 && result.totalAssetsKB < 21);
  assert.deepEqual(evaluate(result, {
    "initial-js": { maxKB: 10 },
    "initial-css": { maxKB: 1 },
    "largest-chunk": { maxKB: 10 },
    "total-assets": { maxKB: 22 },
  }), []);
  const failures = evaluate(result, {
    "initial-js": { maxKB: 5 },
    "largest-chunk": { maxKB: 5 },
    "total-assets": { maxKB: 20 },
  });
  assert.equal(failures.length, 3);
  assert.match(failures[0], /initial-js: .* > budget 5 KB/u);
  assert.match(failures[1], /largest-chunk: .* > budget 5 KB/u);
  assert.match(failures[2], /total-assets: .* > budget 20 KB/u);
});

test("main falha com exit 1 acima do budget e 0 dentro dele", () => {
  const dir = fixture(4);
  writeFileSync(path.join(dir, "budget-ok.json"), JSON.stringify({ budgets: { "initial-js": { maxKB: 50 } } }));
  writeFileSync(path.join(dir, "budget-low.json"), JSON.stringify({ budgets: { "initial-js": { maxKB: 1 } } }));
  assert.equal(main(["--dist", dir, "--budget", path.join(dir, "budget-ok.json")], dir), 0);
  assert.equal(main(["--dist", dir, "--budget", path.join(dir, "budget-low.json")], dir), 1);
});

test("main retorna 2 sem dist", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "bundle-budget-empty-"));
  fixtureDirs.push(dir);
  assert.equal(main(["--dist", dir], dir), 2);
});

// ── Regra de chunking: NAO portada ───────────────────────────────────────────
// No Zapp_Web_V2 havia aqui uma guarda que lia `codeSplitting.groups` do
// vite.config.ts (vendor-core/vendor-ui/vendor-motion...) e provava que o runtime
// de animacao nao caia no chunk do Radix. O vite.config.ts do Lalamove_V2 (medido
// 2026-11-08) NAO define manualChunks nem codeSplitting: nao ha regra para vigiar,
// e portar a guarda seria codigo morto que falha de nascenca. Consequencia pratica
// para quem for medir o bundle: framer-motion, mapbox-gl, jspdf, recharts e xlsx
// sao dependencias diretas e, sem chunking manual, entram no grafo do entry.

// ── Orcamento versionado: contrato, nao teto herdado ─────────────────────────
// No Zapp este bloco travava `initial-js` em 325 KB — numero medido NAQUELE bundle.
// Aqui o Lalamove_V2 ainda nao tem medicao (ver cabecalho de bundle-budget.mjs:
// `vite build` falha na main por postcss/tailwind v4), entao o que se testa e o
// CONTRATO:
//   1. sem performance-budget.json, a guarda sai 2 (fail-closed) — nunca "OK";
//   2. com o arquivo, `budgets["initial-js"].maxKB` tem de ser numero e o gate
//      reprova 0,1 KB acima do teto;
//   3. `--update-budget` grava o MEDIDO como teto, sem folga inventada.
const ORCAMENTO_PATH = fileURLToPath(new URL("../../performance-budget.json", import.meta.url));

test("sem performance-budget.json a guarda sai 2 (fail-closed), nunca OK", (t) => {
  if (existsSync(ORCAMENTO_PATH)) {
    t.skip("o repo ja tem performance-budget.json: coberto pelo teste do teto abaixo");
    return;
  }
  const raiz = mkdtempSync(path.join(tmpdir(), "bundle-budget-sem-orcamento-"));
  mkdirSync(path.join(raiz, "dist", "assets"), { recursive: true });
  writeFileSync(path.join(raiz, "dist", "assets", "app.js"), "console.log(1)");
  writeFileSync(
    path.join(raiz, "dist", "index.html"),
    '<script type="module" src="/assets/app.js"></script>',
  );
  assert.equal(main([], raiz), 2, "sem teto versionado a guarda nao pode se declarar OK");
});

test("se o orcamento existir, o teto de initial-js e numerico e o gate reprova acima dele", (t) => {
  if (!existsSync(ORCAMENTO_PATH)) {
    t.skip("performance-budget.json ainda nao foi medido neste repo");
    return;
  }
  const budgets = JSON.parse(readFileSync(ORCAMENTO_PATH, "utf8")).budgets ?? {};
  const teto = budgets["initial-js"]?.maxKB;
  assert.equal(typeof teto, "number", 'performance-budget.json precisa de budgets["initial-js"].maxKB numerico');
  const reprovaInitialJs = (jsKB) =>
    evaluate({ jsKB, cssKB: 0, largestChunkKB: 0, totalAssetsKB: 0 }, budgets)
      .some((falha) => falha.startsWith("initial-js:"));
  assert.equal(reprovaInitialJs(teto), false, "limite exato deveria passar");
  assert.equal(reprovaInitialJs(teto + 0.1), true, "limite+0,1 KB gzip deveria reprovar");
});

test("--update-budget grava o MEDIDO como teto (sem folga inventada)", () => {
  const medido = { jsKB: 123.45, cssKB: 10.01, largestChunkKB: 200.2, totalAssetsKB: 900.9 };
  const orcamento = budgetFromMeasurement(medido, "2026-11-08");
  assert.equal(orcamento.budgets["initial-js"].maxKB, 123.5);
  assert.equal(orcamento.budgets["initial-css"].maxKB, 10.1);
  assert.equal(orcamento.budgets["largest-chunk"].maxKB, 200.2);
  assert.equal(orcamento.budgets["total-assets"].maxKB, 900.9);
  // Teto = medido => o proprio valor medido passa e 0,1 KB acima reprova.
  assert.deepEqual(evaluate(medido, orcamento.budgets), []);
  assert.equal(evaluate({ ...medido, jsKB: 123.6 }, orcamento.budgets).length, 1);
  assert.match(orcamento.budgets["initial-js"].description, /2026-11-08/);
});
