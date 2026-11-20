#!/usr/bin/env node
/**
 * Guarda: workflow que usa as credenciais de E2E nao pode publicar o report do
 * Playwright.
 *
 * MOTIVO (medido no Zapp_Web_V2 em 02/10/2026, mesma stack Playwright): quando o
 * setup de autenticacao falha, o Playwright grava a arvore de acessibilidade da
 * pagina da falha em `test-results/.../error-context.md` e o relatorio HTML embute
 * esse conteudo. O campo de senha aparece com o VALOR DIGITADO em texto claro. O
 * `upload-artifact` de `playwright-report/` publicaria isso como artifact.
 *
 * PERTINENCIA NO LALAMOVE_V2 (medido 2026-11-08): o `.github/workflows/ci.yml` JA
 * publica `playwright-report/` (job "E2E (Playwright)"). Hoje nao ha credencial de
 * E2E nesse job, entao a guarda passa; ela existe para o dia em que houver.
 *
 * EXCECAO (a mesma do Zapp): publicar e permitido quando o proprio workflow redige
 * o report ANTES do upload com `scripts/ci/redigir-relatorio.mjs`, cobrindo TODAS as
 * credenciais que AQUELE workflow usa, e condiciona o upload ao sucesso da redacao
 * (`steps.<id>.outcome == 'success'`). Mascarar o log (`::add-mask::`) NAO conta: ele
 * esconde o valor na saida do run, nao no arquivo — e o vazamento esta no arquivo.
 * Redigir so parte das credenciais tambem nao conta.
 *
 * DIFERENCA EM RELACAO AO ZAPP: la a exigencia era cobrir a lista fixa
 * E2E_TEST_EMAIL+E2E_TEST_PASSWORD; aqui a exigencia e cobrir as credenciais que o
 * workflow REALMENTE referencia (`credenciaisUsadas`), porque a lista inclui tanto o
 * par de senha quanto a sessao injetada e nenhum workflow usa os quatro nomes.
 *
 * Uso: node scripts/ci/check-e2e-artifact-secrets.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Caminhos que carregam a arvore de acessibilidade com o valor digitado. */
export const CAMINHOS_SENSIVEIS = ['playwright-report', 'test-results', 'e2e/.auth'];

/**
 * Variaveis cujo uso ativo marca o workflow como "com credencial".
 * LOVABLE_BROWSER_SUPABASE_* sao as que o e2e/helpers/auth.ts do Lalamove_V2 le
 * (sessao Supabase injetada: o JSON tem access_token/refresh_token); E2E_TEST_*
 * ficam na lista porque sao o par padrao de login por senha nesta stack.
 */
export const VARIAVEIS_CREDENCIAL = [
  'LOVABLE_BROWSER_SUPABASE_SESSION_JSON',
  'LOVABLE_BROWSER_SUPABASE_STORAGE_KEY',
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
];

/** Script que redige o report; a excecao exige a invocacao dele antes do upload. */
export const REDATOR = 'scripts/ci/redigir-relatorio.mjs';

