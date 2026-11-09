#!/usr/bin/env node
/**
 * Guarda de supply chain dos workflows. Portado do Zapp Web V2 e reduzido ao que
 * existe no Lalamove V2 (sem bun/go/supabase-cli, sem actionlint/shellcheck/zizmor).
 *
 * Confere, em todo `.github/workflows/*.yml`:
 *  P1 — toda Action é referenciada por SHA de 40 caracteres (`owner/repo@<sha40>`).
 *       Tag (`@v7`) é mutável: quem controla a tag controla o que roda com o
 *       GITHUB_TOKEN do repo.
 *  P2 — o owner/repo da Action está em `scripts/ci/allowed-actions.json`.
 *  P3 — variável `*_IMAGE` fixada por digest (`@sha256:<64 hex>`).
 *  P4 — versão de toolchain literalizada no YAML igual à de `.github/toolchain.json`
 *       (fonte única). Hoje: `node-version` e `deno-version`.
 *
 * Uso: node scripts/ci/check-workflow-pins.mjs
 * Saída: 0 = tudo pinado, 1 = violação.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FULL_SHA = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[a-f0-9]{40}$/u;
const IMAGE_DIGEST = /@sha256:[a-f0-9]{64}/u;

export const TOOLCHAIN_PATH = '.github/toolchain.json';
/** Ferramentas cuja versão aparece literal em algum workflow deste repo. */
export const TOOLCHAIN_KEYS = ['node', 'deno'];

