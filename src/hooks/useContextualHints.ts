import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useHints, commonHints } from '@/components/ui/contextual-hints';
import { useIsMobile } from './use-mobile';
import { usePermissions, type AppRole } from './usePermissions';

/**
 * Onboarding contextual por role (RBAC).
 * Cada perfil recebe uma dica inicial alinhada às suas responsabilidades e
 * permissões — evitando orientar o usuário para ações que ele não pode executar.
 */
const ROLE_ONBOARDING: Record<AppRole, { title: string; description: string; variant: 'feature' | 'info' | 'tip' | 'warning' }> = {
  admin: {
    title: 'Bem-vindo, Administrador 🛡️',
    description: 'Você tem acesso total: gestão de usuários, roles, segurança e configurações do sistema. Comece pelo painel de Administração.',
    variant: 'feature',
  },
  manager: {
    title: 'Bem-vindo, Gestor 📊',
    description: 'Acompanhe aprovações, avaliações de motoristas e métricas operacionais. Priorize a fila de aprovações pendentes.',
    variant: 'feature',
  },
  operator: {
    title: 'Bem-vindo, Operador 🚚',
    description: 'Monitore entregas e o mapa em tempo real. Dados sensíveis (PII) ficam restritos ao seu perfil.',
    variant: 'info',
  },
  viewer: {
    title: 'Bem-vindo, Visualizador 👁️',
    description: 'Seu acesso é somente leitura. Explore dashboards e relatórios sem risco de alterar dados.',
    variant: 'tip',
  },
};

// Prioridade de exibição quando o usuário acumula múltiplas roles.
const ROLE_PRIORITY: AppRole[] = ['admin', 'manager', 'operator', 'viewer'];


/**
 * Hook that shows contextual hints based on the current page and user context
 */
export function useContextualHints() {
  const location = useLocation();
  const { showHint, isHintDismissed } = useHints();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Small delay to let the page render first
    const timer = setTimeout(() => {
      const path = location.pathname;

      // Dashboard hints
      if (path === '/' || path === '/dashboard') {
        if (!isHintDismissed('dashboard-welcome')) {
          showHint({
            id: 'dashboard-welcome',
            title: 'Bem-vindo ao Dashboard! 👋',
            description: 'Aqui você tem uma visão geral de todas as operações. Clique nos cards para ver mais detalhes.',
            variant: 'feature',
            showOnce: true,
            delay: 1500,
          });
        }

        // Keyboard shortcuts hint (desktop only)
        if (!isMobile && !isHintDismissed('keyboard-shortcuts')) {
          setTimeout(() => {
            showHint({
              ...commonHints.keyboardShortcuts,
              id: 'keyboard-shortcuts',
              delay: 0,
              action: {
                label: 'Ver atalhos',
                onClick: () => {
                  const event = new KeyboardEvent('keydown', { key: '?' });
                  document.dispatchEvent(event);
                },
              },
            });
          }, 5000);
        }
      }

      // Approvals page hints
      if (path === '/approvals') {
        if (isMobile && !isHintDismissed('swipe-approvals')) {
          showHint({
            ...commonHints.swipeToAction,
            id: 'swipe-approvals',
            delay: 1000,
          });
        }

        if (!isHintDismissed('bulk-approvals')) {
          setTimeout(() => {
            showHint({
              ...commonHints.bulkActions,
              id: 'bulk-approvals',
              title: 'Aprovação em lote',
              description: 'Selecione múltiplos motoristas para aprovar ou rejeitar de uma vez.',
              delay: 0,
            });
          }, 3000);
        }
      }

      // Alerts page hints
      if (path === '/alerts') {
        if (isMobile && !isHintDismissed('swipe-alerts')) {
          showHint({
            id: 'swipe-alerts',
            title: 'Deslize para dispensar',
            description: 'Deslize alertas para a direita para dispensar ou esquerda para ver detalhes.',
            variant: 'tip',
            showOnce: true,
            delay: 1000,
          });
        }
      }

      // Drivers page hints
      if (path === '/drivers') {
        if (!isHintDismissed('driver-filters')) {
          showHint({
            ...commonHints.filters,
            id: 'driver-filters',
            title: 'Filtre motoristas',
            description: 'Use os filtros avançados para encontrar motoristas por status, risco ou avaliação.',
            delay: 2000,
          });
        }
      }

      // Map page hints
      if (path === '/map' || path === '/live-map') {
        if (!isHintDismissed('map-realtime')) {
          showHint({
            id: 'map-realtime',
            title: 'Mapa em tempo real',
            description: 'As posições dos motoristas são atualizadas automaticamente. Clique em um marcador para ver detalhes.',
            variant: 'info',
            showOnce: true,
            delay: 1500,
          });
        }
      }

      // Reports page hints
      if (path === '/reports') {
        if (!isHintDismissed('export-reports')) {
          showHint({
            id: 'export-reports',
            title: 'Exporte relatórios',
            description: 'Você pode exportar relatórios em PDF ou Excel clicando nos botões no topo da página.',
            variant: 'tip',
            showOnce: true,
            delay: 2000,
          });
        }
      }

      // Settings page hints
      if (path === '/settings') {
        if (!isHintDismissed('settings-mfa')) {
          showHint({
            id: 'settings-mfa',
            title: 'Segurança recomendada',
            description: 'Ative a autenticação de dois fatores (MFA) para proteger sua conta.',
            variant: 'warning',
            showOnce: true,
            delay: 2000,
          });
        }
      }

    }, 500);

    return () => clearTimeout(timer);
  }, [location.pathname, showHint, isHintDismissed, isMobile]);
}

// Export predefined page-specific hints for manual triggering
export const pageHints = {
  dashboard: {
    quickActions: {
      id: 'quick-actions',
      title: 'Ações Rápidas',
      description: 'Use os atalhos para navegar rapidamente entre as funcionalidades mais usadas.',
      variant: 'tip' as const,
      showOnce: true,
    },
    metrics: {
      id: 'dashboard-metrics',
      title: 'Métricas Interativas',
      description: 'Clique em qualquer card de métrica para ver detalhes completos.',
      variant: 'info' as const,
      showOnce: true,
    },
  },
  approvals: {
    urgency: {
      id: 'approval-urgency',
      title: 'Indicador de Urgência',
      description: 'Cards com borda vermelha indicam aprovações urgentes que precisam de atenção imediata.',
      variant: 'warning' as const,
      showOnce: true,
    },
  },
  orders: {
    search: {
      id: 'orders-search',
      title: 'Busca Avançada',
      description: 'Use Ctrl+K ou ⌘+K para abrir a busca global e encontrar pedidos rapidamente.',
      variant: 'tip' as const,
      showOnce: true,
    },
  },
};
