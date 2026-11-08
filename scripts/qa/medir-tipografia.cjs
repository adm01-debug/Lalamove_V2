#!/usr/bin/env node
/**
 * Medidor de tipografia — guard-rail de escala de fonte do Lalamove V2.
 *
 * Analise estatica: resolve font-size e line-height de cada uso de `text-*` em
 * `src/`, cruzando com a escala do Tailwind, e varre a zona cega fora do JSX.
 *
 * Mede line-height alem de font-size de proposito: trocar um arbitrario
 * (`text-[12px]`, que so define font-size e herda o line-height) por uma classe
 * nomeada (`text-xs`, que define os dois) NAO e neutro.
 *
 * Checagens:
 *   - `text-[N.5px]` (meia-medida) e `text-[Npx]` acima de 16px em src/**;
 *   - arbitrario que ja tem equivalente exato na escala (`text-[12px]` -> text-xs);
 *   - meia-medida e `font-family: 'Nome'` literal em CSS puro (src/**\/*.css);
 *   - `fontSize: N` / `fontFamily: 'Nome'` inline em .tsx;
 *   - `font-weight` pedido no CSS fora dos pesos que o Google Fonts carrega em
 *     index.html (peso orfao: o navegador sintetiza e o texto sai borrado).
 *
 * Padrao ratchet: o teto vem do budget versionado
 * (`scripts/qa/tipografia-budget.json`) e reprova so se a divida SOBE — nao
 * exige zerar tudo de uma vez.
 *
 * PORTADO do Zapp Web V2 (`scripts/qa/medir-tipografia.cjs`), com tres
 * adaptacoes ao que existe neste repo:
 *
 *  1. ESCALA. Lá `tailwind.config.ts` traz um bloco `fontSize:` proprio e
 *     `parseScale()` lançava se não achasse. Aqui `tailwind.config.ts` NAO
 *     declara `fontSize` (só fontFamily/colors/etc.), então a escala e a padrao
 *     do Tailwind — ver DEFAULT_SCALE. Um bloco `fontSize:` adicionado no futuro
 *     passa a ter precedencia automaticamente.
 *  2. CSS. Lá o CSS vivia em `src/styles/*.css` e os pesos só eram varridos em
 *     base/utilities/tokens.css. Aqui não existe `src/styles/`: o CSS e
 *     `src/index.css` e `src/components/map/liveMap.css`, então a varredura e de
 *     `src/**\/*.css`.
 *  3. FONT-FAMILY. Lá `tokens.css` era isentado porque declarava as variaveis.
 *     Aqui `src/index.css:242` já usa `font-family: var(--font-sans)` — valor sem
 *     quotes, que o regex nem casa — então a isenção por nome de arquivo saiu.
 *
 * Uso:
 *   node scripts/qa/medir-tipografia.cjs                                  # relatorio
 *   node scripts/qa/medir-tipografia.cjs --json scripts/qa/tipografia-budget.json
 *   node scripts/qa/medir-tipografia.cjs --check                          # guard-rail
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const CONFIG = path.join(ROOT, 'tailwind.config.ts');
const INDEX_HTML = path.join(ROOT, 'index.html');
const BUDGET = path.join(ROOT, 'scripts/qa/tipografia-budget.json');

// line-height herdado quando a classe nao declara um (preflight do Tailwind).
const INHERITED_LH_RATIO = 1.5;

/**
 * Escala padrao do Tailwind (identica em v3 e v4 para xs..9xl). Usada porque
 * `tailwind.config.ts` deste repo nao redefine `fontSize`; e a escala que as
 * classes `text-xs`...`text-9xl` realmente produzem.
 */
const DEFAULT_SCALE = {
  xs: { fontSize: '0.75rem', lineHeight: '1rem' },
  sm: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  base: { fontSize: '1rem', lineHeight: '1.5rem' },
  lg: { fontSize: '1.125rem', lineHeight: '1.75rem' },
  xl: { fontSize: '1.25rem', lineHeight: '1.75rem' },
  '2xl': { fontSize: '1.5rem', lineHeight: '2rem' },
  '3xl': { fontSize: '1.875rem', lineHeight: '2.25rem' },
  '4xl': { fontSize: '2.25rem', lineHeight: '2.5rem' },
  '5xl': { fontSize: '3rem', lineHeight: '1' },
  '6xl': { fontSize: '3.75rem', lineHeight: '1' },
  '7xl': { fontSize: '4.5rem', lineHeight: '1' },
  '8xl': { fontSize: '6rem', lineHeight: '1' },
  '9xl': { fontSize: '8rem', lineHeight: '1' },
};

