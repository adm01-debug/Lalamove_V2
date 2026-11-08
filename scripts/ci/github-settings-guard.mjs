#!/usr/bin/env node
/**
 * Confere o perimetro do GitHub do repositorio contra o baseline versionado
 * (`github-settings-baseline.json`). Divergencia = alguem mudou um ajuste do repo
 * fora de um PR; o baseline e o unico registro de como o perimetro deveria estar.
 *
 * PORTADO DO ZAPP_WEB_V2, COM UMA DIFERENCA DELIBERADA: **esta versao nao escreve
 * nada**. A do Zapp restaurava ajustes via PATCH e abria/fechava uma issue
 * [settings-guard]. Aqui nao, por dois motivos:
 *   1. o perimetro do Lalamove_V2 e outro — `main` NAO tem branch protection nem
 *      required check (medido 2026-11-08), e o AGENTS.md diz que "o gate e voce";
 *      restaurar automaticamente uma politica que o repo nao adotou seria mudar a
 *      regra do dono por conta propria;
 *   2. guarda que escreve em settings precisa de token com `administration:write`
 *      e de uma decisao do dono. Este script so LE.
 * Entao: ele compara, relata e sai 1. Quem decide o que fazer e o dono.
 *
 * PONTO CEGO (licao W04/W05 do Zapp, mantida): campo que a API NAO devolve nao e
 * divergencia — e ponto cego. O `GITHUB_TOKEN` de workflow responde 200 em
 * `GET /repos` mas OMITE `allow_auto_merge`, `delete_branch_on_merge` etc. (exigem
 * permissao push/admin), e responde 403 em `/branches/main/protection` (exige
 * `administration: read`). Tratar ausencia como divergencia dava 30 runs vermelhos
 * em 7 dias no Zapp. Aqui: campo ausente vira aviso, exit 0; so divergencia real
 * sai 1.
 *
 * Uso:
 *   GITHUB_TOKEN=... node scripts/ci/github-settings-guard.mjs
 *   GITHUB_TOKEN=... node scripts/ci/github-settings-guard.mjs --update-baseline
 *   node scripts/ci/github-settings-guard.mjs --entrada <resposta.json>   (sem rede; usado nos testes)
 *
 * Variaveis: GITHUB_REPOSITORY (padrao adm01-debug/Lalamove_V2), GITHUB_TOKEN,
 * ADMIN_READ_TOKEN (PAT fine-grained com `administration: read` — opcional; sem ele
 * a branch protection fica como ponto cego declarado).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const REPO_PADRAO = 'adm01-debug/Lalamove_V2';
const BASELINE_PADRAO = fileURLToPath(new URL('./github-settings-baseline.json', import.meta.url));

/** Neutraliza quebra de linha/controle de valor vindo da API antes de logar (S5145). */
export const semQuebra = (valor) => String(valor).replace(/[\r\n\u0000-\u001f\u007f]/gu, ' ');

/** Erro de leitura por falta de escopo/permissao — nao e regressao, e ponto cego. */
export class NaoVerificavel extends Error {
  constructor(caminho, status, motivo) {
    super(`${status} em ${caminho}: ${motivo}`);
    this.caminho = caminho;
    this.status = status;
  }
}

/** 401: token recusado (expirado, revogado, malformado) — nao e falta de escopo. */
export class TokenRecusado extends Error {
  constructor(caminho) {
    super(`401 em ${caminho}: token recusado`);
    this.caminho = caminho;
  }
}

