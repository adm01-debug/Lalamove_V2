#!/usr/bin/env node
/**
 * Contraste WCAG dos pares de cor do design system, lidos de `src/index.css`
 * nos dois temas (`:root` = claro, `.dark` = escuro).
 *
 * Portado do Zapp Web V2 (`scripts/qa/contraste-contatos.mjs`) e ADAPTADO:
 *
 *  - lá os tokens vivem em `src/styles/tokens.css`; aqui vivem em `src/index.css`,
 *    que tem MAIS DE UM bloco `:root` (um dentro de `@media (prefers-contrast)`,
 *    outro dentro de `@layer base`). O parser do Zapp pegava o primeiro `:root`
 *    que encontrasse e mediria um bloco com dois tokens. Aqui a função junta
 *    todos os blocos fora de `@media`, na ordem do arquivo, e AVISA quando um
 *    bloco condicional redefine um token medido.
 *  - lá as receitas de badge vinham de `src/components/contacts/contactTypeConfig.tsx`,
 *    que não existe neste repo. Aqui as receitas são lidas de
 *    `src/components/ui/badge.tsx` e `src/components/ui/button.tsx`, que declaram
 *    `variant: { nome: "bg-x/15 text-x ..." }` — mesma ideia: se a receita mudar
 *    de forma, o parser lança em vez de medir silenciosamente o que não existe.
 *  - o Zapp tem um 3º tema (`.high-contrast` em `src/styles/accessibility.css`).
 *    Aqui não existe classe de alto contraste: os dois blocos
 *    `@media (prefers-contrast: high)` (src/index.css:29 e :289) só mexem em
 *    `--border`/`--ring`, que não entram em contraste de texto. Por isso são
 *    dois temas, não quatro.
 *
 * Fundos com alpha (`bg-x/15`) são compostos sobre `--card`, que é onde badges e
 * botões aparecem na maior parte das telas (ex.: src/pages/ContactsPage.tsx).
 *
 * Uso: node scripts/qa/contraste-tokens.mjs [--check]
 *      (--check: exit 1 se algum par < 4.5:1)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TOKENS_CSS = path.join(ROOT, 'src/index.css');
export const BADGE_TSX = path.join(ROOT, 'src/components/ui/badge.tsx');
export const BUTTON_TSX = path.join(ROOT, 'src/components/ui/button.tsx');

/** AA para texto normal. */
export const AA = 4.5;

/**
 * [rótulo, token do texto, token do fundo, alpha do fundo sobre --card]
 *
 * Todos os pares saem de uso real no repo, não de hipótese:
 *   - `text-muted-foreground` dentro de Card: src/pages/ContactsPage.tsx:95
 *   - `bg-destructive text-destructive-foreground` e o hover `/90`: botão
 *     destructive (src/components/ui/button.tsx:14-15)
 *   - `bg-primary/10` com ícone `text-primary`: src/pages/ContactsPage.tsx:71
 *   - `data-[selected]:bg-accent text-accent-foreground`: item do command
 *     palette (src/components/ui/command.tsx:108)
 */
export const PARES = [
  ['texto secundário em Card (muted-foreground / card)', 'muted-foreground', 'card', 1],
  ['texto principal em Card (foreground / card)', 'foreground', 'card', 1],
  ['texto secundário no fundo (muted-foreground / background)', 'muted-foreground', 'background', 1],
  ['texto principal no fundo (foreground / background)', 'foreground', 'background', 1],
  ['texto secundário em popover (muted-foreground / popover)', 'muted-foreground', 'popover', 1],
  ['botão primário (primary-foreground / primary)', 'primary-foreground', 'primary', 1],
  ['botão primário hover (primary-foreground / primary 90%)', 'primary-foreground', 'primary', 0.9],
  ['botão secundário (secondary-foreground / secondary)', 'secondary-foreground', 'secondary', 1],
  ['botão destrutivo (destructive-foreground / destructive)', 'destructive-foreground', 'destructive', 1],
  ['botão destrutivo hover (destructive-foreground / destructive 90%)', 'destructive-foreground', 'destructive', 0.9],
  ['botão sucesso (success-foreground / success)', 'success-foreground', 'success', 1],
  ['botão aviso (warning-foreground / warning)', 'warning-foreground', 'warning', 1],
  ['badge info (info-foreground / info)', 'info-foreground', 'info', 1],
  ['item selecionado do command (accent-foreground / accent)', 'accent-foreground', 'accent', 1],
  ['ícone de contato (primary / primary 10% sobre card)', 'primary', 'primary', 0.1],
];

