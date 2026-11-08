#!/usr/bin/env node
// Gera o contexto de código do Lalamove V2 para agentes de IA (padrão: docs/contexto/codigo/).
// Zero dependências, só APIs nativas do Node (>= 22). Lê o repositório e escreve JSONs + INDEX.md:
//   rotas (React Router em src/App.tsx, com requiredRole/requireMFA do ProtectedRoute),
//   menu (src/components/layout/sidebar-config.ts), módulos, componentes, hooks, lógica,
//   edge functions (supabase/functions), banco (supabase/migrations + types.ts), RBAC,
//   testes (vitest src/**/*.{test,spec}.* + playwright e2e/*.e2e.ts + deno nas edges),
//   ferramentas/CI/scripts/env/integrações, grafo de imports, convenções e baseline.
//
// Uso: node scripts/ai-context/gerar.mjs [--root <dir>] [--out <dir>] [--quiet]
// Config opcional na raiz do repo: ai-context.config.json
//   { "out": "docs/contexto/codigo", "skipDirs": [...], "srcDirs": [...], "menuFiles": [...],
//     "routeFiles": [...], "aliases": { "@/": "src/" }, "typesFile": "...", "maxFileMB": 8,
//     "publicacao": "texto do rodapé do INDEX.md" }
// Saída determinística: só manifest.json carrega data/hora.
// Nunca imprime valor de variável de ambiente nem de segredo: só NOMES de env e posição
// (arquivo:linha) de possíveis segredos commitados.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const FORMAT_VERSION = 1;
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ROOT = path.resolve(argOf('--root', process.env.AI_CONTEXT_ROOT || process.cwd()));
const QUIET = args.includes('--quiet');
const log = (...m) => { if (!QUIET) console.log('[contexto-codigo]', ...m); };
const ERROS = [];
const secao = (nome, fn, fallback) => { try { return fn(); } catch (e) { ERROS.push({ secao: nome, erro: String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ') }); log(`ERRO na seção ${nome}: ${e && e.message}`); return fallback; } };

// ---------- util ----------
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const abs = (p) => path.join(ROOT, p);
const CFG = (() => { try { return JSON.parse(fs.readFileSync(abs('ai-context.config.json'), 'utf8')); } catch { return {}; } })();
const OUT = path.resolve(ROOT, argOf('--out', process.env.AI_CONTEXT_DIR || CFG.out || 'docs/contexto/codigo'));
const OUT_REL = rel(OUT);
const MAX_FILE_BYTES = (CFG.maxFileMB || 8) * 1024 * 1024;
const PUBLICACAO = process.env.AI_CONTEXT_PUBLICACAO || CFG.publicacao || 'Gerado sob demanda (não há workflow de contexto neste repo); rode o comando abaixo e commite a saída junto do fix.';
const exists = (p) => fs.existsSync(abs(p));
const readText = (p) => { try { const a = path.isAbsolute(p) ? p : abs(p); if (fs.statSync(a).size > MAX_FILE_BYTES) return ''; return fs.readFileSync(a, 'utf8'); } catch { return ''; } };
const readJson = (p) => { try { return JSON.parse(readText(p).replace(/^﻿/, '')); } catch { return null; } };
const uniq = (a) => [...new Set(a)].sort();
const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const countLines = (s) => (s ? s.split('\n').length : 0);
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim(); } catch { return ''; } };
// Remove comentário de bloco mas preserva as quebras de linha internas (só troca por espaço):
// sem isso, um /* ... */ de várias linhas encolhe o arquivo e desalinha a numeração de tudo que
// vem depois — o que torna errado qualquer arquivo:linha calculado sobre este texto.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
const cap = (arr, n = 200) => arr.slice(0, n);
const allMatches = (re, s, g = 1) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(s))) out.push(m[g]); return out; };
const byCount = (arr) => Object.entries(arr.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
const dirOf = (f) => path.posix.dirname(f);
const baseOf = (f) => path.posix.basename(f).replace(/\.[^.]+$/, '');

// ---------- walk ----------
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'out', '.cache', 'tmp', '.tmp',
  'playwright-report', 'test-results', 'graphify-out', '.idea', '.vscode', '__pycache__', ...(CFG.skipDirs || [])]);
const KEEP_DOT = new Set(['.github', '.env.example', '.nvmrc', '.lintstagedrc', '.prettierrc', '.claude', '.agents', '.codex', '.hermes.md', '.graphifyignore']);
const ALL = [];
(function walk(dir) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith('.') && !KEEP_DOT.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (SKIP_DIRS.has(e.name) || full === OUT) continue; walk(full); }
    else if (e.isFile()) ALL.push(rel(full));
  }
})(ROOT);
ALL.sort();
const FILESET = new Set(ALL);
log(`arquivos no repo: ${ALL.length}`);

