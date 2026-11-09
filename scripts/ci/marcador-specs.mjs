#!/usr/bin/env node
/**
 * Marcador de causa para o alerta da suíte E2E — dedupe de issue de bot.
 * Portado do Zapp Web V2 (lá chamado de E83).
 *
 * Um alerta repetido a cada execução é ruído: ninguém lê a vigésima cópia. A ideia é a
 * mesma do dedupe por marcador: um comentário HTML invisível identifica a CAUSA, e o
 * alerta só é repetido quando a causa MUDA.
 *
 * Aqui a causa é o conjunto de testes que falharam. O Playwright escreve um diretório em
 * `test-results/` por teste que falhou, e o nome do diretório carrega o spec e o título.
 *
 * DECISÃO: o marcador é o sha256 dos NOMES de diretório (ordenados e únicos), sem tentar
 * extrair o `.e2e.ts` do nome. O nome é sanitizado pelo Playwright (hífens no lugar de
 * espaços e barras) e o parse de volta seria heurística que erra em título com hífen. O
 * efeito prático é o mesmo: cada diretório é um teste que falhou, então o dedupe continua
 * sendo por spec/teste, e o corpo da issue lista os nomes crus — legível para quem lê e
 * sem inventar estrutura que o dado não tem.
 *
 * Adaptação ao Lalamove V2: a suíte é `e2e/*.e2e.ts` (login-lockout, mfa, password-reset,
 * rbac) e NÃO há projeto `setup` com `auth.setup.ts`; a sessão é injetada por
 * `e2e/helpers/auth.ts` a partir de `LOVABLE_BROWSER_SUPABASE_*`. Por isso a detecção de
 * "falhou o login, não o spec" olha os nomes de `login-lockout` e `auth`, e não
 * `auth.setup.ts-`. O prefixo do título é `[e2e]`, não `[e2e-logado]`.
 *
 * Uso (biblioteca):  import { marcadorDe, corpoDe, tituloDe } from './marcador-specs.mjs';
 * Uso (CLI):         node scripts/ci/marcador-specs.mjs [dir=test-results]
 *   Imprime título, marcador e corpo — o que um passo de alerta colaria na issue.
 */

import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

/** Marcador invisível que identifica a causa (`<!-- e2e-specs:<sha> -->`). */
export const PREFIXO = '<!-- e2e-specs:';

/** Prefixo do título, usado pelo workflow de fechamento para achar a issue. */
export const PREFIXO_TITULO = '[e2e]';

/** Diretórios de `test-results/`, ordenados e sem repetição. Arquivos soltos ficam fora. */
export function nomesDeTestResults(dir) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // sem test-results não há falha identificada — ver o aviso em marcadorDe
  }
  return entradas
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Nomes válidos: string, não vazia, sem repetição, ordenados. */
function normalizar(nomes) {
  return [...new Set((nomes ?? []).filter((n) => typeof n === 'string' && n.length > 0))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Marcador da causa. Conjunto vazio gera um marcador próprio (`sem-diretorios`), e não
 * string vazia: sem isso, uma falha que não deixou test-results (erro no setup, por
 * exemplo) seria confundida com "mesma causa" de um alerta anterior. Entrada que não é
 * string conta como ausente — não como uma causa diferente.
 */
export function marcadorDe(nomes) {
  const lista = normalizar(nomes);
  const semente = lista.length === 0 ? 'sem-diretorios' : lista.join('\n');
  const hash = createHash('sha256').update(semente).digest('hex').slice(0, 16);
  return `${PREFIXO}${hash} -->`;
}

/** Lista legível para o corpo da issue. */
export function corpoDe(nomes) {
  const lista = normalizar(nomes);
  if (lista.length === 0) {
    return 'A suíte E2E falhou **sem deixar `test-results/`** — o erro aconteceu antes do ' +
      'Playwright (instalação do browser, subida do servidor Vite ou injeção da sessão). Veja o log do run.';
  }
  return [
    `A suíte E2E falhou com **${lista.length}** teste(s) quebrado(s):`,
    '',
    ...lista.map((n) => `- \`${n}\``),
    '',
    '_Alerta do job `e2e` do `ci.yml`. Fecha sozinho quando a suíte voltar a passar na main._',
  ].join('\n');
}

/**
 * Detecta se a falha foi só no caminho de autenticação. Quando todos os diretórios são de
 * `login-lockout` ou de algo com `auth`, a causa é "login falhou", não "spec quebrado" —
 * dono e ação distintos.
 */
export function eLoginFalhou(nomes) {
  const lista = normalizar(nomes);
  if (lista.length === 0) return false;
  return lista.every((n) => n.startsWith('login-lockout') || /auth/i.test(n));
}

/** Título da issue de acordo com a causa detectada. */
export function tituloDe(nomes) {
  if (eLoginFalhou(nomes)) return `${PREFIXO_TITULO} login E2E falhou`;
  return `${PREFIXO_TITULO} suíte E2E quebrada na main`;
}

function principal(argv) {
  const dir = argv.find((a) => !a.startsWith('--')) ?? 'test-results';
  const nomes = nomesDeTestResults(dir);
  console.log(tituloDe(nomes));
  console.log(marcadorDe(nomes));
  console.log('');
  console.log(corpoDe(nomes));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(principal(process.argv.slice(2)));
}
