#!/usr/bin/env node
/**
 * Fila de merge serial — somente leitura. Portado do Zapp Web V2.
 *
 * Problema que a fila resolve: com várias PRs de auto-merge abertas (aqui há ~10 do
 * Dependabot), cada merge na `main` deixa todas as outras atrasadas, e atualizar TODAS de
 * uma vez recomeça a CI completa de N PRs para só uma entrar — trabalho O(N²), runners
 * disputados e nenhuma PR andando mais rápido.
 *
 * Regra:
 *   1. Só uma PR "em voo" por vez (atualizada com a main, com checks rodando ou verde
 *      esperando o auto-merge). Havendo uma, ninguém mais é atualizado.
 *   2. Sem PR em voo, indica só a PRÓXIMA: a atrasada com auto-merge que habilitou o
 *      auto-merge primeiro (FIFO por `enabledAt`) — ninguém volta para o fim da fila.
 *   3. PR com check falhando não entra: rodaria de novo para falhar de novo. Ela volta
 *      quando o autor empurrar a correção.
 *
 * ADAPTAÇÃO AO LALAMOVE V2 — leia antes de usar:
 *  - a `main` deste repo NÃO tem branch protection nem required check (AGENTS.md), então
 *    não existe a lista `required_status_checks` que a versão do Zapp lia de
 *    `github-settings-baseline.json`. Aqui `checksObrigatorios()` devolve `[]` e, com a
 *    lista vazia, a regra 3 passa a valer para TODOS os checks do rollup (fail-closed:
 *    qualquer check falhando segura a PR). Sem isso, uma PR vermelha seria atualizada
 *    repetidamente e queimaria CI à toa;
 *  - este script NÃO atualiza, NÃO aprova e NÃO mergeia nada. Ele lê `gh pr list` e
 *    imprime a decisão; com `$GITHUB_OUTPUT` presente, grava `pr=<n>` e `fila=<n n n>`
 *    para um passo de workflow decidir o que fazer. Quem aperta o botão é o dono.
 *
 * Uso:
 *   node scripts/ci/fila-merge.mjs                       # imprime a decisão
 *   node scripts/ci/fila-merge.mjs --confirmar <n> [--recusadas "A B"]
 *       exit 0 se <n> ainda é a próxima da fila recalculada; 3 se não.
 * Env: GITHUB_REPOSITORY. Precisa do `gh` autenticado (GH_TOKEN) só para LER.
 */

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Caminho absoluto do binário pelo PATH (o helper do Zapp vivia em scripts/lib/). */
export function resolverExecutavel(comando) {
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

function erroTransitorio(err) {
  const msg = String(err?.stderr ?? err?.message ?? '');
  return /HTTP 50[234]|50[234] Bad Gateway|50[234] Service Unavailable|connection reset|ECONNRESET|ETIMEDOUT|timeout expired|unexpected end of JSON/i.test(msg);
}

async function execComRetry(cmd, args, opts, { tentativas = 4, delaysMs = [5000, 10000, 20000] } = {}) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return execFileSync(cmd, args, opts);
    } catch (err) {
      if (!erroTransitorio(err) || i >= tentativas - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delaysMs[Math.min(i, delaysMs.length - 1)]));
    }
  }
}

/**
 * Checks obrigatórios da `main`. Vazio neste repo: não há branch protection.
 * Com a lista vazia, `classificar` considera TODOS os checks do rollup.
 */
export function checksObrigatorios() {
  return [];
}

const PASSOU = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);
const FALHOU = new Set(['FAILURE', 'TIMED_OUT', 'STARTUP_FAILURE', 'ERROR']);

/**
 * Estado de UM check no head da PR: 'passou' | 'falhou' | 'pendente'.
 * CANCELLED e ACTION_REQUIRED contam como pendente: não são defeito do código.
 */
