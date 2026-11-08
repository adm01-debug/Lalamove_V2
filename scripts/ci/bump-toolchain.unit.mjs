// Testes do bump-toolchain.mjs. A rede e injetada (`fetchImpl`): nenhum teste
// chama api.github.com.

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { FERRAMENTAS, executar, maisNova, piso, relatorio, versoesFixadas } from './bump-toolchain.mjs';

/** Repo sintetico com package.json + .github/workflows/ci.yml. */
function repoFalso({ node = "'22'", deno = 'v1.x', devDeps = {} } = {}) {
  const raiz = mkdtempSync(path.join(tmpdir(), 'bump-toolchain-'));
  mkdirSync(path.join(raiz, '.github', 'workflows'), { recursive: true });
  writeFileSync(path.join(raiz, 'package.json'), JSON.stringify({ devDependencies: devDeps }));
  writeFileSync(
    path.join(raiz, '.github', 'workflows', 'ci.yml'),
    ['jobs:', '  a:', '    steps:', `      - with:`, `          node-version: ${node}`, `          deno-version: ${deno}`].join('\n'),
  );
  return raiz;
}

test('piso: normaliza faixa semver para [maior, menor, patch]', () => {
  assert.deepEqual(piso('^5.8.3'), [5, 8, 3]);
  assert.deepEqual(piso('~1.2'), [1, 2, 0]);
  assert.deepEqual(piso('v1.x'), [1, 0, 0]);
  assert.deepEqual(piso('22'), [22, 0, 0]);
  assert.deepEqual(piso('>=2.0.1'), [2, 0, 1]);
  assert.deepEqual(piso(undefined), [0, 0, 0]);
});

test('maisNova compara pelo piso da faixa', () => {
  assert.equal(maisNova('v1.x', 'v2.9.8'), true, 'deno 1.x contra a 2.x e atraso real');
  assert.equal(maisNova('^5.8.3', 'v5.8.3'), false, 'igual nao e atualizacao');
  assert.equal(maisNova('^5.8.3', 'v5.9.3'), true);
  assert.equal(maisNova('^7.3.5', 'v7.3.4'), false, 'remota mais velha nao conta');
  assert.equal(maisNova('22', 'v22.11.0'), true);
});

test('versoesFixadas le package.json e ci.yml do repo', () => {
  const raiz = repoFalso({ devDeps: { typescript: '^5.8.3', vite: '^7.3.5', '@playwright/test': '^1.56.0' } });
  const fixadas = versoesFixadas({ raiz });
  const porChave = Object.fromEntries(fixadas.map((f) => [f.chave, f.local]));
  assert.equal(porChave.node, '22');
  assert.equal(porChave.deno, 'v1.x');
  assert.equal(porChave.typescript, '^5.8.3');
  assert.equal(porChave.vite, '^7.3.5');
  assert.equal(porChave['@playwright/test'], '^1.56.0');
});

test('versoesFixadas: jobs com valores diferentes de node ficam com o mais ANTIGO', () => {
  const raiz = mkdtempSync(path.join(tmpdir(), 'bump-toolchain-multi-'));
  mkdirSync(path.join(raiz, '.github', 'workflows'), { recursive: true });
  writeFileSync(path.join(raiz, 'package.json'), '{}');
  writeFileSync(
    path.join(raiz, '.github', 'workflows', 'ci.yml'),
    ["          node-version: '24'", "          node-version: '22'", '          deno-version: v1.x'].join('\n'),
  );
  const node = versoesFixadas({ raiz }).find((f) => f.chave === 'node');
  assert.equal(node.local, '22', 'o piso do CI e o job mais atrasado');
});

