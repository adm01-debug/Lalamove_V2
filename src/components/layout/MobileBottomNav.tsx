import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Shield, 
  Bell, 
  Map,
  MoreHorizontal,
  Search,
  X,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useActiveAlerts } from '@/hooks/useActiveAlerts';
import { useApprovalStats } from '@/hooks/usePendingApprovals';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { usePrefetch } from '@/hooks/usePrefetch';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
  critical?: boolean;
}

interface MoreMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  category: string;
}

const moreMenuItems: MoreMenuItem[] = [
  // Operações
  { id: 'incidents', label: 'Incidentes', icon: Shield, path: '/incidents', category: 'Operações' },
  { id: 'evaluations', label: 'Avaliações', icon: Users, path: '/evaluations', category: 'Operações' },
  { id: 'risk-rules', label: 'Regras de Risco', icon: Shield, path: '/risk-rules', category: 'Operações' },
  
  // Analytics
  { id: 'metrics', label: 'Métricas', icon: LayoutDashboard, path: '/metrics', category: 'Analytics' },
  { id: 'delivery-metrics', label: 'Métricas Entregas', icon: Package, path: '/delivery-metrics', category: 'Analytics' },
  { id: 'sla', label: 'Dashboard SLA', icon: LayoutDashboard, path: '/sla', category: 'Analytics' },
  { id: 'heatmap', label: 'Mapa de Calor', icon: Map, path: '/heatmap', category: 'Analytics' },
  { id: 'reports', label: 'Relatórios', icon: Package, path: '/reports', category: 'Analytics' },
  
  // Configurações
  { id: 'alert-config', label: 'Config. Alertas', icon: Bell, path: '/alert-configurations', category: 'Sistema' },
  { id: 'webhooks', label: 'Webhooks', icon: Package, path: '/webhooks', category: 'Sistema' },
  { id: 'settings', label: 'Configurações', icon: LayoutDashboard, path: '/settings', category: 'Sistema' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  // quickActionsOpen removed
  const { getPrefetchProps } = usePrefetch();
  
  // Fetch counts
  const { data: alerts } = useActiveAlerts();
  const { data: approvalStats } = useApprovalStats();
  
  const unreadAlertsCount = alerts?.filter(a => !a.isRead).length || 0;
  const criticalAlertsCount = alerts?.filter(a => a.severity === 'CRITICAL' && !a.isRead).length || 0;
  const pendingApprovalsCount = approvalStats?.pending || 0;
  
  // Total badge count for "More" menu
  // totalBadges removed
  
  const isRoot = location.pathname === '/' || location.pathname === '/dashboard';

  // Main navigation items (max 5 for bottom nav)
  const mainNavItems: NavItem[] = [
    isRoot 
      ? { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/' }
      : { id: 'back', label: 'Voltar', icon: ArrowLeft, path: '#back' },
    { id: 'orders', label: 'Pedidos', icon: Package, path: '/orders' },
    { id: 'approvals', label: 'Aprovações', icon: Shield, path: '/approvals', badge: pendingApprovalsCount, critical: pendingApprovalsCount >= 5 },
    { id: 'alerts', label: 'Alertas', icon: Bell, path: '/alerts', badge: unreadAlertsCount, critical: criticalAlertsCount > 0 },
    { id: 'more', label: 'Mais', icon: MoreHorizontal, path: '#more' },
  ];
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleNavigation = useCallback((path: string) => {
    if (path === '#more') {
      setMoreOpen(true);
      return;
    }
    if (path === '#back') {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
      return;
    }
    navigate(path);
    setMoreOpen(false);
  }, [navigate]);

  // Group more menu items by category
  const groupedMenuItems = moreMenuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MoreMenuItem[]>);

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {mainNavItems.map((item) => {
            const active = item.path !== '#more' && isActive(item.path);
            const isMoreActive = item.path === '#more' && moreOpen;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full min-w-0 py-1 px-1 relative transition-all duration-200",
                  "touch-manipulation active:scale-95",
                  (active || isMoreActive) ? "text-primary" : "text-muted-foreground"
                )}
              >
                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                
                {/* Icon with badge */}
                <div className="relative">
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    (active || isMoreActive) && "scale-110"
                  )} />
                  
                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold",
                        item.critical 
                          ? "bg-destructive text-destructive-foreground animate-pulse" 
                          : "bg-primary text-primary-foreground"
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.div>
                  )}
                </div>
                
                {/* Label */}
                <span className={cn(
                  "text-[10px] mt-0.5 font-medium truncate w-full text-center",
                  (active || isMoreActive) && "text-primary font-semibold"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle>Menu</DrawerTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMoreOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DrawerHeader>
          
          <div className="overflow-y-auto px-4 py-4 space-y-6">
            {/* Quick actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setMoreOpen(false);
                  navigate('/drivers');
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Motoristas
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setMoreOpen(false);
                  navigate('/map');
                }}
              >
                <Map className="h-4 w-4 mr-2" />
                Mapa ao Vivo
              </Button>
            </div>
            
            {/* Grouped menu items */}
            {Object.entries(groupedMenuItems).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {items.map((item) => {
                    const active = isActive(item.path);
                    const prefetchHandlers = getPrefetchProps(item.path);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigation(item.path)}
                        {...prefetchHandlers}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200",
                          "touch-manipulation active:scale-95",
                          active 
                            ? "bg-primary/10 text-primary border border-primary/20" 
                            : "bg-muted/50 hover:bg-muted text-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5 mb-1" />
                        <span className="text-[10px] font-medium text-center leading-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Search button */}
            <Button
              variant="secondary"
              className="w-full h-12 mt-4"
              onClick={() => {
                setMoreOpen(false);
                // Trigger command palette
                const event = new KeyboardEvent('keydown', { 
                  key: 'k', 
                  metaKey: true,
                  ctrlKey: true 
                });
                document.dispatchEvent(event);
              }}
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar em tudo
            </Button>
          </div>
          
          {/* Safe area padding */}
          <div className="h-8 safe-area-bottom" />
        </DrawerContent>
      </Drawer>

      {/* Floating Quick Action Button */}
      <AnimatePresence>
        {!moreOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              "fixed z-50 md:hidden",
              "bottom-20 right-4",
              "w-14 h-14 rounded-full",
              "bg-primary text-primary-foreground",
              "shadow-lg shadow-primary/25",
              "flex items-center justify-center",
              "touch-manipulation active:scale-95",
              "transition-transform duration-200"
            )}
            onClick={() => navigate('/map')}
          >
            <Map className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
