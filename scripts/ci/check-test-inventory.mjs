#!/usr/bin/env node
/**
 * Inventário de testes: todo teste no disco tem de ter um passo de workflow que o rode.
 *
 * Portado do Zapp Web V2. O que mudou no Lalamove V2:
 *  - saiu a parte de `.test.sh` x `db-guard.yml`: não existe `scripts/db-audit/` nem
 *    `db-guard.yml` neste repo;
 *  - os testes de `src/**` ficam FORA do inventário de propósito: o ci.yml roda
 *    `npx vitest run` sem caminho e o `include` de `vitest.config.ts` cobre
 *    `src/**\/*.{test,spec}.{ts,tsx}` inteiro — cobrar citação individual geraria órfão falso.
 *
 * Duas regras, as duas valendo:
 *  T1 — `supabase/functions/**\/*.test.ts` (Deno): coberto quando o caminho aparece no
 *       ci.yml, ou quando o ci.yml usa o glob `supabase/functions/**\/*.test.ts`.
 *  T2 — suíte Node de `scripts/` (`*.test.mjs`, `*.unit.mjs`, `*.integration.mjs`):
 *       coberta quando o caminho (ou um glob que casa com ele) aparece DENTRO de um
 *       bloco `run:` de algum workflow — exatamente onde o runner a executa. Citação em
 *       comentário, em nome de etapa ou em `env:` NÃO conta: é o que separa registro de
 *       execução. Fechamento transitivo: suíte importada por outra já coberta conta
 *       como coberta (agregador), mas só por import estático de arquivo existente.
 *
 * Uso: node scripts/ci/check-test-inventory.mjs
 * Saída: 0 = tudo coberto, 1 = teste órfão (a saída lista cada um).
 */

import { readFileSync, readdirSync, statSync, existsSync, accessSync, constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, delimiter, posix as pathPosix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '../../..');
export const RAIZ = root;

