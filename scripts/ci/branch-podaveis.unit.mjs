import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DIAS_MINIMOS,
  executar,
  lerEquivalentes,
  lerPrsAbertas,
  lerProtegidas,
  motivoNomeInseguro,
  relatorio,
  selecionarPodaveis,
} from './branch-podaveis.mjs';

const SCRIPT = fileURLToPath(new URL('./branch-podaveis.mjs', import.meta.url));
const AGORA = Date.UTC(2026, 10, 8); // 2026-11-08
const DIA = 86_400_000;
const epochDiasAtras = (dias) => Math.floor((AGORA - dias * DIA) / 1000);

const base = {
  prsAbertas: [],
  protegidas: [],
  agoraMs: AGORA,
};

test('branch antiga, sem PR e com nome seguro é elegível', () => {
  const { elegiveis } = selecionarPodaveis({
    ...base,
    equivalentes: [{ branch: 'claude/fix-x-261001-1200', commitEpoch: epochDiasAtras(30) }],
  });
  assert.deepEqual(elegiveis, ['claude/fix-x-261001-1200']);
});

test(`commit nos últimos ${DIAS_MINIMOS} dias fica fora`, () => {
  const { elegiveis, fora } = selecionarPodaveis({
    ...base,
    equivalentes: [{ branch: 'recente', commitEpoch: epochDiasAtras(3) }],
  });
  assert.deepEqual(elegiveis, []);
  assert.deepEqual(fora.recentes, ['recente']);
});

test('epoch ausente ou inválido fica fora — não dá para provar que é antiga', () => {
  const { fora } = selecionarPodaveis({
    ...base,
    equivalentes: [{ branch: 'sem-data', commitEpoch: Number.NaN }, { branch: 'zero', commitEpoch: 0 }],
  });
  assert.deepEqual(fora.recentes.sort(), ['sem-data', 'zero']);
});

test('PR aberta com a branch como head segura a poda', () => {
  const { elegiveis, fora } = selecionarPodaveis({
    ...base,
    prsAbertas: ['com-pr'],
    equivalentes: [{ branch: 'com-pr', commitEpoch: epochDiasAtras(99) }],
  });
  assert.deepEqual(elegiveis, []);
  assert.deepEqual(fora.comPr, ['com-pr']);
});

test('main, develop e protegidas nunca entram', () => {
  const { elegiveis, fora } = selecionarPodaveis({
    ...base,
    protegidas: ['release'],
    equivalentes: [
      { branch: 'main', commitEpoch: epochDiasAtras(99) },
      { branch: 'develop', commitEpoch: epochDiasAtras(99) },
      { branch: 'release', commitEpoch: epochDiasAtras(99) },
    ],
  });
  assert.deepEqual(elegiveis, []);
  assert.deepEqual(fora.principal.sort(), ['develop', 'main']);
  assert.deepEqual(fora.protegidas, ['release']);
});

test('nome com shell dentro é RECUSADO, não escapado', () => {
  for (const nome of ['-D', 'a;rm -rf /', '$(whoami)', 'a`b`', 'a//b', 'x.lock', '']) {
    assert.ok(motivoNomeInseguro(nome), `deveria recusar: ${nome}`);
  }
  assert.equal(motivoNomeInseguro('claude/fix-a_b.1'), null);

  const { elegiveis, fora } = selecionarPodaveis({
    ...base,
    equivalentes: [{ branch: '$(whoami)', commitEpoch: epochDiasAtras(99) }],
  });
  assert.deepEqual(elegiveis, []);
  assert.equal(fora.recusadas.length, 1);
  const md = relatorio({ elegiveis, fora });
  assert.doesNotMatch(md, /\$\(whoami\)/, 'nome recusado não pode sair cru no markdown');
});

test('relatório traz um git push --delete por linha, dentro de bloco sh', () => {
  const md = relatorio(
    selecionarPodaveis({ ...base, equivalentes: [{ branch: 'a', commitEpoch: epochDiasAtras(99) }] }),
  );
  assert.match(md, /```sh\ngit push origin --delete a\n```/);
  assert.match(md, /\*\*Nada é apagado automaticamente\*\*/);
});

test('lista de PRs cheia até o limite falha fechado: nenhum comando é gerado', () => {
  assert.throws(() => lerPrsAbertas('[{"headRefName":"a"}]', 1), /veio cheia/);
  assert.throws(() => lerPrsAbertas('{}', 100), /não é um array/);
  assert.throws(() => lerPrsAbertas('[{}]', 100), /sem headRefName/);
  assert.deepEqual(lerPrsAbertas('[{"headRefName":"a"}]', 100), ['a']);
});

test('leitores de TSV e de protegidas', () => {
  assert.deepEqual(lerEquivalentes('a\t123\nsem-tab\nb\t\n'), [
    { branch: 'a', commitEpoch: 123 },
    { branch: 'sem-tab', commitEpoch: Number.NaN },
    { branch: 'b', commitEpoch: Number.NaN },
  ]);
  assert.deepEqual(lerProtegidas(' main \n\n release\n'), ['main', 'release']);
});

test('arquivo faltando ou argumento ausente → relatório "não gerado" com o motivo', () => {
  const r = executar(['--equivalentes', '/nao/existe', '--prs', '/nao/existe', '--protegidas', '/nao/existe']);
  assert.match(r.saida, /Comando não gerado: lista de patch-equivalentes ilegível/);
  assert.ok(r.aviso);
  assert.match(executar([]).saida, /Comando não gerado: falta --equivalentes/);
});

test('CLI completo sai 0 e imprime o bloco', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poda-'));
  writeFileSync(join(dir, 'eq.tsv'), `velha\t${epochDiasAtras(99)}\n`);
  writeFileSync(join(dir, 'prs.json'), '[]');
  writeFileSync(join(dir, 'prot.txt'), 'main\n');
  const r = spawnSync(
    process.execPath,
    [SCRIPT, '--equivalentes', join(dir, 'eq.tsv'), '--prs', join(dir, 'prs.json'), '--protegidas', join(dir, 'prot.txt')],
    { encoding: 'utf8' },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /git push origin --delete velha/);
});
