#!/usr/bin/env node
/**
 * scripts/ci/workflow-invariants.mjs — invariantes estáticos de `.github/workflows/ci.yml`.
 *
 * Portado do Zapp Web V2 e adaptado ao Lalamove V2 (npm, não bun; outros nomes de job).
 *
 * I1 — cada job de gate declarado em JOBS_DE_GATE existe no ci.yml. Renomear um job
 *      sem atualizar esta lista some com a prova sem ninguém notar.
 * I2 — nenhum job de gate usa `if: always()` no nível do job. Com `always()`, um run
 *      cancelado pinta o check de vermelho mesmo com o código correto; o certo é
 *      `!cancelled()`.
 * I3 — comando de suíte caro (`npx vitest run`, `npx playwright test`) aparece em no
 *      máximo 1 job. Duplicar paga a mesma prova duas vezes e disputa runner.
 * I4 — todo `actions/upload-artifact` tem `if:` no passo. Sem guard, o artifact sobe
 *      em todo run (inclusive nos cancelados) e queima cota de armazenamento.
 *
 * Uso: node scripts/ci/workflow-invariants.mjs [caminho-do-yml]
 * Saída: 0 = tudo OK, 1 = violação encontrada.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const CI_YML = join(AQUI, '..', '..', '.github', 'workflows', 'ci.yml');

/**
 * Jobs que compõem a prova de uma PR no ci.yml de hoje (08/11/2026).
 * `edge-integration-tests` e `deploy` ficam fora: os dois têm
 * `if: github.ref == 'refs/heads/main'`, então não são gate de PR.
 */
export const JOBS_DE_GATE = [
  'lint-and-typecheck',
  'test',
  'e2e',
  'build',
  'security',
  'contract-tests',
];

/** Comandos de suíte caros que não devem rodar em dois jobs ao mesmo tempo. */
export const COMANDOS_UNICOS = ['npx vitest run', 'npx playwright test'];

