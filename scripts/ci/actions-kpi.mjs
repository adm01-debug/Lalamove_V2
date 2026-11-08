#!/usr/bin/env node
/**
 * KPI de uso do GitHub Actions. Portado do Zapp Web V2 (lá E79).
 *
 * Mede, numa janela de dias, quantos runs cada workflow gastou, quantos foram
 * cancelados, quantos falharam e quantos minutos consumiram — mais o ranking dos jobs
 * mais lentos. Serve para responder "onde o CI está queimando tempo" sem abrir a aba
 * Actions run por run.
 *
 * A duração sai da diferença entre `run_started_at` e `updated_at` de cada run, não do
 * endpoint `/timing`: em repositório que não fatura minutos o `/timing` devolve
 * `billable: {}`.
 *
 * MODO PADRÃO = SOMENTE LEITURA. O script imprime a tabela e, se houver,
 * escreve no `$GITHUB_STEP_SUMMARY`. Ele só abre/atualiza issue com `--publicar`
 * (e aí usa `scripts/ci/issue-rotativa.mjs`, para não acumular comentário infinito).
 *
 * O núcleo é puro de propósito: `agregar`, `maisLentos`, `paginaTemMais`, `tabela` e
 * `corpoDoKpi` não tocam rede nem disco, então a conta é testável com runs sintéticos.
 *
 * Uso:
 *   node scripts/ci/actions-kpi.mjs                 # somente leitura (precisa de GH_TOKEN)
 *   node scripts/ci/actions-kpi.mjs --publicar      # também abre/atualiza a issue [kpi-actions]
 * Env: GITHUB_REPOSITORY (owner/repo), GH_TOKEN ou GITHUB_TOKEN, JANELA_DIAS (default 7).
 */
import { appendFileSync } from 'node:fs';

import { abrirOuRotacionar } from './issue-rotativa.mjs';

const CANCELADOS = new Set(['cancelled']);
const FALHAS = new Set(['failure', 'timed_out', 'startup_failure']);
const UM_DIA = 24 * 60 * 60 * 1000;
const POR_PAGINA = 100; // teto da API do GitHub
export const LABEL = 'kpi-actions';

export function duracaoMinutos(run) {
  const inicio = Date.parse(run.run_started_at ?? '');
  const fim = Date.parse(run.updated_at ?? '');
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim < inicio) return 0;
  return (fim - inicio) / 60000;
}

export function runsNaJanela(runs, { janelaDias = 7, agora = Date.now() } = {}) {
  const corte = agora - janelaDias * UM_DIA;
  return (runs ?? []).filter((run) => {
    const inicio = Date.parse(run.run_started_at ?? '');
    return Number.isFinite(inicio) && inicio >= corte;
  });
}

