import { test, expect, type Page, type Route } from '@playwright/test';
import { ensureSignedOut } from './helpers/auth';

/**
 * Fluxo de bloqueio progressivo de login (lockout v2).
 *
 * Cobertura de segurança:
 *  - Após N tentativas de login falhas, a conta é temporariamente bloqueada
 *    (banner de "Conta temporariamente bloqueada" + inputs desabilitados).
 *  - Enquanto bloqueada, novas tentativas são impedidas no cliente (o botão
 *    "Entrar" fica desabilitado durante a janela de contagem regressiva).
 *  - Quando a janela de tempo configurada expira, o backend passa a reportar
 *    `is_locked = false` e o formulário é reabilitado (o app faz re-check via
 *    `check_login_lockout_v2` ao fim da contagem).
 *
 * Determinismo: interceptamos as chamadas de rede para as RPCs
 * `check_login_lockout_v2` / `record_failed_login_v2` e o endpoint de token do
 * Auth, simulando o backend. Assim o teste roda de forma estável em qualquer
 * ambiente, sem depender do estado real do banco.
 */

const TEST_EMAIL = 'lockout-e2e@example.com';
const TEST_PASSWORD = 'senha-incorreta-123';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 3; // Janela curta para validar a liberação sem esperas longas.

/**
 * Estado mutável compartilhado entre os handlers de rota, simulando a tabela
 * `login_attempts` do backend.
 */
interface LockoutState {
  attempts: number;
  locked: boolean;
  /** Momento (ms epoch) em que o bloqueio expira. */
  lockedUntil: number;
}

/**
 * Instala os interceptadores de rede que emulam o backend de lockout v2.
 * Retorna o estado compartilhado para asserções, se necessário.
 */
async function installLockoutBackend(page: Page): Promise<LockoutState> {
  const state: LockoutState = { attempts: 0, locked: false, lockedUntil: 0 };

  const remainingSeconds = (): number => {
    if (!state.locked) return 0;
    const ms = state.lockedUntil - Date.now();
    if (ms <= 0) {
      // Janela expirou: o backend libera a conta.
      state.locked = false;
      state.attempts = 0;
      return 0;
    }
    return Math.ceil(ms / 1000);
  };

  const jsonRoute = (route: Route, body: unknown) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });

  // check_login_lockout_v2 → status atual do bloqueio.
  await page.route('**/rest/v1/rpc/check_login_lockout_v2', (route) =>
    jsonRoute(route, [
      {
        is_locked: state.locked && remainingSeconds() > 0,
        remaining_seconds: remainingSeconds(),
        attempt_count: state.attempts,
      },
    ]),
  );

  // record_failed_login_v2 → incrementa e bloqueia ao atingir o limite.
  await page.route('**/rest/v1/rpc/record_failed_login_v2', (route) => {
    state.attempts += 1;
    if (state.attempts >= MAX_ATTEMPTS) {
      state.locked = true;
      state.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
    }
    return jsonRoute(route, [
      {
        is_locked: state.locked,
        lockout_seconds: state.locked ? remainingSeconds() : 0,
        attempt_count: state.attempts,
      },
    ]);
  });

  // clear_login_attempts → reset (login bem-sucedido).
  await page.route('**/rest/v1/rpc/clear_login_attempts', (route) => {
    state.attempts = 0;
    state.locked = false;
    state.lockedUntil = 0;
    return jsonRoute(route, null);
  });

  // Auth token: sempre falha (credenciais inválidas) para acionar o lockout.
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid login credentials',
        msg: 'Invalid login credentials',
      }),
    }),
  );

  return state;
}

async function fillAndSubmitLogin(page: Page): Promise<void> {
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test.describe('Fluxo de bloqueio de login (lockout v2)', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSignedOut(page);
  });

  test('bloqueia a conta após atingir o limite de tentativas falhas', async ({ page }) => {
    await installLockoutBackend(page);
    await page.goto('/auth');

    await expect(page.getByLabel('Email')).toBeVisible();

    // Realiza MAX_ATTEMPTS tentativas de login com credenciais inválidas.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await fillAndSubmitLogin(page);
      // Aguarda o app processar a resposta antes da próxima tentativa.
      await page.waitForTimeout(300);
    }

    // O banner de conta bloqueada deve aparecer.
    await expect(
      page.getByText('Conta temporariamente bloqueada'),
    ).toBeVisible({ timeout: 10_000 });

    // Os inputs e o botão devem estar desabilitados durante o bloqueio.
    await expect(page.getByLabel('Email')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
  });

  test('libera a conta após expirar a janela de tempo configurada', async ({ page }) => {
    await installLockoutBackend(page);
    await page.goto('/auth');

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await fillAndSubmitLogin(page);
      await page.waitForTimeout(300);
    }

    await expect(
      page.getByText('Conta temporariamente bloqueada'),
    ).toBeVisible({ timeout: 10_000 });

    // Aguarda a janela de lockout expirar; o countdown do app dispara um
    // re-check via check_login_lockout_v2 que agora retorna is_locked=false.
    await expect(page.getByLabel('Email')).toBeEnabled({
      timeout: (LOCKOUT_SECONDS + 5) * 1000,
    });
    await expect(
      page.getByRole('button', { name: 'Entrar', exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText('Conta temporariamente bloqueada'),
    ).toHaveCount(0);
  });
});