/** Blocos de job (`  <id>:` sob `jobs:`), como texto. */
export function blocosDeJob(source) {
  const lines = source.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*(?:#.*)?$/.test(line));
  if (jobsIndex === -1) return new Map();

  const jobs = new Map();
  let currentId = null;
  let currentLines = [];
  const save = () => {
    if (currentId !== null) jobs.set(currentId, currentLines.join('\n'));
  };

  for (let index = jobsIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const jobHeader = /^ {2}([\w-]+):\s*(?:#.*)?$/.exec(line);
    if (jobHeader) {
      save();
      currentId = jobHeader[1];
      currentLines = [line];
      continue;
    }
    if (currentId !== null) currentLines.push(line);
  }
  save();
  return jobs;
}

/** Blocos de passo (itens de `steps:`), como arrays de linha. */
export function blocosDePasso(source) {
  const lines = source.split(/\r?\n/);
  const blocks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const stepsHeader = /^(\s*)steps:\s*(?:#.*)?$/.exec(lines[i]);
    if (!stepsHeader) continue;

    const stepsIndent = stepsHeader[1].length;
    let itemIndent = null;
    let block = null;
    const saveBlock = () => {
      if (block) blocks.push(block);
      block = null;
    };

    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (!line.trim() || /^\s*#/.test(line)) {
        if (block) block.push(line);
        continue;
      }

      const indent = line.length - line.trimStart().length;
      if (indent <= stepsIndent) break;

      const sequenceItem = /^(\s*)-\s+/.exec(line);
      if (!sequenceItem) {
        if (block) block.push(line);
        continue;
      }

      const sequenceIndent = sequenceItem[1].length;
      if (itemIndent === null) itemIndent = sequenceIndent;
      if (sequenceIndent === itemIndent) {
        saveBlock();
        block = [line];
      } else if (sequenceIndent > itemIndent && block) {
        // Lista aninhada dentro de um passo (por exemplo, um valor de `with`).
        block.push(line);
      }
    }

    saveBlock();
  }

  return blocks;
}

/** I1 + I2: gates presentes e sem `always()` no nível do job. */
export function violacoesDeGate(source, gates = JOBS_DE_GATE) {
  const jobs = blocosDeJob(source);
  const problemas = [];
  for (const id of gates) {
    const bloco = jobs.get(id);
    if (!bloco) {
      problemas.push(`I1: job de gate '${id}' não existe em ci.yml — atualize JOBS_DE_GATE ou o YAML`);
      continue;
    }
    if (/^ {4}if:\s*(?:\$\{\{\s*)?always\s*\(\s*\)/im.test(bloco)) {
      problemas.push(`I2: job '${id}' usa always() no nível do job — usar !cancelled()`);
    }
  }
  return problemas;
}

/** I3: cada comando caro em no máximo 1 job. */
export function violacoesDeDuplicacao(source, comandos = COMANDOS_UNICOS) {
  const jobs = blocosDeJob(source);
  const problemas = [];
  for (const comando of comandos) {
    const onde = [...jobs.entries()]
      .filter(([, bloco]) => bloco.includes(comando))
      .map(([id]) => id);
    if (onde.length > 1) {
      problemas.push(`I3: '${comando}' aparece em ${onde.length} jobs (${onde.join(', ')}) — deve rodar em 1 só`);
    }
  }
  return problemas;
}

/** I4: todo upload-artifact tem `if:` no passo. */
export function violacoesDeArtifact(source) {
  const problemas = [];
  for (const block of blocosDePasso(source)) {
    const item = /^(\s*)-\s+(.*)$/.exec(block[0]);
    if (!item) continue;

    const itemIndent = item[1].length;
    const fieldIndent = itemIndent + 2;
    let usaUpload = false;
    let temIf = false;
    let nome = null;
    let inWith = false;
    const nameRe = new RegExp(`^ {${fieldIndent + 2}}name:\\s*(.*?)\\s*(?:#.*)?$`);

    for (let i = 0; i < block.length; i += 1) {
      const line = block[i];
      const fieldMatch = i === 0
        ? /^\s*-\s+([\w-]+):\s*(.*)$/.exec(line)
        : new RegExp(`^ {${fieldIndent}}([\\w-]+):\\s*(.*)$`).exec(line);

      if (fieldMatch) {
        const key = fieldMatch[1];
        const value = fieldMatch[2].trim();
        inWith = key === 'with';
        if (key === 'uses' && /^actions\/upload-artifact(?:@|$)/.test(value)) usaUpload = true;
        if (key === 'if') temIf = true;
        continue;
      }

      const nameMatch = inWith ? nameRe.exec(line) : null;
      if (nameMatch) nome = nameMatch[1].replace(/^['"]|['"]$/g, '');
    }

    if (usaUpload && !temIf) {
      problemas.push(`I4: upload-artifact '${nome ?? '(sem name)'}' não tem \`if:\` — subiria em todo run`);
    }
  }
  return problemas;
}

export function verificar(source, { gates = JOBS_DE_GATE, comandos = COMANDOS_UNICOS } = {}) {
  return [
    ...violacoesDeGate(source, gates),
    ...violacoesDeDuplicacao(source, comandos),
    ...violacoesDeArtifact(source),
  ];
}

function principal(argv) {
  const caminho = argv.find((a) => !a.startsWith('--')) ?? CI_YML;
  let texto;
  try {
    texto = readFileSync(resolve(caminho), 'utf8');
  } catch (err) {
    console.error(`FALHA: não foi possível ler ${caminho}: ${err.message}`);
    return 1;
  }
  const problemas = verificar(texto);
  if (problemas.length) {
    for (const p of problemas) console.error(`❌ ${p}`);
    console.error(`\n${problemas.length} violação(ões) de invariante em ${caminho}.`);
    return 1;
  }
  console.log(
    `OK: ${JOBS_DE_GATE.length} jobs de gate presentes e sem always(), ` +
      `${COMANDOS_UNICOS.length} comandos caros sem duplicação, upload-artifact com if:.`,
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(principal(process.argv.slice(2)));
}
