import { lazy, type LazyExoticComponent, type ComponentType } from 'react';

/**
 * Item 57 — retry de chunk após deploy.
 * Se o `import()` falhar (ex.: chunk antigo após um deploy, ChunkLoadError),
 * marca uma flag na sessão e recarrega a página uma única vez. Em recarregamentos
 * subsequentes a flag é limpa, então a aplicação não entra em loop.
 */

const RETRY_FLAG = 'lazy-retry-flag';

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (sessionStorage.getItem(RETRY_FLAG) === '1') {
        // Já tentamos recarregar uma vez — não entra em loop, deixa o ErrorBoundary agir.
        sessionStorage.removeItem(RETRY_FLAG);
        throw err;
      }
      sessionStorage.setItem(RETRY_FLAG, '1');
      window.location.reload();
      // Nunca chega aqui (reload), mas o TypeScript exige um retorno.
      return { default: (() => null) as unknown as T };
    }
  });
}
