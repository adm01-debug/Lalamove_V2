import { Link, useLocation, matchPath } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Package, Users, Map, Bell, Settings,
  Shield, BarChart3, Truck, Flame, Activity,
  Scale, Webhook, Briefcase, AlertTriangle, History,
  ClipboardCheck, HardDrive, Globe, KeyRound,
  ChevronDown, Gauge, Database, Lock, Zap, Sparkles, Bug, ArrowLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BounceBadge } from '@/components/ui/micro-interactions';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState, useEffect } from 'react';
import { BackButton } from '@/components/ui/back-button';
import { meetsRole, getHighestRole } from '@/lib/roles';
import { usePermissions } from '@/hooks/usePermissions';
import { useSidebarCounts } from '@/hooks/useSidebarCounts';
import { useSidebarCountsRealtime } from '@/hooks/useRealtimeSubscriptions';

interface MenuItem {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  badgeType?: 'alerts' | 'approvals' | 'incidents';
  requiredRole?: 'admin' | 'manager';
}

interface MenuCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
  defaultOpen?: boolean;
  requiredRole?: 'admin' | 'manager';
}

const menuCategories: MenuCategory[] = [
  {
    id: 'main',
    label: 'Principal',
    icon: Zap,
    defaultOpen: true,
    items: [
      { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'orders', path: '/orders', label: 'Pedidos', icon: Package },
      { id: 'drivers', path: '/drivers', label: 'Motoristas', icon: Users },
    ]
  },
  {
    id: 'operations',
    label: 'Operações',
    icon: Gauge,
    items: [
      { id: 'approvals', path: '/approvals', label: 'Aprovações', icon: Shield, badgeType: 'approvals', requiredRole: 'manager' },
      { id: 'incidents', path: '/incidents', label: 'Incidentes', icon: AlertTriangle, badgeType: 'incidents' },
      { id: 'map', path: '/map', label: 'Mapa ao Vivo', icon: Map },
      { id: 'evaluations', path: '/evaluations', label: 'Avaliações', icon: ClipboardCheck },
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    items: [
      { id: 'metrics', path: '/metrics', label: 'Métricas', icon: BarChart3 },
      { id: 'delivery-metrics', path: '/delivery-metrics', label: 'Métricas Entregas', icon: Truck },
      { id: 'sla', path: '/sla', label: 'Dashboard SLA', icon: Activity },
      { id: 'heatmap', path: '/heatmap', label: 'Mapa de Calor', icon: Flame },
    ]
  },
  {
    id: 'notifications',
    label: 'Notificações',
    icon: Bell,
    items: [
      { id: 'alerts', path: '/alerts', label: 'Alertas', icon: Bell, badgeType: 'alerts' },
      { id: 'alert-config', path: '/alert-configurations', label: 'Config. Alertas', icon: Bell, requiredRole: 'manager' },
      { id: 'notification-history', path: '/notification-history', label: 'Histórico', icon: History },
    ]
  },
  {
    id: 'integrations',
    label: 'Integrações',
    icon: Webhook,
    items: [
      { id: 'webhooks', path: '/webhooks', label: 'Webhooks', icon: Webhook, requiredRole: 'manager' },
      { id: 'bitrix24', path: '/bitrix24', label: 'Bitrix24', icon: Briefcase, requiredRole: 'manager' },
    ]
  },
  {
    id: 'security',
    label: 'Segurança',
    icon: Lock,
    requiredRole: 'admin',
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
    id: 'system',
    label: 'Sistema',
    icon: Database,
    requiredRole: 'manager',
    items: [
      { id: 'risk-rules', path: '/risk-rules', label: 'Regras de Risco', icon: Scale },
      { id: 'error-monitoring', path: '/error-monitoring', label: 'Erros Runtime', icon: Bug, requiredRole: 'manager' },
      { id: 'cache-monitoring', path: '/cache-monitoring', label: 'Cache Monitor', icon: HardDrive, requiredRole: 'manager' },
      { id: 'settings', path: '/settings', label: 'Configurações', icon: Settings },
    ]
  },
];

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openCategories, setOpenCategories] = useState<string[]>(['main']);
  const { userRoles } = usePermissions();
  const userRole = getHighestRole(userRoles);
  const { unreadAlerts, pendingApprovals, openIncidents, refetchCounts } = useSidebarCounts();
  useSidebarCountsRealtime(refetchCounts);

  // Role hierarchy for filtering (fonte única em @/lib/roles, item 48)
  const hasRequiredRole = (required?: 'admin' | 'manager') => meetsRole(userRole, required);

  const filteredCategories = menuCategories
    .filter(cat => hasRequiredRole(cat.requiredRole))
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => hasRequiredRole(item.requiredRole)),
    }))
    .filter(cat => cat.items.length > 0);

  // Auto-open category when active route is inside
  useEffect(() => {
    menuCategories.forEach(cat => {
      // eslint-disable-next-line react-hooks/immutability
      if (cat.items.some(item => isActive(item.path))) {
        setOpenCategories(prev => prev.includes(cat.id) ? prev : [...prev, cat.id]);
      }
    });
  }, [location.pathname]);

  const getBadgeCount = (badgeType?: string) => {
    if (badgeType === 'alerts') return unreadAlerts;
    if (badgeType === 'approvals') return pendingApprovals;
    if (badgeType === 'incidents') return openIncidents;
    return 0;
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return matchPath({ path, end: false }, location.pathname) !== null;
  };

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleNavigation = (_: string) => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border/30 relative">
          <div className="flex items-center gap-3">
            <BackButton variant="ghost" size="icon" className="md:hidden" />
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <SheetTitle className="font-bold text-foreground text-lg">Lalamove</SheetTitle>
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">Intelligence Hub</p>
            </div>
          </div>
        </SheetHeader>

        {/* Navigation */}
        <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
          <nav className="p-3 space-y-1">
            {filteredCategories.map((category) => {
              const isOpen = openCategories.includes(category.id);
              const hasActiveItem = category.items.some(item => isActive(item.path));
              const CategoryIcon = category.icon;

              return (
                <Collapsible
                  key={category.id}
                  open={isOpen}
                  onOpenChange={() => toggleCategory(category.id)}
                >
                  <CollapsibleTrigger className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all touch-manipulation",
                    "text-muted-foreground active:bg-secondary/70",
                    hasActiveItem && "text-foreground font-medium bg-secondary/30"
                  )}>
                    <CategoryIcon className="w-4 h-4" />
                    <span className="flex-1 text-left text-sm font-medium">{category.label}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <motion.div 
                      className="ml-2 pl-3 border-l border-border/50 mt-1 space-y-0.5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {category.items.map((item) => {
                        const active = isActive(item.path);
                        const badgeCount = getBadgeCount(item.badgeType);
                        const showBadge = badgeCount > 0;

                        return (
                          <Link
                            key={item.id}
                            to={item.path}
                            onClick={() => handleNavigation(item.path)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all touch-manipulation min-h-[44px]",
                              active 
                                ? "bg-primary/15 text-primary" 
                                : "text-muted-foreground active:bg-secondary/70"
                            )}
                          >
                            {active && (
                              <motion.div
                                layoutId="mobileActiveIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}
                            
                            <div className={cn(
                              "w-8 h-8 rounded-md flex items-center justify-center transition-all",
                              active ? "bg-primary/20" : "bg-secondary/50"
                            )}>
                              <item.icon className="w-4 h-4" />
                            </div>
                            
                            <span className="flex-1 text-sm font-medium">
                              {item.label}
                            </span>
                            
                            {showBadge && (
                                <BounceBadge 
                                  count={badgeCount}
                                  variant={item.badgeType === 'alerts' ? 'destructive' : item.badgeType === 'approvals' ? 'warning' : 'default'}
                                />
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
