import { test, expect } from '@playwright/test';
import { ensureSignedOut } from './helpers/auth';

/**
 * Fluxo de recuperação/redefinição de senha.
 *
 * Cobertura de segurança e conformidade:
 *  - A página /reset-password NÃO deve permitir a troca de senha sem uma sessão
 *    válida de recuperação (proteção contra reset não autorizado).
 *  - O formulário de recuperação valida o e-mail no cliente antes de qualquer
 *    chamada ao backend.
 *  - A resposta de "solicitação enviada" não revela se o e-mail existe
 *    (enumeration protection) — a mensagem é genérica.
 */

test.describe('Fluxo de reset de senha', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSignedOut(page);
  });

  test('exibe formulário de recuperação e valida e-mail no cliente', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.getByRole('heading', { name: 'Recuperação de senha' })).toBeVisible();
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();

    // E-mail inválido: a validação de cliente (nativa + Zod) impede o envio
    // e o usuário permanece na página de recuperação.
    await emailInput.fill('nao-e-um-email');
    await page.getByRole('button', { name: /Enviar link de recuperação/i }).click();

    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(isInvalid).toBe(true);
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('confirmação de envio não revela existência da conta', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.locator('#email').fill('usuario-inexistente@example.com');
    await page.getByRole('button', { name: /Enviar link de recuperação/i }).click();

    // Mensagem genérica ("Se existir uma conta...") — não confirma nem nega o e-mail.
    await expect(page.getByText(/Se existir uma conta/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Se existir uma conta/i)).toContainText('usuario-inexistente@example.com');
  });

  test('bloqueia troca de senha sem sessão de recuperação válida', async ({ page }) => {
    await page.goto('/reset-password');

    // Sem sessão de recuperação, o app deve mostrar o estado de link inválido...
    await expect(page.getByText('Link Inválido ou Expirado')).toBeVisible({ timeout: 15_000 });
    // ...e NÃO deve renderizar o formulário de nova senha.
    await expect(page.locator('#password')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Solicitar novo link/i })).toBeVisible();
  });

  test('link inválido redireciona para solicitar novo link', async ({ page }) => {
    await page.goto('/reset-password');
    await page.getByRole('button', { name: /Solicitar novo link/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
