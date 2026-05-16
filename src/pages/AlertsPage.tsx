import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DataRefreshIndicator } from '@/components/ui/data-refresh-indicator';
import { useUndoableAction } from '@/components/ui/undo-toast';
import { TrendIndicator } from '@/components/ui/sparkline';
import { 
  Bell, 
  CheckCheck, 
  AlertTriangle,
  AlertCircle,
  Info,
  MapPin,
  Shield,
  Clock,
  X,
  Settings,
  Sparkles,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useActiveAlerts, useAlertActions } from '@/hooks/useActiveAlerts';
import { Alert, AlertType } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  AlertsToolbar,
  AlertListItem,
  AlertGroupHeader,
  BulkActionsBar,
  useAlertGrouping,
  useAlertSelection,
} from '@/components/alerts/AlertsAdvanced';
import { useQueryClient } from '@tanstack/react-query';

const alertIcons: Record<AlertType, typeof AlertTriangle> = {
  DRIVER_BLOCKED: Shield,
  ROUTE_DEVIATION: MapPin,
  DRIVER_STOPPED: Clock,
  LATE_DELIVERY: AlertCircle,
  APPROVAL_REQUIRED: AlertTriangle,
  ORDER_CANCELLED: X,
};

const severityStyles = {
  INFO: {
    bg: 'bg-info/10',
    border: 'border-info/30',
    icon: 'text-info',
    badge: 'info' as const,
    gradient: 'from-info/20 via-info/10 to-transparent',
    glow: 'shadow-info/20',
  },
  WARNING: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    icon: 'text-warning',
    badge: 'warning' as const,
    gradient: 'from-warning/20 via-warning/10 to-transparent',
    glow: 'shadow-warning/20',
  },
  CRITICAL: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    icon: 'text-destructive',
    badge: 'destructive' as const,
    gradient: 'from-destructive/20 via-destructive/10 to-transparent',
    glow: 'shadow-destructive/20',
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

type GroupBy = 'none' | 'severity' | 'type' | 'time';
type SortBy = 'newest' | 'oldest' | 'severity';
type ViewMode = 'list' | 'compact';

