#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Secrets que podem aparecer em workflow de PR/push irrestrito: sao as duas
// variaveis publicas que o Vite injeta no bundle (o `.env.example` do repo as
// documenta como publicas). Qualquer outro nome e privilegiado.
const PUBLIC_SECRET_ALLOWLIST = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
]);

// Branches de push consideradas confiaveis (push ali exige permissao de escrita
// no repo). No Zapp_Web_V2 so `main` contava; o `.github/workflows/ci.yml` do
// Lalamove_V2 dispara em `branches: [main, develop]`, e as duas sao protegidas
// pelo mesmo controle de acesso. Lista de bloco ou inline com SO estes nomes =
// restrito; qualquer outro nome, `**`, `branches-ignore` ou filtro de `tags`
// volta a contar como irrestrito.
export const BRANCHES_CONFIAVEIS = ['main', 'develop'];
const NOME_CONFIAVEL = `(?:${BRANCHES_CONFIAVEIS.join('|')})`;
const ITEM_CONFIAVEL = `(?:"${NOME_CONFIAVEL}"|'${NOME_CONFIAVEL}'|${NOME_CONFIAVEL})`;
const LISTA_CONFIAVEL = `\\[\\s*${ITEM_CONFIAVEL}(?:\\s*,\\s*${ITEM_CONFIAVEL})*\\s*\\]`;
const BRANCHES_INLINE_CONFIAVEIS = new RegExp(`\\bbranches:\\s*${LISTA_CONFIAVEL}`);
const BRANCHES_BLOCO_CONFIAVEIS = new RegExp(`^\\s+branches:\\s*${LISTA_CONFIAVEL}\\s*(?:#.*)?$`);

export function hasPullRequestTrigger(source) {
  const lines = source.split(/\r?\n/u);
  const onIndex = lines.findIndex((line) => /^on:\s*(?:#.*)?$/u.test(line));

  if (onIndex === -1) {
    return /^on:\s*\[[^\]]*\bpull_request(?:_target)?\b[^\]]*\]/mu.test(source);
  }

  for (let index = onIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_-][A-Za-z0-9_-]*:\s*/u.test(line)) break;
    if (/^\s{2}pull_request(?:_target)?:/u.test(line)) return true;
  }

  return false;
}

