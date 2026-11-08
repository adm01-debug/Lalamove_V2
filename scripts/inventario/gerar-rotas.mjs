#!/usr/bin/env node
/**
 * Inventario das rotas do front -> inventario/estado/rotas.json (fonte de consulta dos agentes).
 *
 * Le o codigo, nao documentacao:
 *  - Rotas: src/App.tsx (path, componente lazy, <ProtectedRoute requiredRole/requireMFA>,
 *    <Navigate> e o envoltorio de layout em que a rota esta).
 *  - Menu:  src/components/layout/sidebar-config.ts (menuCategories: categoria, rotulo, badge e
 *    requiredRole do item e da categoria).
 *  - Para cada rota: segue os imports a partir do arquivo da pagina (src/hooks/, src/lib/,
 *    src/services/, src/integrations/ e src/utils/ sem limite; src/components/ fora de ui/ e as
 *    outras paginas ate MAX_SALTOS saltos) e lista hooks, edge functions invocadas, RPCs, tabelas
 *    (.from e /rest/v1) e buckets de storage (storage.from).
 *  - `problemas`: item de menu sem rota, rota de app sem item de menu, componente que nao resolve,
 *    import local que nao resolve e menu mais permissivo que o RBAC da rota (item aparece para quem
 *    o ProtectedRoute vai mandar para /unauthorized).
 *
 * Uso:
 *   node scripts/inventario/gerar-rotas.mjs           grava inventario/estado/rotas.json
 *   node scripts/inventario/gerar-rotas.mjs --check   exit 1 se o arquivo commitado esta desatualizado
 * Saida deterministica (sem data): o mesmo codigo gera o mesmo arquivo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAIDA_REL = 'inventario/estado/rotas.json';
const ARQUIVO_ROTAS = 'src/App.tsx';
const ARQUIVO_MENU = 'src/components/layout/sidebar-config.ts';
const EXTENSOES = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts'];
// Componentes de estrutura do App.tsx: nunca sao "a pagina" da rota.
const ESTRUTURA = ['ProtectedRoute', 'Navigate', 'Route', 'Routes', 'Suspense', 'SuspenseWrapper', 'ErrorBoundary'];
// roleHierarchy de src/components/layout/sidebar-config.ts; sem papel = 0 (qualquer usuario logado).
export const PAPEIS = { admin: 4, manager: 3, operator: 2, viewer: 1 };
// So reclama de divergencia de RBAC quando a rota exige manager/admin: viewer/operator sao os
// papeis de base e um menu sem requiredRole nao e, na pratica, mais permissivo que eles.
export const PAPEL_SENSIVEL = PAPEIS.manager;

const ler = (raiz, rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const rel = (raiz, abs) => path.relative(raiz, abs).split(path.sep).join('/');
const unico = (lista) => [...new Set(lista)].sort();
const nivel = (papel) => PAPEIS[papel] ?? 0;

/** Resolve um especificador de import para um arquivo do repo (ou null se externo/inexistente). */
export function resolverImport(raiz, deArquivoAbs, especificador) {
  let base;
  if (especificador.startsWith('@/')) base = path.join(raiz, 'src', especificador.slice(2));
  else if (especificador.startsWith('.')) base = path.resolve(path.dirname(deArquivoAbs), especificador);
  else return null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTENSOES) if (fs.existsSync(base + ext)) return base + ext;
  return undefined; // local, mas nao existe
}

/** Imports de um arquivo: [{ especificador, nomes[] }] (estaticos e import() dinamico). */
export function extrairImports(texto) {
  const out = [];
  for (const m of texto.matchAll(/import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (m[1]) continue;
    const nomes = [...m[2].matchAll(/\b([A-Za-z_$][\w$]*)\b(?!\s*as\b)/g)].map((x) => x[1])
      .filter((n) => !['type', 'as', 'default'].includes(n));
    out.push({ especificador: m[3], nomes });
  }
  for (const m of texto.matchAll(/(?:import|export)\s*(?:\*\s*from\s*)?['"]([^'"]+)['"]/g)) out.push({ especificador: m[1], nomes: [] });
  for (const m of texto.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ especificador: m[1], nomes: [] });
  for (const m of texto.matchAll(/export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g)) out.push({ especificador: m[1], nomes: [] });
  return out;
}

/**
 * Chamadas ao Supabase num texto: tabelas (`.from('x')` do cliente e `/rest/v1/<tabela>`),
 * buckets (`storage.from`), RPCs (`.rpc`) e edges (`functions.invoke`, `/functions/v1/<edge>`).
 * Limite conhecido: `.from(variavel)` nao e resolvido (ex.: supabase/functions/external-companies,
 * que recebe o nome da tabela por parametro).
 */