// ---------- linguagens / stack ----------
const EXT_LANG = { '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript', '.py': 'Python', '.sql': 'SQL', '.sh': 'Shell', '.ps1': 'PowerShell', '.css': 'CSS', '.html': 'HTML', '.md': 'Markdown', '.json': 'JSON', '.yml': 'YAML', '.yaml': 'YAML', '.toml': 'TOML' };
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts']);
// vitest: src/**/*.{test,spec}.{ts,tsx} · playwright: e2e/*.e2e.ts · deno: supabase/functions/**/*.test.ts
const TEST_RE = /(\.(test|spec|e2e|contract|unit|fixture|fixtures)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|tests?|fixtures|__fixtures__|e2e|__mocks__)\//;
const STORY_RE = /\.stories\.[cm]?[jt]sx?$/;
const pkg = readJson('package.json') || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
const langCounts = byCount(ALL.map((f) => EXT_LANG[path.extname(f).toLowerCase()]).filter(Boolean));
const SRC_DIRS = CFG.srcDirs || ['src'].filter((d) => exists(d));
const isSrc = (f) => SRC_DIRS.some((d) => f.startsWith(d + '/'));
const stack = {
  linguagens: langCounts.slice(0, 8).map(([l, n]) => `${l} (${n})`),
  linguagem_principal: (langCounts.find(([l]) => !['Markdown', 'JSON', 'YAML', 'TOML', 'CSS', 'HTML', 'Shell', 'SQL', 'PowerShell'].includes(l)) || ['n/d'])[0],
  framework: has('react') ? 'React' : 'não detectado',
  bundler: has('vite') ? 'Vite' : 'não detectado',
  roteador: has('react-router-dom') ? 'react-router-dom (rotas declaradas em src/App.tsx)' : 'não detectado',
  banco: exists('supabase/config.toml') ? `Supabase Cloud (project_id em supabase/config.toml: ${(/^project_id\s*=\s*"([^"]+)"/m.exec(readText('supabase/config.toml')) || [, 'n/d'])[1]})` : 'não detectado',
  edge_runtime: exists('supabase/functions') ? 'Deno (supabase/functions)' : null,
  testes: [has('vitest') && 'vitest', has('@playwright/test') && 'playwright', exists('supabase/functions/_shared/contract.test.ts') && 'deno test (contratos das edges)'].filter(Boolean),
  ui: [has('tailwindcss') && 'tailwind', (has('@radix-ui/react-dialog') || exists('components.json')) && 'radix/shadcn', has('lucide-react') && 'lucide', has('recharts') && 'recharts', has('mapbox-gl') && 'mapbox-gl'].filter(Boolean),
  estado: [has('@tanstack/react-query') && 'react-query', has('zustand') && 'zustand'].filter(Boolean),
  gerenciador_pacotes: exists('package-lock.json') ? 'npm (package-lock.json; não há bun.lock)' : exists('bun.lock') ? 'bun' : 'não detectado',
  node: readText('.nvmrc').trim() || (pkg.engines && pkg.engines.node) || null,
  deploy: [exists('vercel.json') && 'vercel', ALL.some((f) => /^\.github\/workflows\//.test(f)) && 'github actions', exists('Dockerfile') && 'docker'].filter(Boolean),
  pastas_fonte: SRC_DIRS,
};

// ---------- aliases (tsconfig* + @/ default) ----------
const aliasesByBase = {};
for (const tc of ALL.filter((f) => /^tsconfig[\w.-]*\.json$/.test(f) || /(^|\/)(tsconfig[\w.-]*|jsconfig)\.json$/.test(f))) {
  const j = readJson(tc) || {}; const co = j.compilerOptions || {}; const base = dirOf(tc) === '.' ? '' : dirOf(tc) + '/';
  const bu = co.baseUrl ? path.posix.normalize(base + co.baseUrl).replace(/^\.\/?/, '').replace(/^\.$/, '') : null;
  const map = aliasesByBase[base] || (aliasesByBase[base] = {});
  for (const [k, v] of Object.entries(co.paths || {})) { const t = String((v || [])[0] || '').replace(/^\.\//, '').replace(/\*$/, ''); map[k.replace(/\*$/, '')] = path.posix.normalize((bu ? bu + '/' : base) + t).replace(/^\.\//, '').replace(/^\.$/, ''); }
  if (bu) map.__baseUrl__ = bu;
}
for (const [a, t] of Object.entries(CFG.aliases || {})) (aliasesByBase[''] = aliasesByBase[''] || {})[a] = t;
if (!Object.keys(aliasesByBase[''] || {}).filter((k) => k !== '__baseUrl__').length && exists('src')) (aliasesByBase[''] = aliasesByBase[''] || {})['@/'] = 'src/';
const aliasesFor = (f) => Object.keys(aliasesByBase).filter((b) => f.startsWith(b)).sort((a, b) => b.length - a.length).map((b) => aliasesByBase[b]);
const isAliasSpec = (f, spec) => aliasesFor(f).some((m) => Object.keys(m).some((a) => a !== '__baseUrl__' && spec.startsWith(a)));
const RESOLVE_EXT = [...CODE_EXT, '.d.ts', '.json'];
function resolveImport(fromFile, spec) {
  if (!spec || spec.startsWith('node:') || /^https?:/.test(spec)) return null;
  const cands = [];
  if (spec.startsWith('.')) cands.push(path.posix.normalize(path.posix.join(dirOf(fromFile), spec)));
  else {
    for (const m of aliasesFor(fromFile)) {
      for (const [a, dir] of Object.entries(m)) if (a !== '__baseUrl__' && spec.startsWith(a)) cands.push(path.posix.normalize(dir + spec.slice(a.length)));
      if (m.__baseUrl__ !== undefined) cands.push(path.posix.normalize((m.__baseUrl__ ? m.__baseUrl__ + '/' : '') + spec));
    }
    if (spec.startsWith('/')) cands.push(spec.slice(1));
  }
  for (const t of cands) {
    const c = t.replace(/\.js$/, '');
    for (const x of [t, c, ...RESOLVE_EXT.map((e) => c + e), ...RESOLVE_EXT.map((e) => c + '/index' + e)]) if (FILESET.has(x)) return x;
  }
  return null;
}

// ---------- análise por arquivo ----------
const CODE_FILES = ALL.filter((f) => CODE_EXT.has(path.extname(f)) && !f.endsWith('.d.ts'));
const FILE = new Map();
const RE = {
  imp: /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]/g,
  dyn: /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  req: /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  hook: /\b(use[A-Z]\w*)\s*\(/g,
  from: /\.from\(\s*['"`]([\w.]+)['"`]/g,
  rpc: /\.rpc\(\s*['"`](\w+)['"`]/g,
  invoke: /functions\.invoke\(\s*['"`]([\w-]+)['"`]/g,
  fnUrl: /\/functions\/v1\/([\w-]+)/g,
  envVite: /import\.meta\.env\.(\w+)/g,
  envNode: /process\.env\.(\w+)/g,
  envDeno: /Deno\.env\.get\(\s*['"](\w+)['"]/g,
  exp: /export\s+(?:async\s+)?(?:const|let|var|function\*?|class|enum|interface|type|abstract\s+class)\s+([A-Za-z_$][\w$]*)/g,
  expList: /export\s*\{([^}]+)\}/g,
  expDefault: /export\s+default\s+(?:async\s+)?(?:function\s*\*?\s*|class\s+)?([A-Za-z_$][\w$]*)?/g,
  storage: /storage\.from\(\s*['"`]([\w-]+)['"`]/g,
  channel: /\.channel\(\s*['"`]([^'"`]+)['"`]/g,
  urlHost: /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[/'"`\s)?]|$)/gi,
  flag: /(?:isFeatureEnabled|useFeatureFlag|useFlag|useFeature|getFlag|featureFlag|isEnabled)\(\s*['"`]([\w.:-]+)['"`]/g,
  flagEnv: /\b(?:VITE_)?(FEATURE_[A-Z0-9_]+|FF_[A-Z0-9_]+|ENABLE_[A-Z0-9_]+)\b/g,
  role: /\b(?:role|roles|papel|userRole|requiredRole|allowedRoles|hasRole|requireRole|minRole)\b\s*(?:[:=!]=?=?|\(|\.includes\(|:\s*\[)\s*\[?\s*['"`](\w+)['"`]/g,
  perm: /\b(?:requiredPermission|hasPermission|permission)\b\s*(?:[:=]=?=?|\()\s*['"`]([\w.:-]+)['"`]/g,
  zod: /\b(?:z|zod)\.object\(/g,
};
const envNames = (s) => uniq([...allMatches(RE.envVite, s), ...allMatches(RE.envNode, s), ...allMatches(RE.envDeno, s)]);
for (const f of CODE_FILES) secao(`arquivo:${f}`, () => {
  const raw = readText(f);
  const src = stripComments(raw);
  const specs = [...allMatches(RE.imp, src), ...allMatches(RE.dyn, src), ...allMatches(RE.req, src)];
  const local = uniq(specs.map((s) => resolveImport(f, s)).filter(Boolean));
  const external = uniq(specs.filter((s) => !s.startsWith('.') && !s.startsWith('/') && !isAliasSpec(f, s) && !resolveImport(f, s)).map((s) => (s.startsWith('@') ? s.split('/').slice(0, 2).join('/') : s.split('/')[0])));
  const expDef = allMatches(RE.expDefault, src).filter(Boolean);
  const exportsNamed = uniq([...allMatches(RE.exp, src), ...expDef, ...allMatches(RE.expList, src).flatMap((l) => l.split(',').map((x) => x.trim().split(/\s+as\s+/).pop()).filter((x) => x && /^[A-Za-z_$][\w$]*$/.test(x)))]);
  const todos = []; let ln = 0;
  for (const line of raw.split('\n')) { ln++; const m = /\b(TODO|FIXME|HACK|XXX)\b[:\s-]*([^\n]{0,100})/.exec(line); if (m) todos.push({ linha: ln, tipo: m[1], texto: m[2].trim() }); }
  const isTest = TEST_RE.test(f); const isStory = STORY_RE.test(f);
  const base = baseOf(f);
  const temJsx = /\.(tsx|jsx)$/.test(f) && /(?<![\w.])<[a-zA-Z][\w.-]*(?:\s[^<>]*)?\/?>/.test(src);
  FILE.set(f, {
    linhas: countLines(raw), bytes: Buffer.byteLength(raw), imports: local, externos: external, exports: exportsNamed, export_default: expDef[0] || (/export\s+default\b/.test(src) ? '(anônimo)' : null),
    hooks: uniq(allMatches(RE.hook, src)), tabelas: uniq(allMatches(RE.from, src)), rpcs: uniq(allMatches(RE.rpc, src)),
    edges: uniq([...allMatches(RE.invoke, src), ...allMatches(RE.fnUrl, src)]), env: envNames(src), buckets: uniq(allMatches(RE.storage, src)), canais_realtime: uniq(allMatches(RE.channel, src)),
    hosts_externos: uniq(allMatches(RE.urlHost, src).map((h) => h.toLowerCase())).filter((h) => !/localhost|example\.(com|org)|w3\.org|schema\.org|github\.com|npmjs\.com|deno\.land|esm\.sh|jsdelivr|unpkg/.test(h)),
    flags: uniq([...allMatches(RE.flag, src), ...allMatches(RE.flagEnv, src)]), papeis: uniq(allMatches(RE.role, src)), permissoes: uniq(allMatches(RE.perm, src)), zod: (src.match(RE.zod) || []).length,
    todos, teste: isTest, story: isStory,
    componente: temJsx && !isTest && !isStory && exportsNamed.some((e) => /^[A-Z]/.test(e)),
    hook_arquivo: /^use[A-Z]/.test(base) && !isTest,
    any_count: (src.match(/:\s*any\b|<any>|as any\b/g) || []).length, console_count: (src.match(/console\.(log|debug)\(/g) || []).length, ts_ignore: (src.match(/@ts-(ignore|expect-error|nocheck)/g) || []).length,
    eslint_disable: (src.match(/eslint-disable/g) || []).length,
    conteudo: src,
  });
});

// ---------- grafo reverso / fecho ----------
const USED_BY = new Map();
for (const [f, d] of FILE) for (const i of d.imports) { if (!USED_BY.has(i)) USED_BY.set(i, []); USED_BY.get(i).push(f); }
for (const [, v] of USED_BY) v.sort();
const usedBy = (f) => (USED_BY.get(f) || []).filter((u) => !FILE.get(u)?.teste);
const closureCache = new Map();
function closure(f) {
  if (closureCache.has(f)) return closureCache.get(f);
  const seen = new Set(); const stack = [f];
  while (stack.length) { const cur = stack.pop(); if (seen.has(cur)) continue; seen.add(cur); const d = FILE.get(cur); if (d) for (const i of d.imports) if (!seen.has(i) && !FILE.get(i)?.teste) stack.push(i); }
  seen.delete(f); const arr = [...seen].sort(); closureCache.set(f, arr); return arr;
}
const AGG_KEYS = ['hooks', 'tabelas', 'rpcs', 'edges', 'env', 'buckets', 'canais_realtime', 'flags', 'papeis', 'permissoes'];
function aggregate(files) {
  const agg = Object.fromEntries(AGG_KEYS.map((k) => [k, new Set()]));
  for (const f of files) { const d = FILE.get(f); if (!d) continue; for (const k of AGG_KEYS) for (const v of d[k] || []) agg[k].add(v); }
  return Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, [...v].sort()]));
}

// ---------- domínios (src/<kind>/<nome>) ----------
const DOM_KINDS = 'components|pages|hooks|services|lib|utils|integrations|types|i18n|test|features|modules|layouts|providers|contexts?|stores?|api|config|data|schemas|validators';
const SRC_PREFIX_RE = /^(?:(?:src|supabase)\/)?/;
const DOM_RE = new RegExp(`^(${DOM_KINDS})\\/([^/]+)`);
function dominioDe(f) {
  const pre = (SRC_PREFIX_RE.exec(f) || [''])[0];
  const rest = f.slice(pre.length);
  const m = DOM_RE.exec(rest);
  if (!m) { const top = /^([^/]+)\//.exec(rest); return top && pre && !/\./.test(top[1]) ? top[1] : null; }
  return m[2].includes('.') ? m[1] : `${m[1]}/${m[2]}`;
}
const HOOK_FILES_BY_NAME = new Map();
const localHooks = (hooks) => hooks.filter((h) => HOOK_FILES_BY_NAME.has(h));

// ---------- hooks ----------
const hooksOut = secao('hooks', () => {
  const out = [];
  for (const [f, d] of FILE) {
    if (d.teste) continue;
    const names = d.exports.filter((e) => /^use[A-Z]/.test(e));
    if (!names.length && !d.hook_arquivo) continue;
    for (const n of names) if (!HOOK_FILES_BY_NAME.has(n)) HOOK_FILES_BY_NAME.set(n, f);
    out.push({ arquivo: f, hooks_exportados: names, linhas: d.linhas, dominio: dominioDe(f), tabelas: d.tabelas, rpcs: d.rpcs, edges: d.edges, hooks_internos: d.hooks.filter((h) => !names.includes(h)), canais_realtime: d.canais_realtime, usado_por: usedBy(f).length, usado_por_arquivos: cap(usedBy(f), 30), coberto_por_testes: 0 });
  }
  return out.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
}, []);

// ---------- rotas (React Router em JSX) ----------
const lazyMap = new Map();
for (const [f, d] of FILE) {
  const re = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:lazy\w*|React\.lazy|loadable)\s*\(\s*(?:async\s*)?(?:\(\)\s*=>\s*)?(?:\{[^}]{0,200}?)?(?:await\s+)?import\(\s*['"]([^'"]+)['"]/g; let m;
  while ((m = re.exec(d.conteudo))) { const t = resolveImport(f, m[2]); if (t) lazyMap.set(m[1], t); }
}
const ambiguos = new Set();
function componentFile(name, fromFile, strict = false) {
  if (!name) return null;
  if (lazyMap.has(name)) return lazyMap.get(name);
  const d = FILE.get(fromFile);
  if (d) {
    const re = new RegExp(`import\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}\\b[^;'"]*)\\s*from\\s+['"]([^'"]+)['"]`);
    const m = re.exec(d.conteudo);
    if (m) { const t = resolveImport(fromFile, m[1]); if (t) { const dt = FILE.get(t); if (dt && !dt.exports.includes(name)) for (const i of dt.imports) { const di = FILE.get(i); if (di && di.exports.includes(name)) return lazyMap.get(name) || i; } return t; } }
    for (const i of d.imports) { const di = FILE.get(i); if (di && di.exports.includes(name)) return i; }
  }
  if (strict) return null;
  const cands = [...FILE.entries()].filter(([, d2]) => d2.exports.includes(name) && !d2.teste && d2.componente).map(([f2]) => f2);
  if (cands.length > 1) ambiguos.add(name);
  return cands[0] || null;
}
const joinPath = (parent, child) => { if (child === undefined || child === null || child === '') return parent || '/'; if (child.startsWith('/')) return child; const p = (parent || '').replace(/\/$/, ''); return (p + '/' + child).replace(/\/+/g, '/'); };
const mk = (o) => ({ caminho: null, componente: null, arquivo: null, tipo: 'tela', protegida: false, papel_requerido: null, requer_mfa: false, permissao_requerida: null, wrappers: [], pai: null, indice: false, lazy: false, ...o });
const rotas = [];
// `<Route>` do react-router; `<Route className=...>` é o ícone lucide-react com o mesmo nome.
const routeFiles = uniq([...CODE_FILES.filter((f) => { const c = FILE.get(f)?.conteudo || ''; return !FILE.get(f)?.teste && isSrc(f) && /<Routes[\s>]/.test(c) && /<Route\b/.test(c) && (/\bpath\s*[=:]\s*['"]/.test(c) || /<Route\b[^>]*\bindex\b/.test(c)); }), ...(CFG.routeFiles || [])]);
secao('rotas-jsx', () => {
  for (const rf of routeFiles) {
    const src = FILE.get(rf)?.conteudo || ''; const stack = [];
    const re = /<Route\b((?:[^>{/]|\/(?!>)|\{(?:[^{}]|\{[^{}]*\})*\})*)(\/?)>|<\/Route\s*>/g; let m;
    while ((m = re.exec(src))) {
      if (m[0].startsWith('</')) { stack.pop(); continue; }
      const attrs = m[1] || ''; const self = m[2] === '/';
      const p = /\bpath=["']([^"']*)["']/.exec(attrs) || /\bpath:\s*["']([^"']*)["']/.exec(attrs); const isIndex = /\bindex\b/.test(attrs);
      const frame = stack.length ? stack[stack.length - 1] : null;
      const parent = frame ? frame.caminho : null;
      const full = p ? joinPath(parent, p[1]) : isIndex ? parent || '/' : parent;
      const tags = [...attrs.matchAll(/<([A-Z]\w*)/g)].map((x) => x[1]);
      const props = [...attrs.matchAll(/\w+=\{\s*([A-Z]\w*)\s*\}/g)].map((x) => x[1]);
      const GENERIC = /^(?:Navigate|Redirect|Suspense|Fragment|Outlet|Loadable|AnimatePresence|Lazy\w*|\w*Wrapper|\w*Boundary|\w*Provider|\w*Layout|\w*Route)$|^(?:Protected|Private|Require)\w*$|^\w*Guard$/;
      const ordem = uniq([...props, ...tags.slice().reverse()]).sort((a, b) => (props.includes(b) ? 1 : 0) - (props.includes(a) ? 1 : 0) || tags.lastIndexOf(b) - tags.lastIndexOf(a));
      let comp = null, file = null;
      for (const cnd of ordem.filter((x) => !GENERIC.test(x))) { const fl = componentFile(cnd, rf, true); if (fl) { comp = cnd; file = fl; break; } }
      if (!comp) for (const cnd of ordem.filter((x) => !GENERIC.test(x))) { const fl = componentFile(cnd, rf); if (fl) { comp = cnd; file = fl; break; } }
      if (!comp) { const inner = tags[tags.length - 1]; if (inner && !/^(Navigate|Redirect)$/.test(inner)) { comp = inner; file = componentFile(inner, rf); } }
      const redir = /<(?:Navigate|Redirect)\b[^>]*\bto=["']([^"']+)["']/.exec(attrs);
      // RBAC do ProtectedRoute: requiredRole / requireMFA / requiredPermission; herda do Route que envolve
      const herda = frame ? frame.rota : null;
      const guard = /<((?:Protected|Private|Require)\w*|\w*Guard)\b([^>]*)>/.exec(attrs);
      const gAttrs = guard ? guard[2] : '';
      const papel = (/\brequiredRole\s*=\s*["']([\w-]+)["']/.exec(gAttrs) || /\brequiredRole\s*=\s*\{\s*["']([\w-]+)["']\s*\}/.exec(gAttrs) || [])[1] || (herda ? herda.papel_requerido : null) || null;
      const mfa = /\brequireMFA\b(?!\s*=\s*\{?\s*false)/.test(gAttrs) || !!(herda && herda.requer_mfa);
      const perm = (/\brequiredPermission\s*=\s*["']([\w.:-]+)["']/.exec(gAttrs) || [])[1] || (herda ? herda.permissao_requerida : null) || null;
      const protegida = tags.some((w) => /^(?:Protected|Private|Require)\w*$|^\w*Guard$/.test(w)) || !!(herda && herda.protegida);
      const comum = { componente: comp, arquivo: file, protegida, papel_requerido: papel, requer_mfa: mfa, permissao_requerida: perm, wrappers: tags.filter((t) => t !== comp), pai: parent, definida_em: rf };
      let entry;
      if (p || isIndex) { entry = mk({ ...comum, caminho: full, indice: isIndex, lazy: comp ? lazyMap.has(comp) : false, tipo: redir && !comp ? 'redirect' : 'tela', redireciona: redir ? redir[1] : null }); rotas.push(entry); }
      else { entry = mk({ ...comum, caminho: null, tipo: 'layout' }); if (!self && (tags.length || protegida)) rotas.push(entry); }
      if (!self) stack.push({ caminho: full, rota: entry });
    }
  }
});
const enrich = (r) => {
  if (!r.arquivo || !FILE.has(r.arquivo)) return { ...r, hooks: [], hooks_locais: [], tabelas: [], rpcs: [], edges: [], canais_realtime: [], flags: [], papeis: [], arquivos_puxados: 0 };
  const files = [r.arquivo, ...closure(r.arquivo)]; const a = aggregate(files);
  return { ...r, hooks: a.hooks, hooks_locais: localHooks(a.hooks), tabelas: a.tabelas, rpcs: a.rpcs, edges: a.edges, canais_realtime: a.canais_realtime, flags: a.flags, papeis: a.papeis, arquivos_puxados: files.length - 1 };
};
const rotasDedup = Object.values(Object.fromEntries(rotas.filter((r) => r.caminho).map((r) => [`${r.caminho}|${r.componente}|${r.definida_em}`, r])));
const layouts = rotas.filter((r) => !r.caminho).map(enrich);
const rotasEnriched = rotasDedup.sort((a, b) => a.caminho.localeCompare(b.caminho) || (a.indice ? 1 : 0) - (b.indice ? 1 : 0) || a.tipo.localeCompare(b.tipo) || a.definida_em.localeCompare(b.definida_em)).map(enrich);

// ---------- menu (sidebar-config.ts: categorias com items, requiredRole escalar) ----------
const menu = [];
secao('menu', () => {
  const menuFiles = uniq([...[...FILE.entries()].filter(([f, d]) => !d.teste && isSrc(f) && (/nav|menu|sidebar/i.test(f) || ((d.conteudo.match(/\b(?:label|title)\s*:\s*['"`][^'"`]+['"`]/g) || []).length >= 5 && /\b(?:path|href|to|route)\s*:/.test(d.conteudo) && /\b(nav|menu|sidebar|Sidebar|Navigation)\b/.test(d.conteudo)))).map(([f]) => f), ...(CFG.menuFiles || [])]);
  for (const f of menuFiles) {
    const src = (FILE.get(f)?.conteudo || readText(f)).replace(/icon\s*:\s*\{[^{}]*\}/g, 'icon: 0');
    // categorias: rótulo + requiredRole do grupo, até o `items:` daquele grupo
    const grupos = [...src.matchAll(/(?:title|label|group|section|name)\s*:\s*['"`]([^'"`]+)['"`]([^{}[\]]*?)(?:items|children|links|routes)\s*:/g)]
      .map((g) => ({ rotulo: g[1], papel: (/(?:requiredRole|role|minRole)\s*:\s*['"`](\w+)['"`]/.exec(g[2]) || [])[1] || null, pos: g.index }));
    const re = /\{[^{}]*?\b(?:label|title|name)\s*:\s*(['"`])([^'"`]+)\1[^{}]*?\b(?:path|href|to|route|url)\s*:\s*(['"`])([^'"`]+)\3[^{}]*\}|\{[^{}]*?\b(?:path|href|to|route|url)\s*:\s*(['"`])([^'"`]+)\5[^{}]*?\b(?:label|title|name)\s*:\s*(['"`])([^'"`]+)\7[^{}]*\}/g;
    let m;
    while ((m = re.exec(src))) {
      const label = m[2] || m[8]; const dest = m[4] || m[6]; const block = m[0];
      if (!/^[\w/.:#?=&-]+$/.test(dest) || label.length > 60) continue;
      const g = grupos.filter((x) => x.pos < m.index).pop() || null;
      let papeisExpr = null; const roles = [];
      for (const x of block.matchAll(/(?:requiredRole|roles?|permissions?|allowedRoles|minRole)\s*:\s*(\[[^\]]*\]|['"`]\w+['"`]|[A-Za-z_$][\w$.]*)/g)) {
        let expr = x[1];
        if (/^['"`]/.test(expr)) { roles.push(expr.replace(/['"`]/g, '')); continue; }
        if (!expr.startsWith('[')) { const cm = new RegExp(`(?:const|let|var)\\s+${expr.replace(/[.$]/g, '\\$&')}\\b[^=]*=\\s*(\\[[^\\]]*\\])`).exec(src) || [...(FILE.get(f)?.imports || [])].map((i) => new RegExp(`(?:const|let|var)\\s+${expr.replace(/[.$]/g, '\\$&')}\\b[^=]*=\\s*(\\[[^\\]]*\\])`).exec(FILE.get(i)?.conteudo || '')).find(Boolean); if (cm) expr = cm[1]; else { papeisExpr = x[1]; continue; } }
        roles.push(...expr.replace(/^\[|\]$/g, '').split(',').map((s0) => s0.replace(/['"`\s]/g, '')).filter((s0) => /^\w+$/.test(s0)));
      }
      menu.push({ rotulo: label, destino: dest, grupo: g ? g.rotulo : null, papel_do_grupo: g ? g.papel : null, papeis: uniq(roles), papeis_nao_resolvidos: papeisExpr, badge: (/badgeType\s*:\s*['"`](\w+)['"`]/.exec(block) || [])[1] || null, definido_em: f });
    }
  }
});
const menuUniq = Object.values(Object.fromEntries(menu.map((v) => [v.destino + '|' + v.rotulo, v])))
  .map((m) => ({ ...m, papel_efetivo: m.papeis[0] || m.papel_do_grupo || null }))
  .sort((a, b) => (a.grupo || '').localeCompare(b.grupo || '') || a.rotulo.localeCompare(b.rotulo));
const norm = (p) => String(p).replace(/^\//, '').replace(/\/$/, '').split('?')[0];
const resolveDestino = (dest) => rotasEnriched.find((r) => r.caminho === dest) || rotasEnriched.find((r) => norm(r.caminho) === norm(dest)) || null;

// ---------- módulos ----------
const dominios = new Map();
for (const f of FILE.keys()) { const dom = dominioDe(f); if (!dom) continue; if (!dominios.has(dom)) dominios.set(dom, []); dominios.get(dom).push(f); }
const modulos = secao('modulos', () => [...dominios.entries()].filter(([, files]) => files.some((f) => !FILE.get(f).teste)).sort(([a], [b]) => a.localeCompare(b)).map(([dom, files]) => {
  const prod = files.filter((f) => !FILE.get(f).teste);
  const direto = aggregate(prod);
  const a = aggregate(uniq(prod.flatMap((f) => [f, ...closure(f)])));
  const telas = rotasEnriched.filter((r) => r.arquivo && dominioDe(r.arquivo) === dom);
  const itensMenu = menuUniq.filter((mi) => { const t = resolveDestino(mi.destino); return t && telas.includes(t); });
  return {
    modulo: dom, arquivos: prod.length, testes: files.length - prod.length, linhas: prod.reduce((s, f) => s + FILE.get(f).linhas, 0),
    itens_menu: itensMenu.map((x) => x.rotulo), telas: telas.map((t) => t.caminho),
    papeis_das_telas: uniq(telas.map((t) => t.papel_requerido).filter(Boolean)),
    componentes: prod.filter((f) => FILE.get(f)?.componente).length,
    hooks_locais: localHooks(a.hooks), hooks_definidos: hooksOut.filter((h) => dominioDe(h.arquivo) === dom).flatMap((h) => h.hooks_exportados),
    edges: a.edges, tabelas: a.tabelas, rpcs: a.rpcs, buckets: a.buckets, canais_realtime: a.canais_realtime, env: a.env, flags: a.flags, papeis: a.papeis,
    diretos: { edges: direto.edges, tabelas: direto.tabelas, rpcs: direto.rpcs },
    importado_por_outros_modulos: uniq(prod.flatMap((f) => usedBy(f)).map((u) => dominioDe(u)).filter((x) => x && x !== dom)),
    depende_de_modulos: uniq(prod.flatMap((f) => FILE.get(f).imports).map((u) => dominioDe(u)).filter((x) => x && x !== dom)),
    pacotes_externos: uniq(prod.flatMap((f) => FILE.get(f).externos || [])).filter((x) => !/^(react|react-dom)$/.test(x)).slice(0, 40),
  };
}), []);

// ---------- componentes ----------
const lazyTargets = new Set(lazyMap.values());
const componentes = secao('componentes', () => [...FILE.entries()].filter(([, d]) => d.componente).map(([f, d]) => ({
  arquivo: f, exports: d.exports.filter((e) => /^[A-Z]/.test(e)), export_default: d.export_default, linhas: d.linhas, dominio: dominioDe(f),
  hooks_locais: localHooks(d.hooks), tabelas: d.tabelas, edges: d.edges, usado_por: usedBy(f).length,
  orfao: usedBy(f).length === 0 && !rotasEnriched.some((r) => r.arquivo === f) && !layouts.some((r) => r.arquivo === f) && !lazyTargets.has(f) && !/^src\/pages\//.test(f),
})).sort((a, b) => a.arquivo.localeCompare(b.arquivo)), []);
const nomesComp = {};
for (const co of componentes) for (const e of co.exports) (nomesComp[e] = nomesComp[e] || []).push(co.arquivo);
const componentesDuplicados = sortObj(Object.fromEntries(Object.entries(nomesComp).filter(([k, v]) => v.length > 1 && !/^(Index|Page|Layout|App|Default|Root|Props)$/.test(k))));

// ---------- banco (SQL de supabase/migrations em ordem de statement) ----------
const banco = { tabelas: {}, funcoes: new Set(), triggers: [], views: new Set(), enums: {}, extensoes: new Set(), migrations: 0, fonte: [], cron: [], buckets_sql: new Set(), seeds: [], ddl_dinamico: 0 };
let SQL_TEXT_LOWER = '';
const isCurrentSql = (f) => f.endsWith('.sql') && !/(^|\/)(_foreign|_superseded|_archive)\//.test(f);
const migDir = ['supabase/migrations', 'migrations', 'db/migrations'].find((d) => exists(d) && ALL.some((f) => f.startsWith(d + '/') && isCurrentSql(f)));
const tname = (name) => { const n = name.replace(/"/g, ''); return /^public\./i.test(n) ? n.slice(7) : n; };
const T = (name) => { const n = tname(name); if (!banco.tabelas[n]) banco.tabelas[n] = { colunas: {}, rls: false, policies: [], indices: [], fks: [], criada_em: null }; return banco.tabelas[n]; };
const splitStatements = (text) => { const out = []; let cur = '', q = null; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { cur += ch; if (ch === q) { if (text[i + 1] === q) { cur += q; i++; } else q = null; } continue; } if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; } if (ch === ';') { out.push(cur); cur = ''; continue; } cur += ch; } out.push(cur); return out; };
const parseCols = (body, table) => {
  let depth = 0, cur = ''; const parts = [];
  for (const ch of body) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
  parts.push(cur);
  for (let p of parts) {
    p = p.trim().replace(/\s+/g, ' '); if (!p) continue;
    const m = /^"?([a-zA-Z_]\w*)"?\s+((?:double\s+precision|character\s+varying|bit\s+varying|timestamp\s+with(?:out)?\s+time\s+zone|time\s+with(?:out)?\s+time\s+zone|[a-zA-Z_][\w[\]]*)(?:\s*\([^)]*\))?(?:\s+with(?:out)?\s+time\s+zone)?(?:\[\])?)(.*)$/i.exec(p);
    if (!m || /^(constraint|primary|foreign|unique|check|exclude|like|index|key)$/i.test(m[1])) {
      const fk = /foreign key\s*\(\s*"?(\w+)"?\s*\)\s*references\s+"?(?:public\.)?"?(\w+)/i.exec(p); if (fk) table.fks.push({ coluna: fk[1], ref: fk[2] });
      continue;
    }
    const rest = m[3] || ''; const ref = /references\s+"?(?:public\.)?"?(\w+)/i.exec(rest);
    table.colunas[m[1]] = { tipo: m[2].toLowerCase(), nn: /not null/i.test(rest), pk: /primary key/i.test(rest), default: (/default\s+(.+?)(?:\s+(?:not null|null|references|check|unique|primary|generated)|$)/i.exec(rest) || [])[1] || null, ref: ref ? ref[1] : null };
    if (ref) table.fks.push({ coluna: m[1], ref: ref[1] });
  }
};
secao('banco-sql', () => {
  const sqlFiles = migDir ? ALL.filter((f) => f.startsWith(migDir + '/') && isCurrentSql(f)).sort() : ALL.filter((f) => isCurrentSql(f) && !/supabase\/tests|\/tests?\//.test(f)).sort();
  if (!sqlFiles.length) return;
  banco.migrations = sqlFiles.length; banco.fonte.push(migDir || '*.sql');
  const allSql = [];
  for (const f of sqlFiles) {
    const sql = readText(f).replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const bodies = []; const sqlNoBody = sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, (m0) => { bodies.push(m0); return "''"; });
    allSql.push(sql.toLowerCase());
    // DO $$ ... $$ e corpos de função: statements literais contam; DDL dinâmico (EXECUTE format) só é sinalizado
    const bodyStatements = bodies.flatMap((b) => { const inner = b.replace(/^\$\w*\$|\$\w*\$$/g, '').replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "''"); if (/\bexecute\s+(format|'|\$|[a-z_]+\s*\()/i.test(inner)) banco.ddl_dinamico++; return splitStatements(inner).map((x) => { const m0 = /\b(create|drop|alter)\s[\s\S]*$/i.exec(x); return m0 ? m0[0] : ''; }).filter(Boolean); });
    for (const stRaw of [...splitStatements(sqlNoBody), ...bodyStatements]) {
      const st = stRaw.trim(); if (!st) continue; let m;
      if ((m = /^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?\w+"?)\s*\(/i.exec(st))) {
        let i = m[0].length, depth = 1, body = '';
        while (i < st.length && depth > 0) { const ch = st[i++]; if (ch === '(') depth++; if (ch === ')') depth--; if (depth > 0) body += ch; }
        const t = T(m[1]); if (!t.criada_em) t.criada_em = path.posix.basename(f); parseCols(body, t); continue;
      }
      if ((m = /^create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?\w+"?\.)?"?\w+"?)\s+(?:partition\s+of|as\s+)/i.exec(st))) { const t = T(m[1]); if (!t.criada_em) t.criada_em = path.posix.basename(f); t.particao_de = (/partition\s+of\s+(?:public\.)?"?(\w+)"?/i.exec(st) || [])[1] || undefined; continue; }
      if ((m = /^drop\s+table\s+(?:if\s+exists\s+)?((?:"?\w+"?\.)?"?\w+"?)/i.exec(st))) { delete banco.tabelas[tname(m[1])]; continue; }
      if ((m = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:"?\w+"?\.)?"?\w+"?)\s+rename\s+to\s+("?\w+"?)/i.exec(st))) { const o = tname(m[1]); if (banco.tabelas[o]) { banco.tabelas[m[2].replace(/"/g, '')] = banco.tabelas[o]; delete banco.tabelas[o]; } continue; }
      if ((m = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:"?\w+"?\.)?"?\w+"?)\s+([\s\S]+)$/i.exec(st))) {
        const t = T(m[1]); const ops = m[2].split(/,\s*(?=(?:add|drop|alter|enable|disable|force|rename)\s)/i);
        for (const op of ops) {
          let x;
          if ((x = /^add\s+column\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i.exec(op))) parseCols(x[1], t);
          else if ((x = /^add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(\s*"?(\w+)"?\s*\)\s*references\s+"?(?:public\.)?"?(\w+)/i.exec(op))) t.fks.push({ coluna: x[1], ref: x[2] });
          else if ((x = /^drop\s+column\s+(?:if\s+exists\s+)?"?(\w+)"?/i.exec(op))) delete t.colunas[x[1]];
          else if ((x = /^rename\s+column\s+"?(\w+)"?\s+to\s+"?(\w+)"?/i.exec(op)) && t.colunas[x[1]]) { t.colunas[x[2]] = t.colunas[x[1]]; delete t.colunas[x[1]]; }
          else if ((x = /^alter\s+column\s+"?(\w+)"?\s+(?:set\s+data\s+)?type\s+([\w\s()[\]]+?)(?:\s+using|$)/i.exec(op)) && t.colunas[x[1]]) t.colunas[x[1]].tipo = x[2].trim().toLowerCase();
          else if ((x = /^alter\s+column\s+"?(\w+)"?\s+(set|drop)\s+not\s+null/i.exec(op)) && t.colunas[x[1]]) t.colunas[x[1]].nn = x[2].toLowerCase() === 'set';
          else if ((x = /^alter\s+column\s+"?(\w+)"?\s+set\s+default\s+([\s\S]+)$/i.exec(op)) && t.colunas[x[1]]) t.colunas[x[1]].default = x[2].trim();
          else if ((x = /^alter\s+column\s+"?(\w+)"?\s+drop\s+default/i.exec(op)) && t.colunas[x[1]]) t.colunas[x[1]].default = null;
          else if (/^enable\s+row\s+level\s+security/i.test(op)) t.rls = true;
          else if (/^disable\s+row\s+level\s+security/i.test(op)) t.rls = false;
        }
        continue;
      }
      if ((m = /^create\s+policy\s+("[^"]+"|\w+)\s+on\s+((?:"?\w+"?\.)?"?\w+"?)(?:\s+as\s+(permissive|restrictive))?(?:\s+for\s+(select|insert|update|delete|all))?(?:\s+to\s+([\w, ]+?))?\s+(?:using|with\s+check)/i.exec(st))) {
        const t = T(m[2]); const nome = m[1].replace(/"/g, ''); t.policies = t.policies.filter((p) => p.nome !== nome);
        t.policies.push({ nome, comando: (m[4] || 'all').toLowerCase(), para: (m[5] || 'public').trim(), tipo: (m[3] || 'permissive').toLowerCase() }); continue;
      }
      if ((m = /^drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+((?:"?\w+"?\.)?"?\w+"?)/i.exec(st))) { const t = T(m[2]); t.policies = t.policies.filter((p) => p.nome !== m[1].replace(/"/g, '')); continue; }
      if ((m = /^create\s+(unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?("?\w+"?)\s+on\s+(?:only\s+)?((?:"?\w+"?\.)?"?\w+"?)\s*(?:using\s+\w+\s*)?\(([^)]+)\)/i.exec(st))) {
        const t = T(m[3]); const nome = m[2].replace(/"/g, ''); t.indices = t.indices.filter((i) => i.nome !== nome); t.indices.push({ nome, colunas: m[4].replace(/\s+/g, ' ').trim(), unico: !!m[1] }); continue;
      }
      if ((m = /^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/i.exec(st))) { for (const t of Object.values(banco.tabelas)) t.indices = t.indices.filter((i) => i.nome !== m[1]); continue; }
      if ((m = /^create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+(?:public\.)?"?(\w+)"?/i.exec(st))) { banco.funcoes.add(m[1]); continue; }
      if ((m = /^drop\s+(?:function|procedure)\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/i.exec(st))) { banco.funcoes.delete(m[1]); continue; }
      if ((m = /^create\s+(?:or\s+replace\s+)?trigger\s+"?(\w+)"?\s+(before|after|instead\s+of)\s+([\w\s]+?)\s+on\s+((?:"?\w+"?\.)?"?\w+"?)[\s\S]*?execute\s+(?:function|procedure)\s+(?:public\.)?"?(\w+)"?/i.exec(st))) {
        const tb = tname(m[4]); banco.triggers = banco.triggers.filter((t) => !(t.nome === m[1] && t.tabela === tb));
        banco.triggers.push({ nome: m[1], quando: m[2].toLowerCase(), evento: m[3].replace(/\s+/g, ' ').toLowerCase(), tabela: tb, funcao: m[5] }); continue;
      }
      if ((m = /^drop\s+trigger\s+(?:if\s+exists\s+)?"?(\w+)"?\s+on\s+((?:"?\w+"?\.)?"?\w+"?)/i.exec(st))) { const tb = tname(m[2]); banco.triggers = banco.triggers.filter((t) => !(t.nome === m[1] && t.tabela === tb)); continue; }
      if ((m = /^create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:public\.)?"?(\w+)"?/i.exec(st))) { banco.views.add(m[1]); continue; }
      if ((m = /^drop\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?(?:public\.)?"?(\w+)"?/i.exec(st))) { banco.views.delete(m[1]); continue; }
      if ((m = /^create\s+type\s+(?:public\.)?"?(\w+)"?\s+as\s+enum\s*\(([^)]*)\)/i.exec(st))) { banco.enums[m[1]] = m[2].split(',').map((v) => v.trim().replace(/'/g, '')).filter(Boolean); continue; }
      if ((m = /^alter\s+type\s+(?:public\.)?"?(\w+)"?\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']+)'/i.exec(st))) { (banco.enums[m[1]] = banco.enums[m[1]] || []).push(m[2]); continue; }
      if ((m = /^create\s+extension\s+(?:if\s+not\s+exists\s+)?"?([\w-]+)"?/i.exec(st))) { banco.extensoes.add(m[1]); continue; }
      if ((m = /^insert\s+into\s+storage\.buckets\s*\(([^)]*)\)\s*values\s*\(\s*'([^']+)'/i.exec(st))) { banco.buckets_sql.add(m[2]); continue; }
      if ((m = /cron\.schedule\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/i.exec(st))) { const ex = banco.cron.findIndex((cj) => cj.nome === m[1]); const job = { nome: m[1], agenda: m[2], migration: path.posix.basename(f) }; if (ex >= 0) banco.cron[ex] = job; else banco.cron.push(job); continue; }
      if ((m = /cron\.unschedule\s*\(\s*'([^']+)'/i.exec(st))) { banco.cron = banco.cron.filter((cj) => cj.nome !== m[1]); continue; }
    }
    for (const b of bodies) { let m; const re = /cron\.schedule\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/gi; while ((m = re.exec(b))) if (!banco.cron.some((cj) => cj.nome === m[1])) banco.cron.push({ nome: m[1], agenda: m[2], migration: path.posix.basename(f) }); }
  }
  SQL_TEXT_LOWER = allSql.join('\n');
  for (const cj of banco.cron) { const m = new RegExp(`cron\\.schedule\\s*\\(\\s*'${cj.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]{0,600}?functions/v1/([\\w-]+)`, 'i').exec(SQL_TEXT_LOWER); if (m) cj.chama_edge = m[1]; }
  banco.seeds = ALL.filter((f) => /(^|\/)seed[\w-]*\.sql$/.test(f));
});
const tabelasTypes = {};
secao('banco-types', () => {
  const typesFile = CFG.typesFile || ALL.find((f) => /^src\/integrations\/supabase\/types\.ts$/.test(f)) || ALL.find((f) => /(supabase|database)[/.-].*types\.ts$/.test(f) && !TEST_RE.test(f));
  if (!typesFile) return;
  const src = readText(typesFile); if (!src) { ERROS.push({ secao: 'banco-types', erro: `${typesFile} maior que ${MAX_FILE_BYTES / 1048576} MB; aumente maxFileMB em ai-context.config.json` }); return; }
  banco.fonte.push(typesFile);
  const ti = src.indexOf('Tables: {', src.indexOf('public: {')); if (ti < 0) return;
  let i = ti + 'Tables: {'.length, depth = 1, body = '';
  while (i < src.length && depth > 0) { const ch = src[i++]; if (ch === '{') depth++; if (ch === '}') depth--; if (depth > 0) body += ch; }
  const re = /(\w+):\s*\{\s*Row:\s*\{/g; let m;
  while ((m = re.exec(body))) { let j = re.lastIndex, d2 = 1, row = ''; while (j < body.length && d2 > 0) { const ch = body[j++]; if (ch === '{') d2++; if (ch === '}') d2--; if (d2 > 0) row += ch; } const campos = []; let dd = 0, cur = ''; for (const ch of row) { if (ch === '{' || ch === '[' || ch === '(') dd++; if (ch === '}' || ch === ']' || ch === ')') dd--; if ((ch === ';' || ch === '\n') && dd === 0) { campos.push(cur); cur = ''; } else cur += ch; } campos.push(cur); tabelasTypes[m[1]] = Object.fromEntries(campos.map((cmp) => /^\s*(\w+)\??:\s*([\s\S]+?)\s*$/.exec(cmp)).filter(Boolean).map((cm) => [cm[1], cm[2].replace(/\s+/g, ' ')])); }
});
for (const [t, cols] of Object.entries(tabelasTypes)) T(t).colunas_types = cols;
const EDGE_DIR = 'supabase/functions';
// Exemplos, testes e ferramentas continuam no inventário, mas não provam uso pela aplicação.
const TOOLING_ROOT = /^(scripts|bin|tools|\.github|docs|e2e|public)\//;
const appFiles = [...FILE.entries()].filter(([f, d]) => !d.teste && !d.story && (isSrc(f) || !TOOLING_ROOT.test(f)));
const tabelasUsadas = new Map();
for (const [f, d] of appFiles) for (const t of d.tabelas) { if (!tabelasUsadas.has(t)) tabelasUsadas.set(t, { front: [], edges: [] }); (f.startsWith(EDGE_DIR) ? tabelasUsadas.get(t).edges : tabelasUsadas.get(t).front).push(f); }
const bancoOut = {
  fonte: uniq(banco.fonte), migrations: banco.migrations, seeds: banco.seeds, avisos: banco.ddl_dinamico ? [`${banco.ddl_dinamico} bloco(s) com DDL dinâmico (EXECUTE format/...) não modelado — policies/colunas criadas dinamicamente podem faltar; confira no banco vivo`] : [], extensoes: [...banco.extensoes].sort(), enums: sortObj(banco.enums), views: [...banco.views].sort(), funcoes: [...banco.funcoes].sort(),
  triggers: banco.triggers.sort((a, b) => a.tabela.localeCompare(b.tabela) || a.nome.localeCompare(b.nome)),
  cron_jobs: banco.cron.sort((a, b) => a.nome.localeCompare(b.nome)),
  buckets: uniq([...banco.buckets_sql, ...[...FILE.values()].flatMap((d) => d.buckets)]).map((b) => ({ nome: b, criado_em_sql: banco.buckets_sql.has(b), usado_em: [...FILE.values()].filter((d) => d.buckets.includes(b)).length })),
  tabelas: sortObj(Object.fromEntries(Object.entries(banco.tabelas).map(([n, t]) => {
    const uso = tabelasUsadas.get(n) || { front: [], edges: [] };
    const cols = Object.keys(t.colunas); const colsT = t.colunas_types ? Object.keys(t.colunas_types) : null;
    return [n, { ...t, colunas: sortObj(t.colunas), colunas_types: t.colunas_types ? sortObj(t.colunas_types) : undefined, drift: colsT && cols.length ? { so_na_migration: cols.filter((cc) => !colsT.includes(cc)), so_no_types: colsT.filter((cc) => !cols.includes(cc)) } : undefined, policies: t.policies.sort((a, b) => a.nome.localeCompare(b.nome)), indices: t.indices.sort((a, b) => a.nome.localeCompare(b.nome)), fks: uniq(t.fks.map((x) => `${x.coluna}->${x.ref}`)), usada_no_front: uniq(uso.front).length, usada_em_edges: uniq(uso.edges.map((f) => f.split('/').slice(-2)[0])), triggers: banco.triggers.filter((tr) => tr.tabela === n).map((tr) => tr.nome), sem_rls: !t.rls && !n.includes('.') && !!t.criada_em && /\.sql$/.test(t.criada_em) && !t.particao_de, nao_usada: !uso.front.length && !uso.edges.length }];
  }))),
  tabelas_usadas_no_codigo_sem_definicao: uniq([...tabelasUsadas.keys()]).filter((t) => !banco.tabelas[t] && !banco.views.has(t)),
  rpcs_usadas_no_codigo: uniq(appFiles.flatMap(([, d]) => d.rpcs)).map((r) => ({ nome: r, definida: banco.funcoes.has(r), usada_em: appFiles.filter(([, d]) => d.rpcs.includes(r)).length })),
};

// ---------- edge functions (Deno / supabase) ----------
const configToml = readText('supabase/config.toml');
const verifyJwt = {}; { const re = /\[functions\.([\w-]+)\]\s*\n(?:[^[]*?)verify_jwt\s*=\s*(true|false)/g; let m; while ((m = re.exec(configToml))) verifyJwt[m[1]] = m[2] === 'true'; }
// Serviços do domínio Lalamove V2 (ver docs/agentes/lalamove-api.md, deploy.md, regras-dominio.md)
const SERVICO_EDGE = [[/^lalamove-/, 'Lalamove API v3'], [/^bitrix24-/, 'Bitrix24'], [/mapbox/, 'Mapbox'], [/notification|alert|escalate/, 'Notificações/Alertas'], [/^external-|^llm-wh$/, 'Dados externos'], [/driver|evaluate|simulate/, 'Motoristas'], [/route-analyzer/, 'Lovable AI (custo por token)'], [/token|rotate/, 'Segredos/token'], [/job-worker/, 'Fila de jobs'], [/migrate-helper|seed-|apply-fixes/, 'Manutenção/DDL']];
const servicoDe = (nome) => (SERVICO_EDGE.find(([re]) => re.test(nome)) || [, null])[1];
const edges = secao('edges', () => {
  const out = [];
  if (!exists(EDGE_DIR)) return out;
  for (const name of fs.readdirSync(abs(EDGE_DIR)).sort()) {
    const dir = `${EDGE_DIR}/${name}`;
    if (!fs.statSync(abs(dir)).isDirectory() || name.startsWith('_')) continue;
    const entry = ['index.ts', 'index.js', 'main.ts', 'handler.ts', 'mod.ts'].map((e) => `${dir}/${e}`).find((p) => FILESET.has(p));
    const files = ALL.filter((f) => f.startsWith(dir + '/') && CODE_EXT.has(path.extname(f)) && !TEST_RE.test(f));
    const a = aggregate(files);
    const srcAll = files.map((f) => FILE.get(f)?.conteudo || '').join('\n');
    const callers = uniq(appFiles.filter(([f, d]) => !f.startsWith(EDGE_DIR) && d.edges.includes(name)).map(([f]) => f));
    const chamadaPorEdges = uniq(appFiles.filter(([f, d]) => f.startsWith(EDGE_DIR) && !f.startsWith(dir + '/') && !f.includes('/_shared/') && d.edges.includes(name)).map(([f]) => f.split('/').slice(-2)[0]));
    const noSql = SQL_TEXT_LOWER.includes(`/functions/v1/${name}`);
    out.push({
      nome: name, servico: servicoDe(name), entrada: entry || null, arquivos: files.length, linhas: files.reduce((s, f) => s + (FILE.get(f)?.linhas || 0), 0),
      verify_jwt: name in verifyJwt ? verifyJwt[name] : true, metodos: uniq([...srcAll.matchAll(/req(?:uest)?\.method\s*(?:===|==|!==)\s*['"](\w+)['"]/g)].map((m) => m[1])),
      assina_hmac: /createHmac|crypto\.subtle\.(sign|importKey)|hmac/i.test(srcAll),
      usa_service_role: /SUPABASE_SERVICE_ROLE_KEY/.test(srcAll),
      tabelas: a.tabelas, rpcs: a.rpcs, env: a.env, buckets: a.buckets, chama_edges: a.edges.filter((e) => e !== name),
      hosts_externos: uniq(files.flatMap((f) => FILE.get(f)?.hosts_externos || [])).filter((h) => !/supabase\.co$/.test(h)),
      usa_shared: uniq(files.flatMap((f) => FILE.get(f)?.imports || []).filter((i) => i.includes('/_shared/')).map((i) => path.posix.basename(i))),
      chamada_pelo_front: callers, chamada_por_edges: chamadaPorEdges, chamada_por_sql_ou_cron: noSql,
      orfa: callers.length === 0 && chamadaPorEdges.length === 0 && !noSql && !(name in verifyJwt && !verifyJwt[name]),
      testes: ALL.filter((f) => TEST_RE.test(f) && (f.includes(`/${name}/`) || f.includes(`${name}.test`) || f.includes(`${name}.spec`))).length,
    });
  }
  return out;
}, []);
const edgesSemPasta = uniq(appFiles.flatMap(([, d]) => d.edges)).filter((e) => !edges.some((x) => x.nome === e));

// ---------- ferramentas / scripts / workflows / deploy ----------
const workflows = secao('workflows', () => ALL.filter((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f)).map((f) => {
  const y = readText(f);
  const name = (/^name:\s*(.+)$/m.exec(y) || [])[1]?.trim().replace(/^['"]|['"]$/g, '') || path.posix.basename(f);
  const onBlock = (y.split(/^on:/m)[1] || '').split(/^[a-z]/m)[0];
  const gatilhos = uniq([...onBlock.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]).concat((/^on:\s*\[([^\]]*)\]/m.exec(y) || [, ''])[1].split(',').map((s) => s.trim()).filter(Boolean)));
  const jobs = [...(y.split(/^jobs:/m)[1] || '').matchAll(/^\s{2}([\w-]+):\s*$/gm)].map((m) => m[1]);
  const branches = uniq([...onBlock.matchAll(/branches:\s*\[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().replace(/['"]/g, ''))).concat([...onBlock.matchAll(/branches:\s*\n((?:\s+-\s*.+\n)+)/g)].flatMap((m) => (m[1].match(/-\s*(\S+)/g) || []).map((x) => x.replace(/-\s*/, '').replace(/['"]/g, '')))).filter(Boolean));
  return { arquivo: f, nome: name, gatilhos, crons: [...y.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]), branches, jobs, permissoes: (/^permissions:[ \t]*\n((?:[ \t]+[\w-]+:[^\n]*\n)+)/m.exec(y) || [])[1]?.trim().split('\n').map((l) => l.trim()) || [], scripts_usados: uniq([...y.matchAll(/(?:node|bash|sh|npx tsx|python3?|deno run)\s+((?:scripts|\.github|tools|bin)\/[\w./-]+)/g)].map((m) => m[1])), npm_scripts: uniq([...y.matchAll(/(?:npm|npx)\s+(?:run\s+)?([\w:-]+)/g)].map((m) => m[1]).filter((s) => pkg.scripts && pkg.scripts[s])), secrets: uniq([...y.matchAll(/secrets\.(\w+)/g)].map((m) => m[1])), actions: uniq([...y.matchAll(/uses:\s*([\w./-]+)@/g)].map((m) => m[1])) };
}).sort((a, b) => a.arquivo.localeCompare(b.arquivo)), []);
const TEXT_CORPUS = ALL.filter((o) => /\.(mjs|cjs|js|ts|tsx|sh|ya?ml|json|md|toml|py|ps1)$/.test(o) && !o.startsWith(OUT_REL)).map((o) => [o, FILE.get(o)?.conteudo ?? (fs.statSync(abs(o)).size < 512 * 1024 ? readText(o) : '')]);
const scriptsRepo = secao('scripts', () => ALL.filter((f) => /^(scripts|bin|tools|\.github\/scripts)\//.test(f) && /\.(mjs|cjs|js|ts|sh|py|sql|ps1)$/.test(f) && !TEST_RE.test(f)).map((f) => {
  const src = readText(f); const first = src.split('\n').slice(0, 15).map((l) => l.trim()).filter((l) => /^(\/\/|#|\*|\/\*|""")/.test(l) && !/^#!/.test(l) && !/eslint|@ts-|^\*\/|^"""$/.test(l)).map((l) => l.replace(/^(\/\/|#|\*|\/\*|""")\s?/, '')).filter(Boolean);
  const bn = path.posix.basename(f);
  const usadoPorNpm = Object.entries(pkg.scripts || {}).filter(([, v]) => v.includes(f) || v.includes(bn)).map(([k]) => k);
  const usadoPorWf = workflows.filter((w) => w.scripts_usados.includes(f)).map((w) => path.posix.basename(w.arquivo));
  return { arquivo: f, pasta: dirOf(f), descricao: first.slice(0, 2).join(' ').slice(0, 200) || null, linhas: countLines(src), env: envNames(src), npm_scripts: usadoPorNpm, workflows: usadoPorWf, solto_na_raiz_de_scripts: /^scripts\/[^/]+$/.test(f), orfao: !usadoPorNpm.length && !usadoPorWf.length && !TEXT_CORPUS.some(([o, t]) => o !== f && t.includes(bn)) };
}), []);
const envExampleText = ALL.filter((f) => /(^|\/)\.env\.example$/.test(f)).map((f) => readText(f)).join('\n');
const envExample = uniq([...envExampleText.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]));
const envExampleComentadas = uniq([...envExampleText.matchAll(/^\s*#\s*([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]));
const envUsadas = uniq([...FILE.entries()].filter(([f]) => isSrc(f)).flatMap(([, d]) => d.env));
const envEdges = uniq([...FILE.entries()].filter(([f]) => f.startsWith(EDGE_DIR)).flatMap(([, d]) => d.env));
const configs = ALL.filter((cf) => /^(vite|vitest|playwright|eslint|tailwind|postcss|commitlint)\.config\.[cm]?[jt]s$|^(tsconfig[\w.-]*|components|package)\.json$|^(vercel\.json|Dockerfile[\w.-]*|supabase\/config\.toml|\.nvmrc|Makefile|\.prettierrc|\.lintstagedrc|\.graphifyignore|\.github\/dependabot\.ya?ml|\.github\/PULL_REQUEST_TEMPLATE\.md|ai-context\.config\.json)$/.test(cf));
const docTitle = (f) => { const s = readText(f); return (/^#\s+(.+)$/m.exec(s) || [])[1]?.trim().slice(0, 100) || null; };
const docsRaiz = ALL.filter((f) => /^[A-Za-z][\w.-]*\.md$/.test(f) || /^docs\/[^/]+\.md$/.test(f) || /^\.github\/[\w-]+\.md$/.test(f)).map((f) => ({ arquivo: f, titulo: docTitle(f), linhas: countLines(readText(f)) }));
const docsProfundos = byCount(ALL.filter((f) => /^docs\/.+\/.+\.md$/.test(f)).map((f) => f.split('/').slice(0, 2).join('/'))).map(([pasta, n]) => ({ pasta, arquivos_md: n }));
const vercelJson = readJson('vercel.json');
const changelogTopo = (() => { const s = readText(ALL.find((f) => /^CHANGELOG\.md$/i.test(f)) || ''); const m = /^##\s+(.+)$/m.exec(s); return m ? m[1].trim() : null; })();
const integracoes = secao('integracoes', () => {
  const SDK = { '@supabase/supabase-js': 'Supabase', 'mapbox-gl': 'Mapbox GL', '@types/mapbox-gl': 'Mapbox GL', '@lovable.dev/cloud-auth-js': 'Lovable Cloud', '@tanstack/react-query': 'react-query', zod: 'zod', i18next: 'i18next', 'react-i18next': 'i18next', pg: 'Postgres (pg, scripts)', xlsx: 'XLSX (export)', jspdf: 'jsPDF (export)', papaparse: 'CSV (papaparse)', recharts: 'Recharts', 'web-vitals': 'Web Vitals', zustand: 'zustand', idb: 'IndexedDB (idb)' };
  const sdks = Object.keys(deps).filter((d) => SDK[d]).map((d) => ({ pacote: d, servico: SDK[d], versao: deps[d] })).sort((a, b) => a.servico.localeCompare(b.servico) || a.pacote.localeCompare(b.pacote));
  const hosts = byCount([...FILE.values()].flatMap((d) => d.hosts_externos)).map(([h, n]) => ({ host: h, arquivos: n }));
  const envHints = uniq([...envUsadas, ...envEdges, ...envExample, ...envExampleComentadas]).filter((e) => /(API_KEY|API_SECRET|TOKEN|SECRET|WEBHOOK|DSN|CLIENT_ID|BUCKET|LALAMOVE|MAPBOX|BITRIX|LOVABLE|SUPABASE|SLACK|WHATSAPP|N8N|SMTP|RESEND)/i.test(e));
  const webhooks = edges.filter((e) => !e.verify_jwt).map((e) => e.nome);
  const servicos = byCount(edges.map((e) => e.servico).filter(Boolean)).map(([servico, n]) => ({ servico, edges: edges.filter((e) => e.servico === servico).map((e) => e.nome), total: n }));
  return { sdks, servicos_por_edge: servicos, hosts_externos: hosts, env_de_integracao: envHints, webhooks_recebidos: uniq(webhooks), realtime: uniq([...FILE.values()].flatMap((d) => d.canais_realtime)) };
}, { sdks: [], servicos_por_edge: [], hosts_externos: [], env_de_integracao: [], webhooks_recebidos: [], realtime: [] });

// ---------- RBAC (ProtectedRoute × sidebar-config × enums de papel) ----------
const HIERARQUIA = (() => {
  const m = /roleHierarchy\s*:\s*Record<[^>]*>\s*=\s*\{([^}]*)\}/.exec(readText('src/components/layout/sidebar-config.ts')) || /roleHierarchy\s*[:=][^{]*\{([^}]*)\}/.exec(readText('src/components/auth/ProtectedRoute.tsx'));
  const out = {}; if (m) for (const x of m[1].matchAll(/(\w+)\s*:\s*(\d+)/g)) out[x[1]] = Number(x[2]);
  return Object.keys(out).length ? out : { viewer: 1, operator: 2, manager: 3, admin: 4 };
})();
const MIN_NIVEL = Math.min(...Object.values(HIERARQUIA));
// Sem papel declarado: rota/menu protegido vale o papel mínimo autenticado; rota pública vale 0.
const nivel = (p, protegida = true) => (p && HIERARQUIA[p] !== undefined ? HIERARQUIA[p] : protegida ? MIN_NIVEL : 0);
const rbac = secao('rbac', () => {
  const porPapel = {};
  for (const r of rotasEnriched.filter((r) => r.tipo === 'tela')) { const k = r.papel_requerido || (r.protegida ? '(só autenticado)' : '(público)'); (porPapel[k] = porPapel[k] || []).push(r.caminho); }
  const itens = menuUniq.map((mi) => { const t = resolveDestino(mi.destino); return { rotulo: mi.rotulo, grupo: mi.grupo, destino: mi.destino, papel_no_menu: mi.papel_efetivo, papel_na_rota: t ? t.papel_requerido : null, rota_existe: !!t, rota_protegida: t ? t.protegida : null, rota_requer_mfa: t ? t.requer_mfa : null, arquivo: t ? t.arquivo : null }; });
  return {
    hierarquia_de_papeis: HIERARQUIA,
    guards: uniq([...FILE.entries()].filter(([, d]) => d.componente && /Protected|Guard|RequireAuth|RequireRole|PrivateRoute|Authorized/.test(d.exports.join(' '))).map(([f]) => f)),
    rotas_por_papel: sortObj(Object.fromEntries(Object.entries(porPapel).map(([k, v]) => [k, v.sort()]))),
    rotas_com_mfa: rotasEnriched.filter((r) => r.requer_mfa).map((r) => r.caminho),
    rotas_com_permissao: rotasEnriched.filter((r) => r.permissao_requerida).map((r) => `${r.caminho} (${r.permissao_requerida})`),
    rotas_publicas: rotasEnriched.filter((r) => !r.protegida && r.tipo === 'tela').map((r) => r.caminho),
    enums_de_papel_no_banco: Object.entries(banco.enums).filter(([k]) => /role|papel|perfil|permission/i.test(k)).map(([k, v]) => ({ enum: k, valores: v })),
    rpcs_de_autorizacao: bancoOut.rpcs_usadas_no_codigo.filter((r) => /admin|role|permission|can_|has_|is_|auth/i.test(r.nome)).map((r) => r.nome),
    itens_de_menu: itens,
    menu_visivel_sem_acesso: itens.filter((i) => i.rota_existe && nivel(i.papel_na_rota, i.rota_protegida) > nivel(i.papel_no_menu)).map((i) => `${i.rotulo} -> ${i.destino} (menu: ${i.papel_no_menu || 'todos'}; rota: ${i.papel_na_rota})`),
    menu_mais_restrito_que_a_rota: itens.filter((i) => i.rota_existe && i.papel_no_menu && nivel(i.papel_no_menu) > nivel(i.papel_na_rota, i.rota_protegida)).map((i) => `${i.rotulo} -> ${i.destino} (menu: ${i.papel_no_menu}; rota: ${i.papel_na_rota || (i.rota_protegida ? 'só autenticado' : 'pública')})`),
    tabelas_sem_rls: Object.entries(bancoOut.tabelas).filter(([, t]) => t.sem_rls).map(([n]) => n),
  };
}, {});
const flags = secao('flags', () => { const all = byCount([...FILE.values()].flatMap((d) => d.flags)); return { total: all.length, flags: all.map(([f, n]) => ({ flag: f, arquivos: n })), tabelas_de_flag: Object.keys(bancoOut.tabelas).filter((t) => /flag|feature|toggle|setting/i.test(t)) }; }, { total: 0, flags: [], tabelas_de_flag: [] });
const providers = secao('providers', () => { const entry = ALL.find((f) => /^src\/main\.tsx$/.test(f)) || ALL.find((f) => /^src\/App\.tsx$/.test(f)); if (!entry) return { entrada: null, providers: [] }; const files = [entry, ...closure(entry).filter((f) => /App\.[tj]sx$|providers?\//i.test(f)).slice(0, 10)]; return { entrada: entry, providers: uniq(files.flatMap((f) => allMatches(/<([A-Z]\w*(?:Provider|Context|Boundary|Router|Client|Store)\b[\w.]*)/g, FILE.get(f)?.conteudo || ''))) }; }, { entrada: null, providers: [] });
const i18n = secao('i18n', () => { const arqs = ALL.filter((f) => /(^|\/)(i18n|locales?)\/.+\.(json|ts|js)$/.test(f)); const LANG = /^[a-z]{2}(?:[-_][A-Za-z]{2,4})?$/; const idiomas = uniq(arqs.map((f) => { const b0 = baseOf(f).split('.')[0]; return LANG.test(b0) ? b0 : null; }).filter(Boolean)); return { arquivos: arqs.length, idiomas, lib: [has('i18next') && 'i18next', has('react-i18next') && 'react-i18next'].filter(Boolean) }; }, { arquivos: 0, idiomas: [], lib: [] });
const ferramentas = {
  stack,
  package: { nome: pkg.name || null, versao: pkg.version || null, scripts: sortObj(pkg.scripts || {}), dependencias: Object.keys(pkg.dependencies || {}).length, dev_dependencias: Object.keys(pkg.devDependencies || {}).length, principais: sortObj(Object.fromEntries(Object.entries(pkg.dependencies || {}).filter(([k]) => /^(react|react-dom|react-router|@supabase|@tanstack|zustand|zod|react-hook-form|tailwindcss|vite|typescript|mapbox-gl|recharts|framer-motion|date-fns|i18next|pg|xlsx|jspdf)/.test(k)))), engines: pkg.engines || null, packageManager: pkg.packageManager || null },
  configs, workflows,
  docs_raiz: docsRaiz, docs_em_subpastas: docsProfundos, changelog_topo: changelogTopo,
  env: { declaradas_no_env_example: envExample, comentadas_no_env_example: envExampleComentadas, usadas_no_front: envUsadas, usadas_nas_edges: envEdges, usadas_mas_nao_declaradas: envUsadas.filter((e) => !envExample.includes(e)), secrets_em_workflows: uniq(workflows.flatMap((w) => w.secrets)) },
  deploy: { alvos: stack.deploy, vercel: vercelJson ? { framework: vercelJson.framework || null, build: vercelJson.buildCommand || null, rewrites: (vercelJson.rewrites || []).length, redirects: (vercelJson.redirects || []).length, headers: (vercelJson.headers || []).length, crons: (vercelJson.crons || []).map((cj) => `${cj.schedule} ${cj.path}`) } : null, nota: 'Deploy real: Vercel (projeto lalamove-v2, team juca1) + Lovable — ver docs/agentes/deploy.md.' },
  integracoes, feature_flags: flags, providers, i18n,
};

// ---------- testes ----------
const testFiles = [...FILE.entries()].filter(([, d]) => d.teste);
const cobertoPor = new Map();
for (const [, d] of testFiles) for (const i of d.imports) { if (FILE.get(i)?.teste) continue; cobertoPor.set(i, (cobertoPor.get(i) || 0) + 1); }
for (const h of hooksOut) h.coberto_por_testes = cobertoPor.get(h.arquivo) || 0;
const tipoTeste = (f) => (/^e2e\/|\.e2e\./.test(f) ? 'e2e (playwright)' : /^(scripts|tools|bin)\/.*\.unit\.mjs$/.test(f) ? 'guard (node --test)' : /contract/.test(f) ? 'contrato (deno)' : f.startsWith(EDGE_DIR) ? 'edge (deno)' : 'unit (vitest)');
const testes = secao('testes', () => ({
  frameworks: stack.testes,
  comandos: { unit: 'npx vitest run <caminho>', typecheck: 'npx tsc --noEmit -p tsconfig.app.json', lint: 'npx eslint <arquivos>', e2e: 'npx playwright test', edges: 'deno test --allow-net --allow-env supabase/functions/_shared/contract.test.ts supabase/functions/lalamove-webhook/security.test.ts', guards: 'node --test scripts/ci/*.unit.mjs' },
  total: testFiles.length + ALL.filter((f) => /^supabase\/tests\/.*\.sql$/.test(f)).length,
  por_tipo: sortObj(testFiles.reduce((acc, [f]) => { const t = tipoTeste(f); acc[t] = (acc[t] || 0) + 1; return acc; }, {})),
  onde_ficam: byCount(testFiles.map(([f]) => (/__tests__\//.test(f) ? 'co-localizado (__tests__)' : /^e2e\//.test(f) ? 'e2e/' : f.startsWith(EDGE_DIR) ? 'supabase/functions/<edge>' : /^(scripts|tools|bin)\//.test(f) ? 'guards em scripts/' : /\.(test|spec)\./.test(f) ? 'co-localizado (*.test)' : 'outro'))).map(([k, n]) => ({ padrao: k, arquivos: n })),
  arquivos: testFiles.map(([f, d]) => ({ arquivo: f, tipo: tipoTeste(f), linhas: d.linhas, testa: d.imports.filter((i) => !FILE.get(i)?.teste), casos: (d.conteudo.match(/\b(?:it|test|Deno\.test)(?:\.(?:each|only|skip|concurrent|todo))?\s*\(/g) || []).length })).sort((a, b) => a.arquivo.localeCompare(b.arquivo)),
  sql: ALL.filter((f) => /^supabase\/tests\/.*\.sql$/.test(f)),
  cobertura_por_arquivo: sortObj(Object.fromEntries(cobertoPor)),
  sem_teste: { telas: uniq(rotasEnriched.filter((r) => r.arquivo && !cobertoPor.has(r.arquivo)).map((r) => r.arquivo)), hooks: hooksOut.filter((h) => !h.coberto_por_testes).map((h) => h.arquivo), edges: edges.filter((e) => !e.testes).map((e) => e.nome), servicos: [] },
}), { total: 0, por_tipo: {}, onde_ficam: [], arquivos: [], sql: [], cobertura_por_arquivo: {}, sem_teste: { telas: [], hooks: [], edges: [], servicos: [] } });

// ---------- lógica (services/lib/utils/integrations/types) ----------
const LOGIC_KINDS = /^(services?|lib|utils?|integrations|api|config|data|schemas|validators|stores?|contexts?|providers|types|i18n)$/;
const camadaDe = (f) => { const dom = dominioDe(f); if (!dom) return null; const k = dom.split('/')[0]; return LOGIC_KINDS.test(k) ? k : null; };
const logica = secao('logica', () => [...FILE.entries()].filter(([f, d]) => camadaDe(f) && !d.teste && !d.componente).map(([f, d]) => ({
  arquivo: f, camada: camadaDe(f), exports: d.exports, export_default: d.export_default, linhas: d.linhas, tabelas: d.tabelas, rpcs: d.rpcs, edges: d.edges, env: d.env, externos: d.externos, zod_schemas: d.zod, flags: d.flags, papeis: d.papeis,
  usado_por: usedBy(f).length, usado_por_modulos: uniq(usedBy(f).map(dominioDe).filter(Boolean)), coberto_por_testes: cobertoPor.get(f) || 0,
  orfao: usedBy(f).length === 0 && !/index\.[tj]sx?$|main\.[tj]sx?$|\.d\.ts$|\.config\./.test(f),
})).sort((a, b) => a.arquivo.localeCompare(b.arquivo)), []);
testes.sem_teste.servicos = logica.filter((l) => !l.coberto_por_testes && l.usado_por > 0 && /^serv/.test(l.camada || '')).map((l) => l.arquivo);

// ---------- grafo de imports ----------
const prodFiles = [...FILE.entries()].filter(([, d]) => !d.teste).map(([f]) => f).sort();
const importsOf = (f) => FILE.get(f)?.imports || [];
const grafo = secao('grafo', () => {
  const idx = new Set(prodFiles); let index = 0; const low = new Map(), ord = new Map(), onS = new Set(), S = [], sccs = [];
  const tarjan = (root) => {
    const stack = [[root, 0]]; ord.set(root, index); low.set(root, index); index++; S.push(root); onS.add(root);
    while (stack.length) {
      const top = stack[stack.length - 1]; const v = top[0]; const nb = importsOf(v).filter((w) => idx.has(w));
      if (top[1] < nb.length) { const w = nb[top[1]++]; if (!ord.has(w)) { ord.set(w, index); low.set(w, index); index++; S.push(w); onS.add(w); stack.push([w, 0]); } else if (onS.has(w)) low.set(v, Math.min(low.get(v), ord.get(w))); continue; }
      if (low.get(v) === ord.get(v)) { const comp = []; let w; do { w = S.pop(); onS.delete(w); comp.push(w); } while (w !== v); if (comp.length > 1) sccs.push(comp.sort()); }
      stack.pop(); if (stack.length) { const p = stack[stack.length - 1][0]; low.set(p, Math.min(low.get(p), low.get(v))); }
    }
  };
  for (const f of prodFiles) if (!ord.has(f)) tarjan(f);
  const entradas = new Set([...rotasEnriched.map((r) => r.arquivo), ...layouts.map((r) => r.arquivo), ...edges.map((e) => e.entrada), ...lazyTargets, ...ALL.filter((f) => /^src\/(main|App)\.tsx$/.test(f) || /^scripts\//.test(f))].filter(Boolean));
  return {
    nos: prodFiles.length, arestas: prodFiles.reduce((s, f) => s + importsOf(f).length, 0),
    hubs: [...USED_BY.entries()].filter(([f]) => FILE.get(f) && !FILE.get(f).teste).map(([f, u]) => ({ arquivo: f, importado_por: u.length })).sort((a, b) => b.importado_por - a.importado_por || a.arquivo.localeCompare(b.arquivo)).slice(0, 40),
    ciclos: { total: sccs.length, maiores: sccs.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0])).slice(0, 15).map((comp) => ({ tamanho: comp.length, arquivos: comp.slice(0, 12) })) },
    orfaos: prodFiles.filter((f) => !usedBy(f).length && !entradas.has(f) && !/\.d\.ts$|\.config\.|_shared\/|\/types\/|\.stories\./.test(f)).slice(0, 300),
    modulos_mais_acoplados: modulos.map((m) => ({ modulo: m.modulo, depende_de: m.depende_de_modulos.length, importado_por: m.importado_por_outros_modulos.length })).sort((a, b) => b.depende_de + b.importado_por - (a.depende_de + a.importado_por) || a.modulo.localeCompare(b.modulo)).slice(0, 20),
    arestas_em: `${OUT_REL}/grafo-arestas.json`,
  };
}, { nos: 0, arestas: 0, hubs: [], ciclos: { total: 0, maiores: [] }, orfaos: [], modulos_mais_acoplados: [] });
const grafoArestas = Object.fromEntries(prodFiles.filter((f) => importsOf(f).length).map((f) => [f, importsOf(f)]));

// ---------- graphify (grafo por AST, opcional: segue sem ele se não existir) ----------
function gitInfoCommit() { return git('rev-parse', 'HEAD') || null; }
const graphify = secao('graphify', () => {
  const gdir = CFG.graphifyDir || 'graphify-out';
  const gjson = `${gdir}/graph.json`;
  const base = { presente: false, como_gerar: 'npm run graph:setup (uma vez) e `graphify update .` depois de mexer no código; saída em graphify-out/, não versionada. Consulta: graphify query/path/explain.', relatorio: FILESET.has(`${gdir}/GRAPH_REPORT.md`) ? `${gdir}/GRAPH_REPORT.md` : null };
  if (!fs.existsSync(abs(gjson))) return base;
  const stat = fs.statSync(abs(gjson)); if (stat.size > 400 * 1024 * 1024) return { ...base, presente: true, erro: `graph.json com ${Math.round(stat.size / 1048576)} MB — acima do limite de leitura` };
  const g = JSON.parse(fs.readFileSync(abs(gjson), 'utf8'));
  const nodes = g.nodes || [], links = g.links || [];
  const deg = new Map(); for (const l of links) { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const comm = new Map();
  for (const n of nodes) { const k = n.community ?? -1; if (!comm.has(k)) comm.set(k, { id: k, nome: n.community_name || `Community ${k}`, nos: 0, arquivos: new Set(), callables: 0 }); const cm = comm.get(k); cm.nos++; if (n.source_file) cm.arquivos.add(n.source_file); if (n._callable) cm.callables++; }
  const comunidades = [...comm.values()].sort((a, b) => b.nos - a.nos || a.id - b.id).slice(0, 80).map((cm) => ({ id: cm.id, nome: cm.nome, nos: cm.nos, callables: cm.callables, arquivos: cm.arquivos.size, exemplos_arquivos: [...cm.arquivos].sort().slice(0, 8) }));
  const hubs = [...deg.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 60).map(([id, d]) => { const n = byId.get(id) || {}; return { id, rotulo: n.label || id, arquivo: n.source_file || null, grau: d, comunidade: n.community_name || null }; });
  const porArquivo = new Map(); for (const n of nodes) if (n.source_file && n._callable) porArquivo.set(n.source_file, (porArquivo.get(n.source_file) || 0) + 1);
  const chamadas = new Map(); for (const l of links) if (l.relation === 'calls') { const t = byId.get(l.target); const key = t ? `${t.label} (${t.source_file || '?'})` : l.target; chamadas.set(key, (chamadas.get(key) || 0) + 1); }
  const arquivoComunidade = {}; for (const n of nodes) if (n.source_file && n.community_name && !arquivoComunidade[n.source_file]) arquivoComunidade[n.source_file] = n.community_name;
  return {
    ...base, presente: true, commit_do_grafo: g.built_at_commit || null, grafo_atual: !!(g.built_at_commit && gitInfoCommit() && g.built_at_commit === gitInfoCommit()),
    nos: nodes.length, arestas: links.length, comunidades_total: comm.size, relacoes: sortObj(Object.fromEntries(byCount(links.map((l) => l.relation || '?')))), origem: sortObj(Object.fromEntries(byCount(links.map((l) => l.confidence || '?')))),
    comunidades, hubs, mais_chamados: [...chamadas.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 60).map(([k, n]) => ({ simbolo: k, chamadas: n })),
    arquivos_com_mais_simbolos: [...porArquivo.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 40).map(([f, n]) => ({ arquivo: f, simbolos: n })),
    comunidade_por_arquivo: sortObj(arquivoComunidade),
  };
}, { presente: false });

// ---------- convenções ----------
const convencoes = secao('convencoes', () => {
  const comps = componentes.map((co) => co.arquivo);
  const nameStyle = (files) => { if (!files.length) return null; const n = byCount(files.map((f) => { const b = baseOf(f); return /^[A-Z][a-zA-Z0-9]*$/.test(b) ? 'PascalCase' : /^[a-z][a-zA-Z0-9]*$/.test(b) ? 'camelCase' : /^[a-z0-9]+(-[a-z0-9]+)+$/.test(b) ? 'kebab-case' : /_/.test(b) ? 'snake_case' : 'outro'; })); return `${n[0][0]} (${Math.round((n[0][1] / files.length) * 100)}%)`; };
  const topDir = (files) => byCount(files.map((f) => f.split('/').slice(0, 2).join('/'))).slice(0, 3).map(([d, n]) => `${d} (${n})`);
  const barrels = ALL.filter((f) => /(^|\/)index\.[tj]s$/.test(f) && (FILE.get(f)?.conteudo || '').split('\n').filter((l) => /^export\s/.test(l)).length >= 3).length;
  const tc = readJson('tsconfig.app.json') || readJson('tsconfig.json') || {}; const co = tc.compilerOptions || {};
  const subj = git('log', '-50', '--format=%s').split('\n').filter(Boolean);
  const TIPOS_COMMIT = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|security|revert)(\(.+\))?!?:/;
  return {
    onde_ficam: { telas: topDir(uniq(rotasEnriched.map((r) => r.arquivo).filter(Boolean))), componentes: topDir(comps), hooks: topDir(hooksOut.map((h) => h.arquivo)), servicos_logica: topDir(logica.map((l) => l.arquivo)), testes: testes.onde_ficam.slice(0, 3).map((t) => `${t.padrao} (${t.arquivos})`), edge_functions: edges.length ? EDGE_DIR : null, migrations: migDir || null, scripts: topDir(scriptsRepo.map((s) => s.arquivo)), rotas: routeFiles, menu: uniq(menuUniq.map((m) => m.definido_em)), docs: byCount(docsRaiz.map((d) => dirOf(d.arquivo))).slice(0, 3).map(([d, n]) => `${d === '.' ? '(raiz)' : d} (${n})`) },
    nomenclatura: { componentes: nameStyle(comps), hooks: hooksOut.length ? 'use + PascalCase' : null, servicos: nameStyle(logica.map((l) => l.arquivo)), edge_functions: nameStyle(edges.map((e) => e.nome)), tabelas: nameStyle(Object.keys(bancoOut.tabelas)) },
    barrels_index: barrels, extensao_componentes: byCount(comps.map((f) => path.extname(f))).map(([e, n]) => `${e} (${n})`), alias_imports: Object.fromEntries(Object.entries(aliasesByBase).map(([b, m]) => [b || '(raiz)', m])),
    commits: { convencao: FILESET.has('scripts/ci/commit-msg-lint.mjs') ? 'conventional commits validados por scripts/ci/commit-msg-lint.mjs (sem hook commit-msg instalado)' : subj.filter((s) => TIPOS_COMMIT.test(s)).length > subj.length / 2 ? 'conventional commits (observado)' : 'livre', tipos_aceitos: FILESET.has('scripts/ci/commit-msg-lint.mjs') ? uniq((/const\s+TIPOS[^=]*=\s*(?:new\s+Set\()?\[([^\]]*)\]/.exec(readText('scripts/ci/commit-msg-lint.mjs')) || [, ''])[1].split(',').map((x) => x.replace(/['"`\s]/g, '')).filter(Boolean)) : [], exemplos: subj.slice(0, 5) },
    pr_template: ALL.find((f) => /PULL_REQUEST_TEMPLATE/i.test(f)) || null, codeowners: ALL.find((f) => /CODEOWNERS$/.test(f)) || null, contributing: ALL.find((f) => /^(docs\/)?CONTRIBUTING\.md$/i.test(f)) || null,
    instrucoes_agentes: ALL.filter((f) => /^(CLAUDE|AGENTS)\.md$|^\.hermes\.md$|^docs\/agentes\/|^\.claude\/[^/]+\.md$/i.test(f)),
    typescript: { strict: !!co.strict, noImplicitAny: co.noImplicitAny ?? null, tsconfigs: ALL.filter((f) => /^tsconfig[\w.-]*\.json$/.test(f)) },
  };
}, { onde_ficam: {}, nomenclatura: {}, instrucoes_agentes: [] });

// ---------- baseline ----------
const gitInfo = secao('git', () => ({
  commit: git('rev-parse', 'HEAD') || null, branch: git('rev-parse', '--abbrev-ref', 'HEAD') || null, data_commit: git('log', '-1', '--format=%cI') || null, remote: git('remote', 'get-url', 'origin').replace(/\/\/[^@]+@/, '//') || null,
  ultimos_commits: git('log', '-25', '--format=%h|%cs|%s').split('\n').filter(Boolean).map((l) => { const [h, d, ...s] = l.split('|'); return { sha: h, data: d, assunto: s.join('|').slice(0, 120) }; }),
  arquivos_mudados_7d: uniq(git('log', '--since=7.days', '--name-only', '--format=').split('\n').filter(Boolean)).length,
  pastas_mais_mudadas_30d: byCount(git('log', '--since=30.days', '--name-only', '--format=').split('\n').filter(Boolean).map((f) => f.split('/').slice(0, 3).join('/'))).slice(0, 15).map(([pasta, n]) => ({ pasta, mudancas: n })),
  arquivos_mais_mudados_90d: byCount(git('log', '--since=90.days', '--name-only', '--format=').split('\n').filter((f) => f && FILESET.has(f))).slice(0, 25).map(([arquivo, n]) => ({ arquivo, mudancas: n })),
  autores_30d: byCount(git('log', '--since=30.days', '--format=%an').split('\n').filter(Boolean)).slice(0, 10).map(([a, n]) => ({ autor: a, commits: n })),
}), {});
const byDir = {};
for (const [f, d] of FILE) { const k = f.split('/').slice(0, 2).join('/'); byDir[k] = byDir[k] || { arquivos: 0, linhas: 0 }; byDir[k].arquivos++; byDir[k].linhas += d.linhas; }
const allDocs = [...FILE.values()];
const baseline = {
  git: gitInfo,
  contagens: { arquivos_total: ALL.length, arquivos_codigo: CODE_FILES.length, linhas_codigo: allDocs.reduce((s, d) => s + d.linhas, 0), rotas: rotasEnriched.length, rotas_protegidas: rotasEnriched.filter((r) => r.protegida).length, rotas_com_mfa: rotasEnriched.filter((r) => r.requer_mfa).length, itens_menu: menuUniq.length, modulos: modulos.length, componentes: componentes.length, hooks: hooksOut.length, edge_functions: edges.length, tabelas: Object.keys(bancoOut.tabelas).length, migrations: bancoOut.migrations, cron_jobs: bancoOut.cron_jobs.length, testes: testes.total, workflows: workflows.length, scripts: scriptsRepo.length, docs_md: ALL.filter((f) => f.endsWith('.md')).length },
  por_pasta: sortObj(byDir),
  maiores_arquivos: [...FILE.entries()].filter(([, d]) => !d.teste).map(([f, d]) => ({ arquivo: f, linhas: d.linhas })).sort((a, b) => b.linhas - a.linhas || a.arquivo.localeCompare(b.arquivo)).slice(0, 25),
  qualidade: { any: [...FILE.values()].reduce((s, d) => s + d.any_count, 0), console_log: [...FILE.values()].reduce((s, d) => s + d.console_count, 0), ts_ignore: [...FILE.values()].reduce((s, d) => s + d.ts_ignore, 0), eslint_disable: [...FILE.values()].reduce((s, d) => s + d.eslint_disable, 0), todos: allDocs.reduce((s, d) => s + d.todos.length, 0), arquivos_acima_500_linhas: allDocs.filter((d) => !d.teste && d.linhas > 500).length },
  todos: cap([...FILE.entries()].flatMap(([f, d]) => d.todos.map((t) => ({ arquivo: f, ...t }))), 300),
  alertas: {
    rotas_sem_arquivo: rotasEnriched.filter((r) => !r.arquivo && r.tipo === 'tela').map((r) => r.caminho),
    rotas_sem_protecao: (rbac.rotas_publicas || []).filter((c) => !/^\/(auth|forgot-password|reset-password|mfa-verify|unauthorized)$|^\/\*$/.test(c)),
    menu_visivel_sem_acesso: rbac.menu_visivel_sem_acesso || [],
    componentes_ambiguos: [...ambiguos].sort(),
    menu_sem_destino: menuUniq.filter((m) => !m.destino.startsWith('#') && !resolveDestino(m.destino)).map((m) => `${m.rotulo} -> ${m.destino}`),
    edges_orfas: edges.filter((e) => e.orfa).map((e) => e.nome),
    edges_chamadas_sem_pasta: edgesSemPasta,
    edges_sem_verify_jwt: edges.filter((e) => !e.verify_jwt).map((e) => e.nome),
    tabelas_sem_rls: Object.entries(bancoOut.tabelas).filter(([, t]) => t.sem_rls).map(([n]) => n),
    tabelas_usadas_sem_definicao: bancoOut.tabelas_usadas_no_codigo_sem_definicao,
    tabelas_com_drift_migration_vs_types: Object.entries(bancoOut.tabelas).filter(([, t]) => t.drift && (t.drift.so_na_migration.length || t.drift.so_no_types.length)).map(([n]) => n),
    rpcs_sem_definicao: bancoOut.rpcs_usadas_no_codigo.filter((r) => !r.definida).map((r) => r.nome),
    componentes_orfaos: componentes.filter((co) => co.orfao).map((co) => co.arquivo).slice(0, 200),
    componentes_com_nome_duplicado: Object.keys(componentesDuplicados),
    scripts_orfaos: scriptsRepo.filter((s) => s.orfao).map((s) => s.arquivo),
    scripts_soltos_na_raiz: scriptsRepo.filter((s) => s.solto_na_raiz_de_scripts).map((s) => s.arquivo),
    env_usadas_nao_declaradas: ferramentas.env.usadas_mas_nao_declaradas,
    ciclos_de_import: grafo.ciclos.total,
    possiveis_segredos_no_codigo: cap([...FILE.entries()].flatMap(([f, d]) => { const out = []; let ln = 0; for (const line of (d.conteudo || readText(f)).split('\n')) { ln++; if (/eyJ[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{10,}|sk_live_[a-zA-Z0-9]{10,}|sk-[a-zA-Z0-9]{32,}|sbp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{30,}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE/.test(line) && !/example|placeholder|xxx|mock|fake|dummy/i.test(line)) out.push(`${f}:${ln}`); } return out; }), 50),
  },
  erros_do_gerador: ERROS,
};

// ---------- escrita ----------
fs.mkdirSync(OUT, { recursive: true });
const AVISO = 'GERADO AUTOMATICAMENTE por scripts/ai-context/gerar.mjs — não editar à mão; será sobrescrito.';
const c = baseline.contagens;
const files = {
  'rotas.json': { aviso: AVISO, format_version: FORMAT_VERSION, descricao: 'Rotas React Router de src/App.tsx: url → componente → arquivo → hooks/tabelas/edges (fecho transitivo dos imports). papel_requerido/requer_mfa/permissao_requerida vêm do ProtectedRoute e são herdados do Route pai.', resumo: { urls: rotasEnriched.length, layouts: layouts.length, itens_menu: menuUniq.length, lazy: lazyMap.size }, urls: rotasEnriched, layouts, menu: menuUniq.map((m) => ({ ...m, resolve_para: (resolveDestino(m.destino) || {}).arquivo || null })), lazy: sortObj(Object.fromEntries(lazyMap)) },
  'modulos.json': { aviso: AVISO, format_version: FORMAT_VERSION, descricao: 'menu → módulo (pasta de domínio) → telas/rotas → hooks → edge functions → tabelas → dependências entre módulos. edges/tabelas/rpcs são TRANSITIVOS (tudo que os arquivos do módulo puxam); `diretos` tem só o que está escrito nos arquivos do próprio módulo.', modulos },
  'componentes.json': { aviso: AVISO, format_version: FORMAT_VERSION, total: componentes.length, orfaos: componentes.filter((co) => co.orfao).length, nomes_duplicados: componentesDuplicados, componentes },
  'hooks.json': { aviso: AVISO, format_version: FORMAT_VERSION, total: hooksOut.length, hooks: hooksOut },
  'edge-functions.json': { aviso: AVISO, format_version: FORMAT_VERSION, pasta: exists(EDGE_DIR) ? EDGE_DIR : null, total: edges.length, verify_jwt_false: edges.filter((e) => !e.verify_jwt).map((e) => e.nome), shared: ALL.filter((f) => f.startsWith(EDGE_DIR + '/_shared/')), edges, chamadas_sem_pasta: edgesSemPasta },
  'banco.json': { aviso: AVISO, format_version: FORMAT_VERSION, nota: 'Reconstruído de supabase/migrations + src/integrations/supabase/types.ts — visão do CÓDIGO, não do banco vivo (nenhum MCP desta sessão aponta para iecgydonctmabiijadsf; ver docs/agentes/banco.md). `drift` compara colunas (migrations) com colunas_types (types.ts).', ...bancoOut },
  'rbac.json': { aviso: AVISO, format_version: FORMAT_VERSION, nota: 'ProtectedRoute (src/components/auth/ProtectedRoute.tsx) × sidebar-config.ts × enums de papel do banco. menu_visivel_sem_acesso = item aparece para papel que a rota bloqueia.', ...rbac },
  'ferramentas.json': { aviso: AVISO, format_version: FORMAT_VERSION, ...ferramentas },
  'scripts.json': { aviso: AVISO, format_version: FORMAT_VERSION, total: scriptsRepo.length, nota: 'scripts soltos na raiz de scripts/ são legado de sessões antigas (alguns com segredo commitado) — ver AGENTS.md; automação nova vai em scripts/<nome>/ com README.', scripts: scriptsRepo },
  'testes.json': { aviso: AVISO, format_version: FORMAT_VERSION, ...testes },
  'logica.json': { aviso: AVISO, format_version: FORMAT_VERSION, total: logica.length, por_camada: sortObj(logica.reduce((a, l) => { a[l.camada] = (a[l.camada] || 0) + 1; return a; }, {})), arquivos: logica },
  'grafo.json': { aviso: AVISO, format_version: FORMAT_VERSION, ...grafo },
  'grafo-arestas.json': { aviso: AVISO, format_version: FORMAT_VERSION, arestas: grafoArestas },
  'convencoes.json': { aviso: AVISO, format_version: FORMAT_VERSION, ...convencoes },
  'grafo-graphify.json': { aviso: AVISO, format_version: FORMAT_VERSION, ...graphify },
  'baseline.json': { aviso: AVISO, format_version: FORMAT_VERSION, ...baseline },
};
const hashes = {};
for (const [name, data] of Object.entries(files)) { const txt = JSON.stringify(data, null, 1) + '\n'; fs.writeFileSync(path.join(OUT, name), txt); hashes[name] = sha(txt); }
const li = (arr, f = (x) => x) => (arr.length ? arr.map((x) => `- ${f(x)}`).join('\n') : '- (nenhum)');
const kv = (o) => Object.entries(o || {}).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') || 'n/d' : v && typeof v === 'object' ? JSON.stringify(v) : v ?? 'n/d'}`).join('\n');
const indexMd = `# Contexto de código do Lalamove V2 para agentes de IA

${AVISO}
${PUBLICACAO} Gere com \`node scripts/ai-context/gerar.mjs\`. Commit-base: \`${gitInfo.commit || 'n/d'}\` (${gitInfo.data_commit || 'n/d'}).${ERROS.length ? `\n\n> ⚠️ ${ERROS.length} seção(ões) falharam na geração — ver \`baseline.json → erros_do_gerador\`.` : ''}

As regras do dono estão em \`AGENTS.md\` e \`docs/agentes/\` — este diretório é só o mapa do código.

## Como usar (leia antes de planejar ou executar qualquer tarefa)
1. **Tela/rota/menu** → \`rotas.json\` (url → arquivo → hooks → tabelas → edges, com \`papel_requerido\`/\`requer_mfa\`) e \`modulos.json\` (módulo inteiro + dependências entre módulos).
2. **RBAC** → \`rbac.json\` (rotas por papel, rotas com MFA, divergência menu × ProtectedRoute, tabelas sem RLS).
3. **Hook/serviço/lógica** → \`hooks.json\`, \`logica.json\` (quem usa, o que toca, se tem teste).
4. **Edge function** → \`edge-functions.json\` (verify_jwt, service_role, HMAC, tabelas, env, quem chama, órfãs).
5. **Banco** → \`banco.json\` (colunas, RLS, policies, índices, FKs, triggers, cron jobs, buckets, drift migration×types, uso no código) — visão do código; o banco vivo exige MCP que esta sessão não tem (\`docs/agentes/banco.md\`).
6. **Antes de criar arquivo** → \`convencoes.json\`, \`componentes.json\` (nomes duplicados, órfãos), \`grafo.json\` (hubs, ciclos) e \`grafo-graphify.json\` (grafo por AST, quando gerado).
7. **CI/scripts/deploy/env/integrações/flags** → \`ferramentas.json\` e \`scripts.json\`.
8. **Antes de abrir PR** → \`testes.json\` (comandos e cobertura) e \`baseline.json\` (alertas, TODOs, hotspots, últimos commits).
Os JSONs são grandes: filtre com \`rg\`/\`jq\` pelo caminho/arquivo/tabela da sua tarefa; não carregue tudo.

## Stack
${kv(stack)}

## Números
| item | qtd |
|---|---|
${Object.entries(c).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Onde ficam as coisas
${kv(convencoes.onde_ficam)}
- nomenclatura: ${JSON.stringify(convencoes.nomenclatura)}
- instruções para agentes no repo: ${(convencoes.instrucoes_agentes || []).slice(0, 12).join(', ') || 'nenhuma'}

## Módulos (menu → domínio)
| módulo | itens de menu | telas | arquivos | hooks locais | edges | tabelas |
|---|---|---|---|---|---|---|
${modulos.filter((m) => m.itens_menu.length || m.telas.length || m.arquivos >= 5).map((m) => `| ${m.modulo} | ${m.itens_menu.length} | ${m.telas.length} | ${m.arquivos} | ${m.hooks_locais.length} | ${m.edges.length} | ${m.tabelas.length} |`).join('\n')}

## Rotas (url → arquivo → papel)
${li(rotasEnriched, (r) => `\`${r.caminho}\` [${r.tipo}] → ${r.arquivo || '**ARQUIVO NÃO RESOLVIDO**'}${r.papel_requerido ? ` · papel ${r.papel_requerido}` : r.protegida ? ' · autenticado' : ' · **público**'}${r.requer_mfa ? ' · MFA' : ''}`)}

## Menu (sidebar-config.ts)
${li(menuUniq, (m) => `${m.grupo ? `[${m.grupo}] ` : ''}${m.rotulo} → \`${m.destino}\`${m.papel_efetivo ? ` (papel ${m.papel_efetivo})` : ''}${resolveDestino(m.destino) ? '' : ' — **SEM ROTA**'}`)}

## Edge functions
${li(edges, (e) => `\`${e.nome}\`${e.servico ? ` [${e.servico}]` : ''}${e.verify_jwt ? '' : ' (verify_jwt=false)'} — tabelas: ${e.tabelas.join(', ') || '-'}; chamada por ${e.chamada_pelo_front.length} arquivo(s) do front${e.chamada_por_sql_ou_cron ? ', por SQL/cron' : ''}${e.orfa ? ' — **ÓRFÃ**' : ''}`)}

## Cron jobs (pg_cron)
${li([...bancoOut.cron_jobs.map((j) => `\`${j.nome}\` ${j.agenda}${j.chama_edge ? ' → edge ' + j.chama_edge : ''} (${j.migration})`), ...((ferramentas.deploy.vercel && ferramentas.deploy.vercel.crons) || [])])}

## Integrações externas
- SDKs: ${uniq(integracoes.sdks.map((s) => s.servico)).join(', ') || 'nenhum'}
- serviços por edge: ${(integracoes.servicos_por_edge || []).map((s) => `${s.servico} (${s.total})`).join(', ') || 'nenhum'}
- hosts mais citados: ${integracoes.hosts_externos.slice(0, 15).map((h) => h.host).join(', ') || 'nenhum'}
- webhooks recebidos (verify_jwt=false): ${integracoes.webhooks_recebidos.join(', ') || 'nenhum'}
- env de integração (só NOMES, nunca valores): ${integracoes.env_de_integracao.join(', ') || 'nenhum'}

## RBAC
- hierarquia: ${Object.entries(rbac.hierarquia_de_papeis || {}).sort((a, b) => a[1] - b[1]).map(([k, v]) => `${k}=${v}`).join(' < ') || 'n/d'}
- rotas por papel: ${Object.entries(rbac.rotas_por_papel || {}).map(([k, v]) => `${k} (${v.length})`).join(', ') || 'n/d'}
- rotas com MFA: ${(rbac.rotas_com_mfa || []).join(', ') || 'nenhuma'}
- guards: ${(rbac.guards || []).join(', ') || 'nenhum'}
- enums de papel no banco: ${(rbac.enums_de_papel_no_banco || []).map((e) => `${e.enum}: ${e.valores.join('|')}`).join('; ') || 'nenhum'}
- feature flags: ${flags.flags.slice(0, 20).map((f) => f.flag).join(', ') || 'nenhuma'}

## Alertas (baseline.json → alertas)
${Object.entries(baseline.alertas).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.length + (v.length ? ' — ex.: ' + v.slice(0, 3).join(', ') : '') : v}`).join('\n')}

## Grafo de código (graphify)
${graphify.presente ? `- ${graphify.nos} nós · ${graphify.arestas} arestas · ${graphify.comunidades_total} comunidades · grafo do commit \`${(graphify.commit_do_grafo || '').slice(0, 8)}\`${graphify.grafo_atual ? '' : ' (DESATUALIZADO em relação ao HEAD)'}
- comunidades maiores: ${(graphify.comunidades || []).slice(0, 12).map((cm) => `${cm.nome} (${cm.nos})`).join(', ')}
- símbolos mais chamados: ${(graphify.mais_chamados || []).slice(0, 12).map((x) => x.simbolo).join(', ')}` : `- não gerado neste run (o gerador segue sem ele). ${graphify.como_gerar}`}

## Hotspots (arquivos mais alterados, 90 dias)
${li((gitInfo.arquivos_mais_mudados_90d || []).slice(0, 15), (x) => `${x.arquivo} (${x.mudancas})`)}

## Workflows
${li(workflows, (w) => `\`${path.posix.basename(w.arquivo)}\` — ${w.nome} (${w.gatilhos.join(', ')}${w.crons.length ? '; cron ' + w.crons.join(' | ') : ''})`)}

## Scripts npm
${li(Object.entries(pkg.scripts || {}), ([k, v]) => `\`${k}\`: \`${v}\``)}

## Comandos de verificação
${kv(testes.comandos)}

## Documentos (raiz e docs/)
${li(cap(docsRaiz, 60), (d) => `\`${d.arquivo}\`${d.titulo ? ' — ' + d.titulo : ''} (${d.linhas} linhas)`)}
${docsProfundos.length ? '- subpastas de docs/: ' + docsProfundos.map((d) => `${d.pasta} (${d.arquivos_md})`).join(', ') : ''}
${changelogTopo ? `- CHANGELOG topo: ${changelogTopo}` : ''}

## Últimos commits
${li((gitInfo.ultimos_commits || []).slice(0, 15), (x) => `${x.data} \`${x.sha}\` ${x.assunto}`)}

## Arquivos deste diretório
${Object.keys(files).map((f) => `- \`${OUT_REL}/${f}\``).join('\n')}
- \`${OUT_REL}/manifest.json\` (commit, data, hashes, erros — único arquivo com data/hora)
`;
fs.writeFileSync(path.join(OUT, 'INDEX.md'), indexMd);
hashes['INDEX.md'] = sha(indexMd);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ aviso: AVISO, format_version: FORMAT_VERSION, gerado_em: new Date().toISOString(), commit: gitInfo.commit || null, branch: gitInfo.branch || null, gerador: 'scripts/ai-context/gerar.mjs', node: process.version, arquivos: sortObj(hashes), contagens: c, erros: ERROS }, null, 1) + '\n');
log(`escrito em ${OUT_REL}/ (${Object.keys(files).length + 2} arquivos)${ERROS.length ? `; ${ERROS.length} erro(s) de seção` : ''}`);
log(`rotas=${c.rotas} (protegidas=${c.rotas_protegidas} mfa=${c.rotas_com_mfa}) menu=${c.itens_menu} modulos=${c.modulos} hooks=${c.hooks} edges=${c.edge_functions} tabelas=${c.tabelas} cron=${c.cron_jobs} testes=${c.testes}`);