// A rampa modular e a escala sancionada; token NOMEADO fora dela que passe de
// 16px e violacao, a menos que esteja na allowlist `allowAbove16` do budget.
const MODULAR_SCALE = new Set(Object.keys(DEFAULT_SCALE));

function isNamedAbove16(token, px, allowAbove16) {
  return (
    px != null &&
    px > 16 &&
    !MODULAR_SCALE.has(token) &&
    !(allowAbove16 && allowAbove16.has(token))
  );
}

/**
 * Escala efetiva: o bloco `fontSize:` de tailwind.config.ts quando existir,
 * senao a padrao do Tailwind. Nao lanca por ausencia — neste repo a ausencia e
 * o estado normal, e lancar deixaria o guard inutilizavel.
 */
function parseScale(configPath = CONFIG) {
  if (!fs.existsSync(configPath)) return { ...DEFAULT_SCALE };
  const src = fs.readFileSync(configPath, 'utf8');
  const block = src.match(/fontSize:\s*\{([\s\S]*?)\n {6}\}/);
  if (!block) return { ...DEFAULT_SCALE };
  const scale = { ...DEFAULT_SCALE };
  const re = /["']?([a-z0-9-]+)["']?:\s*\[\s*["']([^"']+)["']\s*,\s*\{\s*lineHeight:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(block[1]))) {
    scale[m[1]] = { fontSize: m[2], lineHeight: m[3] };
  }
  return scale;
}

const toPx = (v) => {
  if (!v) return null;
  if (v.endsWith('rem')) return Number.parseFloat(v) * 16;
  if (v.endsWith('px')) return Number.parseFloat(v);
  const n = Number.parseFloat(v);
  return Number.isNaN(n) ? null : n; // razao sem unidade, resolvida depois
};

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['__tests__', '__fixtures__', 'fixtures', 'test', 'tests'].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function walkCss(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCss(p, acc);
    else if (e.name.endsWith('.css')) acc.push(p);
  }
  return acc;
}

