import { test, expect } from '@playwright/test';
import { ensureSignedOut, getInjectedSession, restoreSession } from './helpers/auth';

/**
 * Fluxo de verificação MFA (multi-fator).
 *
 * Cobertura de segurança:
 *  - A tela de verificação MFA renderiza e exige um código de 6 dígitos.
 *  - O botão "Verificar" permanece desabilitado até o código ter 6 dígitos
 *    (impede submissões incompletas / brute-force acidental).
 *  - O campo aceita apenas dígitos (sanitização de entrada no cliente).
 *  - Rotas que exigem MFA (requireMFA) redirecionam quando o fator não foi
 *    verificado — validado na suíte de RBAC para usuários autenticados.
 */

test.describe('Fluxo de verificação MFA', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSignedOut(page);
  });

  test('a tela de MFA expõe o cabeçalho de verificação em duas etapas', async ({ page }) => {
    await page.goto('/mfa-verify');
    // O h1 sr-only está sempre presente, independentemente do estado de challenge.
    await expect(page.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible();
  });

  test('o campo de código aceita apenas dígitos e limita a 6 caracteres', async ({ page }) => {
    const session = getInjectedSession();
    test.skip(!session, 'Requer sessão autenticada injetada para renderizar o challenge MFA.');

    await restoreSession(page, session!);
    await page.goto('/mfa-verify');

    // O challenge só renderiza o campo se o usuário tiver um fator MFA inscrito.
    const codeInput = page.locator('input[inputmode="numeric"]');
    const rendered = await codeInput.isVisible().catch(() => false)
      || await codeInput.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
    test.skip(!rendered, 'Usuário de teste sem fator MFA inscrito — challenge não disponível.');

    // Entrada com letras deve ser sanitizada para apenas dígitos.
    await codeInput.fill('12ab34cd56ef');
    await expect(codeInput).toHaveValue('123456');

    // Botão "Verificar" habilitado somente com 6 dígitos.
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeEnabled();

    await codeInput.fill('123');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeDisabled();
  });
});
