import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { CAMPOS, extrairDocs, extrairNaoEBug, nomeDe, projetar } from './render-workflow-docs.mjs';

const SCRIPT = fileURLToPath(new URL('./render-workflow-docs.mjs', import.meta.url));
const RAIZ = fileURLToPath(new URL('../..', import.meta.url));

const COMPLETO = [
  '# docs:',
  '#   gatilho: push na main e PR',
  '#   prova:   typecheck, unit, build e e2e passam',
  '#   falha:   merge fica sem prova; o dono é chamado',
  '#   avisa:   dono via check vermelho na PR',
  '',
  'name: CI/CD',
  'on: push',
].join('\n');

test('bloco # docs: completo é extraído campo a campo', () => {
  const bloco = extrairDocs(COMPLETO);
  assert.deepEqual(Object.keys(bloco).sort(), [...CAMPOS].sort());
  assert.equal(bloco.gatilho, 'push na main e PR');
  assert.equal(nomeDe(COMPLETO, 'ci.yml'), 'CI/CD');
});

test('workflow sem bloco # docs: FALHA nomeando arquivo e campos — nunca passa em falso', () => {
  const { problemas, conteudo } = projetar([{ arquivo: 'ci.yml', texto: 'name: CI/CD\non: push\n' }]);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /^ci\.yml: sem bloco '# docs:'/);
  for (const campo of CAMPOS) assert.match(problemas[0], new RegExp(campo));
  assert.match(conteudo, /\*\*0 workflows\.\*\*/);
});

test('bloco incompleto FALHA listando só o que falta', () => {
  const texto = ['# docs:', '#   gatilho: push', '#   prova: nada quebra', 'name: X'].join('\n');
  const { problemas } = projetar([{ arquivo: 'x.yml', texto }]);
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /sem falha, avisa$/);
});

test('projeção monta tabela, detalhe e KPI quando o kpi.json existe', () => {
  const { conteudo, problemas, total } = projetar(
    [{ arquivo: 'ci.yml', texto: COMPLETO }],
    { 'ci.yml': { custo_semana_min: 42, taxa_falha_7d: '12%' } },
  );
  assert.deepEqual(problemas, []);
  assert.equal(total, 1);
  assert.match(conteudo, /\| CI\/CD \| \[`ci\.yml`\]\(\.\.\/\.\.\/\.github\/workflows\/ci\.yml\) \|/);
  assert.match(conteudo, /\| 42 \| 12% \|/);
  assert.match(conteudo, /### CI\/CD \(`ci\.yml`\)/);
});

test('sem kpi.json as colunas de custo ficam em "—"', () => {
  const { conteudo } = projetar([{ arquivo: 'ci.yml', texto: COMPLETO }]);
  assert.match(conteudo, /\| — \| — \|/);
});

test('bloco # nao-e-bug: vira seção própria; sem ele a seção não aparece', () => {
  const comNaoEBug = [
    '# nao-e-bug:',
    '#   - e2e sem secret: a suíte pula quando VITE_SUPABASE_URL não existe no fork',
    '# docs:',
    '#   gatilho: push',
    '#   prova:   x',
    '#   falha:   y',
    '#   avisa:   z',
    'name: CI/CD',
  ].join('\n');
  assert.deepEqual(extrairNaoEBug(comNaoEBug), [
    { chave: 'e2e sem secret', descricao: 'a suíte pula quando VITE_SUPABASE_URL não existe no fork' },
  ]);
  assert.match(projetar([{ arquivo: 'ci.yml', texto: comNaoEBug }]).conteudo, /## O que NÃO é bug/);
  assert.doesNotMatch(projetar([{ arquivo: 'ci.yml', texto: COMPLETO }]).conteudo, /## O que NÃO é bug/);
});

test('rodando no repositório real: ci.yml ainda não tem bloco # docs: (achado registrado)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: RAIZ, encoding: 'utf8' });
  assert.equal(r.status, 1, `esperado exit 1 enquanto ci.yml não declarar # docs:\n${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /ci\.yml: sem bloco '# docs:'/);
});
