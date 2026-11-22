import { test, expect, type Page } from '@playwright/test';
import { getInjectedSession, restoreSession } from './helpers/auth';

/**
 * Autocomplete de endereço — round-trip real `autocomplete` → `place-details` (etapa 85).
 *
 * Protege a regressão mais cara já encontrada neste recurso: o contrato limitava
 * `place_id` a 200 caracteres, mas os `mapbox_id` reais do Search Box/Geocoding v6
 * variam com o tamanho do endereço — 70 chars em SP (POI/rodovia) e até 574 em
 * Curitiba/Goiânia. Com `max(200)` o retrieve fora de SP falhava em 422 e a seleção
 * no autocomplete nunca gravava coordenada, silenciosamente.
 *
 * O teste não usa fixture: pega uma sugestão REAL do gateway e faz o retrieve dela,
 * que é exatamente o caminho do usuário. Roda dentro do app autenticado para usar o
 * cliente Supabase da sessão (`callGeo`), não uma chave injetada à parte.
 */

/** Endereços onde o `mapbox_id` comprovadamente passa de 200 chars (medido em produção). */
const LONG_ID_ADDRESSES = [
  'Rua XV de Novembro 1000, Curitiba',
  'Avenida Goias 500, Goiania',
  'Avenida Paulista 1578, Sao Paulo',
];

interface Suggestion {
  id: string;
  main_text: string;
  secondary_text: string;
  type?: string;
  provider?: string;
}

async function suggestFor(page: Page, input: string): Promise<Suggestion[]> {
  return page.evaluate(async (text) => {
    const mod = await import('/src/lib/geo-gateway.ts');
    const sessionToken = crypto.randomUUID();
    return (await mod.callGeo({
      action: 'autocomplete',
      input: text,
      session_token: sessionToken,
      country: 'br',
      language: 'pt',
      limit: 5,
    })) as Suggestion[];
  }, input);
}

test.describe('Autocomplete — retrieve do mapbox_id', () => {
  const session = getInjectedSession();
  test.skip(!session, 'Sessão Supabase não injetada neste ambiente');

  test('sugestões reais expõem id utilizável e o retrieve devolve coordenada', async ({ page }) => {
    await restoreSession(page, session!);
    await page.goto('/map');

    let suggestions: Suggestion[] = [];
    let usedInput = '';
    for (const address of LONG_ID_ADDRESSES) {
      const found = await suggestFor(page, address);
      if (found.length > 0) {
        suggestions = found;
        usedInput = address;
        break;
      }
    }

    expect(suggestions.length, 'nenhum endereço de teste retornou sugestão').toBeGreaterThan(0);
    expect(suggestions[0].id, 'sugestão sem id').toBeTruthy();
    expect(usedInput).toBeTruthy();

    // O retrieve real da primeira sugestão tem de funcionar — é aqui que o
    // `max(200)` antigo quebrava para ids longos fora de SP.
    const details = await page.evaluate(async (placeId) => {
      const mod = await import('/src/lib/geo-gateway.ts');
      return (await mod.callGeo({
        action: 'place-details',
        place_id: placeId,
        session_token: crypto.randomUUID(),
      })) as { formatted?: string; location?: { lat: number; lng: number } | null };
    }, suggestions[0].id);

    expect(details.formatted, 'retrieve sem endereço formatado').toBeTruthy();
    expect(details.location, 'retrieve sem coordenada — seleção não gravaria ponto').not.toBeNull();
    expect(Number.isFinite(details.location!.lat)).toBe(true);
    expect(Number.isFinite(details.location!.lng)).toBe(true);
    // Coordenada 0,0 é o fallback que colocava a entrega no Golfo da Guiné.
    expect(Math.abs(details.location!.lat) + Math.abs(details.location!.lng)).toBeGreaterThan(0);
  });

  test('place_id acima de 1024 é rejeitado com validação, não com erro de rede', async ({ page }) => {
    await restoreSession(page, session!);
    await page.goto('/map');

    const outcome = await page.evaluate(async () => {
      const mod = await import('/src/lib/geo-gateway.ts');
      try {
        await mod.callGeo({ action: 'place-details', place_id: 'x'.repeat(1100) });
        return { threw: false, code: null as string | null };
      } catch (error) {
        const e = error as { code?: string };
        return { threw: true, code: e.code ?? null };
      }
    });

    expect(outcome.threw, 'id acima do limite deveria falhar').toBe(true);
    expect(outcome.code, 'esperava erro de contrato (VALIDATION_FAILED)').toBe('VALIDATION_FAILED');
  });
});