#!/usr/bin/env node
/**
 * layout-guard.mjs — auditoria estatica das raizes JSX das paginas roteadas.
 *
 * Portado do Zapp Web V2 (`scripts/ui-audit/layout-guard.mjs`) e ADAPTADO ao
 * contrato de layout real deste repo. Duas diferencas estruturais:
 *
 *  1. O Zapp lista as views em `src/pages/lazyViews.ts`. Aqui as rotas vivem em
 *     `src/App.tsx`, e so as que estao DENTRO de `<Route element={<AppLayout />}>`
 *     herdam o shell. O guard extrai justamente esse bloco: rota publica
 *     (`/auth`, `/reset-password`, `*` → NotFound) renderiza fora do shell, cuida
 *     do proprio scroll/altura e nao entra na auditoria.
 *
 *  2. O Zapp tem um `ViewContainer` que aplica o gutter; aqui NAO existe. O
 *     `<main>` do shell e so `flex-1 overflow-y-auto`
 *     (`src/components/layout/AppLayout.tsx:322`) e cada pagina paga o proprio
 *     padding (ex.: `src/pages/OrdersPage.tsx:112` `p-3 sm:p-4 md:p-6`). Por isso
 *     a regra "p-6 duplica o gutter" do Zapp foi DESCARTADA (seria o oposto do
 *     contrato daqui) e entrou a regra inversa: raiz sem padding horizontal cola
 *     o conteudo na sidebar.
 *
 * Regras (todas ancoradas em codigo deste repo):
 *   1. `overflow-y-auto`/`overflow-auto` na raiz — quem rola e o `<main>`
 *      (AppLayout.tsx:322). Raiz rolando cria scroll aninhado.
 *   2. `h-screen`/`min-h-screen`/`h-[100vh]` na raiz — o shell ja limita a
 *      viewport (AppLayout.tsx:288 `flex h-screen overflow-hidden`); repetir na
 *      pagina dobra a altura e inventa scroll.
 *   3. `h-full` sem `w-full`/`flex-1` quando a raiz e flex-row — a faixa encolhe
 *      para o conteudo.
 *   4. raiz sem padding horizontal — o `<main>` nao da gutter nenhum.
 *
 * Exit 0 = sem violacoes. Exit 1 = violacoes.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { extractRoots } from "./root-className.mjs";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const APP = path.join(SRC, "App.tsx");

/**
 * Paginas que ocupam a area inteira de proposito: mapa em tela cheia nao tem
 * gutter nem altura de documento. Mantido explicito (e curto) para que uma
 * pagina nova nao entre na excecao por acidente.
 */
const TELA_CHEIA = new Set(["LiveMapPage", "HeatmapPage"]);

/**
 * Fim da tag aberta em `from` (indice do '>') contando chaves.
 *
 * Nao da para fatiar com `[^>]*>`: `<Route path="/x" element={<Protected...>` tem
 * '>' DENTRO da expressao do atributo, e era isso que fazia a contagem de
 * profundidade nunca fechar.
 */
function fimDaTag(source, from) {
  let chaves = 0;
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") chaves += 1;
    else if (ch === "}") chaves -= 1;
    else if (ch === ">" && chaves === 0) return i;
  }
  return -1;
}

/** Corpo do `<Route element={<AppLayout />}>` ... `</Route>` correspondente. */
export function blocoDoAppLayout(source) {
  const abre = source.search(/<Route\s+element=\{<AppLayout\s*\/>\}\s*>/);
  if (abre === -1) return null;
  const inicio = fimDaTag(source, abre) + 1;
  if (inicio === 0) return null;

  let profundidade = 1;
  let i = inicio;
  while (i < source.length) {
    const proximaAbre = source.indexOf("<Route", i);
    const proximaFecha = source.indexOf("</Route>", i);
    if (proximaFecha === -1) return null;
    if (proximaAbre !== -1 && proximaAbre < proximaFecha) {
      const fim = fimDaTag(source, proximaAbre);
      if (fim === -1) return null;
      // Auto-fechada (`... />`) nao abre nivel; so o grupo com filhos abre.
      if (source[fim - 1] !== "/") profundidade += 1;
      i = fim + 1;
      continue;
    }
    profundidade -= 1;
    if (profundidade === 0) return source.slice(inicio, proximaFecha);
    i = proximaFecha + "</Route>".length;
  }
  return null;
}

/** `const X = lazy(() => import('./pages/Y'))` / `import X from './pages/Y'` → { X: spec }. */
export function especificadores(source) {
  const mapa = new Map();
  for (const m of source.matchAll(
    /\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']/g,
  )) {
    mapa.set(m[1], m[2]);
  }
  for (const m of source.matchAll(
    /^import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+["']([^"']+)["']/gm,
  )) {
    mapa.set(m[1], m[2]);
  }
  return mapa;
}

function resolverEspecificador(spec) {
  if (spec.startsWith("@/")) return resolverArquivo(path.join(SRC, spec.slice(2)));
  if (spec.startsWith(".")) return resolverArquivo(path.resolve(SRC, spec));
  return null;
}