export async function gh(caminho, { token, fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(`https://api.github.com${caminho}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'settings-guard-lalamove/1.0',
    },
  });
  if (res.status === 401) throw new TokenRecusado(caminho);
  if (res.status === 403 || res.status === 404) {
    const texto = await res.text().catch(() => '');
    throw new NaoVerificavel(caminho, res.status, texto.slice(0, 200));
  }
  if (!res.ok) throw new Error(`GitHub API GET ${caminho} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Le o perimetro inteiro. Cada bloco que falhar por escopo entra em
 * `pontosCegos` com o motivo, em vez de derrubar a leitura (licao E95 do Zapp:
 * a versao antiga morria no primeiro 403 e nunca comparava nada).
 */
export async function lerPerimetro({ repo = REPO_PADRAO, token, adminToken, fetchImpl } = {}) {
  const [owner, nome] = repo.split('/');
  const perimetro = {};
  const pontosCegos = [];

  const bloco = async (chave, caminho, tok, transforma) => {
    try {
      perimetro[chave] = transforma(await gh(caminho, { token: tok, fetchImpl }));
    } catch (erro) {
      if (erro instanceof NaoVerificavel || erro instanceof TokenRecusado) {
        pontosCegos.push({ campo: chave, motivo: semQuebra(erro.message) });
        return;
      }
      throw erro;
    }
  };

  await bloco('repo', `/repos/${owner}/${nome}`, token, (r) => ({
    private: r.private,
    visibility: r.visibility,
    default_branch: r.default_branch,
    archived: r.archived,
    allow_squash_merge: r.allow_squash_merge,
    allow_merge_commit: r.allow_merge_commit,
    allow_rebase_merge: r.allow_rebase_merge,
    allow_auto_merge: r.allow_auto_merge,
    delete_branch_on_merge: r.delete_branch_on_merge,
    allow_update_branch: r.allow_update_branch,
    web_commit_signoff_required: r.web_commit_signoff_required,
    squash_merge_commit_title: r.squash_merge_commit_title,
    squash_merge_commit_message: r.squash_merge_commit_message,
    has_issues: r.has_issues,
    has_wiki: r.has_wiki,
    security_and_analysis: r.security_and_analysis ?? null,
  }));
  await bloco('branch_main', `/repos/${owner}/${nome}/branches/${'main'}`, token, (b) => ({
    protected: b.protected,
  }));
  await bloco('branch_protection_main', `/repos/${owner}/${nome}/branches/main/protection`, adminToken ?? token, (p) => ({
    strict: p.required_status_checks?.strict ?? null,
    required_status_checks: (p.required_status_checks?.contexts ?? []).slice().sort(),
    enforce_admins: p.enforce_admins?.enabled ?? null,
    required_linear_history: p.required_linear_history?.enabled ?? null,
    allow_force_pushes: p.allow_force_pushes?.enabled ?? null,
  }));
  await bloco('actions', `/repos/${owner}/${nome}/actions/permissions`, token, (a) => ({
    enabled: a.enabled,
    allowed_actions: a.allowed_actions ?? null,
    sha_pinning_required: a.sha_pinning_required ?? null,
  }));
  await bloco('rulesets_count', `/repos/${owner}/${nome}/rulesets`, token, (r) => (Array.isArray(r) ? r.length : null));
  await bloco('environments', `/repos/${owner}/${nome}/environments`, token, (e) =>
    (e.environments ?? []).map((amb) => amb.name).sort(),
  );

  return { perimetro, pontosCegos };
}

/** Chaves do baseline que descrevem o proprio registro, nao o perimetro. */
const METADADOS = new Set(['medido_em', 'nao_verificavel_automaticamente']);

/** `true` quando os dois valores sao o MESMO valor (comparacao estrutural rasa+array). */
function igual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => igual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...chaves].every((k) => igual(a[k], b[k]));
  }
  return a === b;
}

/**
 * Compara o perimetro lido com o baseline, campo a campo (notacao `bloco.campo`).
 * Campo que o baseline declara e a API NAO devolveu (`undefined`) e PONTO CEGO,
 * nao divergencia — e a licao W04/W05. Campo presente com outro valor e divergencia.
 * Campo que a API devolve e o baseline nao declara e ignorado de proposito: o
 * baseline e a lista do que se vigia.
 */
