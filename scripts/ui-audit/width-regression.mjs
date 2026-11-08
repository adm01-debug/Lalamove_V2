#!/usr/bin/env node
/**
 * width-regression.mjs — regressão de largura das páginas do AppLayout.
 *
 * Verifica, em cada rota, que (a) nada transborda o viewport horizontalmente e
 * (b) o conteúdo OCUPA o `main` — `main.clientWidth - content.clientWidth > 1`
 * reprova (faixa morta). Mede a 1280x800 e a 1920x1080.
 *
 * Portado do Zapp Web V2 e adaptado:
 *   - rotas reais deste repo (react-router com path, não hash `#view`);
 *   - porta 8080, a mesma do `vite` e do `playwright.config.ts:10`;
 *   - o `main` daqui é `#main-content` (src/components/layout/AppLayout.tsx:321),
 *     coberto pelo seletor `main, [role="main"]`.
 *
 * O predicado vive em ./width-check.mjs e é provado sem navegador por
 * ./width-check.unit.mjs; aqui só se coletam as medições no DOM.
 *
 * Ferramenta local. As páginas exigem sessão: sem estado autenticado toda rota
 * cai em /auth e a medição não vale nada — por isso STORAGE_STATE é obrigatório:
 *
 *   npx playwright open --save-storage=.auth/state.json http://localhost:8080
 *   STORAGE_STATE=.auth/state.json node scripts/ui-audit/width-regression.mjs
 *
 * Exit 0 = nenhum overflow e nenhuma faixa morta. Exit 1 = problema detectado.
 * Exit 2 = entrada inválida (sem STORAGE_STATE).
 *
 * O módulo não executa nada ao ser importado; `main()` só roda quando o arquivo
 * é o entrypoint.
 */

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { avaliarLargura } from './width-check.mjs';

export const BASE_URL = process.env.APP_URL || `http://localhost:${process.env.VITE_PORT || 8080}`;

// 1280x800 é o viewport padrão do e2e (playwright.config.ts:30 usa 1280x900);
// 1920x1080 expõe faixa morta que só aparece quando sobra largura.
export const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];

/**
 * Rotas medidas: as de maior tráfego do AppLayout, cobrindo os três formatos de
 * página do repo (grade de cards, dashboard de métricas e formulário).
 * `/map` e `/heatmap` ficam de fora de propósito: são tela cheia e não seguem o
 * contrato de gutter (mesma exceção de scripts/ui-audit/layout-guard.mjs).
 */
export const ROTAS = [
  '/dashboard',
  '/orders',
  '/drivers',
  '/contacts',
  '/approvals',
  '/incidents',
  '/metrics',
  '/alerts',
  '/reports',
  '/settings',
];

/**
 * Mede uma rota: overflow do documento e ocupação do main pelo conteúdo.
 * A decisão fica no predicado puro `avaliarLargura`.
 */
export async function medirLargura(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  // Espera o lazy chunk da página montar.
  await page.waitForTimeout(500);

  // Sem sessão válida a rota cai em /auth e mediríamos a tela de login.
  if (new URL(page.url()).pathname.startsWith('/auth')) {
    throw new Error('redirecionado para /auth — STORAGE_STATE expirado ou invalido');
  }

  const medicao = await page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const docScrollWidth = document.documentElement.scrollWidth;

    const main = document.querySelector('main, [role="main"]');
    let mainWidth = null;
    let contentWidth = null;
    if (main) {
      mainWidth = main.clientWidth;
      // Conteúdo = a faixa que deve preencher o main: o filho direto mais largo
      // que participa do fluxo (overlays fixos/absolutos não contam).
      const filhos = Array.from(main.children).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.position !== 'fixed' && cs.position !== 'absolute' && el.clientWidth > 0;
      });
      if (filhos.length) contentWidth = Math.max(...filhos.map((el) => el.clientWidth));
    }

    // Culpados do overflow (só quando há overflow)
    const offenders = [];
    if (docScrollWidth > innerWidth) {
      for (const el of document.querySelectorAll('*')) {
        const rect = el.getBoundingClientRect();
        if (rect.right > innerWidth + 1) {
          offenders.push({
            tag: el.tagName,
            id: el.id || '',
            classes: el.className.toString().slice(0, 80),
            right: Math.round(rect.right),
          });
          if (offenders.length >= 5) break;
        }
      }
    }

    return { innerWidth, docScrollWidth, mainWidth, contentWidth, offenders };
  });

  return { ...medicao, resultado: avaliarLargura(medicao) };
}