/** Corpo de um bloco `seletor { ... }` com chaves balanceadas, a partir de `from`. */
function bloco(css, seletor, from = 0) {
  const i = css.indexOf(`${seletor} {`, from);
  if (i < 0) return null;
  let profundidade = 0;
  for (let k = css.indexOf('{', i); k < css.length; k++) {
    if (css[k] === '{') profundidade++;
    else if (css[k] === '}' && --profundidade === 0) {
      return { inicio: i, fim: k, texto: css.slice(i, k) };
    }
  }
  throw new Error(`bloco ${seletor} sem fechamento`);
}

/** `--token: H S% L%;` → { token: [H, S, L] }. Ignora cor que não seja HSL de 3 partes. */
function vars(texto) {
  return Object.fromEntries(
    [...texto.matchAll(/--([a-z0-9-]+):\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%\s*(?:!important\s*)?;/g)]
      .map(([, nome, h, s, l]) => [nome, [Number(h), Number(s), Number(l)]]),
  );
}

/** Faixas `@media ... { ... }` do arquivo, para saber o que é condicional. */
function faixasCondicionais(css) {
  const faixas = [];
  const re = /@media\b/g;
  let m;
  while ((m = re.exec(css))) {
    let profundidade = 0;
    const abre = css.indexOf('{', m.index);
    if (abre < 0) break;
    for (let k = abre; k < css.length; k++) {
      if (css[k] === '{') profundidade++;
      else if (css[k] === '}' && --profundidade === 0) {
        faixas.push([m.index, k]);
        break;
      }
    }
  }
  return faixas;
}

/** Todos os blocos de um seletor, com a marca de estar ou não dentro de @media. */
function blocos(css, seletor) {
  const condicionais = faixasCondicionais(css);
  const achados = [];
  let from = 0;
  for (;;) {
    const b = bloco(css, seletor, from);
    if (!b) break;
    achados.push({
      ...b,
      condicional: condicionais.some(([a, z]) => b.inicio > a && b.fim < z),
    });
    from = b.inicio + seletor.length + 1;
  }
  if (achados.length === 0) throw new Error(`bloco ${seletor} ausente`);
  return achados;
}

/**
 * @returns {{temas:{claro:object,escuro:object}, condicionais:{seletor:string,tokens:string[]}[]}}
 * `condicionais` lista tokens redefinidos dentro de `@media` — hoje só
 * `--border`/`--ring`, que não entram em contraste de texto; se um dia um token
 * medido aparecer aí, o relatório mostra em vez de esconder.
 */
export function parseTemas(css) {
  const medidos = new Set(PARES.flatMap(([, fg, bg]) => [fg, bg, 'card']));
  const condicionais = [];
  const junta = (seletor) => {
    let acumulado = {};
    for (const b of blocos(css, seletor)) {
      const v = vars(b.texto);
      if (b.condicional) {
        const tocados = Object.keys(v).filter((t) => medidos.has(t));
        if (tocados.length) condicionais.push({ seletor, tokens: tocados });
        continue;
      }
      acumulado = { ...acumulado, ...v };
    }
    return acumulado;
  };
  const claro = junta(':root');
  const escuro = { ...claro, ...junta('.dark') };
  return { temas: { claro, escuro }, condicionais };
}