export function comparar(baseline, perimetro, pontosCegosDaLeitura = []) {
  const divergencias = [];
  const pontosCegos = [...pontosCegosDaLeitura];

  for (const [bloco, esperadoBloco] of Object.entries(baseline)) {
    if (bloco.startsWith('_') || METADADOS.has(bloco)) continue;
    const lidoBloco = perimetro[bloco];
    if (lidoBloco === undefined) {
      if (!pontosCegos.some((p) => p.campo === bloco)) {
        pontosCegos.push({ campo: bloco, motivo: 'bloco nao lido (sem escopo ou nao consultado)' });
      }
      continue;
    }
    if (esperadoBloco !== null && typeof esperadoBloco === 'object' && !Array.isArray(esperadoBloco)) {
      for (const [campo, esperado] of Object.entries(esperadoBloco)) {
        if (campo.startsWith('_')) continue;
        const lido = lidoBloco?.[campo];
        if (lido === undefined) {
          pontosCegos.push({ campo: `${bloco}.${campo}`, motivo: 'campo ausente na resposta da API (exige mais permissao)' });
          continue;
        }
        if (!igual(esperado, lido)) {
          divergencias.push({ campo: `${bloco}.${campo}`, esperado, encontrado: lido });
        }
      }
      continue;
    }
    if (!igual(esperadoBloco, lidoBloco)) {
      divergencias.push({ campo: bloco, esperado: esperadoBloco, encontrado: lidoBloco });
    }
  }

  return { divergencias, pontosCegos };
}

export function formatar({ divergencias, pontosCegos }) {
  const linhas = [];
  for (const d of divergencias) {
    linhas.push(`DIVERGENCIA ${d.campo}: baseline=${semQuebra(JSON.stringify(d.esperado))} encontrado=${semQuebra(JSON.stringify(d.encontrado))}`);
  }
  for (const p of pontosCegos) {
    linhas.push(`PONTO CEGO ${p.campo}: ${semQuebra(p.motivo)}`);
  }
  return linhas;
}

function parseArgs(argv) {
  const args = { baseline: BASELINE_PADRAO, atualizar: false, entrada: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--update-baseline') args.atualizar = true;
    else if (argv[i] === '--baseline') args.baseline = path.resolve(argv[++i]);
    else if (argv[i] === '--entrada') args.entrada = path.resolve(argv[++i]);
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (erro) {
    console.error(`ERRO: ${erro.message}`);
    return 2;
  }

  let leitura;
  if (args.entrada) {
    leitura = JSON.parse(readFileSync(args.entrada, 'utf8'));
  } else {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('ERRO: GITHUB_TOKEN ausente — sem token nao da para ler o perimetro (fail-closed).');
      return 2;
    }
    const adminToken = (process.env.ADMIN_READ_TOKEN || '').trim() || null;
    try {
      leitura = await lerPerimetro({ repo: process.env.GITHUB_REPOSITORY ?? REPO_PADRAO, token, adminToken });
    } catch (erro) {
      console.error(`ERRO ao ler o perimetro: ${semQuebra(erro.message)}`);
      return 2;
    }
  }

  if (args.atualizar) {
    const baseline = {
      _comentario: [
        'Perimetro do GitHub de adm01-debug/Lalamove_V2. Fonte: API do GitHub.',
        'O github-settings-guard.mjs confere a realidade contra este arquivo; divergencia = mudanca fora de PR.',
        'Mudou o perimetro de proposito? Atualize ESTE arquivo no mesmo PR.',
      ],
      medido_em: new Date().toISOString().slice(0, 10),
      ...leitura.perimetro,
      nao_verificavel_automaticamente: Object.fromEntries(leitura.pontosCegos.map((p) => [p.campo, p.motivo])),
    };
    writeFileSync(args.baseline, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    console.log(`Baseline gravado em ${args.baseline} (${leitura.pontosCegos.length} ponto(s) cego(s)).`);
    return 0;
  }

  const baseline = JSON.parse(readFileSync(args.baseline, 'utf8'));
  const resultado = comparar(baseline, leitura.perimetro, leitura.pontosCegos);
  for (const linha of formatar(resultado)) {
    if (linha.startsWith('DIVERGENCIA')) console.error(linha);
    else console.log(`::warning::${linha}`);
  }

  if (resultado.divergencias.length > 0) {
    console.error(
      `\nFALHA: ${resultado.divergencias.length} divergencia(s) de perimetro. ` +
        'Reverta no GitHub ou atualize scripts/ci/github-settings-baseline.json no PR que mudou a politica.',
    );
    return 1;
  }
  console.log(
    `OK: perimetro igual ao baseline (${resultado.pontosCegos.length} ponto(s) cego(s) declarado(s), ` +
      'nenhuma divergencia).',
  );
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