/** Remove comentarios de linha para nao confundir citacao em prosa com uso real. */
export function semComentarios(fonte) {
  return fonte
    .split(/\r?\n/u)
    .map((linha) => linha.replace(/(^|\s)#.*$/u, '$1'))
    .join('\n');
}

/** Credenciais que ESTE workflow referencia de verdade (subconjunto de VARIAVEIS_CREDENCIAL). */
export function credenciaisUsadas(fonte) {
  const limpo = semComentarios(fonte);
  return VARIAVEIS_CREDENCIAL.filter((variavel) => new RegExp(`secrets\\.${variavel}\\b`, 'u').test(limpo));
}

/** O workflow referencia alguma credencial de E2E de verdade? */
export function usaCredencial(fonte) {
  const limpo = semComentarios(fonte);
  return VARIAVEIS_CREDENCIAL.some((variavel) =>
    new RegExp(`secrets\\.${variavel}\\b`, 'u').test(limpo),
  );
}

/** Blocos de upload-artifact: o que cada um publica. */
export function uploads(fonte) {
  const limpo = semComentarios(fonte);
  const achados = [];
  const linhas = limpo.split('\n');
  for (let i = 0; i < linhas.length; i += 1) {
    if (!/uses:\s*actions\/upload-artifact@/u.test(linhas[i])) continue;
    let caminho = '';
    for (let j = i + 1; j < Math.min(i + 20, linhas.length); j += 1) {
      if (/^\s*uses:\s*/u.test(linhas[j])) break;
      const m = /^\s*path:\s*(.+?)\s*$/u.exec(linhas[j]);
      if (m) {
        caminho = m[1].replace(/^['"]|['"]$/gu, '');
        break;
      }
    }
    achados.push({ linha: i + 1, caminho });
  }
  return achados;
}

/** O trecho do workflow que antecede a linha do upload. */
function antesDe(fonte, linhaDoUpload) {
  return semComentarios(fonte)
    .split('\n')
    .slice(0, Math.max(0, linhaDoUpload - 1))
    .join('\n');
}

/**
 * O bloco do passo de upload, completo. Em YAML a ordem das chaves do passo nao e
 * garantida -- o `if:` pode vir antes OU depois do `uses:` --, entao o bloco e delimitado
 * pelo item da lista (a linha que comeca com `- `), para tras e para frente.
 */
function blocoDoUpload(fonte, linhaDoUpload) {
  const linhas = semComentarios(fonte).split('\n');
  const inicio = linhaDoUpload - 1;
  let de = inicio;
  while (de > 0 && !/^\s*- /u.test(linhas[de])) de -= 1;
  let ate = inicio;
  while (ate + 1 < linhas.length && !/^\s*- /u.test(linhas[ate + 1])) ate += 1;
  return linhas.slice(de, ate + 1).join('\n');
}

/**
 * O workflow redige o report, cobrindo todas as credenciais QUE ELE USA, antes de
 * publicar? Tres exigencias, nenhuma cosmetica:
 *  1. o redator foi invocado antes do upload;
 *  2. nomeia TODAS as credenciais que o workflow referencia — redigir so uma deixaria
 *     a outra em texto claro no error-context, que e o vazamento medido;
 *  3. o upload esta condicionado ao sucesso da redacao
 *     (`steps.<id>.outcome == 'success'`): se a redacao falhar, o report nao sobe.
 */
export function redigeAntesDoUpload(fonte, linhaDoUpload) {
  const antes = antesDe(fonte, linhaDoUpload);
  if (!antes.includes(REDATOR)) return false;
  const usadas = credenciaisUsadas(fonte);
  const cobreTodas = usadas.every((variavel) => new RegExp(`segredo-env=${variavel}\\b`, 'u').test(antes));
  if (!cobreTodas) return false;
  return /steps\.[A-Za-z0-9_-]+\.outcome\s*==\s*'success'/u.test(blocoDoUpload(fonte, linhaDoUpload));
}

/**
 * Avalia um workflow. Devolve [] quando esta em conformidade, ou uma lista de
 * violacoes legiveis.
 */
export function avaliarWorkflow(nome, fonte) {
  const violations = [];
  if (!usaCredencial(fonte)) return violations;
  for (const envio of uploads(fonte)) {
    const sensivel = CAMINHOS_SENSIVEIS.find((alvo) => envio.caminho.includes(alvo));
    if (!sensivel) continue;
    if (redigeAntesDoUpload(fonte, envio.linha)) continue;
    violations.push(
      `${nome}: linha ${envio.linha} publica "${envio.caminho}" (contem ${sensivel}) ` +
        `num workflow que usa ${VARIAVEIS_CREDENCIAL.join('/')}. O report do Playwright ` +
        'embute o error-context com o valor digitado no campo de senha e o JSON da sessao ' +
        `injetada. Ou tire a credencial deste workflow, ou nao publique o report, ou redija-o ` +
        `antes com ${REDATOR} ` +
        `${credenciaisUsadas(fonte).map((v) => `--segredo-env=${v}`).join(' ')} ` +
        "e condicione o upload ao sucesso dela (steps.<id>.outcome == 'success').",
    );
  }
  return violations;
}

export function guarda(diretorio = '.github/workflows') {
  const violations = [];
  for (const arquivo of readdirSync(diretorio).sort()) {
    if (!/\.ya?ml$/u.test(arquivo)) continue;
    const fonte = readFileSync(join(diretorio, arquivo), 'utf8');
    violations.push(...avaliarWorkflow(arquivo, fonte));
  }
  return violations;
}

const executadoDireto = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (executadoDireto) {
  const violations = guarda();
  if (violations.length > 0) {
    console.error('VIOLACAO: credencial de E2E + publicacao do report do Playwright\n');
    for (const v of violations) console.error(` - ${v}`);
    console.error(
      `\n${violations.length} violacao(oes). O artifact de um repo publico nao pode conter ` +
        'valor de senha digitada.',
    );
    process.exit(1);
  }
  console.log('OK: nenhum workflow publica o report do Playwright junto das credenciais de E2E.');
}
