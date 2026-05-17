import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Loader2, Package, Users, AlertTriangle, Map, Settings, FileText, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileSidebar } from '@/components/layout/MobileSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Header } from '@/components/layout/Header';
import { useAccessibility, SkipLink } from '@/hooks/useAccessibility';
import { useContextualHints } from '@/hooks/useContextualHints';
import { FloatingActionButton, FloatingActionButtonRef } from '@/components/ui/floating-action-button';
import { KeyboardShortcutsModal } from '@/components/ui/keyboard-shortcuts-modal';
import { GlobalSearchAdvanced } from '@/components/GlobalSearchAdvanced';
import { useActiveAlerts } from '@/hooks/useActiveAlerts';
import { useApprovalStats } from '@/hooks/usePendingApprovals';
import { enableAudioOnInteraction } from '@/utils/alertSounds';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const pageConfig: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão geral do sistema' },
  '/orders': { title: 'Pedidos', subtitle: 'Gerencie entregas Lalamove' },
  '/drivers': { title: 'Motoristas', subtitle: 'Avaliação e screening' },
  '/approvals': { title: 'Aprovações', subtitle: 'Fila de aprovação manual' },
  '/incidents': { title: 'Incidentes', subtitle: 'Gestão de ocorrências' },
  '/metrics': { title: 'Métricas', subtitle: 'Dashboard de performance' },
  '/map': { title: 'Mapa ao Vivo', subtitle: 'Rastreamento em tempo real' },
  '/alerts': { title: 'Alertas', subtitle: 'Central de notificações' },
  '/reports': { title: 'Relatórios', subtitle: 'Análises e métricas' },
  '/heatmap': { title: 'Mapa de Calor', subtitle: 'Regiões com maior volume' },
  '/sla': { title: 'Dashboard SLA', subtitle: 'Métricas de performance em tempo real' },
  '/risk-rules': { title: 'Regras de Risco', subtitle: 'Configure o cálculo de score' },
  '/webhooks': { title: 'Webhooks', subtitle: 'Eventos recebidos do Lalamove' },
  '/bitrix24': { title: 'Bitrix24', subtitle: 'Integração com CRM' },
  '/settings': { title: 'Configurações', subtitle: 'Preferências do sistema' },
  '/delivery-metrics': { title: 'Métricas de Entrega', subtitle: 'Análise detalhada de performance' },
  '/evaluations': { title: 'Avaliações', subtitle: 'Histórico de avaliações de motoristas' },
  '/alert-configurations': { title: 'Configurações de Alertas', subtitle: 'Canais e templates de notificação' },
  '/system-health': { title: 'Saúde do Sistema', subtitle: 'Monitoramento de serviços' },
  '/cache-monitoring': { title: 'Monitoramento de Cache', subtitle: 'Performance e estatísticas' },
  '/job-queue': { title: 'Fila de Jobs', subtitle: 'Tarefas em processamento' },
  '/notification-history': { title: 'Histórico de Notificações', subtitle: 'Registro de alertas enviados' },
};

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const config = pageConfig[location.pathname] || { title: 'Dashboard' };
  const fabRef = useRef<FloatingActionButtonRef>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [gKeyPressed, setGKeyPressed] = useState(false);
  const gKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Navigation shortcuts map (G + letter) - memoized to avoid re-renders
  const navigationShortcuts = useRef<Record<string, string>>({
    'd': '/',           // Dashboard
    'o': '/orders',     // Orders (Pedidos)
    'm': '/drivers',    // Motoristas
    'a': '/approvals',  // Aprovações
    'l': '/alerts',     // Alertas
    'p': '/map',        // Mapa ao vivo (Live map)
    'r': '/reports',    // Relatórios
    'i': '/incidents',  // Incidentes
    's': '/settings',   // Settings
  }).current;
  
  // Initialize accessibility and contextual hints
  useAccessibility();
  useContextualHints();

  // Enable audio on first user interaction (required by browsers)
  useEffect(() => {
    enableAudioOnInteraction();
  }, []);

  // Fetch counts for badges
  const { data: alerts } = useActiveAlerts();
  const { data: approvalStats } = useApprovalStats();

  // Count critical/unread alerts
  const criticalAlertsCount = alerts?.filter(a => a.severity === 'CRITICAL' && !a.isRead).length || 0;
  const unreadAlertsCount = alerts?.filter(a => !a.isRead).length || 0;
  const pendingApprovalsCount = approvalStats?.pending || 0;

  // Total badge = critical alerts + pending approvals
  const totalBadge = criticalAlertsCount + pendingApprovalsCount;

  // Ações base disponíveis - memoized to prevent re-creation
  type ActionConfig = {
    icon: typeof Package;
    label: string;
    path: string;
    variant?: 'primary' | 'secondary' | 'destructive';
    badgeKey?: 'alerts' | 'approvals';
  };

  const allActions = useMemo<Record<string, ActionConfig>>(() => ({
    orders: { icon: Package, label: 'Pedidos', path: '/orders' },
    drivers: { icon: Users, label: 'Motoristas', path: '/drivers' },
    alerts: { icon: AlertTriangle, label: 'Alertas', path: '/alerts', badgeKey: 'alerts' },
    approvals: { icon: ClipboardCheck, label: 'Aprovações', path: '/approvals', badgeKey: 'approvals' },
    map: { icon: Map, label: 'Mapa ao Vivo', path: '/map' },
    reports: { icon: FileText, label: 'Relatórios', path: '/reports' },
    settings: { icon: Settings, label: 'Configurações', path: '/settings', variant: 'secondary' },
  }), []);

  // Badge counts mapping - memoized
  const badgeCounts = useMemo<Record<string, number>>(() => ({
    alerts: unreadAlertsCount,
    approvals: pendingApprovalsCount,
  }), [unreadAlertsCount, pendingApprovalsCount]);

  // Ações contextuais por página
  const getContextualActions = useCallback(() => {
    const currentPath = location.pathname;
    
    // Define prioridade de ações por página (incluindo aprovações)
    const contextMap: Record<string, string[]> = {
      '/': ['orders', 'approvals', 'alerts', 'drivers', 'map'],
      '/dashboard': ['orders', 'approvals', 'alerts', 'drivers', 'map'],
      '/orders': ['drivers', 'approvals', 'alerts', 'map', 'settings'],
      '/drivers': ['orders', 'approvals', 'alerts', 'map', 'settings'],
      '/approvals': ['drivers', 'orders', 'alerts', 'map', 'settings'],
      '/incidents': ['alerts', 'approvals', 'drivers', 'orders', 'map'],
      '/metrics': ['reports', 'orders', 'approvals', 'alerts', 'settings'],
      '/map': ['orders', 'drivers', 'alerts', 'approvals', 'settings'],
      '/alerts': ['approvals', 'orders', 'drivers', 'map', 'settings'],
      '/reports': ['orders', 'drivers', 'alerts', 'approvals', 'settings'],
      '/heatmap': ['map', 'orders', 'drivers', 'alerts', 'settings'],
      '/sla': ['reports', 'orders', 'alerts', 'approvals', 'settings'],
      '/settings': ['orders', 'drivers', 'alerts', 'approvals', 'reports'],
    };

    const actionKeys = contextMap[currentPath] || ['orders', 'approvals', 'alerts', 'drivers', 'map'];
    
    return actionKeys.map(key => {
      const action = allActions[key as keyof typeof allActions];
      return {
        icon: action.icon,
        label: action.label,
        onClick: () => navigate(action.path),
        ...(action.variant && { variant: action.variant }),
        ...(action.badgeKey && { badge: badgeCounts[action.badgeKey] }),
      };
    });
  }, [location.pathname, navigate, badgeCounts]);

  const fabActions = getContextualActions();

  // Keyboard shortcut: Ctrl+Space to toggle FAB, 1-5 to select actions, ? for help, G+letter for navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    // Handle G + letter navigation
    if (gKeyPressed) {
      const key = e.key.toLowerCase();
      if (navigationShortcuts[key]) {
        e.preventDefault();
        navigate(navigationShortcuts[key]);
        setGKeyPressed(false);
        if (gKeyTimeoutRef.current) {
          clearTimeout(gKeyTimeoutRef.current);
          gKeyTimeoutRef.current = null;
        }
        return;
      }
      // If any other key pressed after G, reset
      setGKeyPressed(false);
      if (gKeyTimeoutRef.current) {
        clearTimeout(gKeyTimeoutRef.current);
        gKeyTimeoutRef.current = null;
      }
    }
    
    // G key starts navigation sequence
    if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setGKeyPressed(true);
      // Reset after 1.5 seconds if no follow-up key
      gKeyTimeoutRef.current = setTimeout(() => {
        setGKeyPressed(false);
      }, 1500);
      return;
    }
    
    // ? to open keyboard shortcuts help
    if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
      e.preventDefault();
      setShortcutsModalOpen(true);
      announce('Abrindo guia de atalhos do teclado', 'polite');
      return;
    }
    
    // Ctrl+K or Cmd+K to open global search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setGlobalSearchOpen(true);
      return;
    }
    
    // Ctrl+Space or Cmd+Space
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault();
      fabRef.current?.toggle();
      return;
    }
    // Escape to close FAB
    if (e.key === 'Escape' && fabOpen) {
      fabRef.current?.close();
      return;
    }
    // Number keys 1-5 to select actions when FAB is open
    if (fabOpen && /^[1-5]$/.test(e.key)) {
      const index = parseInt(e.key) - 1;
      if (index < fabActions.length) {
        e.preventDefault();
        fabActions[index].onClick();
        fabRef.current?.close();
      }
    }
  }, [fabOpen, fabActions, gKeyPressed, navigate, navigationShortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (gKeyTimeoutRef.current) {
        clearTimeout(gKeyTimeoutRef.current);
      }
    };
  }, []);

  // Show hint on first load (only once per session)
  useEffect(() => {
    const hintShown = sessionStorage.getItem('fab-shortcut-hint');
    if (!hintShown && user && !isMobile) {
      const timer = setTimeout(() => {
        toast.info("💡 Dica", {
          description: "Pressione Ctrl+Espaço para abrir ações rápidas ou ? para atalhos",
        });
        sessionStorage.setItem('fab-shortcut-hint', 'true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, isMobile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
        {/* Loading background effects */}
        <div className="absolute inset-0 mesh-gradient opacity-50" />
        <div className="absolute inset-0 noise" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="p-4 rounded-2xl bg-primary/10 animate-pulse">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Skip Link for keyboard navigation */}
      <SkipLink />
      
      {/* Background layers */}
      <div className="absolute inset-0 bg-background" aria-hidden="true" />
      <div className="absolute inset-0 mesh-gradient" aria-hidden="true" />
      <div className="absolute inset-0 noise" aria-hidden="true" />
      
      {/* Animated gradient orbs - hidden on mobile for performance */}
      <div className="hidden md:block absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] animate-float" aria-hidden="true" />
      <div className="hidden md:block absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[80px] animate-float" style={{ animationDelay: '-3s' }} aria-hidden="true" />
      <div className="hidden md:block absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full bg-info/5 blur-[60px] animate-float" style={{ animationDelay: '-5s' }} aria-hidden="true" />
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      <MobileSidebar 
        open={mobileSidebarOpen} 
        onOpenChange={setMobileSidebarOpen} 
      />

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Header 
          title={config.title} 
          subtitle={config.subtitle} 
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        <main 
          id="main-content" 
          className={cn("flex-1 overflow-y-auto", isMobile && "pb-20")} 
          tabIndex={-1}
          role="main"
          aria-label={config.title ? `Conteúdo principal: ${config.title}` : 'Conteúdo principal'}
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* G key indicator */}
      <AnimatePresence>
        {gKeyPressed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-card/95 backdrop-blur-xl border shadow-lg"
          >
            <Badge variant="secondary" className="font-mono">G</Badge>
            <span className="text-sm text-muted-foreground">+ tecla para navegar</span>
            <div className="flex gap-1 ml-2">
              {Object.entries(navigationShortcuts).slice(0, 5).map(([key, path]) => (
                <span key={key} className="text-xs text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                  {key.toUpperCase()}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* Floating Action Button - hidden on mobile (using bottom nav instead) */}
      {!isMobile && (
        <FloatingActionButton 
          ref={fabRef}
          actions={fabActions} 
          position="bottom-right"
          size="md"
          totalBadge={totalBadge}
          hasCriticalAlerts={criticalAlertsCount > 0}
          isOpen={fabOpen}
          onOpenChange={setFabOpen}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal 
        open={shortcutsModalOpen} 
        onOpenChange={setShortcutsModalOpen} 
      />

      {/* Global Search Advanced */}
      <GlobalSearchAdvanced 
        open={globalSearchOpen} 
        onOpenChange={setGlobalSearchOpen} 
      />
    </div>
  );
}
