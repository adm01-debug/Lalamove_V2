import { Bell, User, Sun, Moon, Monitor, Check, Sparkles, AlertTriangle, Clock, CheckCircle, XCircle, ChevronRight, Trash2, Menu, Search, LogOut, ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, ThemeMode } from '@/hooks/useTheme';
import { useActiveAlerts, useAlertActions } from '@/hooks/useActiveAlerts';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SmartBreadcrumbs, MobileBreadcrumbs } from '@/components/ui/smart-breadcrumbs';
import { useIsMobile } from '@/hooks/use-mobile';
import { LanguageSelector } from '@/components/ui/language-selector';
import { BackButton } from '@/components/ui/back-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'auto', label: 'Sistema', icon: Monitor },
];

const getSeverityConfig = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return { 
        icon: XCircle, 
        color: 'text-destructive', 
        bg: 'bg-destructive/10',
        border: 'border-destructive/30',
        glow: 'shadow-destructive/20'
      };
    case 'WARNING':
      return { 
        icon: AlertTriangle, 
        color: 'text-warning', 
        bg: 'bg-warning/10',
        border: 'border-warning/30',
        glow: 'shadow-warning/20'
      };
    default:
      return { 
        icon: CheckCircle, 
        color: 'text-info', 
        bg: 'bg-info/10',
        border: 'border-info/30',
        glow: 'shadow-info/20'
      };
  }
};

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { mode, setMode, isDark } = useTheme();
  const { data: alerts = [], isLoading: alertsLoading } = useActiveAlerts();
  const { dismissMutation, markAsReadMutation } = useAlertActions();
  // isMobile removed

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const handleSignOut = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso');
  };

  const handleDismissAlert = (alertId: string) => {
    dismissMutation.mutate(alertId);
    toast.success('Alerta dispensado');
  };

  const handleMarkAsRead = (alertId: string) => {
    markAsReadMutation.mutate(alertId);
  };

  return (
    <header className="relative flex flex-col border-b border-border/50 bg-background/60 backdrop-blur-xl safe-area-top sticky top-0 z-50">
      {/* Gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      {/* Main header content */}
      <div className="flex items-center justify-between h-14 md:h-16 px-3 md:px-6 gap-2">
        {/* Left section: Menu + Title */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {/* Mobile menu button */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="md:hidden h-10 w-10 shrink-0"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}

          {/* Back Button & Title Section */}
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <BackButton variant="ghost" size="icon" className="h-10 w-10" />
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 md:gap-3 min-w-0"
          >
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-accent/20 to-info/20 items-center justify-center border border-primary/20 shadow-lg shadow-primary/5 shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent truncate">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>
              )}
            </div>
            </motion.div>
          </div>
        </div>

        {/* Right section: Actions */}
        <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
          {/* Search - Desktop only */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative hidden lg:block group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-info/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
            <Input 
              placeholder="Buscar (Ctrl+K)"
              className="w-56 xl:w-72 pl-10 bg-secondary/30 border-border/30 rounded-xl backdrop-blur-sm focus:bg-secondary/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
              readOnly
              onClick={() => {
                // Trigger Ctrl+K
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
            />
          </motion.div>

          {/* Theme Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative overflow-hidden rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 hover:border-primary/30 transition-all duration-200 h-10 w-10"
                aria-label="Alterar tema"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={mode}
                    initial={{ y: -20, opacity: 0, rotate: -90 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 20, opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    {mode === 'auto' ? (
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                    ) : isDark ? (
                      <Moon className="w-5 h-5 text-info" />
                    ) : (
                      <Sun className="w-5 h-5 text-warning" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-background/95 backdrop-blur-xl border-border/50">
              {themeOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setMode(option.value)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <option.icon className="w-4 h-4" />
                    <span>{option.label}</span>
                  </div>
                  {mode === option.value && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Selector - Desktop only */}
          <div className="hidden md:block">
            <LanguageSelector />
          </div>

          {/* Notifications Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 hover:border-primary/30 transition-all duration-200 h-10 w-10"
              >
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-destructive/30 animate-pulse"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              align="end" 
              className="w-[90vw] max-w-[380px] p-0 bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl shadow-black/20"
              sideOffset={8}
            >
              {/* Header */}
              <div className="relative p-4 border-b border-border/30">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-info/5" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Notificações</h3>
                      <p className="text-xs text-muted-foreground">
                        {unreadCount > 0 ? `${unreadCount} não lidos` : 'Tudo em dia'}
                      </p>
                    </div>
                  </div>
                  {alerts.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {alerts.length} alertas
                    </Badge>
                  )}
                </div>
              </div>

              {/* Alerts List */}
              <ScrollArea className="max-h-[50vh] md:max-h-80">
                {alertsLoading ? (
                  <div className="p-6 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-success/10 to-success/5 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-success" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhum alerta ativo</p>
                    <p className="text-xs text-muted-foreground mt-1">Você está em dia!</p>
                  </div>
                ) : (
                  <div className="p-2">
                    <AnimatePresence mode="popLayout">
                      {alerts.slice(0, 5).map((alert, index) => {
                        const config = getSeverityConfig(alert.severity);
                        const Icon = config.icon;
                        
                        return (
                          <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className={`group relative p-3 mb-2 rounded-xl border ${config.border} ${config.bg} cursor-pointer hover:shadow-lg ${config.glow} transition-all duration-200`}
                            onClick={() => handleMarkAsRead(alert.id)}
                          >
                            {/* Unread indicator */}
                            {!alert.isRead && (
                              <motion.div 
                                layoutId={`unread-${alert.id}`}
                                className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                              />
                            )}
                            
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`w-4 h-4 ${config.color}`} />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className={`text-sm font-medium truncate ${!alert.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {alert.title}
                                  </h4>
                                  <Badge 
                                    variant={alert.severity === 'CRITICAL' ? 'destructive' : alert.severity === 'WARNING' ? 'default' : 'secondary'}
                                    className="text-[10px] px-1.5 py-0 flex-shrink-0"
                                  >
                                    {alert.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {alert.message}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(alert.createdAt, { addSuffix: true, locale: ptBR })}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDismissAlert(alert.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              {alerts.length > 0 && (
                <div className="p-3 border-t border-border/30 bg-gradient-to-r from-secondary/30 to-secondary/10">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => window.location.href = '/alerts'}
                  >
                    Ver todos os alertas
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 md:gap-3 md:pl-4 md:ml-2 md:border-l md:border-border/30 h-10 md:h-auto py-2 hover:bg-secondary/30 rounded-xl transition-all duration-200"
              >
                <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-foreground">
                    {user?.email?.split('@')[0] || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email || 'user@email.com'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 via-accent/30 to-info/30 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
                  <User className="w-5 h-5 text-primary" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-xl border-border/50">
              <div className="px-3 py-2 border-b border-border/30">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <p className="text-xs text-muted-foreground">Conta ativa</p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem 
                onClick={handleSignOut} 
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Smart Breadcrumbs - Desktop */}
      <div className="px-3 md:px-6 pb-2 hidden md:block">
        <SmartBreadcrumbs showQuickActions showFavorites showRecent />
      </div>
      
      {/* Mobile Breadcrumbs - only on deep pages */}
      {location.pathname !== '/' && location.pathname !== '/dashboard' && (
        <div className="px-3 pb-2 md:hidden">
          <MobileBreadcrumbs />
        </div>
      )}
    </header>
  );
}