export function estadoDoCheck(rollup, nome) {
  const entradas = (rollup ?? []).filter((c) => (c.name ?? c.context) === nome);
  if (entradas.length === 0) return 'pendente';
  // Mais de uma entrada com o mesmo nome = runs repetidos no mesmo head; vale a mais recente.
  const atual = entradas.reduce((a, b) => (String(b.startedAt ?? '') > String(a.startedAt ?? '') ? b : a));
  if (atual.__typename === 'StatusContext' || atual.state) {
    if (atual.state === 'SUCCESS') return 'passou';
    if (atual.state === 'FAILURE' || atual.state === 'ERROR') return 'falhou';
    return 'pendente';
  }
  if (atual.status !== 'COMPLETED') return 'pendente';
  if (PASSOU.has(atual.conclusion)) return 'passou';
  if (FALHOU.has(atual.conclusion)) return 'falhou';
  return 'pendente';
}

/** Nomes a conferir: os obrigatórios, ou todos os do rollup quando não há obrigatórios. */
export function nomesParaConferir(pr, obrigatorios) {
  if (obrigatorios.length > 0) return obrigatorios;
  return [...new Set((pr.statusCheckRollup ?? []).map((c) => c.name ?? c.context).filter(Boolean))];
}

/** 'fora' | 'em-voo' | 'aguardando' | 'bloqueada' */
export function classificar(pr, obrigatorios) {
  if (pr.isDraft || !pr.autoMergeRequest || (pr.baseRefName && pr.baseRefName !== 'main')) return 'fora';
  if (pr.mergeStateStatus === 'DIRTY') return 'fora'; // conflito: só o autor resolve
  const estados = nomesParaConferir(pr, obrigatorios).map((n) => estadoDoCheck(pr.statusCheckRollup, n));
  if (estados.includes('falhou')) return 'bloqueada';
  // PR de fork ATRASADA fica fora: o GITHUB_TOKEN não escreve no repositório de origem.
  if (pr.mergeStateStatus === 'BEHIND') return pr.isCrossRepository ? 'fora' : 'aguardando';
  // Atualizada com a main (CLEAN/BLOCKED/UNSTABLE/HAS_HOOKS/UNKNOWN): ocupa a vez.
  return 'em-voo';
}

export function decidir(prs, obrigatorios) {
  const classes = prs.map((pr) => ({ pr, classe: classificar(pr, obrigatorios) }));
  const emVoo = classes.filter((c) => c.classe === 'em-voo');
  const bloqueadas = classes.filter((c) => c.classe === 'bloqueada').map((c) => c.pr.number);
  if (emVoo.length > 0) return { acao: 'esperar', emVoo: emVoo.map((c) => c.pr.number), bloqueadas };
  const fila = classes
    .filter((c) => c.classe === 'aguardando')
    .map((c) => c.pr)
    .sort((a, b) => {
      const ea = String(a.autoMergeRequest.enabledAt ?? '');
      const eb = String(b.autoMergeRequest.enabledAt ?? '');
      return ea === eb ? a.number - b.number : ea < eb ? -1 : 1;
    });
  if (fila.length === 0) return { acao: 'nada', bloqueadas };
  return {
    acao: 'atualizar',
    pr: fila[0].number,
    fila: fila.map((p) => p.number),
    restantes: fila.slice(1).map((p) => p.number),
    bloqueadas,
  };
}

/**
 * Depois de uma recusa, o próximo candidato só vale se uma decisão recalculada AGORA
 * ainda o autoriza: ninguém em voo e ele é o primeiro da fila que não foi recusado.
 */
export function confirmarCandidato(decisao, numero, recusadas = []) {
  if (decisao.acao !== 'atualizar') return false;
  return decisao.fila.find((n) => !recusadas.includes(n)) === numero;
}

/**
 * `gh pr list` devolve mergeStateStatus=UNKNOWN enquanto o GitHub não calculou a
 * mergeabilidade. Tratar UNKNOWN como "em voo" travaria a fila; por isso a defasagem vem
 * de uma comparação direta (compare main...head → behind_by).
 */
