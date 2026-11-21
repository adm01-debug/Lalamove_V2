import { test, expect, type Page } from '@playwright/test';
import { getInjectedSession, restoreSession } from './helpers/auth';

/**
 * Mapa ao vivo — camada `expected-route` (etapa 62).
 *
 * A rota contratada do pedido (`active_tracking.expected_route`) tem de virar a
 * camada `expected-route` do Mapbox. O canvas WebGL não é inspecionável, então o
 * componente expõe `window.__livemap` **apenas em dev** e o teste pergunta à API
 * do mapa se a source/layer existem e se o GeoJSON carrega a polyline esperada.
 *
 * Sem sessão injetada (LOVABLE_BROWSER_SUPABASE_*) o teste é ignorado, como os
 * demais E2E autenticados. Sem MAPBOX_ACCESS_TOKEN no ambiente o mapa não
 * instancia: nesse caso verificamos apenas a degradação graciosa, nunca sucesso.
 */

async function waitForMap(page: Page) {
  return page.waitForFunction(
    () => Boolean((window as unknown as { __livemap?: unknown }).__livemap),
    undefined,
    { timeout: 25_000 },
  );
}

/**
 * As camadas são criadas no handler `style.load` (setupMapLayers), que roda depois
 * de a instância existir. Esperar só pela instância faz o teste ler um mapa ainda
 * sem estilo; aguardamos a camada para exercitar o caminho real.
 */
async function waitForRouteLayer(page: Page) {
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __livemap?: any }).__livemap;
      return Boolean(m?.getLayer?.('expected-route'));
    },
    undefined,
    { timeout: 25_000 },
  );
}

test.describe('LiveMap — camada expected-route', () => {
  const session = getInjectedSession();

  test.skip(!session, 'Sessão Supabase não injetada neste ambiente');

  test('a source e a camada expected-route existem após o style carregar', async ({ page }) => {
    await restoreSession(page, session!);
    await page.goto('/map');

    await waitForMap(page);
    await waitForRouteLayer(page);

    const layer = await page.evaluate(() => {
      const m = (window as unknown as { __livemap?: any }).__livemap;
      if (!m) return null;
      m.resize?.();
      return {
        source: Boolean(m.getSource?.('expected-route')),
        layer: Boolean(m.getLayer?.('expected-route')),
        type: m.getLayer?.('expected-route')?.type ?? null,
        paint: m.getLayer?.('expected-route')?.paint?.['line-width'] ?? null,
        styleLoaded: m.isStyleLoaded?.() ?? null,
      };
    });

    expect(layer, 'o mapa instanciou sem estilo carregado').not.toBeNull();
    expect(layer!.type, 'camada expected-route ausente').toBe('line');
    expect(layer!.source, 'source expected-route ausente').toBe(true);
    expect(layer!.paint, 'largura da linha não aplicada').toBe(4);
  });

  test('o GeoJSON da rota aceita a polyline e vira LineString', async ({ page }) => {
    await restoreSession(page, session!);
    await page.goto('/map');
    await waitForMap(page);
    await waitForRouteLayer(page);

    const geom = await page.evaluate(() => {
      const m = (window as unknown as { __livemap?: any }).__livemap;
      const source = m?.getSource?.('expected-route');
      if (!source) return { ok: false, reason: 'source-ausente' as const };
      // Escreve direto na source para isolar a camada de dados da camada de rede
      // (o fetch de active_tracking depende de dados reais em produção).
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [[-46.63, -23.55], [-46.64, -23.56]],
        },
      });
      const data = m.getSource('expected-route').serialize().data;
      return {
        ok: data.geometry.type === 'LineString',
        reason: null,
        points: data.geometry.coordinates.length,
      };
    });

    expect(geom.reason).toBeNull();
    expect(geom.ok, 'a source não aceitou LineString').toBe(true);
    expect(geom.points).toBe(2);
  });

  test('sem token do Mapbox o mapa degrada com mensagem, não com tela branca', async ({ page }) => {
    await restoreSession(page, session!);
    // Bloqueia o token para exercitar o caminho de degradação real da UI.
    await page.route('**/functions/v1/get-mapbox-token', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
    );
    await page.goto('/map');
    await expect(page.getByText(/Token Mapbox não configurado|Mapa indisponível no momento/)).toBeVisible({
      timeout: 25_000,
    });
  });
});