export function hslToRgb([h, s, l]) {
  const sat = s / 100, lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  return [0, 8, 4].map((n) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function contrast(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

export function measure(temas, pares = PARES) {
  return pares.flatMap(([label, fgToken, bgToken, alpha]) =>
    Object.entries(temas).map(([theme, v]) => {
      for (const t of [fgToken, bgToken, 'card']) {
        if (!v[t]) throw new Error(`--${t} ausente (${theme})`);
      }
      const card = hslToRgb(v.card);
      const bg = hslToRgb(v[bgToken]).map((c, i) => c * alpha + card[i] * (1 - alpha));
      return { label, theme, ratio: contrast(hslToRgb(v[fgToken]), bg) };
    }),
  );
}

/**
 * Receitas de `variant: { nome: "classes" }` de um componente cva.
 *
 * Mede o que o componente realmente pinta: `text-<token>` sobre
 * `bg-<token>[/<alpha>]`. Variante sem fundo próprio (ghost, link, outline) é
 * medida sobre `--card`. Variante de gradiente é devolvida com `motivo` em vez
 * de medida: duas cores interpoladas não têm razão de contraste única.
 */
export function parseReceitas(source, arquivo) {
  const varBloco = source.match(/variant:\s*\{([\s\S]*?)\n {6}\}/);
  if (!varBloco) throw new Error(`bloco variant não encontrado em ${arquivo}`);
  const entradas = [
    ...varBloco[1].matchAll(/["']?([a-zA-Z][\w-]*)["']?:\s*((?:"[^"]*"|\s|\+)+)/g),
  ];
  if (entradas.length === 0) throw new Error(`nenhuma variante lida em ${arquivo}`);

  return entradas.map(([, nome, bruto]) => {
    const classes = [...bruto.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join(' ');
    const base = { arquivo, nome, classes };
    if (/\bbg-gradient-to-/.test(classes)) {
      return { ...base, motivo: 'gradiente: sem razão de contraste única' };
    }
    const texto = classes.match(/(?:^|\s)text-([a-z][a-z0-9-]*)(?=\s|$)/);
    if (!texto) return { ...base, motivo: 'variante sem token de texto próprio' };
    const fundo = classes.match(/(?:^|\s)bg-([a-z][a-z0-9-]*)(?:\/(\d{1,3}))?(?=\s|$)/);
    if (fundo && fundo[1] === 'transparent') {
      return { ...base, textoToken: texto[1], fundoToken: 'card', alpha: 1 };
    }
    const alpha = fundo?.[2] === undefined ? 1 : Number(fundo[2]) / 100;
    if (alpha < 0 || alpha > 1) throw new Error(`${arquivo}/${nome}: opacidade inválida`);
    return {
      ...base,
      textoToken: texto[1],
      // Sem fundo próprio o componente herda o que estiver atrás: medimos sobre card.
      fundoToken: fundo ? fundo[1] : 'card',
      alpha,
    };
  });
}

export function measureReceitas(temas, receitas) {
  return receitas
    .filter((r) => !r.motivo)
    .flatMap((r) =>
      Object.entries(temas).map(([theme, v]) => {
        for (const t of [r.textoToken, r.fundoToken, 'card']) {
          if (!v[t]) throw new Error(`--${t} ausente (${theme}, ${r.arquivo}/${r.nome})`);
        }
        const card = hslToRgb(v.card);
        const bg = hslToRgb(v[r.fundoToken]).map((c, i) => c * r.alpha + card[i] * (1 - r.alpha));
        const sufixo = r.alpha === 1 ? '' : `/${Math.round(r.alpha * 100)}`;
        return {
          label: `${path.basename(r.arquivo, '.tsx')} ${r.nome} (text-${r.textoToken} / bg-${r.fundoToken}${sufixo})`,
          theme,
          ratio: contrast(hslToRgb(v[r.textoToken]), bg),
        };
      }),
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { temas, condicionais } = parseTemas(readFileSync(TOKENS_CSS, 'utf8'));
  const receitas = [
    ...parseReceitas(readFileSync(BADGE_TSX, 'utf8'), 'src/components/ui/badge.tsx'),
    ...parseReceitas(readFileSync(BUTTON_TSX, 'utf8'), 'src/components/ui/button.tsx'),
  ];
  const rows = [...measure(temas), ...measureReceitas(temas, receitas)];

  console.log('| Par | Tema | Contraste | AA (4.5:1) |\n|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.label} | ${r.theme} | ${r.ratio.toFixed(2)}:1 | ${r.ratio >= AA ? 'ok' : 'FALHA'} |`);
  }

  const naoMedidas = receitas.filter((r) => r.motivo);
  if (naoMedidas.length) {
    console.log('\nVariantes não medidas (e por quê):');
    for (const r of naoMedidas) console.log(`  - ${path.basename(r.arquivo)} ${r.nome}: ${r.motivo}`);
  }
  if (condicionais.length) {
    console.log('\nATENÇÃO: token medido redefinido dentro de @media:');
    for (const c of condicionais) console.log(`  - ${c.seletor}: ${c.tokens.join(', ')}`);
  }

  const fails = rows.filter((r) => r.ratio < AA);
  console.log(`\n${fails.length} par(es) abaixo de ${AA}:1 de ${rows.length} medidos`);
  if (process.argv.includes('--check') && fails.length > 0) process.exit(1);
}