const SCALAR = /^(?:'([^']*)'|"([^"]*)"|([^\s#'"]+))(?:\s+#.*)?$/u;
const USES_LINE = /^\s*(?:-\s*)?(?:uses|["']uses["'])\s*:\s*(.*)$/u;
const TOOLCHAIN_VERSION_INPUT = /^\s*(?:-\s*)?["']?(deno|node)-version["']?\s*:\s*(.*)$/u;
const IMAGE_LINE = /^\s*(?:-\s*)?(?:["']?image["']?|["']?[A-Za-z][A-Za-z0-9_]*_IMAGE["']?)\s*:\s*(.*)$/u;
const PLAYWRIGHT_PIN = /playwright@([0-9][0-9A-Za-z.-]*)/gu;

/** Valor literal de um escalar YAML; `null` quando é expressão do Actions ou multilinha. */
function scalarValue(raw) {
  const match = raw.trim().match(SCALAR);
  if (!match) return null;
  const value = match[1] ?? match[2] ?? match[3];
  return value.startsWith('${{') ? null : value;
}

export function findMutableActionRefs(source, file = 'workflow.yml') {
  const violations = [];
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  for (const [index, line] of lines.entries()) {
    const match = line.match(USES_LINE);
    if (!match) continue;
    const rawValue = match[1].trim();
    if (/^[>|][+-]?(?:\s+#.*)?$/u.test(rawValue)) {
      violations.push({ file, line: index + 1, reference: '<unsupported-or-multiline-value>' });
      continue;
    }
    const scalar = rawValue.match(SCALAR);
    if (!scalar) {
      violations.push({
        file,
        line: index + 1,
        reference: rawValue ? '<unsupported-or-multiline-value>' : '<missing-or-multiline-value>',
      });
      continue;
    }
    const reference = scalar[1] ?? scalar[2] ?? scalar[3];
    if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
    if (!FULL_SHA.test(reference)) violations.push({ file, line: index + 1, reference });
  }
  return violations;
}

export function findUnauthorizedActionOwners(source, file = 'workflow.yml', allowedOwnerRepos) {
  const violations = [];
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  for (const [index, line] of lines.entries()) {
    const match = line.match(USES_LINE);
    if (!match) continue;
    const scalar = match[1].trim().match(SCALAR);
    if (!scalar) continue;
    const reference = scalar[1] ?? scalar[2] ?? scalar[3];
    if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
    const segments = reference.split('@')[0].split('/');
    if (segments.length < 2) continue;
    const ownerRepo = `${segments[0]}/${segments[1]}`;
    if (!allowedOwnerRepos.has(ownerRepo)) {
      violations.push({ file, line: index + 1, reference, ownerRepo });
    }
  }
  return violations;
}

export function findUnpinnedImages(source, file = 'workflow.yml') {
  const violations = [];
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^\s+[A-Za-z_][A-Za-z0-9_]*_IMAGE\s*:\s*(.+)$/u);
    if (!match) continue;
    const value = match[1].trim();
    if (/^\$\{\{.*\}\}$/u.test(value)) continue; // expressão resolvida em runtime
    if (!value || value.startsWith('#')) continue;
    if (!IMAGE_DIGEST.test(value)) violations.push({ file, line: index + 1, image: value });
  }
  return violations;
}

/** Lê a fonte única de versões. Falha explícita quando falta arquivo ou chave. */
export function loadToolchain(root = process.cwd()) {
  const file = path.join(root, '.github', 'toolchain.json');
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`fonte única de versões ausente ou ilegível em ${TOOLCHAIN_PATH}: ${error.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`fonte única de versões inválida em ${TOOLCHAIN_PATH}: precisa ser um objeto JSON`);
  }
  for (const key of TOOLCHAIN_KEYS) {
    const value = data[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`fonte única de versões incompleta em ${TOOLCHAIN_PATH}: falta a versão de "${key}"`);
    }
  }
  return data;
}

/**
 * Compara cada versão de toolchain literalizada no workflow com a fonte única.
 * Cobre `node-version`, `deno-version` e `playwright@X` dentro de `run:`.
 * Ferramenta sem chave na fonte única também reprova ("chave ausente"): declarar
 * a versão em dois lugares é como a divergência começa.
 */
export function findToolchainDrift(source, file = 'workflow.yml', toolchain = {}) {
  const violations = [];
  const lines = source.replace(/\r\n?/gu, '\n').split('\n');

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const report = (tool, value) => {
      if (value === null) return;
      const expected = Object.hasOwn(toolchain, tool) ? toolchain[tool] : null;
      if (value !== expected) violations.push({ file, line: lineNumber, tool, value, expected });
    };

    const versionInput = line.match(TOOLCHAIN_VERSION_INPUT);
    if (versionInput) {
      report(versionInput[1], scalarValue(versionInput[2]));
      continue;
    }

    const image = line.match(IMAGE_LINE);
    if (image && image[1].trim().startsWith('postgres')) {
      report('postgres-image', scalarValue(image[1]));
      continue;
    }

    for (const pin of line.matchAll(PLAYWRIGHT_PIN)) report('playwright', pin[1]);
  }
  return violations;
}

export function loadAllowedOwnerRepos(root = process.cwd()) {
  const jsonPath = path.join(root, 'scripts', 'ci', 'allowed-actions.json');
  const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
  return new Set(data.patterns);
}

export function main(root = process.cwd()) {
  const workflowsDir = path.join(root, '.github', 'workflows');
  const files = readdirSync(workflowsDir).filter((file) => /\.ya?ml$/u.test(file)).sort();
  const sources = new Map(files.map((file) => [file, readFileSync(path.join(workflowsDir, file), 'utf8')]));

  const pinViolations = files.flatMap((file) => findMutableActionRefs(sources.get(file), file));

  const allowedOwnerRepos = loadAllowedOwnerRepos(root);
  const ownerViolations = files.flatMap((file) =>
    findUnauthorizedActionOwners(sources.get(file), file, allowedOwnerRepos),
  );

  const imageViolations = files.flatMap((file) => findUnpinnedImages(sources.get(file), file));

  let toolchain = null;
  let toolchainError = null;
  try {
    toolchain = loadToolchain(root);
  } catch (error) {
    toolchainError = error.message;
  }
  const driftViolations = toolchain
    ? files.flatMap((file) => findToolchainDrift(sources.get(file), file, toolchain))
    : [];

  let exitCode = 0;

  if (pinViolations.length) {
    console.error('FALHA: GitHub Actions com referência mutável:');
    for (const v of pinViolations) console.error(`  ${v.file}:${v.line} ${v.reference}`);
    console.error('Use o SHA completo de 40 caracteres e mantenha a versão em comentário (`@<sha> # v7.0.1`).');
    exitCode = 1;
  }

  if (ownerViolations.length) {
    console.error('FALHA: GitHub Actions de repositório não autorizado:');
    for (const v of ownerViolations) console.error(`  ${v.file}:${v.line} ${v.ownerRepo} (${v.reference})`);
    console.error('Adicione o owner/repo em scripts/ci/allowed-actions.json se for legítimo.');
    exitCode = 1;
  }

  if (imageViolations.length) {
    console.error('FALHA: variáveis *_IMAGE sem digest (@sha256:<64 hex>):');
    for (const v of imageViolations) console.error(`  ${v.file}:${v.line} ${v.image}`);
    exitCode = 1;
  }

  if (toolchainError) {
    console.error(`FALHA: ${toolchainError}`);
    console.error(`As versões de ${TOOLCHAIN_KEYS.join(', ')} são declaradas em ${TOOLCHAIN_PATH}.`);
    exitCode = 1;
  }

  if (driftViolations.length) {
    console.error(`FALHA: versão de toolchain divergente da fonte única ${TOOLCHAIN_PATH}:`);
    for (const v of driftViolations) {
      console.error(`  ${v.file}:${v.line} ${v.tool}: ${v.value} (fonte: ${v.expected ?? 'chave ausente'})`);
    }
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log(
      `OK: ${files.length} workflow(s) usam só Actions fixadas por SHA, de repositórios autorizados, ` +
        `imagens com digest e as versões de ${TOOLCHAIN_PATH}.`,
    );
  }

  return exitCode;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = main(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..'));
}