export function extrairChamadas(texto) {
  const pegar = (re) => [...texto.matchAll(re)].map((m) => m[1]);
  const tabelas = [];
  const buckets = [];
  for (const m of texto.matchAll(/(\bstorage\s*)?\.from\(\s*['"`]([A-Za-z0-9_-]+)['"`]/g)) (m[1] ? buckets : tabelas).push(m[2]);
  tabelas.push(...pegar(/\/rest\/v1\/([A-Za-z0-9_]+)/g).filter((t) => t !== 'rpc'));
  return {
    tabelas,
    buckets,
    rpcs: [...pegar(/\.rpc\(\s*['"`]([A-Za-z0-9_]+)['"`]/g), ...pegar(/\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/g)],
    // `functions.invoke('edge')` (inclusive quebrado em linha) e chamada direta pela URL
    // (`${SUPABASE_URL}/functions/v1/edge`), que e como as migrations e as proprias edges chamam.
    edges: [
      ...pegar(/functions\s*\.\s*invoke(?:<[^>()]*>)?\(\s*['"`]([A-Za-z0-9_-]+)(?:\/[^'"`]*)?['"`]/g),
      ...pegar(/['"`][^'"`\n]*\/functions\/v1\/([A-Za-z0-9_-]+)/g),
    ],
  };
}

const ehTeste = (p) => /(\.test\.|\.spec\.|__tests__|\.stories\.)/.test(p);

/**
 * Fecho de imports a partir do arquivo da pagina. Segue sem limite as pastas de logica
 * (src/hooks/, src/lib/, src/services/, src/integrations/, src/utils/), onde ficam os helpers que
 * chamam edge/RPC/tabela; componente de src/components/ (fora do kit de UI) e outra pagina de
 * src/pages/ entram ate MAX_SALTOS saltos, para a pagina nao arrastar o app inteiro. Fica de fora
 * so o kit de UI (src/components/ui/) e teste. Import local que nao resolve vira problema.
 */
export const MAX_SALTOS = 2;
const PASTAS_LIVRES = ['src/hooks', 'src/lib', 'src/services', 'src/integrations', 'src/utils'];
export function fechoDaPagina(raiz, arquivoPaginaAbs) {
  const dentro = (abs, rel_) => abs.startsWith(path.join(raiz, rel_) + path.sep);
  const livre = (abs) => PASTAS_LIVRES.some((d) => dentro(abs, d));
  const comSalto = (abs) => dentro(abs, 'src/pages')
    || (dentro(abs, 'src/components') && !dentro(abs, 'src/components/ui'));
  const saltosVistos = new Map(); // arquivo -> menor numero de saltos com que foi visitado
  const hooks = new Map();
  const quebrados = new Set();
  const chamadas = { tabelas: [], buckets: [], rpcs: [], edges: [] };
  const fila = [[arquivoPaginaAbs, 0]];
  while (fila.length) {
    const [atual, saltos] = fila.shift();
    if (saltosVistos.has(atual) && saltosVistos.get(atual) <= saltos) continue;
    const primeiraVez = !saltosVistos.has(atual);
    saltosVistos.set(atual, saltos);
    const texto = fs.readFileSync(atual, 'utf8');
    if (primeiraVez) {
      const c = extrairChamadas(texto);
      for (const k of Object.keys(chamadas)) chamadas[k].push(...c[k]);
    }
    for (const imp of extrairImports(texto)) {
      const alvo = resolverImport(raiz, atual, imp.especificador);
      if (alvo === undefined && !/\.(css|scss|svg|png|jpe?g|webp|gif|json)(\?.*)?$|\?/.test(imp.especificador)) {
        quebrados.add(`${rel(raiz, atual)} -> ${imp.especificador}`);
      }
      if (!alvo || ehTeste(alvo)) continue;
      for (const nome of imp.nomes) if (/^use[A-Z]/.test(nome) && !hooks.has(nome)) hooks.set(nome, rel(raiz, alvo));
      if (livre(alvo)) fila.push([alvo, saltos]);
      else if (comSalto(alvo) && saltos < MAX_SALTOS) fila.push([alvo, saltos + 1]);
    }
  }
  return {
    arquivos_lidos: saltosVistos.size,
    hooks: [...hooks.entries()].map(([nome, arquivo]) => ({ nome, arquivo })).sort((a, b) => a.nome.localeCompare(b.nome)),
    buckets: unico(chamadas.buckets),
    edges: unico(chamadas.edges),
    rpcs: unico(chamadas.rpcs),
    tabelas: unico(chamadas.tabelas),
    imports_quebrados: [...quebrados].sort(),
  };
}

/** Componente -> especificador do modulo em src/App.tsx (lazy(() => import(...)) e import estatico). */
export function componentesDoApp(texto) {
  const mapa = {};
  for (const m of texto.matchAll(/const\s+(\w+)\s*=\s*lazy\w*\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    mapa[m[1]] ??= m[2];
  }
  for (const imp of extrairImports(texto)) {
    for (const nome of imp.nomes) if (/^[A-Z]/.test(nome)) mapa[nome] ??= imp.especificador;
  }
  return mapa;
}

/**
 * Rotas do react-router em src/App.tsx, na ordem do arquivo.
 * `layout` sai do aninhamento: a rota sem `path` (ex.: <Route element={<AppLayout />}>) abre um
 * grupo que vale para as rotas seguintes ate o `</Route>` que o fecha. As publicas (/auth e
 * companhia) e o catch-all ficam com `layout: null`.
 */
export function lerRotas(raiz) {
  const texto = ler(raiz, ARQUIVO_ROTAS);
  const abs = path.join(raiz, ARQUIVO_ROTAS);
  const componentes = componentesDoApp(texto);
  const inicio = texto.search(/<Routes[\s>]/);
  const corpo = texto.slice(inicio, texto.indexOf('</Routes>'));
  const rotas = [];
  const pilha = [];
  for (const pedaco of corpo.split(/<Route\b/).slice(1)) {
    const caminho = (pedaco.match(/path=["']([^"']+)["']/) || [])[1] ?? null;
    const componente = [...pedaco.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1])
      .find((n) => !ESTRUTURA.includes(n)) ?? null;
    const papel = (pedaco.match(/requiredRole=["']([^"']+)["']/) || [])[1] ?? null;
    const esp = componente ? componentes[componente] : null;
    const alvo = esp ? resolverImport(raiz, abs, esp) : null;
    const layout = pilha[pilha.length - 1] ?? null;
    if (caminho) {
      rotas.push({
        caminho,
        componente,
        arquivo: alvo ? rel(raiz, alvo) : null,
        layout,
        protegida: pedaco.includes('<ProtectedRoute'),
        papel,
        requer_mfa: /requireMFA(?![A-Za-z0-9_])/.test(pedaco),
        redireciona: (pedaco.match(/<Navigate\s+to=["']([^"']+)["']/) || [])[1] ?? null,
      });
    } else if (componente) {
      pilha.push(componente); // rota de layout: envolve as proximas
    }
    for (let i = (pedaco.match(/<\/Route>/g) || []).length; i > 0; i -= 1) pilha.pop();
  }
  return rotas;
}

/**
 * Itens do menu lateral (src/components/layout/sidebar-config.ts > menuCategories):
 * path -> { id, rotulo, categoria, categoria_rotulo, papel, papel_categoria, papel_efetivo, badge }.
 * `papel_efetivo` e o do item ou, se nao tiver, o da categoria (como o sidebar filtra).
 */
export function lerMenu(raiz) {
  const texto = ler(raiz, ARQUIVO_MENU);
  const trecho = texto.slice(texto.indexOf('export const menuCategories'));
  const cabecalhos = [...trecho.matchAll(/\{\s*\n?\s*id:\s*'([^']+)',\s*label:\s*'([^']+)',([\s\S]*?)items:\s*\[/g)]
    .map((m) => ({ id: m[1], rotulo: m[2], attrs: m[3], inicio: m.index, fim: m.index + m[0].length }));
  const menu = {};
  for (let i = 0; i < cabecalhos.length; i += 1) {
    const cab = cabecalhos[i];
    const bloco = trecho.slice(cab.fim, cabecalhos[i + 1]?.inicio ?? trecho.length);
    const papelCategoria = (cab.attrs.match(/requiredRole:\s*'([^']+)'/) || [])[1] ?? null;
    for (const m of bloco.matchAll(/\{\s*id:\s*'([^']+)',\s*path:\s*'([^']+)'([^}]*)\}/g)) {
      const attrs = m[3];
      const papel = (attrs.match(/requiredRole:\s*'([^']+)'/) || [])[1] ?? null;
      menu[m[2]] = {
        id: m[1],
        rotulo: (attrs.match(/label:\s*'([^']+)'/) || [])[1] ?? null,
        categoria: cab.id,
        categoria_rotulo: cab.rotulo,
        papel,
        papel_categoria: papelCategoria,
        papel_efetivo: papel ?? papelCategoria,
        badge: (attrs.match(/badgeType:\s*'([^']+)'/) || [])[1] ?? null,
      };
    }
  }
  return menu;
}

/** Monta o inventario inteiro a partir de uma raiz de repo. */
export function gerarRotas(raiz = RAIZ_PADRAO) {
  const menu = lerMenu(raiz);
  const rotas = lerRotas(raiz).map((r) => ({
    ...r,
    menu: menu[r.caminho] ?? null,
    ...(r.arquivo ? fechoDaPagina(raiz, path.join(raiz, r.arquivo))
      : { arquivos_lidos: 0, hooks: [], buckets: [], edges: [], rpcs: [], tabelas: [], imports_quebrados: [] }),
  })).sort((a, b) => a.caminho.localeCompare(b.caminho));
  const caminhos = new Set(rotas.map((r) => r.caminho));

  const hooks = {};
  for (const r of rotas) for (const h of r.hooks) {
    hooks[h.nome] ??= { arquivo: h.arquivo, rotas: [] };
    hooks[h.nome].rotas.push(r.caminho);
  }

  const problemas = [
    ...Object.keys(menu).filter((p) => !caminhos.has(p)).sort()
      .map((p) => ({ tipo: 'menu_sem_rota', id: p, detalhe: `item "${menu[p].rotulo}" do menu aponta para ${p}, que nao existe em ${ARQUIVO_ROTAS} (cai no NotFound)` })),
    ...rotas.filter((r) => r.layout && !r.menu && !r.redireciona)
      .map((r) => ({ tipo: 'rota_sem_menu', id: r.caminho, detalhe: `${r.componente ?? '?'} so e alcancavel por URL ou pela command palette: sem item em ${ARQUIVO_MENU}` })),
    ...rotas.filter((r) => r.componente && !r.arquivo && !r.redireciona)
      .map((r) => ({ tipo: 'rota_sem_arquivo', id: r.caminho, detalhe: `${r.componente} nao resolve em ${ARQUIVO_ROTAS}` })),
    ...rotas.filter((r) => r.menu && nivel(r.papel) >= PAPEL_SENSIVEL && nivel(r.papel) > nivel(r.menu.papel_efetivo))
      .map((r) => ({
        tipo: 'menu_mais_permissivo_que_rota',
        id: r.caminho,
        detalhe: `menu "${r.menu.rotulo}" visivel para ${r.menu.papel_efetivo ?? 'qualquer usuario logado'}, mas a rota exige ${r.papel}${r.requer_mfa ? ' + MFA' : ''} (ProtectedRoute manda para /unauthorized)`,
      })),
    ...rotas.flatMap((r) => r.imports_quebrados.map((q) => ({ tipo: 'import_quebrado', id: r.caminho, detalhe: q }))),
  ];

  return {
    format_version: 1,
    fonte: `scripts/inventario/gerar-rotas.mjs (le ${ARQUIVO_ROTAS}, ${ARQUIVO_MENU} e os imports de cada pagina)`,
    resumo: {
      rotas: rotas.length,
      rotas_protegidas: rotas.filter((r) => r.protegida).length,
      rotas_com_mfa: rotas.filter((r) => r.requer_mfa).length,
      itens_de_menu: Object.keys(menu).length,
      hooks_distintos: Object.keys(hooks).length,
      problemas: problemas.length,
    },
    rotas,
    hooks: Object.fromEntries(Object.keys(hooks).sort().map((k) => [k, { arquivo: hooks[k].arquivo, rotas: unico(hooks[k].rotas) }])),
    problemas,
  };
}

export const serializar = (inv) => JSON.stringify(inv, null, 2) + '\n';

function main(argv) {
  const saida = path.join(RAIZ_PADRAO, SAIDA_REL);
  const conteudo = serializar(gerarRotas(RAIZ_PADRAO));
  if (argv.includes('--check')) {
    const atual = fs.existsSync(saida) ? fs.readFileSync(saida, 'utf8') : '';
    if (atual !== conteudo) {
      console.error(`${SAIDA_REL} desatualizado: rode node scripts/inventario/gerar-rotas.mjs e commite o resultado.`);
      process.exit(1);
    }
    console.log(`${SAIDA_REL} em dia.`);
    return;
  }
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, conteudo);
  const r = JSON.parse(conteudo).resumo;
  console.log(`rotas.json: ${r.rotas} rotas (${r.rotas_protegidas} protegidas, ${r.rotas_com_mfa} com MFA), `
    + `${r.itens_de_menu} itens de menu, ${r.hooks_distintos} hooks, ${r.problemas} problemas.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
