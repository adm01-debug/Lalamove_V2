// Testes do github-settings-guard.mjs. Nada aqui toca a rede: `comparar` e
// `formatar` sao puras e `lerPerimetro` recebe um `fetchImpl` falso.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  NaoVerificavel,
  TokenRecusado,
  comparar,
  formatar,
  lerPerimetro,
  main,
  semQuebra,
} from './github-settings-guard.mjs';

const BASELINE = JSON.parse(
  readFileSync(fileURLToPath(new URL('./github-settings-baseline.json', import.meta.url)), 'utf8'),
);

/** O perimetro exatamente igual ao baseline versionado (sem os metadados). */
function perimetroDoBaseline() {
  const { _comentario, medido_em, nao_verificavel_automaticamente, ...perimetro } = BASELINE;
  return JSON.parse(JSON.stringify(perimetro));
}

test('baseline versionado: campos que o repo realmente tem hoje (medido 2026-11-08)', () => {
  assert.equal(BASELINE.repo.private, true, 'Lalamove_V2 e privado');
  assert.equal(BASELINE.repo.default_branch, 'main');
  assert.equal(BASELINE.branch_main.protected, false, 'main NAO tem branch protection (AGENTS.md: o gate e o agente)');
  assert.equal(BASELINE.rulesets_count, 0);
  assert.ok(
    BASELINE.nao_verificavel_automaticamente.branch_protection_main,
    'o detalhe da branch protection e ponto cego declarado (exige administration:read)',
  );
});

test('perimetro igual ao baseline: zero divergencia', () => {
  const r = comparar(BASELINE, perimetroDoBaseline());
  assert.deepEqual(r.divergencias, []);
  assert.deepEqual(r.pontosCegos, []);
});

test('valor diferente e divergencia, com esperado e encontrado', () => {
  const perimetro = perimetroDoBaseline();
  perimetro.repo.delete_branch_on_merge = true;
  const r = comparar(BASELINE, perimetro);
  assert.equal(r.divergencias.length, 1);
  assert.deepEqual(r.divergencias[0], {
    campo: 'repo.delete_branch_on_merge',
    esperado: false,
    encontrado: true,
  });
});

test('campo AUSENTE na resposta e ponto cego, nunca divergencia (licao W04/W05)', () => {
  // O GITHUB_TOKEN de workflow responde 200 em GET /repos mas OMITE os campos de
  // merge. Tratar ausencia como regressao deixou 30 runs vermelhos no Zapp.
  const perimetro = perimetroDoBaseline();
  delete perimetro.repo.allow_auto_merge;
  delete perimetro.repo.delete_branch_on_merge;
  const r = comparar(BASELINE, perimetro);
  assert.deepEqual(r.divergencias, [], 'ausencia nao pode virar divergencia');
  assert.deepEqual(
    r.pontosCegos.map((p) => p.campo).sort(),
    ['repo.allow_auto_merge', 'repo.delete_branch_on_merge'],
  );
});

test('bloco inteiro nao lido entra como um ponto cego so', () => {
  const perimetro = perimetroDoBaseline();
  delete perimetro.actions;
  const r = comparar(BASELINE, perimetro);
  assert.deepEqual(r.divergencias, []);
  assert.deepEqual(r.pontosCegos, [{ campo: 'actions', motivo: 'bloco nao lido (sem escopo ou nao consultado)' }]);
});

test('ponto cego da leitura nao e duplicado pela comparacao', () => {
  const perimetro = perimetroDoBaseline();
  delete perimetro.actions;
  const r = comparar(BASELINE, perimetro, [{ campo: 'actions', motivo: '403 em /actions/permissions' }]);
  assert.equal(r.pontosCegos.filter((p) => p.campo === 'actions').length, 1);
});

test('lista (environments) compara por conteudo e ordem', () => {
  const perimetro = perimetroDoBaseline();
  perimetro.environments = [...BASELINE.environments, 'producao-ddl'];
  const r = comparar(BASELINE, perimetro);
  assert.equal(r.divergencias.length, 1);
  assert.equal(r.divergencias[0].campo, 'environments');
});

test('metadados do baseline (medido_em, nao_verificavel_automaticamente) nao sao comparados', () => {
  const r = comparar(BASELINE, perimetroDoBaseline());
  assert.equal(r.pontosCegos.some((p) => p.campo === 'medido_em'), false);
  assert.equal(r.pontosCegos.some((p) => p.campo === 'nao_verificavel_automaticamente'), false);
});

test('formatar separa DIVERGENCIA de PONTO CEGO e neutraliza quebra de linha', () => {
  const linhas = formatar({
    divergencias: [{ campo: 'repo.private', esperado: true, encontrado: false }],
    pontosCegos: [{ campo: 'x', motivo: 'linha1\nlinha2' }],
  });
  assert.equal(linhas.length, 2);
  assert.match(linhas[0], /^DIVERGENCIA repo\.private: baseline=true encontrado=false$/u);
  assert.match(linhas[1], /^PONTO CEGO x: linha1 linha2$/u);
  assert.equal(semQuebra('a\r\nb\u0000c').includes('\n'), false);
});

