#!/usr/bin/env node
/**
 * Lista as PERMISSOES e os PAPEIS que a tela usa para esconder acao e diz, para
 * cada um, se existe trava de verdade no banco — isto e, se alguma migration
 * chama `has_permission(<usuario>, '<permissao>')` ou
 * `has_role(<usuario>, '<papel>')`.
 *
 * Por que existe: esconder botao NAO bloqueia a acao. A rota protegida por
 * `<ProtectedRoute requiredRole="admin">` e o `<PermissionGate permission="x">`
 * sao decisao do navegador; quem bloqueia de verdade e a policy RLS ou o
 * SECURITY DEFINER que chama `has_role`/`has_permission`. Esta lista mostra,
 * sem tocar no banco de producao, qual nome usado pela tela NAO tem nenhuma
 * trava correspondente no banco.
 *
 * Adaptacao ao Lalamove V2 (o original do Zapp Web V2 cruzava
 * `user_has_permission`): este repo nao tem `user_has_permission` em nenhuma
 * migration — o RBAC do banco e `has_role(uuid, app_role)` (centenas de
 * call-sites em policy) e `has_permission(uuid, text)`. O front correspondente
 * e `src/components/auth/ProtectedRoute.tsx` (requiredRole/requiredPermission),
 * `src/components/auth/PermissionGate.tsx` (permission/role/roles) e
 * `usePermissions()` (hasPermission/hasRole), mais o menu em
 * `src/components/layout/sidebar-config.ts` (requiredRole: '...').
 *
 * Leitura estatica e offline: nada de rede, nada de banco, nada de producao.
 *
 *   FRONT (padrao `src`, so .ts/.tsx; fora de __tests__/, *.test.*, *.spec.*, *.d.ts):
 *     - `requiredPermission="x"` / `requiredPermission: 'x'`  -> gate por rota;
 *     - `permission="x"` / `permission: 'x'`                  -> PermissionGate;
 *     - `hasPermission('x')` / `checkPermission('x')`         -> gate do usePermissions;
 *     - `requiredRole="x"` / `requiredRole: 'x'`              -> gate por rota e menu;
 *     - `role="x"` / `roles={['x','y']}` / `hasRole('x')`     -> gate por papel.
 *   BANCO (padrao `supabase/migrations`, so .sql): toda chamada
 *     `has_permission(...)` / `has_role(...)` que nao seja linha de comentario;
 *     o nome e o ULTIMO literal da linha (`has_role(auth.uid(), 'admin')` ->
 *     admin). Linha de DEFINICAO da funcao nao tem literal e nao conta.
 *
 * O que este script NAO faz: nao prova que a policy cobre a acao inteira. Ele
 * cruza NOME. Nome que a tela usa e que nenhuma migration conhece sai como SEM
 * TRAVA — e e esse o achado.
 *
 * Uso:
 *   node scripts/db-audit/check-screen-permission-db-guards.mjs [front] [migrations] [--exigir-trava]
 *
 * Codigos de saida: 0 = tabela gerada (relatorio); 1 = ha nome da tela sem trava
 * E `--exigir-trava` foi pedido; 2 = entrada invalida.
 */
import fs from 'node:fs';
import path from 'node:path';

import { resolverCaminhoPermitido } from './seguranca-processo.mjs';

const args = process.argv.slice(2);
const exigirTrava = args.includes('--exigir-trava');
const posicionais = args.filter((a) => !a.startsWith('--'));
const frontPedido = posicionais[0] || 'src';
const migrationsPedido = posicionais[1] || 'supabase/migrations';

function entrar(rotulo, valor) {
  try {
    const resolvido = resolverCaminhoPermitido(valor, rotulo);
    if (!fs.existsSync(resolvido) || !fs.statSync(resolvido).isDirectory()) {
      throw new Error('diretorio inexistente: ' + valor);
    }
    return resolvido;
  } catch (erro) {
    console.error('ERRO: ' + erro.message);
    return null;
  }
}

const frontRaiz = entrar('front (gate da tela)', frontPedido);
const migrationsRaiz = entrar('migrations (trava no banco)', migrationsPedido);
if (!frontRaiz || !migrationsRaiz) {
  console.error('uso: node check-screen-permission-db-guards.mjs [front] [migrations] [--exigir-trava]');
  process.exit(2);
}

/** Caminhos de todos os arquivos sob `dir` que terminam com uma das extensoes, em ordem estavel. */
function listarArquivos(dir, extensoes) {
  const saida = [];
  const pilha = [dir];
  while (pilha.length > 0) {
    const atual = pilha.pop();
    const entradas = fs.readdirSync(atual, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entrada of entradas) {
      const completo = path.join(atual, entrada.name);
      if (entrada.isDirectory()) pilha.push(completo);
      else if (extensoes.some((ext) => completo.endsWith(ext))) saida.push(completo);
    }
  }
  return saida.sort();
}

