import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronDown, LogOut, User, ChevronRight, Moon, Sun, Circle, Truck, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePrefetch } from '@/hooks/usePrefetch';
import { menuCategories, getRoleDisplayName, getRoleColor, type MenuItem } from './sidebar-config';
import { meetsRole, getHighestRole } from '@/lib/roles';
import { usePermissions } from '@/hooks/usePermissions';
import { useSidebarCounts } from '@/hooks/useSidebarCounts';
import { useSidebarCountsRealtime } from '@/hooks/useRealtimeSubscriptions';
import { BounceBadge } from '@/components/ui/micro-interactions';
import { getDisplayName, getDisplayInitials } from '@/lib/user-display';

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { getPrefetchProps } = usePrefetch();
  const [collapsed, setCollapsed] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>(['main']);
  const { userRoles } = usePermissions();
  const userRole = getHighestRole(userRoles);

  const getUserInitials = () => getDisplayInitials(user);

  const { unreadAlerts, pendingApprovals, openIncidents, refetchCounts } = useSidebarCounts();
  useSidebarCountsRealtime(refetchCounts);
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : !!matchPath({ path, end: false }, location.pathname);

  useEffect(() => {
    menuCategories.forEach(cat => { if (cat.items.some(item => isActive(item.path))) setOpenCategories(prev => prev.includes(cat.id) ? prev : [...prev, cat.id]); });
  }, [location.pathname]);

  // Mapas de configuração — evitam ternários aninhados
  const badgeCounts: Record<string, number> = {
    alerts: unreadAlerts,
    approvals: pendingApprovals,
    incidents: openIncidents,
  };
  const badgeVariants: Record<string, 'destructive' | 'warning' | 'default'> = {
    alerts: 'destructive',
    approvals: 'warning',
    incidents: 'default',
  };
  const getBadgeCount = (badgeType?: string) => (badgeType ? badgeCounts[badgeType] ?? 0 : 0);
  const getBadgeVariant = (badgeType?: string) => (badgeType ? badgeVariants[badgeType] ?? 'default' : 'default');

  const toggleCategory = (id: string) => setOpenCategories(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const hasRequiredRole = (required?: 'admin' | 'manager') => meetsRole(userRole, required);

  const filteredCategories = menuCategories.filter(cat => hasRequiredRole(cat.requiredRole)).map(cat => ({ ...cat, items: cat.items.filter(item => hasRequiredRole(item.requiredRole)) })).filter(cat => cat.items.length > 0);

  const renderMenuItem = (item: MenuItem) => {
    const active = isActive(item.path);
    const badgeCount = getBadgeCount(item.badgeType);
    const prefetchProps = getPrefetchProps(item.path);
    const link = (
      <Link key={item.id} to={item.path} {...prefetchProps} aria-current={active ? 'page' : undefined} aria-label={collapsed ? `${item.label}${badgeCount > 0 ? ` (${badgeCount})` : ''}` : undefined} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative", active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground")}>
        {active && <motion.div layoutId="activeIndicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-all", active ? "bg-primary/20" : "bg-secondary/50 group-hover:bg-secondary")}><item.icon className="w-4 h-4" /></div>
        <AnimatePresence>{!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 text-sm font-medium truncate">{item.label}</motion.span>}</AnimatePresence>
        {!collapsed && badgeCount > 0 && <BounceBadge count={badgeCount} variant={getBadgeVariant(item.badgeType)} />}
        {collapsed && badgeCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full bg-destructive text-white">{badgeCount > 9 ? '9+' : badgeCount}</span>}
      </Link>
    );
    if (!collapsed) return link;
    return (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right"><p>{item.label}{badgeCount > 0 ? ` · ${badgeCount}` : ''}</p></TooltipContent>
      </Tooltip>
    );
  };


  const userDropdownContent = () => (
    <>
      <DropdownMenuLabel><div className="flex flex-col space-y-1"><p className="text-sm font-medium">{getDisplayName(user) ?? user?.email ?? 'Usuário'}</p><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /><p className="text-xs text-success">Online</p></div></div></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => navigate('/profile')}><User className="mr-2 h-4 w-4" />Meu Perfil</DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/settings')}><Settings className="mr-2 h-4 w-4" />Configurações</DropdownMenuItem>
      <DropdownMenuItem onClick={toggleTheme}>{theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sair da Conta</DropdownMenuItem>
    </>
  );

  return (
    <aside 
      className={cn("relative flex flex-col h-screen border-r border-border/30 transition-all duration-300", collapsed ? "w-20" : "w-64")}
      aria-expanded={!collapsed}
      aria-label="Menu lateral de navegação"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-accent/20 to-info/30" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-border/30">
          <motion.div whileHover={{ scale: 1.05 }} className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20"><Truck className="w-5 h-5 text-primary" /></motion.div>
          <AnimatePresence>{!collapsed && <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}><div className="flex items-center gap-1.5"><h1 className="font-bold text-foreground text-lg">Lalamove</h1><Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" /></div><p className="text-xs text-muted-foreground">Intelligence Hub</p></motion.div>}</AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border">
          {filteredCategories.map((category) => {
            const isOpen = openCategories.includes(category.id);
            const hasActiveItem = category.items.some(item => isActive(item.path));
            const CategoryIcon = category.icon;
            if (collapsed) return <div key={category.id} className="space-y-1">{category.items.map(renderMenuItem)}</div>;
            return (
              <Collapsible key={category.id} open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
                <CollapsibleTrigger className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-muted-foreground hover:bg-secondary/50 hover:text-foreground", hasActiveItem && "text-foreground font-medium")}>
                  <CategoryIcon className="w-4 h-4" /><span className="flex-1 text-left text-sm font-medium">{category.label}</span>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="w-4 h-4" /></motion.div>
                </CollapsibleTrigger>
                <CollapsibleContent><motion.div className="ml-2 pl-3 border-l border-border/50 mt-1 space-y-0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{category.items.map(renderMenuItem)}</motion.div></CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border/30">
          {collapsed ? (
            <div className="p-3 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full"><Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarImage src="" alt={user?.email || 'User'} /><AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{getUserInitials()}</AvatarFallback></Avatar><span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">{userDropdownContent()}</DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="p-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all group">
                    <div className="relative"><Avatar className="h-10 w-10 border-2 border-primary/20 transition-transform group-hover:scale-105"><AvatarImage src="" alt={getDisplayName(user) ?? user?.email ?? 'User'} /><AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{getUserInitials()}</AvatarFallback></Avatar><motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background" /></div>
                    <div className="flex-1 text-left min-w-0"><p className="text-sm font-medium truncate text-foreground">{getDisplayName(user) ?? user?.email ?? 'Usuário'}</p><div className="flex items-center gap-1.5"><Circle className={cn("h-2 w-2 fill-current", getRoleColor(userRole))} /><p className={cn("text-xs truncate", getRoleColor(userRole))}>{getRoleDisplayName(userRole)}</p></div></div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" className="w-56">{userDropdownContent()}</DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Collapse */}
        <div className="p-3 border-t border-border/30">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} className="w-full justify-center bg-secondary/30 hover:bg-secondary/50 rounded-lg">
                <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}><ChevronLeft className="w-4 h-4" /></motion.div>
                <AnimatePresence>{!collapsed && <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="ml-2 text-sm">Recolher</motion.span>}</AnimatePresence>
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right"><p>Expandir menu</p></TooltipContent>}
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
