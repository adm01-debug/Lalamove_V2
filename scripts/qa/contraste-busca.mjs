#!/usr/bin/env node
/**
 * Contraste WCAG das superfícies de BUSCA: a lista do command palette e o
 * destaque `<mark>` dos resultados.
 *
 * Portado do Zapp Web V2 (`scripts/qa/contraste-combobox.mjs`, que media a lista
 * de sugestões do combobox de endereços) e ADAPTADO ao equivalente real daqui:
 *
 *   - lista de sugestões → `src/components/ui/command.tsx`, usada pelo
 *     `CommandPaletteEnhanced` (src/App.tsx:9). Ela pinta `bg-popover`
 *     (command.tsx:16), cabeçalho de grupo e atalho em `text-muted-foreground`
 *     (command.tsx:84 e :118) e o item selecionado em
 *     `data-[selected=true]:bg-accent` + `text-accent-foreground` (command.tsx:108).
 *   - destaque do termo → `src/components/ui/highlight-match.tsx`, cujo
 *     `highlightClassName` padrão é LIDO DO ARQUIVO (não copiado aqui): se a
 *     receita mudar, o script lança em vez de medir uma cor que não existe mais.
 *     O destaque é composto sobre `--card`, porque é dentro de Card que ele é
 *     usado (src/pages/orders/OrderCard.tsx:64 e src/pages/IncidentsPage.tsx:161),
 *     e também sobre `--popover`, para o caso de o palette passar a destacar.
 *
 * O Zapp media 4 temas (claro, escuro e dois de alto contraste). Aqui são 2:
 * não existe classe `.high-contrast` neste repo — ver o cabeçalho de
 * scripts/qa/contraste-tokens.mjs.
 *
 * Reusa o medidor WCAG de contraste-tokens.mjs em vez de escrever outro —
 * mesma régua do resto do repo.
 *
 * Uso: node scripts/qa/contraste-busca.mjs [--check]
 *      (--check: exit 1 se algum par < 4.5:1)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { AA, TOKENS_CSS, contrast, hslToRgb, parseTemas } from './contraste-tokens.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const HIGHLIGHT_TSX = path.join(ROOT, 'src/components/ui/highlight-match.tsx');

/**
 * Receita do `<mark>`: tokens do `highlightClassName` padrão de HighlightMatch.
 * @returns {{textoToken:string, fundoToken:string, alpha:number}}
 */
export function parseDestaque(source) {
  const padrao = source.match(/highlightClassName\s*=\s*'([^']+)'/);
  if (!padrao) throw new Error('highlightClassName padrão não encontrado em highlight-match.tsx');
  const classes = padrao[1];
  const texto = classes.match(/(?:^|\s)text-([a-z][a-z0-9-]*)(?=\s|$)/);
  const fundo = classes.match(/(?:^|\s)bg-([a-z][a-z0-9-]*)(?:\/(\d{1,3}))?(?=\s|$)/);
  if (!texto || !fundo) {
    throw new Error(`receita do destaque sem text-/bg- reconhecível: "${classes}"`);
  }
  const alpha = fundo[2] === undefined ? 1 : Number(fundo[2]) / 100;
  if (!(alpha >= 0 && alpha <= 1)) throw new Error(`opacidade inválida no destaque: ${fundo[2]}`);
  return { textoToken: texto[1], fundoToken: fundo[1], alpha };
}

/** Texto sobre `fundo/α` composto sobre a superfície `base`. */
function razaoComposta(tema, textoToken, fundoToken, alpha, baseToken) {
  const base = hslToRgb(tema[baseToken]);
  const fundo = hslToRgb(tema[fundoToken]).map((c, i) => c * alpha + base[i] * (1 - alpha));
  return contrast(hslToRgb(tema[textoToken]), fundo);
}

export function medir(temas, destaque) {
  const linhas = [];
  for (const [tema, v] of Object.entries(temas)) {
    for (const t of ['muted-foreground', 'foreground', 'popover', 'card', 'accent', 'accent-foreground', destaque.textoToken, destaque.fundoToken]) {
      if (!v[t]) throw new Error(`--${t} ausente (${tema})`);
    }
    linhas.push({
      tema,
      par: 'cabeçalho/atalho do palette (muted-foreground sobre popover)',
      ratio: contrast(hslToRgb(v['muted-foreground']), hslToRgb(v.popover)),
    });
    linhas.push({
      tema,
      par: 'item do palette (foreground sobre popover)',
      ratio: contrast(hslToRgb(v.foreground), hslToRgb(v.popover)),
    });
    linhas.push({
      tema,
      par: 'item selecionado (accent-foreground sobre accent)',
      ratio: contrast(hslToRgb(v['accent-foreground']), hslToRgb(v.accent)),
    });
    const sufixo = `${destaque.textoToken} sobre ${destaque.fundoToken}/${Math.round(destaque.alpha * 100)}`;
    linhas.push({
      tema,
      par: `destaque <mark> em Card (${sufixo})`,
      ratio: razaoComposta(v, destaque.textoToken, destaque.fundoToken, destaque.alpha, 'card'),
    });
    linhas.push({
      tema,
      par: `destaque <mark> em popover (${sufixo})`,
      ratio: razaoComposta(v, destaque.textoToken, destaque.fundoToken, destaque.alpha, 'popover'),
    });
  }
  return linhas;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { temas } = parseTemas(readFileSync(TOKENS_CSS, 'utf8'));
  const destaque = parseDestaque(readFileSync(HIGHLIGHT_TSX, 'utf8'));
  const rows = medir(temas, destaque);

  console.log('| Tema | Par | Contraste | AA (4.5:1) |\n|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.tema} | ${r.par} | ${r.ratio.toFixed(2)}:1 | ${r.ratio >= AA ? 'ok' : 'FALHA'} |`);
  }
  const fails = rows.filter((r) => r.ratio < AA);
  console.log(`\n${fails.length} par(es) abaixo de ${AA}:1 de ${rows.length} medidos`);
  if (process.argv.includes('--check') && fails.length > 0) process.exit(1);
}
