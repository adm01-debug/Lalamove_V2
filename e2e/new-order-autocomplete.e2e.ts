import { test, expect, type Page, type Route } from '@playwright/test';
import { getInjectedSession, restoreSession } from './helpers/auth';

/**
 * Criar pedido com autocomplete → coordenadas preenchidas (etapa 84).
 *
 * A UI do `NewOrderDialog` não exibe a coordenada escolhida — ela só existe em
 * estado (`pickupGeo`/`deliveryGeo`) e vira `stops[i].coordinates` no corpo da cotação.
 * Verificar "coordenadas preenchidas" por seletor seria impossível, então este teste
 * intercepta o POST da edge `lalamove-api` e inspeciona o corpo real: é a única
 * evidência honesta de que a coordenada do autocomplete chegou ao backend.
 *
 * Fluxo exercitado de ponta a ponta:
 *  1. geocodifica dois endereços pelo `geo-gateway` real (autocomplete → place-details),
 *     que é o mesmo par de chamadas feito ao clicar numa sugestão;
 *  2. preenche o formulário e digita o endereço no campo de coleta, escolhendo a
 *     sugestão na lista — o caminho do usuário, não um `setState` artificial;
 *  3. clica "Obter Cotação" e confere que o `coordinates` da coleta é o ponto do
 *     provedor, nunca ausente e nunca `0,0` (placeholder que a Lalamove rejeita).
 *
 * Sem sessão injetada (LOVABLE_BROWSER_SUPABASE_*) o teste é ignorado, como os
 * demais E2E autenticados.
 */

const PICKUP_ADDRESS = 'Rua XV de Novembro 1000, Curitiba';
const DELIVERY_ADDRESS = 'Avenida Paulista 1578, Sao Paulo';

interface GeoPoint {
  formatted: string;
  lat: number;
  lng: number;
}

/** Resolve um endereço pelo gateway real, com o cliente autenticado da página. */
async function resolveAddress(page: Page, input: string): Promise<GeoPoint | null> {
  return page.evaluate(async (text) => {
    const mod = await import('/src/lib/geo-gateway.ts');
    const suggestions = (await mod.callGeo({
      action: 'autocomplete',
      input: text,
      session_token: crypto.randomUUID(),
      country: 'br',
      language: 'pt',
      limit: 5,
    })) as Array<{ id: string }>;
    if (!suggestions.length) return null;
    const details = (await mod.callGeo({
      action: 'place-details',
      place_id: suggestions[0].id,
      session_token: crypto.randomUUID(),
    })) as { formatted?: string; location?: { lat: number; lng: number } | null };
    if (!details?.location) return null;
    return { formatted: details.formatted ?? text, lat: details.location.lat, lng: details.location.lng };
  }, input);
}

/** Corpo capturado da última cotação enviada para a edge. */
interface CapturedQuotation {
  stops?: Array<{ address?: string; coordinates?: { lat?: string; lng?: string } }>;
}

test.describe('Novo pedido — autocomplete preenche a coordenada da cotação', () => {
  const session = getInjectedSession();
  test.skip(!session, 'Sessão Supabase não injetada neste ambiente');

  test('a coordenada escolhida no autocomplete chega ao corpo da cotação', async ({ page }) => {
    await restoreSession(page, session!);
    await page.goto('/orders');

    const pickup = await resolveAddress(page, PICKUP_ADDRESS);
    const delivery = await resolveAddress(page, DELIVERY_ADDRESS);
    test.skip(!pickup || !delivery, 'O gateway não devolveu coordenada para os endereços de teste');

    const captured: CapturedQuotation[] = [];
    await page.route('**/functions/v1/lalamove-api', async (route: Route) => {
      const body = route.request().postDataJSON() as { action?: string } & CapturedQuotation;
      if (body?.action === 'quotation') {
        captured.push(body);
        // Não chamamos a Lalamove: a cotação real custa dinheiro e depende de
        // serviço ativo na praça. Devolvemos o mesmo contrato mínimo da edge
        // (`quotationId` + `stops[].stopId` + `priceBreakdown`) para o diálogo
        // seguir para o passo "quoted".
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              quotationId: 'e2e-quotation',
              expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
              priceBreakdown: { total: '10.00', currency: 'BRL' },
              stops: [
                { stopId: 's1', coordinates: { lat: String(pickup!.lat), lng: String(pickup!.lng) } },
                { stopId: 's2', coordinates: { lat: String(delivery!.lat), lng: String(delivery!.lng) } },
              ],
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByRole('button', { name: /Novo Pedido/u }).click();

    await page.getByPlaceholder('Nome do remetente').fill('Remetente E2E');
    await page.getByPlaceholder('(11) 99999-9999').first().fill('11999999999');
    await page.getByPlaceholder('Nome do destinatário').fill('Destinatário E2E');
    await page.getByPlaceholder('(11) 99999-9999').last().fill('11988888888');

    // Coleta: digita e escolhe a sugestão real (é ela que carrega a coordenada).
    const pickupField = page.getByPlaceholder('Endereço de coleta');
    await pickupField.fill(PICKUP_ADDRESS);
    const pickupOption = page.getByRole('option').first();
    await expect(pickupOption).toBeVisible({ timeout: 20_000 });
    await pickupOption.click();
    await expect(pickupField).not.toHaveValue(PICKUP_ADDRESS);

    // Entrega: a coordenada vem do mesmo caminho.
    const deliveryField = page.getByPlaceholder('Endereço de entrega');
    await deliveryField.fill(DELIVERY_ADDRESS);
    const deliveryOption = page.getByRole('option').first();
    await expect(deliveryOption).toBeVisible({ timeout: 20_000 });
    await deliveryOption.click();

    await page.getByRole('button', { name: /Obter Cotação/u }).click();
    await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(0);

    const stops = captured.at(-1)?.stops ?? [];
    expect(stops.length, 'a cotação tem de levar duas paradas').toBe(2);

    // A prova do trabalho: a coordenada existe, não é o placeholder 0,0 e é a do provedor.
    for (const [index, stop] of stops.entries()) {
      expect(stop.address, `parada ${index} sem endereço`).toBeTruthy();
      expect(stop.coordinates, `parada ${index} sem coordenada — o autocomplete não propagou o ponto`).toBeTruthy();
      const lat = Number(stop.coordinates!.lat);
      const lng = Number(stop.coordinates!.lng);
      expect(Number.isFinite(lat) && Number.isFinite(lng)).toBe(true);
      expect(Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01, `parada ${index} enviou 0,0`).toBe(true);
    }

    const [pickupStop, deliveryStop] = stops;
    expect(Number(pickupStop.coordinates!.lat)).toBeCloseTo(pickup!.lat, 5);
    expect(Number(pickupStop.coordinates!.lng)).toBeCloseTo(pickup!.lng, 5);
    expect(Number(deliveryStop.coordinates!.lat)).toBeCloseTo(delivery!.lat, 5);
    expect(Number(deliveryStop.coordinates!.lng)).toBeCloseTo(delivery!.lng, 5);
  });
});
