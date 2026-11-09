#!/usr/bin/env node
/**
 * Todo pin de Action (`owner/repo@<sha40> # vX.Y.Z`) tem de ser o commit REAL da tag
 * declarada no comentário.
 *
 * `check-workflow-pins.mjs` confere a FORMA (40 hex, repositório autorizado), não se o
 * SHA existe. No Zapp Web V2, em 15/10/2026, dois pins inventados (32 caracteres iguais
 * ao real, 8 trocados) derrubavam o workflow no "Set up job" em todo push. Este guarda
 * fecha essa classe de erro.
 *
 * Verificação: `git ls-remote --tags https://github.com/<owner>/<repo> vX.Y.Z vX.Y.Z^{}`
 * (sem token, um processo por pin único). O SHA tem de ser o commit apontado pela tag
 * (o `^{}` quando a tag é anotada). Pin sem comentário de versão reprova: sem ele não
 * há o que conferir.
 *
 * Portado do Zapp Web V2. Mudança: o helper `resolverExecutavel` era importado de
 * `scripts/lib/`, que não existe neste repo — está embutido abaixo.
 *
 * ESTADO NO LALAMOVE V2 (08/11/2026): o ci.yml não tem NENHUM pin por SHA (usa `@v7`),
 * então este guarda passa com 0 pins conferidos. O que reprova as tags é o
 * `check-workflow-pins.mjs`; este só vale depois que os pins existirem.
 *
 * Uso: node scripts/ci/check-workflow-pins-resolvem.mjs
 * Rede: fala com github.com (git ls-remote), sem token.
 */

import { readdirSync, readFileSync, accessSync, constants } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PIN = /uses:\s*([\w.-]+\/[\w.-]+)(?:\/[^@\s]+)?@([0-9a-f]{40})(?:\s*#\s*(\S+))?/g;

/** Caminho absoluto do binário, resolvido pelo PATH de quem chamou. Lança se não existir. */
export function resolverExecutavel(comando) {
  for (const dir of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    const candidato = join(dir, comando);
    try {
      accessSync(candidato, constants.X_OK);
      return candidato;
    } catch {
      // segue a busca, igual ao shell
    }
  }
  throw new Error(`comando nao encontrado no PATH: ${comando}`);
}

export function coletarPins(arquivos) {
  const unicos = new Map();
  for (const [nome, texto] of arquivos) {
    for (const m of texto.matchAll(PIN)) {
      const [, repo, sha, tag] = m;
      const chave = `${repo}@${sha}#${tag ?? ''}`;
      if (!unicos.has(chave)) unicos.set(chave, { repo, sha, tag: tag ?? null, arquivos: new Set() });
      unicos.get(chave).arquivos.add(nome);
    }
  }
  return [...unicos.values()];
}

/** Saída do ls-remote → SHA do commit da tag (peeled se anotada; o próprio se leve). */
export function commitDaTag(saida, tag) {
  let leve = null;
  let peeled = null;
  for (const linha of saida.split('\n')) {
    const [sha, ref] = linha.trim().split(/\s+/);
    if (ref === `refs/tags/${tag}^{}`) peeled = sha;
    else if (ref === `refs/tags/${tag}`) leve = sha;
  }
  return peeled ?? leve;
}

export async function verificarPins(pins, lsRemote) {
  const problemas = [];
  for (const pin of pins) {
    const onde = [...pin.arquivos].sort((a, b) => a.localeCompare(b)).join(', ');
    if (!pin.tag) {
      problemas.push(`${pin.repo}@${pin.sha} (${onde}): pin sem comentário "# vX.Y.Z" — não há tag para conferir`);
      continue;
    }
    let saida;
    try {
      saida = await lsRemote(pin.repo, pin.tag);
    } catch (erro) {
      problemas.push(`${pin.repo} ${pin.tag} (${onde}): não foi possível consultar a tag (${erro.message})`);
      continue;
    }
    const real = commitDaTag(saida, pin.tag);
    if (!real) problemas.push(`${pin.repo} ${pin.tag} (${onde}): a tag não existe no repositório da Action`);
    else if (real !== pin.sha) problemas.push(`${pin.repo} ${pin.tag} (${onde}): pin ${pin.sha} ≠ commit real da tag ${real}`);
  }
  return problemas;
}

function lsRemoteGit(repo, tag) {
  const args = ['ls-remote', '--tags', `https://github.com/${repo}`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`];
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    try {
      return execFileSync(resolverExecutavel('git'), args, {
        encoding: 'utf8',
        timeout: 30_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw new Error(String(ultimoErro?.stderr || ultimoErro?.message || 'falha').trim().split('\n')[0]);
}

async function main() {
  const dir = new URL('../../.github/workflows/', import.meta.url);
  const arquivos = readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]);
  const pins = coletarPins(arquivos);
  const problemas = await verificarPins(pins, async (repo, tag) => lsRemoteGit(repo, tag));
  if (problemas.length) {
    for (const p of problemas) console.error(`::error::${p}`);
    console.error(`FALHA: ${problemas.length} de ${pins.length} pins não correspondem ao commit real da tag declarada.`);
    process.exit(1);
  }
  if (pins.length === 0) {
    console.log('OK: 0 pins por SHA nos workflows — nada a conferir (quem reprova as tags é check-workflow-pins.mjs).');
    return;
  }
  console.log(`OK: ${pins.length} pins conferidos — cada SHA é o commit real da tag do comentário.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