function resolverArquivo(base) {
  const candidatos = path.extname(base)
    ? [base]
    : [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")];
  return candidatos.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

/**
 * Arquivos auditados: componentes usados dentro do bloco do AppLayout e que o
 * App.tsx importa de `pages/`. Os wrappers do proprio shell (ProtectedRoute,
 * SuspenseWrapper) nao sao paginas e ficam de fora pelo filtro de origem.
 */
export function paginasDoShell(source) {
  const bloco = blocoDoAppLayout(source);
  if (!bloco) throw new Error("bloco <Route element={<AppLayout />}> nao encontrado em src/App.tsx");
  const mapa = especificadores(source);
  const arquivos = new Map();
  for (const m of bloco.matchAll(/<([A-Z][A-Za-z0-9_]*)\s*\/>/g)) {
    const nome = m[1];
    const spec = mapa.get(nome);
    if (!spec || !/(^|\/)pages\//.test(spec)) continue;
    const arquivo = resolverEspecificador(spec);
    if (arquivo) arquivos.set(nome, arquivo);
  }
  if (arquivos.size === 0) {
    throw new Error("nenhuma pagina do AppLayout resolvida — auditoria incompleta");
  }
  return arquivos;
}

function hasUtility(className, utility) {
  return className.split(/\s+/).some((token) => {
    const normalized = token.replace(/^!/, "");
    return normalized === utility
      || normalized.endsWith(`:${utility}`)
      || normalized.endsWith(`:!${utility}`);
  });
}

/** Qualquer variante de padding horizontal: `p-*`, `px-*`, `pl-*`+`pr-*`, com ou sem breakpoint. */
function temGutterHorizontal(className) {
  return className.split(/\s+/).some((token) => {
    const util = token.replace(/^!/, "").split(":").pop() ?? "";
    return /^!?p[xlr]?-(?:\d+(?:\.\d+)?|px|\[[^\]]+\])$/.test(util);
  });
}

export const ANTI_PATTERNS = [
  {
    name: "overflow na raiz",
    test: (cn) => hasUtility(cn, "overflow-y-auto") || hasUtility(cn, "overflow-auto"),
    message: "quem rola e o <main> do shell (src/components/layout/AppLayout.tsx:322); raiz rolando cria scroll aninhado.",
  },
  {
    name: "altura de viewport na raiz",
    test: (cn) => ["h-screen", "min-h-screen", "h-[100vh]", "min-h-[100vh]", "h-[100dvh]", "min-h-[100dvh]"]
      .some((u) => hasUtility(cn, u)),
    message: "o shell ja limita a viewport (AppLayout.tsx:288 'flex h-screen overflow-hidden'); repetir dobra a altura.",
  },
  {
    name: "h-full sem largura em flex-row",
    test: (cn) => hasUtility(cn, "h-full")
      && hasUtility(cn, "flex")
      && !hasUtility(cn, "flex-col")
      && !hasUtility(cn, "w-full")
      && !hasUtility(cn, "flex-1"),
    message: "h-full em flex-row sem w-full/flex-1 — a faixa encolhe para o conteudo.",
  },
  {
    name: "raiz sem gutter horizontal",
    // So vale para elemento DOM. Quando a raiz e um componente wrapper
    // (`<PullToRefresh className="h-full">` em src/pages/OrdersPage.tsx:138) o
    // padding pode estar legitimamente dentro dele, e cobrar aqui daria falso
    // positivo em toda pagina com pull-to-refresh.
    dom: true,
    test: (cn) => cn !== "" && !temGutterHorizontal(cn),
    message: "o <main> nao da padding (AppLayout.tsx:322); sem p-*/px-* o conteudo cola na sidebar.",
  },
];

function resolverModuloLocal(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  return resolverArquivo(path.resolve(path.dirname(fromFile), specifier));
}

/** Segue reexports locais ate a implementacao real da pagina roteada. */
function carregarPagina(file, seen = new Set()) {
  if (seen.has(file)) return { source: "", roots: [] };
  seen.add(file);

  let source;
  try { source = readFileSync(file, "utf8"); } catch { return { source: "", roots: [] }; }
  const roots = extractRoots(source);
  if (roots.length > 0) return { source, roots };

  const targets = [];
  for (const match of source.matchAll(/export\s*\{[^}]+\}\s*from\s*["']([^"']+)["']/gs)) {
    const target = resolverModuloLocal(file, match[1]);
    if (target) targets.push(carregarPagina(target, seen));
  }

  return {
    source: [source, ...targets.map((t) => t.source)].join("\n"),
    roots: targets.flatMap((t) => t.roots),
  };
}

let violations = 0;
let checked = 0;

for (const [nome, file] of paginasDoShell(readFileSync(APP, "utf8"))) {
  const rel = path.relative(ROOT, file);

  if (/\.(test|spec|stories)\./.test(file)) continue;
  if (TELA_CHEIA.has(nome)) continue;

  const { source, roots } = carregarPagina(file);
  if (!source) continue;

  if (roots.length === 0) {
    // Pagina roteada que o extrator nao conseguiu ler nao pode passar calada:
    // era assim que views com export default sumiam da auditoria.
    console.error(`NAO AUDITAVEL: ${rel} — nenhuma raiz JSX no nivel do corpo do componente`);
    violations++;
    continue;
  }

  checked++;
  for (const { tag, className: cn } of roots) {
    const ehDom = tag === "" || /^[a-z]/.test(tag);
    for (const { name, test, message, dom } of ANTI_PATTERNS) {
      if (dom && !ehDom) continue;
      if (test(cn)) {
        console.error(`VIOLATION [${name}]`);
        console.error(`  file: ${rel}`);
        console.error(`  raiz: <${tag || ">"} className="${cn}">`);
        console.error(`  ${message}`);
        console.error();
        violations++;
      }
    }
  }
}

if (violations === 0) {
  console.log(`✓ layout-guard: 0 violacoes em ${checked} paginas do AppLayout`);
  process.exit(0);
} else {
  console.error(`✗ layout-guard: ${violations} violacao(oes) em ${checked} paginas do AppLayout`);
  process.exit(1);
}