/** CSS puro: meia-medida de font-size e font-family literal (fora de var(--font-*)). */
function scanCss(srcDir = SRC) {
  const files = walkCss(srcDir);
  const halfStep = [];
  const literalFamily = [];
  const fontSizeRe = /font-size:\s*([0-9.]+)px/g;
  const familyRe = /font-family:\s*(['"])((?:(?!\1).)+)\1/g;
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    const txt = fs.readFileSync(f, 'utf8');
    let m;
    fontSizeRe.lastIndex = 0;
    while ((m = fontSizeRe.exec(txt))) {
      const px = Number.parseFloat(m[1]);
      if (!Number.isInteger(px)) {
        const line = txt.slice(0, m.index).split('\n').length;
        halfStep.push({ where: `${rel}:${line}`, px });
      }
    }
    familyRe.lastIndex = 0;
    while ((m = familyRe.exec(txt))) {
      const line = txt.slice(0, m.index).split('\n').length;
      literalFamily.push({ where: `${rel}:${line}`, value: m[2] });
    }
  }
  return { halfStep, literalFamily, arquivos: files.length };
}

/** .tsx: fontSize numerico inline, fontFamily literal e font-family literal em CSS embutido. */
function scanTsxInline(srcDir = SRC) {
  const files = walk(srcDir);
  const fontSizeInline = [];
  const literalFamily = [];
  const fontSizeRe = /fontSize:\s*([0-9.]+)\b/g;
  const familyRe = /fontFamily:\s*(['"])((?:(?!\1).)+)\1/g;
  const embeddedFamilyRe = /font-family:\s*([^;\n]+?)\s*;/g;
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    const txt = fs.readFileSync(f, 'utf8');
    let m;
    fontSizeRe.lastIndex = 0;
    while ((m = fontSizeRe.exec(txt))) {
      const line = txt.slice(0, m.index).split('\n').length;
      fontSizeInline.push({ where: `${rel}:${line}`, px: +m[1] });
    }
    familyRe.lastIndex = 0;
    while ((m = familyRe.exec(txt))) {
      const line = txt.slice(0, m.index).split('\n').length;
      literalFamily.push({ where: `${rel}:${line}`, value: m[2] });
    }
    embeddedFamilyRe.lastIndex = 0;
    while ((m = embeddedFamilyRe.exec(txt))) {
      const value = m[1].trim();
      if (value.startsWith('var(')) continue;
      const line = txt.slice(0, m.index).split('\n').length;
      literalFamily.push({ where: `${rel}:${line}`, value });
    }
  }
  return { fontSizeInline, literalFamily };
}

/**
 * Pesos que cada familia carrega, extraidos das URLs do Google Fonts em
 * index.html. `wght@min..max` (eixo variavel) cobre o intervalo continuo;
 * `wght@a;b;c` (lista estatica) cobre SO os pesos listados — um intermediario
 * ausente (450 numa lista 400;500) NAO esta carregado.
 *
 * Adaptacao: este index.html tem DUAS tags de Google Fonts (index.html:75 e
 * :76); o parser do Zapp lia so a primeira URL que casasse. Aqui todas entram.
 */
function parseLoadedWeights(indexHtmlPath = INDEX_HTML) {
  if (!fs.existsSync(indexHtmlPath)) return {};
  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const families = {};
  for (const url of html.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/g) ?? []) {
    const familyRe = /family=([^&"']+)/g;
    let m;
    while ((m = familyRe.exec(url))) {
      const [namePart, spec] = m[1].split(':wght@');
      const name = decodeURIComponent(namePart.replace(/\+/g, ' '));
      if (!spec) { families[name] = { min: 400, max: 400, exact: [400] }; continue; }
      const range = spec.match(/^([0-9]+)\.\.([0-9]+)$/);
      if (range) {
        families[name] = { min: +range[1], max: +range[2], exact: null };
      } else {
        const weights = [...new Set(spec.split(';').map(Number).filter((n) => !Number.isNaN(n)))]
          .sort((a, b) => a - b);
        if (weights.length) {
          families[name] = { min: weights[0], max: weights[weights.length - 1], exact: weights };
        }
      }
    }
  }
  return families;
}

/** Um peso e renderizavel pela familia carregada? */
function isWeightLoaded(spec, weight) {
  if (!spec) return false;
  if (spec.exact) return spec.exact.includes(weight);
  return weight >= spec.min && weight <= spec.max;
}

/**
 * `font-weight: N` no CSS que a familia padrao nao carrega. A familia padrao
 * deste repo e 'Plus Jakarta Sans' (tailwind.config.ts: fontFamily.sans, e a
 * primeira da lista em src/index.css: --font-sans).
 */
function scanOrphanWeights(srcDir = SRC, indexHtmlPath = INDEX_HTML) {
  const loaded = parseLoadedWeights(indexHtmlPath);
  const padrao = loaded['Plus Jakarta Sans'];
  if (!padrao) return []; // URL ausente/formato mudou — nao quebra o guard por isso
  const orphan = [];
  const re = /font-weight:\s*([0-9]{2,3})\b/g;
  for (const f of walkCss(srcDir)) {
    const rel = path.relative(ROOT, f);
    const txt = fs.readFileSync(f, 'utf8');
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(txt))) {
      const w = +m[1];
      if (!isWeightLoaded(padrao, w)) {
        const line = txt.slice(0, m.index).split('\n').length;
        orphan.push({
          where: `${rel}:${line}`,
          weight: w,
          faixaCarregada: [padrao.min, padrao.max],
          pesosCarregados: padrao.exact,
        });
      }
    }
  }
  return orphan;
}

function main() {
  const scale = parseScale();
  const named = Object.keys(scale);

  let budget = null;
  if (fs.existsSync(BUDGET)) {
    try { budget = JSON.parse(fs.readFileSync(BUDGET, 'utf8')); } catch { budget = null; }
  }
  const allowAbove16 = new Set((budget && budget.allowAbove16) || []);

  // So tokens de TAMANHO; evita text-primary / text-foreground (cores).
  // Escapa todos os meta-caracteres do nome do token, nao so o hifen.
  const namedRe = new RegExp(
    `\\btext-(${named.map((n) => n.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|')})\\b`,
    'g',
  );
  const arbRe = /\btext-\[([0-9.]+)(px|rem|em)\]/g;

  const files = walk(SRC);
  const usage = { named: {}, arbitrary: {} };
  const violations = { halfStep: [], above16: [], hasExactEquivalent: [] };

  // px -> classe nomeada equivalente exata
  const pxToNamed = {};
  for (const [k, v] of Object.entries(scale)) {
    const px = toPx(v.fontSize);
    if (px != null && pxToNamed[px] === undefined) pxToNamed[px] = k;
  }

  for (const f of files) {
    const rel = path.relative(ROOT, f);
    const txt = fs.readFileSync(f, 'utf8');
    let m;
    namedRe.lastIndex = 0;
    while ((m = namedRe.exec(txt))) {
      const token = m[1];
      usage.named[token] = (usage.named[token] || 0) + 1;
      const tokenPx = toPx(scale[token] && scale[token].fontSize);
      if (isNamedAbove16(token, tokenPx, allowAbove16)) {
        const nline = txt.slice(0, m.index).split('\n').length;
        violations.above16.push({ where: `${rel}:${nline}`, px: tokenPx, fonte: `text-${token}` });
      }
    }
    arbRe.lastIndex = 0;
    while ((m = arbRe.exec(txt))) {
      const raw = Number.parseFloat(m[1]);
      const px = m[2] === 'px' ? raw : raw * 16; // rem/em: 1 unidade = 16px na raiz
      usage.arbitrary[px] = (usage.arbitrary[px] || 0) + 1;
      const line = txt.slice(0, m.index).split('\n').length;
      const where = `${rel}:${line}`;
      if (!Number.isInteger(px)) violations.halfStep.push({ where, px });
      if (px > 16) violations.above16.push({ where, px });
      if (pxToNamed[px] !== undefined) {
        violations.hasExactEquivalent.push({ where, px, equivalent: `text-${pxToNamed[px]}` });
      }
    }
  }

  const resolved = {};
  for (const [k, v] of Object.entries(scale)) {
    const fsPx = toPx(v.fontSize);
    const lhRaw = v.lineHeight;
    const unitless = !/rem|px|em|%/.test(lhRaw);
    const lhPx = unitless ? +(fsPx * Number.parseFloat(lhRaw)).toFixed(2) : toPx(lhRaw);
    resolved[k] = { fontSizePx: fsPx, lineHeightPx: lhPx, lineHeightDeclarado: lhRaw, usos: usage.named[k] || 0 };
  }
  const arbitraryResolved = {};
  for (const [px, n] of Object.entries(usage.arbitrary)) {
    arbitraryResolved[px] = {
      fontSizePx: +px,
      lineHeightPx: +(px * INHERITED_LH_RATIO).toFixed(2),
      lineHeightOrigem: 'herdado (preflight 1.5)',
      usos: n,
      equivalenteNaEscala: pxToNamed[px] ? `text-${pxToNamed[px]}` : null,
    };
  }

  const totalArb = Object.values(usage.arbitrary).reduce((a, b) => a + b, 0);
  const totalNamed = Object.values(usage.named).reduce((a, b) => a + b, 0);

  const css = scanCss();
  const tsxInline = scanTsxInline();
  const orphanWeights = scanOrphanWeights();

  const report = {
    geradoEm: new Date().toISOString(),
    commit: process.env.GIT_SHA || null,
    escalaOrigem: fs.existsSync(CONFIG) && /fontSize:\s*\{/.test(fs.readFileSync(CONFIG, 'utf8'))
      ? 'tailwind.config.ts'
      : 'padrao do Tailwind (tailwind.config.ts nao declara fontSize)',
    allowAbove16: [...allowAbove16].sort((a, b) => a.localeCompare(b)),
    escala: resolved,
    arbitrarios: arbitraryResolved,
    totais: {
      usosNomeados: totalNamed,
      usosArbitrarios: totalArb,
      arquivosAnalisados: files.length,
      arquivosCss: css.arquivos,
    },
    violacoes: {
      meiaMedida: violations.halfStep.length,
      acima16px: violations.above16.length,
      comEquivalenteExato: violations.hasExactEquivalent.length,
      cssMeiaMedida: css.halfStep.length,
      cssFontFamilyLiteral: css.literalFamily.length,
      tsxFontSizeInline: tsxInline.fontSizeInline.length,
      tsxFontFamilyLiteral: tsxInline.literalFamily.length,
      pesoOrfao: orphanWeights.length,
    },
    detalheViolacoes: {
      ...violations,
      cssMeiaMedida: css.halfStep,
      cssFontFamilyLiteral: css.literalFamily,
      tsxFontSizeInline: tsxInline.fontSizeInline,
      tsxFontFamilyLiteral: tsxInline.literalFamily,
      pesoOrfao: orphanWeights,
    },
  };

  const jsonIdx = process.argv.indexOf('--json');
  if (jsonIdx > -1 && process.argv[jsonIdx + 1]) {
    const out = path.resolve(ROOT, process.argv[jsonIdx + 1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(`baseline gravado: ${path.relative(ROOT, out)}`);
  }

  console.log(`=== ESCALA (${report.escalaOrigem}) ===`);
  for (const [k, v] of Object.entries(resolved)) {
    console.log(`  text-${k.padEnd(6)} ${String(v.fontSizePx).padStart(5)}px / lh ${String(v.lineHeightPx).padStart(5)}px   usos: ${v.usos}`);
  }
  console.log('\n=== ARBITRARIOS ===');
  Object.entries(arbitraryResolved)
    .sort((a, b) => b[1].usos - a[1].usos)
    .forEach(([px, v]) => {
      const eq = v.equivalenteNaEscala ? `  -> ${v.equivalenteNaEscala}` : '';
      console.log(`  text-[${px}px]`.padEnd(18) + `usos: ${String(v.usos).padStart(4)}  lh herdado ${v.lineHeightPx}px${eq}`);
    });
  console.log('\n=== VIOLACOES (src/**, text-*) ===');
  console.log(`  meia-medida (N.5px)      : ${report.violacoes.meiaMedida}`);
  console.log(`  arbitrario > 16px        : ${report.violacoes.acima16px}`);
  console.log(`  tem equivalente na escala: ${report.violacoes.comEquivalenteExato}`);
  console.log('\n=== VIOLACOES (CSS puro, inline, pesos) ===');
  console.log(`  CSS meia-medida           : ${report.violacoes.cssMeiaMedida}`);
  console.log(`  CSS font-family literal   : ${report.violacoes.cssFontFamilyLiteral}`);
  console.log(`  tsx fontSize inline       : ${report.violacoes.tsxFontSizeInline}`);
  console.log(`  tsx fontFamily literal    : ${report.violacoes.tsxFontFamilyLiteral}`);
  console.log(`  peso orfao (nao carregado): ${report.violacoes.pesoOrfao}`);
  console.log(`\n  totais: ${totalNamed} nomeados / ${totalArb} arbitrarios em ${files.length} arquivos`);

  if (process.argv.includes('--check')) {
    if (!budget) {
      console.error('\nERRO: budget ausente. Gere com --json scripts/qa/tipografia-budget.json');
      process.exit(2);
    }
    let failed = false;
    const checked = [
      'meiaMedida', 'acima16px', 'comEquivalenteExato',
      'cssMeiaMedida', 'cssFontFamilyLiteral',
      'tsxFontSizeInline', 'tsxFontFamilyLiteral',
      'pesoOrfao',
    ];
    for (const k of checked) {
      const atual = report.violacoes[k];
      const teto = budget.violacoes[k];
      const ok = atual <= teto;
      console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${k}: ${atual} (teto ${teto})`);
      if (!ok) failed = true;
    }
    if (failed) { console.error('\nguard-rail de tipografia reprovado: a divida subiu.'); process.exit(1); }
    console.log('\nguard-rail de tipografia aprovado.');
  }
}

module.exports = {
  parseScale, toPx, walk, walkCss, scanCss, scanTsxInline,
  parseLoadedWeights, isWeightLoaded, scanOrphanWeights, isNamedAbove16,
  MODULAR_SCALE, DEFAULT_SCALE, main,
};

if (require.main === module) main();