export function agregar(runs, { janelaDias = 7, agora = Date.now() } = {}) {
  const porWorkflow = new Map();
  for (const run of runsNaJanela(runs, { janelaDias, agora })) {
    const nome = run.name || run.workflow_id || '(sem nome)';
    const atual = porWorkflow.get(nome) ?? { workflow: nome, runs: 0, cancelados: 0, falhas: 0, minutos: 0 };
    atual.runs += 1;
    if (CANCELADOS.has(run.conclusion)) atual.cancelados += 1;
    if (FALHAS.has(run.conclusion)) atual.falhas += 1;
    atual.minutos += duracaoMinutos(run);
    porWorkflow.set(nome, atual);
  }
  return [...porWorkflow.values()]
    .map((l) => ({
      ...l,
      minutos: Math.round(l.minutos * 10) / 10,
      taxaCancelamento: l.runs ? Math.round((l.cancelados / l.runs) * 1000) / 10 : 0,
      taxaFalha: l.runs ? Math.round((l.falhas / l.runs) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.runs - a.runs || b.minutos - a.minutos);
}

/**
 * A API devolve os runs do mais novo para o mais antigo. Se a página veio cheia E o run
 * mais antigo dela ainda está dentro da janela, pode haver run da janela na página
 * seguinte. Página incompleta é a última.
 */
export function paginaTemMais(pagina, { janelaDias = 7, agora = Date.now(), porPagina = POR_PAGINA } = {}) {
  const runs = pagina ?? [];
  if (runs.length < porPagina) return false;
  const tempos = runs.map((r) => Date.parse(r.run_started_at ?? '')).filter(Number.isFinite);
  if (!tempos.length) return false;
  return Math.min(...tempos) >= agora - janelaDias * UM_DIA;
}

export function maisLentos(jobs, { limite = 5 } = {}) {
  return (jobs ?? [])
    .map((j) => ({
      job: j.name,
      workflow: j.workflow_name ?? '',
      minutos: Math.round(duracaoMinutos({ run_started_at: j.started_at, updated_at: j.completed_at }) * 10) / 10,
    }))
    .sort((a, b) => b.minutos - a.minutos)
    .slice(0, limite);
}

export function tabela(agregado, { titulo = 'KPI do GitHub Actions — 7 dias' } = {}) {
  const linhas = [
    `## ${titulo}`,
    '',
    '| workflow | runs | cancelados | taxa cancel. | falhas | taxa falha | minutos |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...agregado.map(
      (l) =>
        `| ${l.workflow} | ${l.runs} | ${l.cancelados} | ${l.taxaCancelamento}% | ${l.falhas} | ${l.taxaFalha}% | ${l.minutos} |`,
    ),
  ];
  const totalRuns = agregado.reduce((a, l) => a + l.runs, 0);
  const totalMin = Math.round(agregado.reduce((a, l) => a + l.minutos, 0) * 10) / 10;
  linhas.push('', `Total: **${totalRuns}** runs, **${totalMin}** minutos.`);
  return linhas.join('\n');
}

export function tabelaLentos(lentos) {
  if (!lentos.length) return '_nenhum job registrado na janela_';
  return [
    '### 5 jobs mais lentos',
    '',
    '| job | workflow | minutos |',
    '| --- | --- | ---: |',
    ...lentos.map((l) => `| ${l.job} | ${l.workflow} | ${l.minutos} |`),
  ].join('\n');
}

/** Corpo publicado (Job Summary e, com --publicar, issue). Puro. */
export function corpoDoKpi(runs, jobs, { janelaDias = 7, agora = Date.now(), titulo } = {}) {
  const agregado = agregar(runs, { janelaDias, agora });
  return [
    tabela(agregado, { titulo: titulo ?? `KPI do GitHub Actions — ${janelaDias} dias` }),
    '',
    tabelaLentos(maisLentos(jobs, { limite: 5 })),
  ].join('\n');
}

// ---------------------------------------------------------------- rede
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const CABECALHOS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

async function pedir(caminho, token, { metodo = 'GET', corpo, tentativas = 4, delaysMs = [5000, 10000, 20000] } = {}) {
  for (let i = 0; i < tentativas; i++) {
    const r = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: { ...CABECALHOS(token), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.ok) return r.json();
    const transitorio = r.status === 502 || r.status === 503 || r.status === 504;
    if (!transitorio || i >= tentativas - 1) throw new Error(`${metodo} ${caminho} -> ${r.status}`);
    await new Promise((res) => setTimeout(res, delaysMs[Math.min(i, delaysMs.length - 1)]));
  }
}

/** Pagina os runs até cobrir a janela. `pedir` é injetável para testar sem rede. */
export async function coletarRuns({
  repo,
  token,
  janelaDias = 7,
  agora = Date.now(),
  porPagina = POR_PAGINA,
  maxPaginas = 100,
  pedir: buscar = pedir,
} = {}) {
  const todos = [];
  for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
    const { workflow_runs: runs = [] } = await buscar(
      `/repos/${repo}/actions/runs?per_page=${porPagina}&page=${pagina}`,
      token,
    );
    todos.push(...runs);
    if (!paginaTemMais(runs, { janelaDias, agora, porPagina })) {
      if (pagina === maxPaginas && runs.length >= porPagina) {
        console.error(`::warning::paginacao de runs parou no teto de ${maxPaginas} paginas`);
      }
      break;
    }
  }
  return todos;
}

/** Busca os jobs de cada run e preenche `workflow_name` quando o endpoint não traz. */
export async function coletarJobs(
  runs,
  { repo, token, porPagina = POR_PAGINA, maxPaginas = 100, pedir: buscar = pedir } = {},
) {
  const jobs = [];
  for (const run of runs ?? []) {
    const id = run.id ?? run.run_id;
    if (id === undefined || id === null) continue;
    for (let pagina = 1; pagina <= maxPaginas; pagina += 1) {
      const { jobs: paginaJobs = [] } = await buscar(
        `/repos/${repo}/actions/runs/${id}/jobs?per_page=${porPagina}&page=${pagina}`,
        token,
      );
      for (const job of paginaJobs) jobs.push({ ...job, workflow_name: job.workflow_name ?? run.name ?? '' });
      if (paginaJobs.length < porPagina) break;
    }
  }
  return jobs;
}

async function principal(argv) {
  const publicar = argv.includes('--publicar');
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    console.error('::error::GITHUB_REPOSITORY e GH_TOKEN (ou GITHUB_TOKEN) sao obrigatorios');
    return 2;
  }
  const janela = Number(process.env.JANELA_DIAS ?? 7);
  const runs = await coletarRuns({ repo, token, janelaDias: janela });
  // Limita a 50 runs mais recentes: é 1 requisição HTTP por run.
  const jobs = await coletarJobs(runsNaJanela(runs, { janelaDias: janela }).slice(0, 50), { repo, token });
  const corpo = corpoDoKpi(runs, jobs, { janelaDias: janela });
  console.log(corpo);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${corpo}\n`);

  if (!publicar) {
    console.log('\n(somente leitura: nenhuma issue tocada — use --publicar para abrir/atualizar a issue)');
    return 0;
  }

  const [owner, nome] = repo.split('/');
  const numero = await abrirOuRotacionar({
    gh: (metodo, caminho, corpoReq) => pedir(caminho, token, { metodo, corpo: corpoReq }),
    owner,
    repo: nome,
    label: LABEL,
    title: `[${LABEL}] Semana de ${new Date().toISOString().slice(0, 10)}`,
    body: corpo,
  });
  console.log(`issue ativa: #${numero}`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  principal(process.argv.slice(2))
    .then((codigo) => process.exit(codigo))
    .catch((e) => {
      console.error(`::error::${e.message}`);
      process.exit(1);
    });
}