/** Um arquivo de tela de verdade: fora de __tests__/, sem .test./.spec. e sem .d.ts. */
function ehFonteDeTela(completo) {
  const normalizado = completo.split(path.sep).join('/');
  if (normalizado.includes('/__tests__/')) return false;
  if (/\.(test|spec)\.(ts|tsx)$/.test(normalizado)) return false;
  return !normalizado.endsWith('.d.ts');
}

// Vocabulario de PAPEIS: os valores do enum `app_role` lidos de
// src/integrations/supabase/types.ts (bloco `export const Constants`). Sem esse
// filtro, `role="alert"`, `role="img"`, `role="status"` (ARIA) e
// `role: 'assistant'` (mensagem de chatbot) entrariam como papel RBAC e a
// tabela viraria ruido — foi o que a primeira execucao mostrou: 12 dos 16
// "papeis" eram ARIA. Permissao nao precisa de vocabulario: `permission`/
// `requiredPermission` sao props proprias do RBAC deste repo.
const TYPES_PATH = 'src/integrations/supabase/types.ts';

function papeisDoApp() {
  let texto;
  try {
    texto = fs.readFileSync(path.join(path.dirname(frontRaiz), TYPES_PATH), 'utf8');
  } catch {
    try {
      texto = fs.readFileSync(TYPES_PATH, 'utf8');
    } catch (erro) {
      console.error('ERRO: nao foi possivel ler ' + TYPES_PATH + ' para o vocabulario de papeis: ' + erro.message);
      process.exit(2);
    }
  }
  const bloco = /app_role:\s*\[([^\]]*)\]/.exec(texto);
  if (!bloco) {
    console.error('ERRO: enum app_role nao encontrado em ' + TYPES_PATH + '; ajuste este script.');
    process.exit(2);
  }
  const valores = [...bloco[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
  if (valores.length === 0) {
    console.error('ERRO: enum app_role vazio em ' + TYPES_PATH + '.');
    process.exit(2);
  }
  return new Set(valores);
}

const PAPEIS_VALIDOS = papeisDoApp();

const NOME = '[A-Za-z0-9_.:-]+';
// Atributo JSX (`permission="x"`) e propriedade de objeto (`permission: 'x'`,
// a forma do menu em sidebar-config.ts) na mesma expressao.
const atributoOuPropriedade = (chave) => new RegExp(
  '\\b' + chave + '\\s*(?:=\\s*\\{?|:)\\s*[\'"](' + NOME + ')[\'"]',
  'g',
);
const chamada = (nomes) => new RegExp('\\b(?:' + nomes + ')\\s*\\(\\s*[\'"](' + NOME + ')[\'"]', 'g');

const PADROES_PERMISSAO = [
  atributoOuPropriedade('requiredPermission'),
  atributoOuPropriedade('permission'),
  chamada('hasPermission|checkPermission|hasAnyPermission|hasAllPermissions'),
];
const PADROES_PAPEL = [
  atributoOuPropriedade('requiredRole'),
  atributoOuPropriedade('role'),
  chamada('hasRole|hasAnyRole'),
];
// `roles={['admin', 'manager']}` / `roles: ['admin']`: lista de literais.
const LISTA_DE_PAPEIS = new RegExp('\\broles\\s*(?:=\\s*\\{|:)\\s*\\[([^\\]]*)\\]', 'g');
const LITERAL = new RegExp('[\'"](' + NOME + ')[\'"]', 'g');

const P_DB = [
  ['permissao', /has_permission\s*\(/],
  ['papel', /has_role\s*\(/],
];

/** Ultimo literal da linha (o nome e o ultimo argumento da chamada). */
function ultimoLiteral(linha) {
  const achados = [...linha.matchAll(new RegExp(LITERAL.source, 'g'))].map((m) => m[1]);
  return achados.length > 0 ? achados[achados.length - 1] : null;
}

// ---------------------------------------------------------------- front (a tela)
// chave `tipo\u0000nome` -> [{ arquivo, linha }]
const usadas = new Map();

function registrar(tipo, nome, arquivo, linha) {
  const chave = tipo + '\u0000' + nome;
  if (!usadas.has(chave)) usadas.set(chave, []);
  usadas.get(chave).push({ arquivo, linha });
}

const arquivosDeTela = listarArquivos(frontRaiz, ['.ts', '.tsx']).filter(ehFonteDeTela);
for (const completo of arquivosDeTela) {
  const relativo = path.relative(frontRaiz, completo).split(path.sep).join('/');
  const linhas = fs.readFileSync(completo, 'utf8').split('\n');
  for (const [indice, linha] of linhas.entries()) {
    const numero = indice + 1;
    for (const [tipo, padroes] of [['permissao', PADROES_PERMISSAO], ['papel', PADROES_PAPEL]]) {
      const achados = new Set();
      for (const padrao of padroes) {
        padrao.lastIndex = 0;
        for (const m of linha.matchAll(new RegExp(padrao.source, 'g'))) achados.add(m[1]);
      }
      for (const nome of achados) {
        if (tipo === 'papel' && !PAPEIS_VALIDOS.has(nome)) continue;
        registrar(tipo, nome, relativo, numero);
      }
    }
    for (const lista of linha.matchAll(new RegExp(LISTA_DE_PAPEIS.source, 'g'))) {
      for (const m of lista[1].matchAll(new RegExp(LITERAL.source, 'g'))) {
        if (PAPEIS_VALIDOS.has(m[1])) registrar('papel', m[1], relativo, numero);
      }
    }
  }
}

// ---------------------------------------------------------------- banco (a trava)
const travadas = new Map(); // `tipo\u0000nome` -> [{ arquivo, linha }]
const arquivosSql = listarArquivos(migrationsRaiz, ['.sql']);
for (const completo of arquivosSql) {
  const relativo = path.relative(migrationsRaiz, completo).split(path.sep).join('/');
  const linhas = fs.readFileSync(completo, 'utf8').split('\n');
  for (const [indice, linha] of linhas.entries()) {
    if (linha.trimStart().startsWith('--')) continue; // comentario nao e execucao
    for (const [tipo, padrao] of P_DB) {
      if (!padrao.test(linha)) continue;
      const nome = ultimoLiteral(linha);
      if (!nome) continue; // linha de definicao da funcao: sem nome a ler
      if (tipo === 'papel' && !PAPEIS_VALIDOS.has(nome)) continue;
      const chave = tipo + '\u0000' + nome;
      if (!travadas.has(chave)) travadas.set(chave, []);
      travadas.get(chave).push({ arquivo: relativo, linha: indice + 1 });
    }
  }
}

// ---------------------------------------------------------------- tabela
const referencias = (lista) => {
  const unicas = [...new Set(lista.map((o) => o.arquivo + ':' + o.linha))];
  // Lista longa polui a tabela; o que importa e o estado + onde comecar a olhar.
  return unicas.length > 6
    ? unicas.slice(0, 6).join(', ') + ' (+' + (unicas.length - 6) + ')'
    : unicas.join(', ');
};
const ordenadas = [...usadas.keys()].sort((a, b) => a.localeCompare(b));
const parte = (chave) => chave.split('\u0000');

console.log('Papeis do enum app_role: ' + [...PAPEIS_VALIDOS].sort().join(', '));
console.log('Front (gate da tela): ' + frontPedido + ' (' + arquivosDeTela.length + ' arquivo[s])');
console.log('Migrations (trava no banco): ' + migrationsPedido + ' (' + arquivosSql.length + ' arquivo[s])');
console.log('');
console.log('| tipo | nome | usado pela tela (arquivo:linha) | trava no banco (migration:linha) | estado |');
console.log('| --- | --- | --- | --- | --- |');
for (const chave of ordenadas) {
  const [tipo, nome] = parte(chave);
  const trava = travadas.get(chave);
  console.log(
    '| ' + tipo
    + ' | ' + nome
    + ' | ' + referencias(usadas.get(chave))
    + ' | ' + (trava ? referencias(trava) : '—')
    + ' | ' + (trava ? 'TRAVADA' : 'SEM TRAVA')
    + ' |',
  );
}

const semTrava = ordenadas.filter((chave) => !travadas.has(chave));
const travadasSemUso = [...travadas.keys()]
  .filter((chave) => !usadas.has(chave))
  .sort((a, b) => a.localeCompare(b));
const rotulo = (chave) => parte(chave).join(' ');

console.log('');
console.log('Resumo: ' + ordenadas.length + ' nome[s] usado[s] pela tela; '
  + (ordenadas.length - semTrava.length) + ' com trava no banco; '
  + semTrava.length + ' SEM TRAVA'
  + (semTrava.length > 0 ? ' (' + semTrava.map(rotulo).join(', ') + ')' : ''));
if (travadasSemUso.length > 0) {
  console.log('Com trava no banco e sem uso na tela: '
    + travadasSemUso.map((chave) => rotulo(chave) + ' (' + referencias(travadas.get(chave)) + ')').join('; '));
}

if (exigirTrava && semTrava.length > 0) {
  console.error('FALHA: ' + semTrava.length + ' nome[s] da tela sem trava no banco: '
    + semTrava.map(rotulo).join(', '));
  process.exit(1);
}
process.exit(0);
