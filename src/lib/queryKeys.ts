// Centralized query key factory to avoid string duplication and enable precise invalidation.
// Usage: queryClient.invalidateQueries({ queryKey: qk.orders.all() })

export const qk = {
  orders: {
    all: () => ['orders'] as const,
    list: (page: number, status?: string, q?: string) => ['orders', 'list', page, status, q] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    geoEvents: (id: string) => ['orders', 'geo-events', id] as const,
    stops: (id: string) => ['orders', 'stops', id] as const,
  },
  drivers: {
    all: () => ['drivers'] as const,
    list: () => ['drivers', 'list'] as const,
    detail: (id: string) => ['drivers', 'detail', id] as const,
    approvals: () => ['pending-approvals'] as const,
    approvalStats: () => ['approval-stats'] as const,
  },
  dashboard: {
    stats: () => ['dashboard', 'stats'] as const,
    metrics: (daysBack?: number) => ['metrics', 'deliveries', daysBack ?? 90] as const,
    sla: (window?: string) => ['sla', 'metrics', window ?? '24h'] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    history: () => ['notification-history'] as const,
  },
  alerts: {
    active: () => ['active-alerts'] as const,
    configs: () => ['alert-configs'] as const,
  },
  cache: {
    views: () => ['cache-views'] as const,
    stats: () => ['cached-stats'] as const,
  },
  geo: {
    admin: () => ['geo-admin'] as const,
    rotationHistory: () => ['geo-admin', 'rotation-history'] as const,
  },
  system: {
    health: () => ['system-health'] as const,
    jobQueue: () => ['job-queue'] as const,
    webhooks: () => ['webhooks'] as const,
  },
  contacts: {
    all: () => ['contacts'] as const,
  },
} as const;