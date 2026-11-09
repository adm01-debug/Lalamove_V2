/**
 * Prova do predicado puro de largura, sem navegador.
 *
 * Adicionado nesta porta: no Zapp o teste do predicado vive em
 * `scripts/ci/width-regression.unit.mjs`; aqui `scripts/ci/` e territorio de
 * outro agente, entao o teste acompanha o proprio modulo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TOLERANCIA_PX, avaliarLargura } from "./width-check.mjs";

const medicao = (over = {}) => ({
  innerWidth: 1280,
  docScrollWidth: 1280,
  mainWidth: 1080,
  contentWidth: 1080,
  ...over,
});

test("tolerancia do aceite e de 1px", () => {
  assert.equal(TOLERANCIA_PX, 1);
});

test("aprova quando nao ha overflow nem faixa morta", () => {
  const r = avaliarLargura(medicao());
  assert.equal(r.ok, true);
  assert.equal(r.overflow, false);
  assert.equal(r.faixaMorta, false);
  assert.equal(r.diferenca, 0);
  assert.equal(r.ocupacao, 1);
});

test("reprova overflow horizontal do documento", () => {
  const r = avaliarLargura(medicao({ docScrollWidth: 1300 }));
  assert.equal(r.overflow, true);
  assert.equal(r.ok, false);
});

test("1px de folga no documento e arredondamento, nao overflow", () => {
  assert.equal(avaliarLargura(medicao({ docScrollWidth: 1281 })).overflow, false);
});

test("reprova faixa morta: conteudo mais estreito que o main", () => {
  const r = avaliarLargura(medicao({ contentWidth: 900 }));
  assert.equal(r.faixaMorta, true);
  assert.equal(r.ok, false);
  assert.equal(r.diferenca, 180);
  assert.equal(Math.round(r.ocupacao * 100), 83);
});

test("sobra de 1px nao e faixa morta", () => {
  assert.equal(avaliarLargura(medicao({ contentWidth: 1079 })).faixaMorta, false);
});

test("sem main ou sem conteudo nao inventa faixa morta", () => {
  const semMain = avaliarLargura(medicao({ mainWidth: null }));
  assert.equal(semMain.faixaMorta, false);
  assert.equal(semMain.diferenca, null);
  assert.equal(semMain.ocupacao, null);

  const semConteudo = avaliarLargura(medicao({ contentWidth: null }));
  assert.equal(semConteudo.faixaMorta, false);
  assert.equal(semConteudo.diferenca, null);
});

test("tolerancia explicita do chamador manda", () => {
  assert.equal(avaliarLargura(medicao({ contentWidth: 1070 }), 20).faixaMorta, false);
  assert.equal(avaliarLargura(medicao({ contentWidth: 1070 }), 5).faixaMorta, true);
});
