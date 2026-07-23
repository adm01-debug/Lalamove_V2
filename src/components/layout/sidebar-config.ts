import {
  LayoutDashboard, Package, Users, Map, Bell, Settings,
  Shield, BarChart3, Truck, Flame, Activity,
  Scale, Webhook, Briefcase, AlertTriangle, History,
  ClipboardCheck, HardDrive, Globe, KeyRound,
  Gauge, Database, Lock, Zap, Bug, FileBarChart, Contact
} from 'lucide-react';

export interface MenuItem {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  badgeType?: 'alerts' | 'approvals' | 'incidents';
  requiredRole?: 'admin' | 'manager';
}

export interface MenuCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
  defaultOpen?: boolean;
  requiredRole?: 'admin' | 'manager';
}

export const menuCategories: MenuCategory[] = [
  {
    id: 'main', label: 'Principal', icon: Zap, defaultOpen: true,
    items: [
      { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'orders', path: '/orders', label: 'Pedidos', icon: Package },
      { id: 'drivers', path: '/drivers', label: 'Motoristas', icon: Users },
      { id: 'contacts', path: '/contacts', label: 'Contatos', icon: Contact },
    ]
  },
  {
    id: 'operations', label: 'Operações', icon: Gauge,
    items: [
      { id: 'approvals', path: '/approvals', label: 'Aprovações', icon: Shield, badgeType: 'approvals' },
      { id: 'incidents', path: '/incidents', label: 'Incidentes', icon: AlertTriangle, badgeType: 'incidents' },
      { id: 'map', path: '/map', label: 'Mapa ao Vivo', icon: Map },
      { id: 'evaluations', path: '/evaluations', label: 'Avaliações', icon: ClipboardCheck },
    ]
  },
  {
    id: 'analytics', label: 'Analytics', icon: BarChart3,
    items: [
      { id: 'metrics', path: '/metrics', label: 'Métricas', icon: BarChart3 },
      { id: 'advanced-reports', path: '/reports/advanced', label: 'Relatórios Avançados', icon: FileBarChart },
      { id: 'delivery-metrics', path: '/delivery-metrics', label: 'Métricas Entregas', icon: Truck },
      { id: 'sla', path: '/sla', label: 'Dashboard SLA', icon: Activity },
      { id: 'heatmap', path: '/heatmap', label: 'Mapa de Calor', icon: Flame },
      { id: 'map-tools', path: '/map-tools', label: 'Ferramentas Mapa', icon: Map },
    ]
  },
  {
    id: 'notifications', label: 'Notificações', icon: Bell,
    items: [
      { id: 'alerts', path: '/alerts', label: 'Alertas', icon: Bell, badgeType: 'alerts' },
      { id: 'alert-config', path: '/alert-configurations', label: 'Config. Alertas', icon: Bell },
      { id: 'notification-history', path: '/notification-history', label: 'Histórico', icon: History },
    ]
  },
  {
    id: 'integrations', label: 'Integrações', icon: Webhook,
    items: [
      { id: 'webhooks', path: '/webhooks', label: 'Webhooks', icon: Webhook },
      { id: 'bitrix24', path: '/bitrix24', label: 'Bitrix24', icon: Briefcase },
      { id: 'lalamove', path: '/settings/lalamove', label: 'Lalamove API', icon: Zap },
      { id: 'external-data', path: '/external-data', label: 'Base CRM', icon: Database },
    ]
  },
  {
    id: 'security', label: 'Segurança', icon: Lock, requiredRole: 'admin',
    items: [
      { id: 'security', path: '/security', label: 'Central Segurança', icon: Shield, requiredRole: 'admin' },
      { id: 'roles', path: '/roles', label: 'Roles', icon: Users, requiredRole: 'admin' },
      { id: 'permissions', path: '/permissions', label: 'Permissões', icon: Shield, requiredRole: 'admin' },
      { id: 'ip-whitelist', path: '/ip-whitelist', label: 'IP Whitelist', icon: Shield, requiredRole: 'admin' },
      { id: 'geo-blocking', path: '/geo-blocking', label: 'Bloqueio Geo', icon: Globe, requiredRole: 'admin' },
      { id: 'password-reset', path: '/password-reset-approvals', label: 'Reset Senha', icon: KeyRound, requiredRole: 'admin' },
    ]
  },
  {
    id: 'system', label: 'Sistema', icon: Database, requiredRole: 'manager',
    items: [
      { id: 'risk-rules', path: '/risk-rules', label: 'Regras de Risco', icon: Scale },
      { id: 'error-monitoring', path: '/error-monitoring', label: 'Erros Runtime', icon: Bug, requiredRole: 'manager' },
      { id: 'cache-monitoring', path: '/cache-monitoring', label: 'Cache Monitor', icon: HardDrive, requiredRole: 'manager' },
      { id: 'performance', path: '/performance', label: 'Performance', icon: Gauge, requiredRole: 'manager' },
      { id: 'slo', path: '/slo', label: 'Dashboard SLO', icon: Activity, requiredRole: 'manager' },
      { id: 'telemetria', path: '/telemetria', label: 'Telemetria BD', icon: Activity, requiredRole: 'admin' },
      { id: 'settings', path: '/settings', label: 'Configurações', icon: Settings },
    ]
  },
];

export const roleHierarchy: Record<string, number> = { admin: 4, manager: 3, operator: 2, viewer: 1 };

export function getRoleDisplayName(role: string | null) {
  switch (role) {
    case 'admin': return 'Administrador';
    case 'manager': return 'Gerente';
    case 'operator': return 'Operador';
    case 'viewer': return 'Visualizador';
    default: return 'Membro';
  }
}

export function getRoleColor(role: string | null) {
  switch (role) {
    case 'admin': return 'text-primary';
    case 'manager': return 'text-amber-500';
    case 'operator': return 'text-info';
    default: return 'text-muted-foreground';
  }
}