/** Caminho absoluto do binário pelo PATH de quem chamou (o helper do Zapp vivia em scripts/lib/). */
function resolverExecutavel(comando) {
  for (const dir of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    const candidato = join(dir, comando);
    try {
      accessSync(candidato, constants.X_OK);
      return candidato;
    } catch {
      // segue a busca
    }
  }
  throw new Error(`comando nao encontrado no PATH: ${comando}`);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function listarArquivosNoDisco(relDir) {
  const base = join(root, relDir);
  const out = [];
  function visitar(abs, rel) {
    for (const nome of readdirSync(abs).sort()) {
      const filhoAbs = join(abs, nome);
      const filhoRel = rel ? `${rel}/${nome}` : nome;
      const st = statSync(filhoAbs);
      if (st.isDirectory()) visitar(filhoAbs, filhoRel);
      else if (st.isFile()) out.push(filhoRel);
    }
  }
  if (!existsSync(base)) return out;
  visitar(base, relDir);
  return out;
}

/**
 * União de `git ls-files` com a varredura do disco: sem o disco, o preflight local
 * dizia OK para um arquivo ainda não indexado e o mesmo commit falhava no checkout
 * limpo do CI. Sem o git (ou fora de um clone), vale só o disco.
 */
function gitLsFilesOuDisco(relDir) {
  try {
    const resultado = spawnSync(resolverExecutavel('git'), ['ls-files', relDir], { cwd: root, encoding: 'utf8' });
    if (resultado.status === 0 && typeof resultado.stdout === 'string') {
      return [...new Set([
        ...resultado.stdout.split('\n').filter(Boolean),
        ...listarArquivosNoDisco(relDir),
      ])].sort();
    }
  } catch {
    // git ausente/sem permissão: a varredura do disco é equivalente neste inventário
  }
  return listarArquivosNoDisco(relDir);
}

/**
 * Suítes Node conhecidas e ainda sem passo de workflow. Entrar aqui exige justificativa
 * NA LINHA: a lista é a última porta, não o lugar onde o teste vai morrer.
 */
export const ALLOWLIST_NODE = new Set();

const CI_TS_GLOB = 'supabase/functions/**/*.test.ts';
const SUFIXO_SUITE_NODE = /\.(?:test|unit|integration)\.mjs$/;
const CAMINHO_SUITE_NODE = /scripts\/[A-Za-z0-9_./*-]+\.(?:test|unit|integration)\.mjs/g;

/** Caminhos e globos de suites Node citados nos blocos `run:` de um workflow. */
export function padroesNodeDeWorkflow(yaml) {
  const linhas = String(yaml).split('\n');
  const padroes = new Set();
  for (let i = 0; i < linhas.length; i += 1) {
    const abertura = /^(\s*)run:\s*(.*)$/.exec(linhas[i]);
    if (!abertura) continue;
    const recuo = abertura[1].length;
    const bloco = [abertura[2]];
    for (let j = i + 1; j < linhas.length; j += 1) {
      const linha = linhas[j];
      if (linha.trim() === '') continue; // linha vazia não fecha o bloco
      if (linha.length - linha.trimStart().length <= recuo) break;
      if (linha.trimStart().startsWith('#')) continue; // passo comentado não executa nada
      bloco.push(linha);
    }
    for (const padrao of bloco.join('\n').match(CAMINHO_SUITE_NODE) ?? []) padroes.add(padrao);
  }
  return [...padroes].sort();
}

/** Casa um caminho com um glob simples: `*` não atravessa `/`, `**` atravessa. */
export function casaPadrao(arquivo, padrao) {
  if (!padrao.includes('*')) return arquivo === padrao;
  const expressao = padrao
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${expressao}$`).test(arquivo);
}

/** Suítes Node sem nenhum bloco `run:` que as execute (fora da allowlist). */
export function orfaosNode(suites, padroes, allowlist = ALLOWLIST_NODE) {
  return suites.filter((f) => !padroes.some((p) => casaPadrao(f, p)) && !allowlist.has(f));
}

/**
 * Suítes alcançadas por import estático de uma suíte já coberta. O fechamento
 * transitivo permite agregadores sem transformar a allowlist em atalho: import
 * dinâmico, comentário ou caminho inexistente não conta.
 */
export function suitesCobertasPorImport(suites, padroes, ler = read) {
  const existentes = new Set(suites);
  const cobertas = new Set(suites.filter((f) => padroes.some((p) => casaPadrao(f, p))));
  const pendentes = [...cobertas];
  const importEstatico = /(?:^|\n)\s*import\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g;

  while (pendentes.length > 0) {
    const agregador = pendentes.pop();
    let fonte;
    try {
      fonte = ler(agregador);
    } catch {
      continue;
    }
    for (const [, especificador] of fonte.matchAll(importEstatico)) {
      if (!especificador.startsWith('.')) continue;
      const importada = pathPosix.normalize(pathPosix.join(pathPosix.dirname(agregador), especificador));
      if (!existentes.has(importada) || cobertas.has(importada)) continue;
      cobertas.add(importada);
      pendentes.push(importada);
    }
  }

  return cobertas;
}

/** Suítes Node versionadas em `scripts/`, do disco. */
export function suitesNodeNoDisco() {
  return gitLsFilesOuDisco('scripts').filter((f) => SUFIXO_SUITE_NODE.test(f));
}

/** Todo caminho/globo de suíte Node declarado nos blocos `run:` dos workflows. */
export function padroesNodeDosWorkflows() {
  const dir = join(root, '.github/workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => padroesNodeDeWorkflow(readFileSync(join(dir, f), 'utf8')));
}

export function suitesNodeOrfas() {
  const suites = suitesNodeNoDisco();
  const padroes = padroesNodeDosWorkflows();
  const cobertas = suitesCobertasPorImport(suites, padroes);
  return orfaosNode(suites, padroes, new Set([...ALLOWLIST_NODE, ...cobertas]));
}

/** T1: `.test.ts` de edge function sem correspondente no ci.yml. */
export function orfaosDeno() {
  const noDisco = gitLsFilesOuDisco('supabase/functions').filter((f) => f.endsWith('.test.ts'));
  const ciYaml = read('.github/workflows/ci.yml');
  if (ciYaml.includes(CI_TS_GLOB)) return [];
  const citados = new Set([...ciYaml.matchAll(/\bsupabase\/functions\/\S+\.test\.ts\b/g)].map((m) => m[0]));
  return noDisco.filter((f) => !citados.has(f));
}

/** Roda o inventário inteiro. `[]` = tudo coberto. */
export function orfaosDoInventario() {
  return [
    ...orfaosDeno().map((file) => ({ file, onde: 'ci.yml (job contract-tests)' })),
    ...suitesNodeOrfas().map((file) => ({ file, onde: 'nenhum bloco run: de workflow' })),
  ];
}

function principal() {
  const orphans = orfaosDoInventario();
  const totalNode = suitesNodeNoDisco().length;

  if (orphans.length === 0) {
    console.log(
      `check-test-inventory: OK — ${totalNode} suíte(s) Node cobertas por bloco run: ` +
        `(${ALLOWLIST_NODE.size} na allowlist); .test.ts de edge function citados no ci.yml`,
    );
    return 0;
  }

  console.error('check-test-inventory: FALHOU — teste no disco sem passo de workflow que o rode:');
  for (const { file, onde } of orphans) console.error(`  ${file}  (não encontrado em ${onde})`);
  console.error(`\nTotal: ${orphans.length} teste(s) órfão(s). Para resolver:`);
  console.error(`  - edge function: cite o arquivo no \`deno test\` do ci.yml, ou use o glob ${CI_TS_GLOB};`);
  console.error('  - suíte Node: acrescente um passo `run: node --test scripts/ci/*.unit.mjs` a um workflow,');
  console.error('    ou justifique o arquivo na ALLOWLIST_NODE deste script.');
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(principal());
}
