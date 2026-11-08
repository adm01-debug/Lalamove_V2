/**
 * Prova dos auditores de contraste contra os arquivos reais do repo.
 *
 * O que NÃO está aqui, de propósito: "todos os pares passam AA". O Zapp podia
 * afirmar isso; aqui a paleta atual reprova 34 de 80 pares medidos
 * (`node scripts/qa/contraste-tokens.mjs`), e um teste que exigisse zero falha
 * nasceria vermelho e seria desligado. O que se prova é o medidor: que ele lê os
 * arquivos certos, que acusa quando a cor piora (controle adulterado), que
 * explode quando a receita muda de forma — e que o piso de texto corrido
 * (foreground/muted-foreground sobre card e background) continua AA.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AA,
  BADGE_TSX,
  BUTTON_TSX,
  TOKENS_CSS,
  contrast,
  hslToRgb,
  measure,
  measureReceitas,
  parseReceitas,
  parseTemas,
} from './contraste-tokens.mjs';
import { HIGHLIGHT_TSX, medir, parseDestaque } from './contraste-busca.mjs';

const css = readFileSync(TOKENS_CSS, 'utf8');
const badge = readFileSync(BADGE_TSX, 'utf8');
const button = readFileSync(BUTTON_TSX, 'utf8');
const highlight = readFileSync(HIGHLIGHT_TSX, 'utf8');

test('contrast() respeita a escala WCAG', () => {
  const branco = hslToRgb([0, 0, 100]);
  const preto = hslToRgb([0, 0, 0]);
  assert.equal(Math.round(contrast(branco, preto)), 21);
  assert.equal(contrast(branco, branco).toFixed(2), '1.00');
});

test('parseTemas junta os blocos :root de @layer base, não o de @media', () => {
  const { temas, condicionais } = parseTemas(css);
  // O primeiro `:root` do arquivo (src/index.css:29) está dentro de
  // @media (prefers-contrast) e só tem --border/--ring. Se o parser parasse
  // nele, --foreground não existiria e a medição seria uma ficção.
  assert.ok(temas.claro.foreground, '--foreground ausente no tema claro');
  assert.ok(temas.claro.card, '--card ausente no tema claro');
  assert.ok(temas.escuro.foreground, '--foreground ausente no tema escuro');
  assert.notDeepEqual(temas.claro.background, temas.escuro.background);
  // Nenhum token MEDIDO é redefinido dentro de @media hoje (só --border/--ring).
  assert.deepEqual(condicionais, []);
});

test('piso de texto corrido continua AA nos dois temas', () => {
  const { temas } = parseTemas(css);
  const piso = measure(temas, [
    ['foreground / card', 'foreground', 'card', 1],
    ['foreground / background', 'foreground', 'background', 1],
    ['muted-foreground / card', 'muted-foreground', 'card', 1],
    ['muted-foreground / background', 'muted-foreground', 'background', 1],
  ]);
  assert.equal(piso.length, 8);
  assert.deepEqual(piso.filter((r) => r.ratio < AA), []);
});

test('parseReceitas lê todas as variantes de badge e separa as que não dá para medir', () => {
  const receitas = parseReceitas(badge, 'src/components/ui/badge.tsx');
  const nomes = receitas.map((r) => r.nome);
  for (const esperado of ['default', 'destructive', 'success', 'warning', 'info', 'inactive']) {
    assert.ok(nomes.includes(esperado), `variante ${esperado} não foi lida`);
  }
  // Gradiente não tem razão de contraste única: volta com motivo, não medido.
  const gradiente = receitas.find((r) => r.nome === 'gradient');
  assert.match(gradiente.motivo, /gradiente/);
  // Alpha da classe entra na composição (bg-destructive/15).
  const destructive = receitas.find((r) => r.nome === 'destructive');
  assert.deepEqual(
    { texto: destructive.textoToken, fundo: destructive.fundoToken, alpha: destructive.alpha },
    { texto: 'destructive', fundo: 'destructive', alpha: 0.15 },
  );
});

test('parseReceitas lê button.tsx e trata variante sem fundo próprio', () => {
  const receitas = parseReceitas(button, 'src/components/ui/button.tsx');
  const link = receitas.find((r) => r.nome === 'link');
  // `link: "text-primary underline-offset-4 ..."` não tem bg: mede sobre card.
  assert.equal(link.fundoToken, 'card');
  assert.equal(link.alpha, 1);
  const ghost = receitas.find((r) => r.nome === 'ghost');
  assert.match(ghost.motivo, /sem token de texto próprio/);
});

test('o medidor de receitas acusa quando a cor piora (controle adulterado)', () => {
  const { temas } = parseTemas(css);
  const receitas = parseReceitas(badge, 'src/components/ui/badge.tsx');
  const secondary = receitas.filter((r) => r.nome === 'secondary');

  const original = measureReceitas(temas, secondary).find((r) => r.theme === 'claro');
  assert.ok(original.ratio >= AA, `controle deveria passar hoje, ratio=${original.ratio}`);

  const adulterado = {
    ...temas,
    claro: { ...temas.claro, 'secondary-foreground': temas.claro.secondary },
  };
  const piorado = measureReceitas(adulterado, secondary).find((r) => r.theme === 'claro');
  assert.ok(piorado.ratio < AA, `controle deveria reprovar, ratio=${piorado.ratio}`);
});

test('parseReceitas explode se o bloco variant mudar de forma', () => {
  assert.throws(
    () => parseReceitas('export const x = cva("base", {});', 'fixture.tsx'),
    /bloco variant não encontrado/,
  );
});

test('parseTemas explode quando o seletor de tema desaparece', () => {
  assert.throws(() => parseTemas(':root { --card: 0 0% 100%; }'), /bloco \.dark ausente/);
});

test('parseDestaque lê a receita real do <mark> e mede as duas superfícies', () => {
  const destaque = parseDestaque(highlight);
  assert.equal(destaque.textoToken, 'primary');
  assert.equal(destaque.fundoToken, 'primary');
  assert.ok(destaque.alpha > 0 && destaque.alpha < 1, `alpha inesperado: ${destaque.alpha}`);

  const { temas } = parseTemas(css);
  const linhas = medir(temas, destaque);
  assert.equal(linhas.length, 10);
  assert.equal(linhas.filter((l) => /destaque <mark>/.test(l.par)).length, 4);
  // A lista do palette (texto sobre popover) é o piso legível do componente.
  for (const l of linhas.filter((l) => /item do palette/.test(l.par))) {
    assert.ok(l.ratio >= AA, `${l.tema}: ${l.par} caiu para ${l.ratio.toFixed(2)}`);
  }
});

test('parseDestaque explode se o highlightClassName perder os tokens', () => {
  assert.throws(
    () => parseDestaque("highlightClassName = 'font-medium rounded px-0.5',"),
    /sem text-\/bg- reconhecível/,
  );
});