/**
 * `chromium` do playwright, de onde ele estiver.
 *
 * O `import()` de ESM resolve só por node_modules do projeto e ignora NODE_PATH;
 * em ambiente onde o playwright está instalado fora do repo (container de
 * agente, instalação global) só o `require` o encontra. Tenta os dois antes de
 * desistir — sem isso o script dizia "playwright nao disponivel" com o pacote
 * instalado e a medição nunca rodava.
 */
async function carregarChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch { /* tenta o resolvedor CJS abaixo */ }
  try {
    const { createRequire } = await import('node:module');
    return createRequire(import.meta.url)('playwright').chromium;
  } catch {
    return null;
  }
}

export async function main() {
  const chromium = await carregarChromium();
  if (!chromium) {
    console.error('playwright nao disponivel — este script e uma ferramenta local.');
    console.error('  npx playwright install chromium');
    process.exit(2);
  }

  const STORAGE_STATE = process.env.STORAGE_STATE;
  if (!STORAGE_STATE || !existsSync(STORAGE_STATE)) {
    console.error('STORAGE_STATE ausente ou inexistente. As paginas exigem sessao;');
    console.error('sem ela toda rota cai em /auth e a medicao nao vale nada.');
    console.error('  npx playwright open --save-storage=.auth/state.json ' + BASE_URL);
    console.error('  STORAGE_STATE=.auth/state.json node scripts/ui-audit/width-regression.mjs');
    process.exit(2);
  }

  const browser = await chromium.launch();

  let failures = 0;
  let medidas = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, storageState: STORAGE_STATE });
    const page = await context.newPage();
    const label = `${viewport.width}x${viewport.height}`;

    for (const rota of ROTAS) {
      const url = BASE_URL + rota;
      try {
        const { innerWidth, docScrollWidth, mainWidth, contentWidth, offenders, resultado } =
          await medirLargura(page, url);
        medidas++;

        if (resultado.overflow) {
          console.error(`OVERFLOW [${label}] ${rota}`);
          console.error(`  doc=${docScrollWidth}px viewport=${innerWidth}px (+${docScrollWidth - innerWidth}px)`);
          for (const o of offenders) {
            console.error(`  <${o.tag} id="${o.id}" class="${o.classes}"> right=${o.right}px`);
          }
          console.error();
          failures++;
        }

        if (resultado.faixaMorta) {
          console.error(`FAIXA MORTA [${label}] ${rota}`);
          console.error(
            `  main=${mainWidth}px content=${contentWidth}px (sobra ${resultado.diferenca}px; tolerancia 1px)`,
          );
          console.error();
          failures++;
        }

        if (!resultado.overflow && !resultado.faixaMorta) {
          console.log(`✓ [${label}] ${rota}`);
        }
      } catch (err) {
        console.error(`ERROR [${label}] ${rota}: ${err.message}`);
        failures++;
      }
    }

    await context.close();
  }

  await browser.close();

  if (failures === 0) {
    console.log(`\n✓ width-regression: 0 overflows / 0 faixas mortas em ${medidas} medicoes`);
    process.exit(0);
  } else {
    console.error(`\n✗ width-regression: ${failures} medicao(oes) reprovada(s)`);
    process.exit(1);
  }
}

// Só executa quando o arquivo é o entrypoint (importável pelo teste sem efeitos).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