export async function resolverDesconhecidos(prs, behindBy) {
  const saida = [];
  for (const pr of prs) {
    if (pr.mergeStateStatus !== 'UNKNOWN' || pr.isDraft || !pr.autoMergeRequest || !pr.headRefOid) {
      saida.push(pr);
      continue;
    }
    let atras = null;
    try {
      atras = await behindBy(pr.headRefOid);
    } catch {
      atras = null; // sem resposta: continua UNKNOWN (conservador: ocupa a vez)
    }
    saida.push(atras > 0 ? { ...pr, mergeStateStatus: 'BEHIND' } : pr);
  }
  return saida;
}

async function decisaoAtual(repo) {
  let json;
  try {
    json = await execComRetry(resolverExecutavel('gh'), [
      'pr', 'list', '--repo', repo, '--state', 'open', '--base', 'main', '--limit', '100',
      '--json', 'number,isDraft,isCrossRepository,baseRefName,headRefOid,autoMergeRequest,mergeStateStatus,statusCheckRollup',
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    console.error(`gh pr list falhou (${err.message?.split('\n')[0]}); nenhuma decisão nesta execução.`);
    return decidir([], checksObrigatorios());
  }
  const behindBy = async (head) => Number((await execComRetry(resolverExecutavel('gh'), [
    'api', `repos/${repo}/compare/main...${head}`, '--jq', '.behind_by',
  ], { encoding: 'utf8' })).trim());
  let parsedPrs;
  try {
    parsedPrs = JSON.parse(json);
  } catch {
    return decidir([], checksObrigatorios());
  }
  const prs = await resolverDesconhecidos(parsedPrs, behindBy);
  return decidir(prs, checksObrigatorios());
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    console.error('GITHUB_REPOSITORY ausente');
    process.exit(2);
  }
  const iConfirmar = process.argv.indexOf('--confirmar');
  if (iConfirmar !== -1) {
    const numero = Number(process.argv[iConfirmar + 1]);
    if (!Number.isInteger(numero) || numero <= 0) {
      console.error('--confirmar exige o número da PR');
      process.exit(2);
    }
    const iRecusadas = process.argv.indexOf('--recusadas');
    const recusadas = iRecusadas === -1 ? [] : String(process.argv[iRecusadas + 1] ?? '')
      .split(/\s+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    const decisao = await decisaoAtual(repo);
    if (confirmarCandidato(decisao, numero, recusadas)) return;
    const motivo = decisao.acao === 'esperar'
      ? `em voo: #${decisao.emVoo.join(', #')}`
      : `#${numero} não é mais a próxima da fila`;
    console.log(`Fila recalculada não autoriza #${numero} (${motivo}).`);
    process.exit(3);
  }
  const decisao = await decisaoAtual(repo);
  const linhas = [];
  if (decisao.acao === 'esperar') linhas.push(`Em voo: #${decisao.emVoo.join(', #')} — ninguém mais é atualizado agora.`);
  if (decisao.acao === 'nada') linhas.push('Nenhuma PR com auto-merge esperando atualização.');
  if (decisao.acao === 'atualizar') {
    linhas.push(`Próxima da fila: #${decisao.pr}.`);
    if (decisao.restantes.length) linhas.push(`Esperando a vez (sem gastar CI): #${decisao.restantes.join(', #')}.`);
  }
  if (decisao.bloqueadas.length) linhas.push(`Fora da fila até corrigir check vermelho: #${decisao.bloqueadas.join(', #')}.`);
  linhas.push('Somente leitura: nada foi atualizado, aprovado ou mergeado.');
  for (const l of linhas) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Fila de merge\n\n${linhas.map((l) => `- ${l}`).join('\n')}\n`);
  }
  if (process.env.GITHUB_OUTPUT && decisao.acao === 'atualizar') {
    // Só inteiros saem daqui: o workflow itera sobre esta lista no shell.
    const fila = decisao.fila.filter((n) => Number.isInteger(n) && n > 0).join(' ');
    appendFileSync(process.env.GITHUB_OUTPUT, `pr=${decisao.pr}\nfila=${fila}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
