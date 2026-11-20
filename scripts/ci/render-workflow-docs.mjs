#!/usr/bin/env node
/**
 * Gera `docs/ci/README.md` a partir dos blocos `# docs:` e `# nao-e-bug:` de cada workflow.
 *
 * Por que existe: um workflow só conta o que faz e a quem avisa se alguém escrever
 * isso. Comentário solto no meio do arquivo não é lido, e um README escrito à mão
 * desatualiza no primeiro PR que mexe num gatilho.
 *
 * O contrato: cada YAML de `.github/workflows/` carrega, no topo, um bloco
 *
 *   # docs:
 *   #   gatilho: <quando roda>
 *   #   prova:   <o que ele prova>
 *   #   falha:   <o que acontece quando falha>
 *   #   avisa:   <quem é avisado>
 *
 * e opcionalmente:
 *
 *   # nao-e-bug:
 *   #   - <chave>: <descricao>
 *
 * O README é a projeção desses blocos. `--check` falha se divergir.
 *
 * ESTADO NO LALAMOVE V2 (08/11/2026): `.github/workflows/ci.yml` NÃO tem o bloco
 * `# docs:`. Este script falha de propósito, nomeando o arquivo e os campos que
 * faltam — passar em falso seria pior do que falhar. Quem adicionar o bloco no
 * ci.yml roda o script sem `--check` para gerar o README.
 *
 * KPI opcional: se `docs/ci/kpi.json` existir, as colunas "custo/semana (min)" e
 * "taxa de falha (7 d)" são lidas de lá (chaves `custo_semana_min` e
 * `taxa_falha_7d`, indexadas pelo nome do arquivo YAML). Sem o arquivo, "—".
 *
 * Uso:
 *   node scripts/ci/render-workflow-docs.mjs           # escreve o README
 *   node scripts/ci/render-workflow-docs.mjs --check    # falha se divergir
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');
const DIR_WF = join(RAIZ, '.github', 'workflows');
const README = join(RAIZ, 'docs', 'ci', 'README.md');
const KPI_PATH = join(RAIZ, 'docs', 'ci', 'kpi.json');

export const CAMPOS = ['gatilho', 'prova', 'falha', 'avisa'];

/** Extrai o bloco `# docs:` do topo do arquivo. Devolve null se não houver. */
export function extrairDocs(texto) {
  const linhas = texto.split('\n');
  const saida = {};
  let dentro = false;

  for (const linha of linhas) {
    if (/^#\s*docs:\s*$/.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;

    // Linha de comentário continua o bloco; qualquer outra coisa o encerra.
    const m = /^#\s+([a-z_]+):\s*(.+?)\s*$/.exec(linha);
    if (m) {
      saida[m[1]] = m[2];
      continue;
    }
    if (/^#\s*$/.test(linha) || linha.trim() === '') continue;
    break;
  }

  return Object.keys(saida).length ? saida : null;
}

/**
 * Extrai entradas do bloco `# nao-e-bug:` do topo do arquivo.
 * Cada item é uma linha `#   - <chave>: <descricao>`.
 */
export function extrairNaoEBug(texto) {
  const linhas = texto.split('\n');
  const itens = [];
  let dentro = false;

  for (const linha of linhas) {
    if (/^#\s*nao-e-bug:\s*$/.test(linha)) {
      dentro = true;
      continue;
    }
    if (!dentro) continue;

    const m = /^#\s+-\s+(.+?):\s*(.+?)\s*$/.exec(linha);
    if (m) {
      itens.push({ chave: m[1], descricao: m[2] });
      continue;
    }
    if (/^#\s*$/.test(linha)) continue;
    break;
  }

  return itens;
}

/** Nome amigável: `name:` do workflow, senão o nome do arquivo. */
export function nomeDe(texto, arquivo) {
  const m = /^name:\s*(.+?)\s*$/m.exec(texto);
  return m ? m[1] : arquivo.replace(/\.ya?ml$/, '');
}

/**
 * Projeta os workflows no markdown. Entrada: `[{ arquivo, texto }]`.
 * Devolve `{ conteudo, problemas }` — `problemas` vazio = contrato cumprido.
 * Puro, para o teste provar a mensagem de falha sem mexer no disco.
 */
export function projetar(arquivos, kpi = {}) {
  const docs = [];
  const problemas = [];
  const naoEBugGlobal = [];

  for (const { arquivo, texto } of arquivos) {
    const bloco = extrairDocs(texto);
    if (!bloco) {
      problemas.push(
        `${arquivo}: sem bloco '# docs:' no topo — declare ${CAMPOS.join(', ')}`,
      );
      continue;
    }
    const faltando = CAMPOS.filter((c) => !bloco[c]);
    if (faltando.length) {
      problemas.push(`${arquivo}: bloco '# docs:' sem ${faltando.join(', ')}`);
      continue;
    }
    const nome = nomeDe(texto, arquivo);
    for (const item of extrairNaoEBug(texto)) {
      naoEBugGlobal.push({ workflow: nome, arquivo, ...item });
    }
    docs.push({ arquivo, nome, ...bloco });
  }

  const linhas = [
    '# Workflows de CI — o que cada um faz',
    '',
    '> **Gerado por `scripts/ci/render-workflow-docs.mjs`.** Não edite à mão: o',
    '> `--check` falha se este arquivo divergir do bloco `# docs:` de cada workflow.',
    '> Para mudar o que está aqui, mude o bloco no YAML.',
    '',
    `**${docs.length} workflows.**`,
    '',
    '| Workflow | Arquivo | Gatilho | O que prova | Quando falha | Quem é avisado | Custo/sem (min) | Falha (7 d) |',
    '|---|---|---|---|---|---|---|---|',
    ...docs.map((d) => {
      const custo = kpi[d.arquivo]?.custo_semana_min ?? '—';
      const falha7d = kpi[d.arquivo]?.taxa_falha_7d ?? '—';
      return `| ${d.nome} | [\`${d.arquivo}\`](../../.github/workflows/${d.arquivo}) | ${d.gatilho} | ${d.prova} | ${d.falha} | ${d.avisa} | ${custo} | ${falha7d} |`;
    }),
    '',
    '## Detalhe',
    '',
    ...docs.flatMap((d) => [
      `### ${d.nome} (\`${d.arquivo}\`)`,
      '',
      `- **Gatilho:** ${d.gatilho}`,
      `- **O que prova:** ${d.prova}`,
      `- **Quando falha:** ${d.falha}`,
      `- **Quem é avisado:** ${d.avisa}`,
      '',
    ]),
  ];

  if (naoEBugGlobal.length > 0) {
    linhas.push(
      '## O que NÃO é bug',
      '',
      '> Comportamentos que parecem erros mas são design intencional.',
      '> Cada item vem do bloco `# nao-e-bug:` do YAML do workflow.',
      '',
      '| Workflow | Situação | Por quê não é bug |',
      '|---|---|---|',
      ...naoEBugGlobal.map(
        (i) =>
          `| [\`${i.arquivo}\`](../../.github/workflows/${i.arquivo}) | **${i.chave}** | ${i.descricao} |`,
      ),
      '',
    );
  }

  return { conteudo: linhas.join('\n'), problemas, total: docs.length };
}

async function principal(argv) {
  let kpi = {};
  try {
    kpi = JSON.parse(await readFile(KPI_PATH, 'utf8'));
  } catch {
    // sem KPI → colunas ficam "—"
  }

  const nomes = (await readdir(DIR_WF)).filter((f) => /\.ya?ml$/.test(f)).sort();
  const arquivos = [];
  for (const arquivo of nomes) {
    arquivos.push({ arquivo, texto: await readFile(join(DIR_WF, arquivo), 'utf8') });
  }

  const { conteudo, problemas, total } = projetar(arquivos, kpi);

  if (problemas.length) {
    console.error('render-workflow-docs: FALHOU — workflow sem documentação declarada:');
    for (const p of problemas) console.error(`  ${p}`);
    console.error('');
    console.error('Adicione no TOPO do YAML (antes de `name:`):');
    console.error('  # docs:');
    console.error('  #   gatilho: <quando roda>');
    console.error('  #   prova:   <o que ele prova>');
    console.error('  #   falha:   <o que acontece quando falha>');
    console.error('  #   avisa:   <quem é avisado>');
    return 1;
  }

  if (argv.includes('--check')) {
    let atual = '';
    try {
      atual = await readFile(README, 'utf8');
    } catch {
      console.error('FALHA: docs/ci/README.md não existe. Rode sem --check para gerar.');
      return 1;
    }
    if (atual !== conteudo) {
      console.error('FALHA: docs/ci/README.md divergiu dos blocos `# docs:` dos workflows.');
      console.error('Rode `node scripts/ci/render-workflow-docs.mjs` e commite o resultado.');
      return 1;
    }
    console.log(`OK: docs/ci/README.md bate com os ${total} workflows.`);
    return 0;
  }

  await mkdir(dirname(README), { recursive: true });
  await writeFile(README, conteudo, 'utf8');
  console.log(`docs/ci/README.md gerado a partir de ${total} workflows.`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await principal(process.argv.slice(2)));
}