export function hasPushTriggerUnrestricted(source) {
  // Scalar: on: push (single event, no branch restriction), including quoted forms
  if (/^on:\s*(?:"push"|'push'|push)\s*(?:#.*)?$/mu.test(source)) return true;

  // Inline array: on: [push] or on: [push, pull_request] etc.
  if (/^on:\s*\[[^\]]*\bpush\b[^\]]*\]/mu.test(source)) return true;

  const lines = source.replace(/\r\n?/gu, '\n').split('\n');
  const onIndex = lines.findIndex((l) => /^on:\s*(?:#.*)?$/u.test(l));
  if (onIndex === -1) return false;

  let pushStart = -1;
  let pushIndent = 0;
  let pushEnd = lines.length;

  for (let i = onIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    // Top-level key ends the 'on:' block
    if (/^[^\s#]/.test(line)) { pushEnd = i; break; }
    // Detect: push: (empty), push: {} (inline empty mapping), push: null, push: Null, push: NULL, push: ~
    // Also handles YAML anchor form: push: &anchor-name (anchor before an implicit null value)
    const pushMatch = /^(\s+)push:\s*(?:&[^\s[\]{},]+\s*)?(?:\{\}|null|Null|NULL|~)?\s*(?:#.*)?$/.exec(line);
    if (pushMatch) { pushStart = i; pushIndent = pushMatch[1].length; continue; }
    // Detect: push: { key: value } (nonempty inline mapping)
    const pushInlineMatch = /^(\s+)push:\s*(\{[^}]+\})\s*(?:#.*)?$/.exec(line);
    if (pushInlineMatch) {
      const inlineContent = pushInlineMatch[2];
      if (
        BRANCHES_INLINE_CONFIAVEIS.test(inlineContent) &&
        !/\btags(?:-ignore)?:/.test(inlineContent)
      ) {
        continue;
      }
      return true;
    }
    // Inside push block: detect sibling key at same or lesser indent = end of push
    if (pushStart !== -1) {
      const indentMatch = /^(\s+)\S/.exec(line);
      if (indentMatch && indentMatch[1].length <= pushIndent && !/^\s*#/.test(line)) {
        pushEnd = i; break;
      }
    }
  }

  if (pushStart === -1) return false;

  // Restricted = branches: [main] / [main, develop] (quoted or not), without any tags: filter.
  // A tags: filter alongside branches: [main] means tag pushes bypass the branch restriction.
  for (let i = pushStart + 1; i < pushEnd; i++) {
    if (
      BRANCHES_BLOCO_CONFIAVEIS.test(lines[i]) &&
      !lines.slice(pushStart + 1, pushEnd).some((line) => /^\s+tags(?:-ignore)?:/.test(line))
    ) {
      return false;
    }
  }

  return true;
}

function _findSecretRefs(source, file) {
  const violations = [];
  const expressionPattern = /\$\{\{([\s\S]*?)\}\}/gu;
  for (const match of source.matchAll(expressionPattern)) {
    const expression = match[1];
    if (!/\bsecrets\b/u.test(expression)) continue;

    const expressionIndex = match.index ?? 0;
    const lineNumber = source.slice(0, expressionIndex).split(/\r?\n/u).length;
    const lineStart = source.lastIndexOf('\n', expressionIndex) + 1;
    const rawLine = source.slice(lineStart, source.indexOf('\n', expressionIndex) === -1
      ? source.length
      : source.indexOf('\n', expressionIndex));
    if (rawLine.trimStart().startsWith('#')) continue;

    const names = [...expression.matchAll(/\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)/gu)]
      .map((m) => m[1]);
    const hasDynamicAccess = /\bsecrets\s*\[/u.test(expression);
    const hasWholeContextAccess = names.length === 0 && !hasDynamicAccess;

    for (const name of names) {
      if (!PUBLIC_SECRET_ALLOWLIST.has(name)) {
        violations.push({ file, line: lineNumber, secret: name });
      }
    }

    if (hasDynamicAccess || hasWholeContextAccess) {
      violations.push({
        file,
        line: lineNumber,
        secret: hasDynamicAccess ? 'dynamic secrets[...] access' : 'whole secrets context',
      });
    }
  }
  return violations;
}

function _findInheritLeaks(source, file) {
  // Match all YAML scalar forms of `secrets: inherit`, including anchor form `&name inherit`.
  // Restricts to horizontal whitespace ([ \t]*) to prevent crossing line boundaries,
  // and anchors to end-of-line ($) so a mapping key named `inherit` on the next line
  // is never mistaken for the inherit scalar.
  // Uses [^\s\[\]{},]+ for anchor names to cover YAML-valid names with hyphens (e.g. &all-secrets).
  const inheritMatch = /^([ \t]+)secrets:[ \t]*(?:&[^\s\[\]{},]+[ \t]+)?(?:"inherit"|'inherit'|inherit)(?:[ \t]*(?:#.*)?)?$/mu.exec(source);
  if (!inheritMatch) return [];
  const lineNumber = source.slice(0, inheritMatch.index).split(/\r?\n/u).length;
  return [{ file, line: lineNumber, secret: 'secrets:inherit (reusable workflow call)' }];
}

export function findPullRequestSecretLeaks(source, file = 'workflow.yml') {
  if (!hasPullRequestTrigger(source)) return [];
  return [..._findSecretRefs(source, file), ..._findInheritLeaks(source, file)];
}

export function findPushSecretLeaks(source, file = 'workflow.yml') {
  if (!hasPushTriggerUnrestricted(source)) return [];
  return [..._findSecretRefs(source, file), ..._findInheritLeaks(source, file)];
}

export function scanWorkflowDirectory(workflowsDirectory) {
  const seen = new Set();
  return readdirSync(workflowsDirectory)
    .filter((file) => /\.ya?ml$/u.test(file))
    .sort()
    .flatMap((file) => {
      const source = readFileSync(path.join(workflowsDirectory, file), 'utf8');
      const violations = [
        ...findPullRequestSecretLeaks(source, file),
        ...findPushSecretLeaks(source, file),
      ];
      return violations.filter((v) => {
        const key = `${v.file}:${v.line}:${v.secret}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const workflowsDirectory = path.join(root, '.github', 'workflows');
  const violations = scanWorkflowDirectory(workflowsDirectory);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `ERRO: ${violation.file}:${violation.line} referencia ${violation.secret} em workflow de PR ou push irrestrito.`,
      );
    }
    console.error(`Mova operações privilegiadas para workflow confiável sem pull_request ou restrinja push a [${BRANCHES_CONFIAVEIS.join(', ')}].`);
    process.exitCode = 1;
    return;
  }

  console.log('OK: workflows de PR e push irrestrito nao recebem secrets privilegiados.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
