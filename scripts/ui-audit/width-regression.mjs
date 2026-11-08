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
 * Exit 2 = entrada inválida (sem STORAGE_STATE) ou Chromium indisponível.
 *
 * `CHROMIUM_PATH` força o binário do navegador quando o do Playwright não casa
 * com a revisão que o pacote espera.
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
    const overflowInterno = [];
    let mainWidth = null;
    let contentWidth = null;
    let containerMedido = null;
    if (main) {
      /** Filhos que participam do fluxo (overlay fixo/absoluto não ocupa faixa). */
      const emFluxo = (el) => Array.from(el.children).filter((filho) => {
        const cs = getComputedStyle(filho);
        return cs.position !== 'fixed' && cs.position !== 'absolute' && filho.clientWidth > 0;
      });
      /** Largura que os filhos têm de preencher: clientWidth menos o padding do container. */
      const larguraUtil = (el) => {
        const cs = getComputedStyle(el);
        return el.clientWidth - Number.parseFloat(cs.paddingLeft || 0) - Number.parseFloat(cs.paddingRight || 0);
      };

      // Desce pelos wrappers de passagem. O shell insere um wrapper de animação
      // entre o <main> e a página (src/components/layout/AppLayout.tsx:327, o
      // `motion.div min-h-full`): ele é um div de bloco, portanto SEMPRE tem a
      // largura do main. Medir o filho direto do main compararia esse wrapper
      // consigo mesmo e a faixa morta nunca apareceria. Então, enquanto o
      // container tiver exatamente um filho em fluxo que já preenche a largura
      // útil, esse filho passa a ser o container — e o padding dele conta.
      let container = main;
      for (let i = 0; i < 10; i += 1) {
        const filhos = emFluxo(container);
        if (filhos.length !== 1) break;
        if (Math.abs(filhos[0].clientWidth - larguraUtil(container)) > 1) break;
        // Nao desce para folha: sem filhos nao haveria conteudo para comparar e
        // a medicao voltaria contentWidth=null.
        if (emFluxo(filhos[0]).length === 0) break;
        container = filhos[0];
      }

      mainWidth = larguraUtil(container);
      containerMedido = `${container.tagName.toLowerCase()}${container.id ? `#${container.id}` : ''}.${container.className.toString().split(/\s+/).slice(0, 3).join('.')}`;
      const filhos = emFluxo(container);
      if (filhos.length) contentWidth = Math.max(...filhos.map((el) => el.clientWidth));

      // Overflow DENTRO do container de scroll. O <main> daqui e
      // `overflow-y-auto` (AppLayout.tsx:322), entao conteudo largo faz o MAIN
      // rolar na horizontal sem que document.scrollWidth passe do viewport —
      // o predicado de documento, sozinho, nao ve esse caso.
      for (const el of new Set([main, container])) {
        if (el.scrollWidth > el.clientWidth + 1) {
          overflowInterno.push({
            onde: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          });
        }
      }
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

    return { innerWidth, docScrollWidth, mainWidth, contentWidth, containerMedido, overflowInterno, offenders };
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

  // CHROMIUM_PATH: escape para ambiente onde o binario do Playwright nao casa
  // com a revisao esperada pelo pacote (foi o caso no container desta porta).
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });

  let failures = 0;
  let medidas = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, storageState: STORAGE_STATE });
    const page = await context.newPage();
    const label = `${viewport.width}x${viewport.height}`;

    for (const rota of ROTAS) {
      const url = BASE_URL + rota;
      try {
        const { innerWidth, docScrollWidth, mainWidth, contentWidth, containerMedido, overflowInterno, offenders, resultado } =
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
            `  container=${containerMedido} util=${mainWidth}px content=${contentWidth}px (sobra ${resultado.diferenca}px; tolerancia 1px)`,
          );
          console.error();
          failures++;
        }

        for (const o of overflowInterno) {
          console.error(`OVERFLOW INTERNO [${label}] ${rota}`);
          console.error(`  <${o.onde}> scrollWidth=${o.scrollWidth}px clientWidth=${o.clientWidth}px (+${o.scrollWidth - o.clientWidth}px)`);
          console.error();
          failures++;
        }

        if (!resultado.overflow && !resultado.faixaMorta && overflowInterno.length === 0) {
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
