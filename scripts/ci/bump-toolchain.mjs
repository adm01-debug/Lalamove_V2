#!/usr/bin/env node
/**
 * Informativo: compara a versao das ferramentas que ESTE repositorio fixa com a
 * ultima release de cada projeto no GitHub. Nunca falha (exit 0 sempre) — serve
 * para o dono saber o que esta velho, nao para travar PR.
 *
 * PORTADO DO ZAPP_WEB_V2 COM UMA MUDANCA DE FONTE: la as versoes vinham de
 * `.github/toolchain.json`. O Lalamove_V2 nao tem esse arquivo e nao da para
 * criar um que ninguem le (seria config morta), entao as versoes sao lidas de
 * onde elas REALMENTE estao (medido 2026-11-08):
 *   - Node    -> `node-version:` em .github/workflows/ci.yml ('22')
 *   - Deno    -> `deno-version:` em .github/workflows/ci.yml ('v1.x')
 *   - Playwright -> devDependencies["@playwright/test"] do package.json
 *   - TypeScript -> devDependencies["typescript"]
 *   - Vite       -> devDependencies["vite"]
 * Nada e escrito: o script so le arquivos do repo e a API publica do GitHub.
 *
 * Faixa (`^5.8.3`, `v1.x`, `22`) e comparada pelo piso: `^5.8.3` conta como 5.8.3.
 * Uma faixa aberta ja aceita versao nova — o que interessa aqui e o piso ficar
 * muito atras (ex.: deno v1.x quando o projeto esta na 2.x).
 *
 * Uso: node scripts/ci/bump-toolchain.mjs
 *      GH_TOKEN=... node scripts/ci/bump-toolchain.mjs   (evita rate limit anonimo)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

/** Ferramenta -> repo do GitHub + como achar a versao fixada neste repositorio. */
export const FERRAMENTAS = [
  { chave: 'node', repo: 'nodejs/node', fonte: 'workflow:node-version' },
  { chave: 'deno', repo: 'denoland/deno', fonte: 'workflow:deno-version' },
  { chave: '@playwright/test', repo: 'microsoft/playwright', fonte: 'devDependency' },
  { chave: 'typescript', repo: 'microsoft/TypeScript', fonte: 'devDependency' },
  { chave: 'vite', repo: 'vitejs/vite', fonte: 'devDependency' },
];

/** Pisa a faixa semver num numero comparavel: `^5.8.3` -> 5.8.3, `v1.x` -> 1.0.0, `22` -> 22.0.0. */
export function piso(faixa) {
  const limpo = String(faixa ?? '').trim().replace(/^[\^~>=v\s]+/u, '');
  const partes = limpo.split('.').map((p) => Number.parseInt(p, 10));
  return [0, 1, 2].map((i) => (Number.isFinite(partes[i]) ? partes[i] : 0));
}

/** `true` quando `remota` e maior que `local` (comparacao por piso). */
export function maisNova(local, remota) {
  const l = piso(local);
  const r = piso(remota);
  for (let i = 0; i < 3; i += 1) {
    if (r[i] > l[i]) return true;
    if (l[i] > r[i]) return false;
  }
  return false;
}

/** Le a versao fixada de cada ferramenta nos arquivos do repo. */
export function versoesFixadas({ raiz = RAIZ, ferramentas = FERRAMENTAS } = {}) {
  const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  let workflow = '';
  try {
    workflow = readFileSync(path.join(raiz, '.github', 'workflows', 'ci.yml'), 'utf8');
  } catch {
    workflow = '';
  }
  const doWorkflow = (campo) => {
    const achados = [...workflow.matchAll(new RegExp(`${campo}:\\s*['"]?([^'"\\s]+)`, 'gu'))].map((m) => m[1]);
    // Varios jobs repetem o mesmo valor; se divergirem, o MAIS ANTIGO manda — e ele
    // que define o piso real do CI (um job em 22 anula o outro em 24).
    return achados.reduce((antigo, atual) => {
      if (antigo === null) return atual;
      // maisNova(atual, antigo) === true <=> `antigo` e mais nova que `atual`.
      return maisNova(atual, antigo) ? atual : antigo;
    }, null);
  };

  return ferramentas.map((ferramenta) => {
    let local = null;
    if (ferramenta.fonte === 'devDependency') {
      local = pkg.devDependencies?.[ferramenta.chave] ?? pkg.dependencies?.[ferramenta.chave] ?? null;
    } else if (ferramenta.fonte.startsWith('workflow:')) {
      local = doWorkflow(ferramenta.fonte.slice('workflow:'.length));
    }
    return { ...ferramenta, local };
  });
}

async function ultimaRelease(repo, headers, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
    if (!res.ok) return null;
    const dados = await res.json();
    return dados.tag_name ?? null;
  } catch {
    return null;
  }
}

export function relatorio({ atualizacoes, erros, hoje }) {
  const linhas = ['## Toolchain — verificacao de versoes', '', `Verificado em: ${hoje}`, ''];
  if (atualizacoes.length > 0) {
    linhas.push('### Atualizacoes disponiveis', '', '| Ferramenta | Fixada aqui | Onde | Ultima release |', '|---|---|---|---|');
    for (const a of atualizacoes) {
      linhas.push(`| \`${a.chave}\` | \`${a.local}\` | ${a.onde} | \`${a.remota}\` |`);
    }
  } else {
    linhas.push('Nenhuma ferramenta atras da ultima release (ou nao foi possivel verificar).');
  }
  if (erros.length > 0) {
    linhas.push('', '### Nao foi possivel verificar');
    for (const e of erros) linhas.push(`- ${e}`);
  }
  return linhas.join('\n');
}

export async function executar({ raiz = RAIZ, fetchImpl = globalThis.fetch, hoje = new Date().toISOString().slice(0, 10) } = {}) {
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '';
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'bump-toolchain-lalamove/1.0',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fixadas = versoesFixadas({ raiz });
  const atualizacoes = [];
  const erros = [];
  const ondeLegivel = { devDependency: 'package.json', 'workflow:node-version': 'ci.yml', 'workflow:deno-version': 'ci.yml' };

  const checagens = await Promise.all(
    fixadas.map(async (f) => ({ ...f, remota: f.local ? await ultimaRelease(f.repo, headers, fetchImpl) : null })),
  );

  for (const c of checagens) {
    if (!c.local) {
      erros.push(`${c.chave}: versao fixada nao encontrada em ${ondeLegivel[c.fonte] ?? c.fonte}`);
      continue;
    }
    if (!c.remota) {
      erros.push(`${c.chave}: nao foi possivel consultar ${c.repo}`);
      continue;
    }
    if (maisNova(c.local, c.remota)) {
      atualizacoes.push({ ...c, onde: ondeLegivel[c.fonte] ?? c.fonte });
    }
  }

  return { atualizacoes, erros, hoje };
}

export async function main() {
  const resultado = await executar();
  const saida = relatorio(resultado);
  console.log(saida);
  const resumo = process.env.GITHUB_STEP_SUMMARY;
  if (resumo) {
    try {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(resumo, `\n${saida}\n`);
    } catch {
      // nao fatal: o relatorio ja foi para o stdout
    }
  }
  // Sempre 0: verificacao de versao e informativa, nao gate.
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