test('versoesFixadas: sem ci.yml, node/deno ficam nulos (e viram "nao verificado")', async () => {
  const raiz = mkdtempSync(path.join(tmpdir(), 'bump-toolchain-sem-wf-'));
  writeFileSync(path.join(raiz, 'package.json'), JSON.stringify({ devDependencies: { vite: '^7.3.5' } }));
  const fixadas = versoesFixadas({ raiz });
  assert.equal(fixadas.find((f) => f.chave === 'node').local, null);
  const r = await executar({ raiz, fetchImpl: async () => ({ ok: true, json: async () => ({ tag_name: 'v9.9.9' }) }) });
  assert.ok(r.erros.some((e) => e.startsWith('node: versao fixada nao encontrada em ci.yml')));
});

test('executar: ferramenta atrasada entra em atualizacoes com o lugar onde esta fixada', async () => {
  const raiz = repoFalso({ devDeps: { typescript: '^5.8.3', vite: '^7.3.5', '@playwright/test': '^1.56.0' } });
  // Ultima release de cada repo (deno v2.9.8 e o valor REAL medido em 2026-11-08).
  const releases = {
    'nodejs/node': 'v22.0.0',
    'denoland/deno': 'v2.9.8',
    'microsoft/playwright': 'v1.56.0',
    'microsoft/TypeScript': 'v5.8.3',
    'vitejs/vite': 'v7.3.5',
  };
  const fetchImpl = async (url) => {
    const repo = String(url).replace('https://api.github.com/repos/', '').replace('/releases/latest', '');
    return { ok: true, json: async () => ({ tag_name: releases[repo] }) };
  };
  const { atualizacoes, erros } = await executar({ raiz, fetchImpl });
  assert.deepEqual(erros, []);
  const chaves = atualizacoes.map((a) => a.chave).sort();
  assert.deepEqual(chaves, ['deno'], 'so o deno esta atras (v1.x contra v2.9.8)');
  assert.equal(atualizacoes[0].onde, 'ci.yml');
  assert.equal(atualizacoes[0].remota, 'v2.9.8');
});

test('executar: falha de rede nao derruba — vira "nao foi possivel verificar"', async () => {
  const raiz = repoFalso({ devDeps: { typescript: '^5.8.3', vite: '^7.3.5', '@playwright/test': '^1.56.0' } });
  const fetchImpl = async () => {
    throw new Error('getaddrinfo EAI_AGAIN');
  };
  const { atualizacoes, erros } = await executar({ raiz, fetchImpl });
  assert.deepEqual(atualizacoes, []);
  assert.equal(erros.length, FERRAMENTAS.length);
  assert.ok(erros.every((e) => /nao foi possivel consultar/u.test(e)));
});

test('executar: HTTP nao-ok tambem e "nao foi possivel verificar", nao atualizacao', async () => {
  const raiz = repoFalso({ devDeps: { typescript: '^5.8.3', vite: '^7.3.5', '@playwright/test': '^1.56.0' } });
  const { atualizacoes, erros } = await executar({ raiz, fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.deepEqual(atualizacoes, []);
  assert.equal(erros.length, FERRAMENTAS.length);
});

test('relatorio: tabela com atualizacoes e secao de nao verificado', () => {
  const texto = relatorio({
    atualizacoes: [{ chave: 'deno', local: 'v1.x', remota: 'v2.9.8', onde: 'ci.yml' }],
    erros: ['vite: nao foi possivel consultar vitejs/vite'],
    hoje: '2026-11-08',
  });
  assert.match(texto, /Verificado em: 2026-11-08/u);
  assert.match(texto, /\| `deno` \| `v1\.x` \| ci\.yml \| `v2\.9\.8` \|/u);
  assert.match(texto, /### Nao foi possivel verificar/u);
  assert.match(texto, /vite: nao foi possivel consultar/u);
});

test('relatorio: sem atualizacao nao inventa tabela', () => {
  const texto = relatorio({ atualizacoes: [], erros: [], hoje: '2026-11-08' });
  assert.match(texto, /Nenhuma ferramenta atras da ultima release/u);
  assert.equal(/\| Ferramenta \|/u.test(texto), false);
});
