import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Etapa 49 — menu alinhado às rotas.
 * Todo item de menu aponta para uma rota cujo `requiredRole` é igual ou mais
 * restritivo que o do menu. Se o menu exibe um link para uma rota que exige um
 * papel maior, o operador/viewer veria um item que leva a `/unauthorized`.
 */

const APP_PATH = 'src/App.tsx';
const SIDEBAR_PATH = 'src/components/layout/sidebar-config.ts';

const ROLE_LEVEL: Record<string, number> = { viewer: 1, operator: 2, manager: 3, admin: 4 };

function roleLevel(role: string | undefined | null): number {
  if (!role) return 0;
  return ROLE_LEVEL[role] ?? 0;
}

describe('menu do sidebar × rotas do App (etapa 49)', () => {
  it('todo item de menu aponta para uma rota existente no App', () => {
    const app = readFileSync(join(process.cwd(), APP_PATH), 'utf-8');
    const routePaths = [...app.matchAll(/path="([^"]+)"/g)].map(m => m[1]);

    const sidebar = readFileSync(join(process.cwd(), SIDEBAR_PATH), 'utf-8');
    const menuPaths = [...sidebar.matchAll(/path:\s*'([^']+)'/g)].map(m => m[1]);

    for (const menuPath of menuPaths) {
      expect(
        routePaths.includes(menuPath) ||
        routePaths.some(p => p.startsWith(menuPath) || menuPath.startsWith(p)),
        `Item de menu "${menuPath}" não tem rota correspondente no App`,
      ).toBe(true);
    }
  });

  it('itens de menu não exibem link para rota que exige papel maior (sem /unauthorized)', () => {
    const app = readFileSync(join(process.cwd(), APP_PATH), 'utf-8');

    // Extrai path -> requiredRole das rotas do App.
    const routeRoles: Record<string, string> = {};
    const routeBlock = /<Route\s+path="([^"]+)"\s+element=\{<ProtectedRoute([^>]*)>[\s\S]*?<\/ProtectedRoute>\}/g;
    for (const m of app.matchAll(routeBlock)) {
      const path = m[1];
      const requiredRole = m[2].match(/requiredRole="([^"]+)"/)?.[1];
      if (requiredRole) routeRoles[path] = requiredRole;
    }

    const sidebar = readFileSync(join(process.cwd(), SIDEBAR_PATH), 'utf-8');

    // O bloco menuCategories, fatiado por categoria (para herdar o
    // requiredRole da categoria nos itens que não o declaram).
    const menuCatBlock = sidebar.match(/export const menuCategories[\s\S]*?\n\];/)?.[0] ?? '';
    // Cada categoria: { label, requiredRole? , items: [ ... ] }
    const categoryBlocks = [...menuCatBlock.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?items:\s*\[([\s\S]*?)\]\s*\}/g)];

    for (const cat of categoryBlocks) {
      const catAttrs = cat[0].slice(0, cat[0].indexOf('items:'));
      const catRole = catAttrs.match(/requiredRole:\s*'([^']+)'/)?.[1];
      const itemsSrc = cat[2];

      const menuItems = [...itemsSrc.matchAll(/\{\s*id:\s*'[^']+'[\s\S]*?path:\s*'([^']+)'([\s\S]*?)\}/g)];
      for (const m of menuItems) {
        const menuPath = m[1];
        const itemAttrs = m[2];
        const itemRole = itemAttrs.match(/requiredRole:\s*'([^']+)'/)?.[1];
        const effectiveRole = itemRole ?? catRole;
        const routeRole = routeRoles[menuPath];

        // O menu é visível para todos. Se a rota exige manager/admin e o item
        // (incluindo herança da categoria) não declara um papel igual ou maior,
        // um viewer/operator veria um link que redireciona para /unauthorized.
        if (routeRole && roleLevel(routeRole) >= ROLE_LEVEL.manager) {
          expect(
            roleLevel(effectiveRole),
            `Item de menu "${menuPath}" exige rota "${routeRole}" mas o menu declara requiredRole "${effectiveRole || '(nenhum)'}" — vazaria /unauthorized`,
          ).toBeGreaterThanOrEqual(roleLevel(routeRole));
        }
      }
    }
  });
});
