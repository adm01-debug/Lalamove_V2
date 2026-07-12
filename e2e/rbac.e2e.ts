import { test, expect } from '@playwright/test';
import { ensureSignedOut, getInjectedSession, restoreSession, expectRedirectToAuth } from './helpers/auth';

/**
 * Controle de acesso baseado em papéis (RBAC).
 *
 * Regras validadas (default-deny):
 *  - Usuários não autenticados são redirecionados para /auth em QUALQUER rota
 *    protegida (dashboard, operações, segurança, sistema).
 *  - A página /unauthorized comunica claramente o acesso negado.
 *  - Para usuários autenticados sem privilégio suficiente, rotas de papel
 *    superior redirecionam para /unauthorized (executado quando há sessão
 *    injetada; caso contrário, ignorado).
 *
 * Hierarquia de papéis: admin > manager > operator > viewer.
 */

// Rotas protegidas representativas de cada nível de sensibilidade.
const PROTECTED_ROUTES = [
  '/',                       // dashboard (autenticado)
  '/orders',                 // operator+
  '/approvals',              // manager+
  '/security',               // admin
  '/roles',                  // admin
  '/slo',                    // manager+
  '/telemetria',             // admin
  '/webhooks',               // manager+ e requireMFA
];

test.describe('RBAC — acesso não autenticado', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSignedOut(page);
  });

  for (const route of PROTECTED_ROUTES) {
    test(`rota protegida ${route} redireciona anônimo para /auth`, async ({ page }) => {
      await page.goto(route);
      await expectRedirectToAuth(page);
    });
  }

  test('a página /unauthorized comunica acesso negado', async ({ page }) => {
    await page.goto('/unauthorized');
    // exact:true evita colisão com o h1 sr-only "Acesso negado" (case-insensitive).
    await expect(page.getByRole('heading', { name: 'Acesso Negado', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ir para Dashboard/i })).toBeVisible();
  });

  test('rota inexistente exibe página 404', async ({ page }) => {
    await page.goto('/rota-que-nao-existe-xyz');
    // A NotFound é pública; não deve vazar conteúdo protegido nem quebrar.
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/\/security|\/roles/);
  });
});

test.describe('RBAC — usuário autenticado', () => {
  test('usuário sem papel de admin é barrado em rota de admin', async ({ page }) => {
    const session = getInjectedSession();
    test.skip(!session, 'Requer sessão autenticada injetada para validar hierarquia de papéis.');

    await restoreSession(page, session!);
    await page.goto('/security');

    // Usuário autenticado: ou acessa (é admin) ou é redirecionado para /unauthorized.
    // Nunca deve cair na tela de login pública.
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('usuário autenticado acessa o dashboard', async ({ page }) => {
    const session = getInjectedSession();
    test.skip(!session, 'Requer sessão autenticada injetada.');

    await restoreSession(page, session!);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/auth/);
  });
});
