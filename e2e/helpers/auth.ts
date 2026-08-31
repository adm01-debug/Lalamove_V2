import { Page, expect } from '@playwright/test';

/**
 * Utilitários compartilhados pelos testes E2E de segurança.
 *
 * Autenticação: quando o ambiente injeta uma sessão gerenciada do Supabase
 * (variáveis LOVABLE_BROWSER_SUPABASE_*), restauramos essa sessão no
 * localStorage do app antes de navegar para rotas protegidas. Sem essas
 * variáveis, os testes autenticados são ignorados (test.skip) para manter a
 * suíte determinística em qualquer ambiente.
 */

export interface InjectedSession {
  storageKey: string;
  sessionJson: string;
}

export function getInjectedSession(): InjectedSession | null {
  const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!storageKey || !sessionJson) return null;
  return { storageKey, sessionJson };
}

/**
 * Restaura a sessão gerenciada do Supabase no localStorage da origem do app.
 * Deve ser chamada após navegar para a origem (para que o write caia na origem
 * correta) e antes de acessar rotas protegidas.
 */
export async function restoreSession(page: Page, session: InjectedSession): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [session.storageKey, session.sessionJson] as const,
  );
}

/** Garante que o usuário NÃO está autenticado limpando qualquer storage de auth. */
export async function ensureSignedOut(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-') || key.includes('auth-token')) {
        window.localStorage.removeItem(key);
      }
    }
  });
}

/** Aguarda o app redirecionar para a tela de login pública. */
export async function expectRedirectToAuth(page: Page): Promise<void> {
  await page.waitForURL(/\/auth/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/auth/);
}
