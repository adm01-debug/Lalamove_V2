import { useCallback, useRef } from 'react';

// Map of paths to their lazy import functions
const pageImports: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/DashboardRedesigned'),
  '/dashboard': () => import('@/pages/DashboardRedesigned'),
  '/orders': () => import('@/pages/OrdersPage'),
  '/drivers': () => import('@/pages/DriversPage'),
  '/approvals': () => import('@/pages/ApprovalsPage'),
  '/incidents': () => import('@/pages/IncidentsPage'),
  '/metrics': () => import('@/pages/MetricsPage'),
  '/delivery-metrics': () => import('@/pages/DeliveryMetricsPage'),
  '/alerts': () => import('@/pages/AlertsPage'),
  '/alert-configurations': () => import('@/pages/AlertConfigurationsPage'),
  '/notification-history': () => import('@/pages/NotificationHistoryPage'),
  '/map': () => import('@/pages/LiveMapPage'),
  '/live-map': () => import('@/pages/LiveMapPage'),
  '/heatmap': () => import('@/pages/HeatmapPage'),
  '/sla': () => import('@/pages/SLADashboardPage'),
  '/risk-rules': () => import('@/pages/RiskRulesPage'),
  '/evaluations': () => import('@/pages/EvaluationsPage'),
  '/webhooks': () => import('@/pages/WebhooksPage'),
  '/bitrix24': () => import('@/pages/Bitrix24Page'),
  '/reports': () => import('@/pages/ReportsPage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/security': () => import('@/pages/SecurityDashboardPage'),
  '/roles': () => import('@/pages/RolesPage'),
  '/permissions': () => import('@/pages/PermissionsPage'),
  '/ip-whitelist': () => import('@/pages/IPWhitelistPage'),
  '/rate-limiting': () => import('@/pages/RateLimitDashboardPage'),
  '/geo-blocking': () => import('@/pages/GeoBlockingPage'),
  '/password-reset-approvals': () => import('@/pages/PasswordResetApprovalsPage'),
  '/system-health': () => import('@/pages/SystemHealthPage'),
  '/system-health-expanded': () => import('@/pages/SystemHealthExpandedPage'),
  '/cache-status': () => import('@/pages/CacheStatusPage'),
  '/cache-monitoring': () => import('@/pages/CacheMonitoringPage'),
  '/performance': () => import('@/pages/PerformanceDashboardPage'),
  '/job-queue': () => import('@/pages/JobQueuePage'),
  '/preferences': () => import('@/pages/UserPreferencesPage'),
  '/analytics': () => import('@/pages/AnalyticsDashboardPage'),
};

// Track which pages have been prefetched
const prefetchedPages = new Set<string>();

/**
 * Hook for intelligent page prefetching
 * Prefetches lazy-loaded pages when user hovers over navigation links
 */
export function usePrefetch() {
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  /**
   * Prefetch a page by its path
   * Uses a small delay to avoid prefetching on quick mouse movements
   */
  const prefetch = useCallback((path: string) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Use a small delay (100ms) to avoid prefetching on quick movements
    hoverTimeoutRef.current = setTimeout(() => {
      // Skip if already prefetched
      if (prefetchedPages.has(path)) {
        return;
      }
      
      const importFn = pageImports[path];
      if (importFn) {
        // Mark as prefetched immediately to prevent duplicate requests
        prefetchedPages.add(path);
        
        // Prefetch with low priority
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            importFn().catch(() => {
              // If prefetch fails, remove from set to allow retry
              prefetchedPages.delete(path);
            });
          });
        } else {
          // Fallback for browsers without requestIdleCallback
          importFn().catch(() => {
            prefetchedPages.delete(path);
          });
        }
      }
    }, 100);
  }, []);
  
  /**
   * Cancel pending prefetch (on mouse leave)
   */
  const cancelPrefetch = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);
  
  /**
   * Get prefetch handlers for a link
   */
  const getPrefetchProps = useCallback((path: string) => ({
    onMouseEnter: () => prefetch(path),
    onMouseLeave: cancelPrefetch,
    onFocus: () => prefetch(path),
    onBlur: cancelPrefetch,
  }), [prefetch, cancelPrefetch]);
  
  /**
   * Prefetch multiple pages at once (e.g., for visible navigation)
   */
  const prefetchMultiple = useCallback((paths: string[]) => {
    paths.forEach(path => {
      if (!prefetchedPages.has(path) && pageImports[path]) {
        prefetchedPages.add(path);
        
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => {
            pageImports[path]?.().catch(() => {
              prefetchedPages.delete(path);
            });
          }, { timeout: 2000 });
        } else {
          setTimeout(() => {
            pageImports[path]?.().catch(() => {
              prefetchedPages.delete(path);
            });
          }, 100);
        }
      }
    });
  }, []);
  
  return {
    prefetch,
    cancelPrefetch,
    getPrefetchProps,
    prefetchMultiple,
    isPrefetched: (path: string) => prefetchedPages.has(path),
  };
}