export function AlertsPage() {
  const queryClient = useQueryClient();
  const { data: alerts = [], isLoading, isFetching } = useActiveAlerts();
  const { dismissMutation, markAsReadMutation, markAllAsReadMutation } = useAlertActions();
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  const severityFilter = (searchParams.get('severity') as 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO') || 'ALL';
  const groupBy = (searchParams.get('groupBy') as GroupBy) || 'severity';
  const sortBy = (searchParams.get('sortBy') as SortBy) || 'newest';
  const viewMode = (searchParams.get('viewMode') as ViewMode) || 'list';

  const setSeverityFilter = useCallback((severity: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (severity !== 'ALL') newParams.set('severity', severity);
    else newParams.delete('severity');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const setGroupBy = useCallback((val: GroupBy) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'severity') newParams.set('groupBy', val);
    else newParams.delete('groupBy');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const setSortBy = useCallback((val: SortBy) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'newest') newParams.set('sortBy', val);
    else newParams.delete('sortBy');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const setViewMode = useCallback((val: ViewMode) => {
    const newParams = new URLSearchParams(searchParams);
    if (val !== 'list') newParams.set('viewMode', val);
    else newParams.delete('viewMode');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['CRITICAL', 'WARNING', 'INFO']));
  const [detailAlert, setDetailAlert] = useState<Alert | null>(null);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      return severityFilter === 'ALL' || alert.severity === severityFilter;
    });
  }, [alerts, severityFilter]);

  const { 
    selectedIds, 
    toggleSelection, 
    selectAll, 
    deselectAll, 
    isAllSelected, 
    selectedCount 
  } = useAlertSelection(filteredAlerts);

  const groupedAlerts = useAlertGrouping(filteredAlerts, groupBy, sortBy);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['active-alerts'] });
    setLastUpdated(new Date());
  }, [queryClient]);

  const unreadCount = alerts.filter(a => !a.isRead).length;
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
  const infoCount = alerts.filter(a => a.severity === 'INFO').length;

  const handleMarkAllRead = () => {
    markAllAsReadMutation.mutate();
  };

  // Undo action for critical operations
  const { execute: executeWithUndo } = useUndoableAction<string>();

  const handleDismiss = useCallback((alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) {
      dismissMutation.mutate(alertId);
      return;
    }
    
    executeWithUndo({
      action: async () => {
        dismissMutation.mutate(alertId);
        return alertId;
      },
      undo: async () => {
        toast.info('Alerta restaurado');
      },
      description: `Alerta "${alert.title}" dispensado`,
      undoTimeout: 5000,
    });
  }, [alerts, dismissMutation, executeWithUndo]);

  const handleMarkAsRead = (alertId: string) => {
    markAsReadMutation.mutate(alertId);
  };

  const handleBulkMarkAsRead = () => {
    selectedIds.forEach(id => {
      markAsReadMutation.mutate(id);
    });
    deselectAll();
    toast.success(`${selectedIds.size} alertas marcados como lidos`);
  };

  const handleBulkDismiss = useCallback(() => {
    const count = selectedIds.size;
    executeWithUndo({
      action: async () => {
        selectedIds.forEach(id => {
          dismissMutation.mutate(id);
        });
        deselectAll();
        return 'bulk';
      },
      undo: async () => {
        toast.info(`${count} alertas restaurados`);
      },
      description: `${count} alertas dispensados`,
      undoTimeout: 5000,
    });
  }, [selectedIds, dismissMutation, deselectAll, executeWithUndo]);

  const handleBulkArchive = () => {
    handleBulkDismiss();
  };

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const statsCards = [
    { 
      key: 'ALL', 
      label: 'Total', 
      fullLabel: 'Total de alertas',
      value: alerts.length, 
      icon: Bell, 
      color: 'text-foreground',
      bg: 'bg-secondary/50',
      border: 'border-border/50',
    },
    { 
      key: 'CRITICAL', 
      label: 'Críticos', 
      fullLabel: 'Alertas críticos',
      value: criticalCount, 
      icon: AlertCircle, 
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
    },
    { 
      key: 'WARNING', 
      label: 'Avisos', 
      fullLabel: 'Avisos',
      value: warningCount, 
      icon: AlertTriangle, 
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/30',
    },
    { 
      key: 'INFO', 
      label: 'Info', 
      fullLabel: 'Informativos',
      value: infoCount, 
      icon: Info, 
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/30',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl blur-xl opacity-50 animate-pulse" />
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">
                <span className="gradient-text">Central de Alertas</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-accent" />
                Monitore eventos críticos em tempo real
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DataRefreshIndicator
              lastUpdated={lastUpdated}
              isRefreshing={isFetching}
              onRefresh={handleRefresh}
              variant="minimal"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleMarkAllRead} 
              disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
              className="bg-background/50 backdrop-blur-sm"
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Marcar todos</span>
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="bg-background/50 backdrop-blur-sm"
            >
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Configurar</span>
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-4 gap-2 sm:gap-4"
        >
          {statsCards.map((stat) => (
            <motion.div key={stat.key} variants={itemVariants}>
              <Card 
                variant={severityFilter === stat.key 
                  ? (stat.key === 'CRITICAL' ? 'gradientDestructive' : 
                     stat.key === 'WARNING' ? 'gradientWarning' : 
                     stat.key === 'INFO' ? 'gradientSuccess' : 'gradientPrimary')
                  : 'glass'
                }
                hover="lift"
                className={cn(
                  "cursor-pointer transition-all duration-300 touch-manipulation active:scale-[0.98]",
                  severityFilter === stat.key && "ring-2 ring-offset-2 ring-offset-background"
                )}
                onClick={() => setSeverityFilter(stat.key)}
              >
                <CardContent className="p-2 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                    <div className={cn(
                      "p-1.5 sm:p-2.5 rounded-lg border flex-shrink-0 transition-colors",
                      severityFilter === stat.key 
                        ? "bg-white/20 border-white/10" 
                        : cn(stat.bg, stat.border)
                    )}>
                      <stat.icon className={cn(
                        "w-3.5 h-3.5 sm:w-5 sm:h-5", 
                        severityFilter === stat.key ? "text-white" : stat.color
                      )} />
                    </div>
                    <div className="text-center sm:text-left">
                      <p className={cn(
                        "text-lg sm:text-2xl font-bold", 
                        severityFilter === stat.key ? "text-white" : stat.color
                      )}>{stat.value}</p>
                      <p className="text-[9px] sm:text-xs text-muted-foreground">
                        <span className="sm:hidden">{stat.label}</span>
                        <span className="hidden sm:inline">{stat.fullLabel}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card variant="glass" className="p-3">
            <AlertsToolbar
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              sortBy={sortBy}
              setSortBy={setSortBy}
              viewMode={viewMode}
              setViewMode={setViewMode}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              onRefresh={handleRefresh}
              isRefreshing={isFetching}
            />
          </Card>
        </motion.div>

        {/* Alerts List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card variant="glass" className="overflow-hidden">
            <CardHeader className="relative border-b border-border/30 pb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-info/5" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-lg">
                    {severityFilter === 'ALL' ? 'Todos os Alertas' : `Alertas ${severityFilter === 'CRITICAL' ? 'Críticos' : severityFilter === 'WARNING' ? 'de Aviso' : 'Informativos'}`}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="animate-pulse">
                      {unreadCount} não lido{unreadCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Badge variant="secondary">{filteredAlerts.length} alertas</Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredAlerts.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-12 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 mx-auto mb-4 flex items-center justify-center border border-success/20">
                    <Bell className="w-8 h-8 text-success" />
                  </div>
                  <h4 className="text-lg font-medium text-foreground mb-2">Tudo tranquilo</h4>
                  <p className="text-muted-foreground">Nenhum alerta nesta categoria</p>
                </motion.div>
              ) : (
                <div className="p-4 space-y-3">
                  <AnimatePresence>
                    {groupedAlerts.map((group) => (
                      <Collapsible
                        key={group.key}
                        open={openGroups.has(group.key)}
                        onOpenChange={() => toggleGroup(group.key)}
                      >
                        <AlertGroupHeader
                          group={group}
                          isOpen={openGroups.has(group.key)}
                          onToggle={() => toggleGroup(group.key)}
                          selectedCount={group.alerts.filter(a => selectedIds.has(a.id)).length}
                          onSelectAll={() => group.alerts.forEach(a => toggleSelection(a.id))}
                        />
                        
                        <CollapsibleContent>
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-2 pt-2 pl-2"
                          >
                            <AnimatePresence mode="popLayout">
                              {group.alerts.map((alert) => (
                                <AlertListItem
                                  key={alert.id}
                                  alert={alert}
                                  isSelected={selectedIds.has(alert.id)}
                                  onSelect={toggleSelection}
                                  onMarkAsRead={handleMarkAsRead}
                                  onDismiss={handleDismiss}
                                  onViewDetails={setDetailAlert}
                                  viewMode={viewMode}
                                />
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>

            {/* Footer */}
            {filteredAlerts.length > 0 && (
              <div className="p-4 border-t border-border/30 bg-gradient-to-r from-secondary/30 to-secondary/10">
                <Button 
                  variant="ghost" 
                  className="w-full justify-between text-sm text-muted-foreground hover:text-foreground"
                >
                  <span>Ver histórico completo de alertas</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          <BulkActionsBar
            selectedCount={selectedCount}
            totalCount={filteredAlerts.length}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onMarkAsRead={handleBulkMarkAsRead}
            onDismiss={handleBulkDismiss}
            onArchive={handleBulkArchive}
            isAllSelected={isAllSelected}
          />
        </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}