test('lerPerimetro: 403 vira ponto cego e NAO derruba a leitura (licao E95)', async () => {
  const respostas = {
    '/repos/o/r': { private: true, visibility: 'private', default_branch: 'main' },
    '/repos/o/r/branches/main': { protected: false },
    '/repos/o/r/actions/permissions': { enabled: true, allowed_actions: 'all', sha_pinning_required: false },
    '/repos/o/r/rulesets': [],
    '/repos/o/r/environments': { environments: [{ name: 'Production' }, { name: 'Preview' }] },
  };
  const fetchImpl = async (url) => {
    const caminho = url.replace('https://api.github.com', '');
    if (caminho === '/repos/o/r/branches/main/protection') {
      return { status: 403, ok: false, text: async () => 'Resource not accessible by integration' };
    }
    return { status: 200, ok: true, json: async () => respostas[caminho] };
  };
  const { perimetro, pontosCegos } = await lerPerimetro({ repo: 'o/r', token: 't', fetchImpl });
  assert.equal(perimetro.repo.private, true);
  assert.equal(perimetro.branch_main.protected, false);
  assert.equal(perimetro.actions.allowed_actions, 'all');
  assert.equal(perimetro.rulesets_count, 0);
  assert.deepEqual(perimetro.environments, ['Preview', 'Production']);
  assert.equal(pontosCegos.length, 1);
  assert.equal(pontosCegos[0].campo, 'branch_protection_main');
  assert.match(pontosCegos[0].motivo, /403/u);
});

test('lerPerimetro: 401 vira ponto cego do bloco (token recusado, nao regressao)', async () => {
  const fetchImpl = async () => ({ status: 401, ok: false, text: async () => 'Bad credentials' });
  const { perimetro, pontosCegos } = await lerPerimetro({ repo: 'o/r', token: 'ruim', fetchImpl });
  assert.deepEqual(perimetro, {});
  assert.equal(pontosCegos.length, 6, 'todos os blocos ficam cegos');
  assert.ok(pontosCegos.every((p) => /401/u.test(p.motivo)));
});

test('lerPerimetro: erro que nao e de permissao sobe (nao e ponto cego)', async () => {
  const fetchImpl = async () => ({ status: 500, ok: false, text: async () => 'boom' });
  await assert.rejects(() => lerPerimetro({ repo: 'o/r', token: 't', fetchImpl }), /500/u);
});

test('NaoVerificavel e TokenRecusado carregam o caminho consultado', () => {
  assert.equal(new NaoVerificavel('/x', 403, 'sem escopo').caminho, '/x');
  assert.equal(new TokenRecusado('/y').caminho, '/y');
});

test('main --entrada: OK no perimetro medido, 1 com divergencia, 2 em argumento invalido', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'settings-guard-'));
  const igual = path.join(dir, 'igual.json');
  const diferente = path.join(dir, 'diferente.json');
  writeFileSync(igual, JSON.stringify({ perimetro: perimetroDoBaseline(), pontosCegos: [] }));
  const divergente = perimetroDoBaseline();
  divergente.repo.private = false;
  writeFileSync(diferente, JSON.stringify({ perimetro: divergente, pontosCegos: [] }));

  assert.equal(await main(['--entrada', igual]), 0);
  assert.equal(await main(['--entrada', diferente]), 1, 'repo virar publico e divergencia');
  assert.equal(await main(['--argumento-que-nao-existe']), 2);
});

test('main --update-baseline grava o lido, com os pontos cegos declarados', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'settings-guard-update-'));
  const entrada = path.join(dir, 'entrada.json');
  const destino = path.join(dir, 'baseline.json');
  writeFileSync(
    entrada,
    JSON.stringify({
      perimetro: { repo: { private: true }, rulesets_count: 0 },
      pontosCegos: [{ campo: 'branch_protection_main', motivo: '403: exige administration:read' }],
    }),
  );
  assert.equal(await main(['--entrada', entrada, '--baseline', destino]), 2, 'sem baseline o arquivo destino nao existe ainda');
  assert.equal(await main(['--entrada', entrada, '--baseline', destino, '--update-baseline']), 0);
  const gravado = JSON.parse(readFileSync(destino, 'utf8'));
  assert.equal(gravado.repo.private, true);
  assert.equal(gravado.rulesets_count, 0);
  assert.match(gravado.medido_em, /^\d{4}-\d{2}-\d{2}$/u);
  assert.match(gravado.nao_verificavel_automaticamente.branch_protection_main, /administration:read/u);
  // E depois de gravar, a mesma entrada passa.
  assert.equal(await main(['--entrada', entrada, '--baseline', destino]), 0);
});
