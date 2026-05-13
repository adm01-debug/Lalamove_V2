import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUndoableAction } from '@/components/ui/undo-toast';
import { createSwipeAction } from '@/components/ui/swipeable-list';
import { CheckCircle2 as ApproveIcon, Ban as BlockIcon, Shield as ShieldIcon, Trash2 as TrashIcon } from 'lucide-react';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DataRefreshIndicator } from '@/components/ui/data-refresh-indicator';
import { DriverProfileModal } from '@/components/drivers/DriverProfileModal';
import { AdvancedFilters, defaultFilters, getActiveFilterCount, type DriverFilters } from '@/components/drivers/AdvancedFilters';
import { BulkActions, SelectionCheckbox, SelectAllHeader } from '@/components/drivers/BulkActions';
import { Search, Users, AlertTriangle, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import {
  useDrivers, useApproveDriver, useBlockDriver,
  useAddToWhitelist, useAddToBlacklist, useRemoveFromWhitelist, useRemoveFromBlacklist,
  DriverWithIncidents,
} from '@/hooks/useDrivers';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { DriverCard } from './drivers/DriverCard';
import { DriverConfirmDialog } from './drivers/DriverConfirmDialog';
import { DriverStatsCards } from './drivers/DriverStatsCards';

type DriverStatus = Database['public']['Enums']['driver_status'];

const statusLabels: Record<DriverStatus, string> = {
  APPROVED: 'Aprovado', PENDING_APPROVAL: 'Pendente', BLOCKED: 'Bloqueado', WHITELIST: 'Whitelist', BLACKLIST: 'Blacklist',
};

function LoadingSkeleton() {
  return (
    <div className="h-full flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center gap-4"><Skeleton className="w-12 h-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <Card key={i} variant="glass"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      <Card variant="glass"><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map(i => <Card key={i} variant="glass"><CardContent className="p-4 space-y-4"><div className="flex gap-4"><Skeleton className="w-16 h-16 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" /></div></div><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
    </div>
  );
}

export function DriversPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | 'ALL'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'whitelist' | 'blacklist' | 'block'>('whitelist');
  const [selectedDriver, setSelectedDriver] = useState<DriverWithIncidents | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<DriverFilters>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { data: drivers, isLoading, error, isFetching } = useDrivers();
  const approveMutation = useApproveDriver();
  const blockMutation = useBlockDriver();
  const addWhitelistMutation = useAddToWhitelist();
  const addBlacklistMutation = useAddToBlacklist();
  const removeWhitelistMutation = useRemoveFromWhitelist();
  const removeBlacklistMutation = useRemoveFromBlacklist();

  const handleRefresh = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: ['drivers'] }); setLastUpdated(new Date()); }, [queryClient]);

  const driverSearchKeys = useMemo(() => ['name', 'phone', 'vehiclePlate'], []);
  const driverSearchResults = useFuseSearchWithMatches(drivers || [], driverSearchKeys, searchQuery);

  const filteredDrivers = useMemo(() => {
    const driversToFilter = searchQuery.trim() ? driverSearchResults.map(r => ({ ...r.item, _matches: r.matches as any })) : (drivers || []);
    return driversToFilter.filter(driver => {
      const matchesStatus = statusFilter === 'ALL' || driver.status === statusFilter;
      const matchesRiskScore = driver.riskScore >= advancedFilters.riskScoreRange[0] && driver.riskScore <= advancedFilters.riskScoreRange[1];
      const matchesRating = driver.rating >= advancedFilters.ratingRange[0] && driver.rating <= advancedFilters.ratingRange[1];
      const matchesMinDeliveries = driver.totalDeliveries >= advancedFilters.minDeliveries;
      const matchesMaxDeliveries = advancedFilters.maxDeliveries === null || driver.totalDeliveries <= advancedFilters.maxDeliveries;
      const matchesVehicle = advancedFilters.vehicleTypes.length === 0 || advancedFilters.vehicleTypes.includes(driver.vehicleType);
      const matchesIncidents = advancedFilters.hasIncidents === null || (advancedFilters.hasIncidents ? driver.incidentCount > 0 : driver.incidentCount === 0);
      const matchesWhitelist = advancedFilters.isWhitelisted === null || advancedFilters.isWhitelisted === driver.whitelisted;
      const matchesBlacklist = advancedFilters.isBlacklisted === null || advancedFilters.isBlacklisted === driver.blacklisted;
      return matchesStatus && matchesRiskScore && matchesRating && matchesMinDeliveries && matchesMaxDeliveries && matchesVehicle && matchesIncidents && matchesWhitelist && matchesBlacklist;
    });
  }, [drivers, driverSearchResults, searchQuery, statusFilter, advancedFilters]);

  const stats = useMemo(() => ({
    total: drivers?.length || 0,
    approved: drivers?.filter(d => d.status === 'APPROVED').length || 0,
    pending: drivers?.filter(d => d.status === 'PENDING_APPROVAL').length || 0,
    blocked: drivers?.filter(d => d.status === 'BLOCKED' || d.status === 'BLACKLIST').length || 0,
  }), [drivers]);

  const { execute: executeWithUndo } = useUndoableAction<string>();

  const handleSwipeApprove = useCallback((driverId: string) => {
    const driver = drivers?.find(d => d.id === driverId); if (!driver) return;
    executeWithUndo({ action: async () => { approveMutation.mutate(driverId); return driverId; }, undo: async () => { blockMutation.mutate({ id: driverId, reason: 'Aprovação desfeita' }); }, description: `Motorista ${driver.name} aprovado` });
  }, [drivers, approveMutation, blockMutation, executeWithUndo]);

  const handleSwipeBlock = useCallback((driverId: string) => {
    const driver = drivers?.find(d => d.id === driverId); if (!driver) return;
    executeWithUndo({ action: async () => { blockMutation.mutate({ id: driverId, reason: 'Bloqueado via swipe' }); return driverId; }, undo: async () => { approveMutation.mutate(driverId); }, description: `Motorista ${driver.name} bloqueado` });
  }, [drivers, blockMutation, approveMutation, executeWithUndo]);

  const handleSwipeWhitelist = useCallback((driverId: string) => {
    const driver = drivers?.find(d => d.id === driverId); if (!driver) return;
    executeWithUndo({ action: async () => { addWhitelistMutation.mutate({ id: driverId, reason: 'Adicionado via swipe' }); return driverId; }, undo: async () => { removeWhitelistMutation.mutate(driverId); }, description: `${driver.name} adicionado à Whitelist` });
  }, [drivers, addWhitelistMutation, removeWhitelistMutation, executeWithUndo]);

  const handleSwipeBlacklist = useCallback((driverId: string) => {
    const driver = drivers?.find(d => d.id === driverId); if (!driver) return;
    executeWithUndo({ action: async () => { addBlacklistMutation.mutate({ id: driverId, reason: 'Adicionado via swipe' }); return driverId; }, undo: async () => { removeBlacklistMutation.mutate(driverId); }, description: `${driver.name} adicionado à Blacklist` });
  }, [drivers, addBlacklistMutation, removeBlacklistMutation, executeWithUndo]);

  const getSwipeActions = useCallback((driver: DriverWithIncidents) => {
    const leftActions: ReturnType<typeof createSwipeAction>[] = [];
    const rightActions: ReturnType<typeof createSwipeAction>[] = [];
    if (driver.status === 'PENDING_APPROVAL') {
      leftActions.push(createSwipeAction('approve', 'Aprovar', <ApproveIcon className="w-5 h-5" />, 'success', () => handleSwipeApprove(driver.id)));
      rightActions.push(createSwipeAction('block', 'Bloquear', <BlockIcon className="w-5 h-5" />, 'destructive', () => handleSwipeBlock(driver.id)));
    } else if (driver.status === 'APPROVED') {
      leftActions.push(createSwipeAction('whitelist', 'Whitelist', <ShieldIcon className="w-5 h-5" />, 'success', () => handleSwipeWhitelist(driver.id)));
      rightActions.push(createSwipeAction('blacklist', 'Blacklist', <BlockIcon className="w-5 h-5" />, 'destructive', () => handleSwipeBlacklist(driver.id)));
    } else if (driver.status === 'WHITELIST') {
      rightActions.push(createSwipeAction('remove', 'Remover', <TrashIcon className="w-5 h-5" />, 'warning', () => removeWhitelistMutation.mutate(driver.id)));
    } else if (driver.status === 'BLACKLIST') {
      leftActions.push(createSwipeAction('remove', 'Remover', <ShieldIcon className="w-5 h-5" />, 'success', () => removeBlacklistMutation.mutate(driver.id)));
    }
    return { leftActions, rightActions };
  }, [handleSwipeApprove, handleSwipeBlock, handleSwipeWhitelist, handleSwipeBlacklist, removeWhitelistMutation, removeBlacklistMutation]);

  const openDialog = (type: 'whitelist' | 'blacklist' | 'block', driver: DriverWithIncidents) => {
    setDialogType(type); setSelectedDriver(driver); setReasonText(''); setDialogOpen(true);
  };

  const handleDialogConfirm = () => {
    if (!selectedDriver) return;
    if (dialogType === 'whitelist') addWhitelistMutation.mutate({ id: selectedDriver.id, reason: reasonText });
    else if (dialogType === 'blacklist') addBlacklistMutation.mutate({ id: selectedDriver.id, reason: reasonText || 'Sem motivo informado' });
    else if (dialogType === 'block') blockMutation.mutate({ id: selectedDriver.id, reason: reasonText });
    setDialogOpen(false);
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error) return (
    <div className="h-full flex flex-col p-6 animate-fade-in">
      <div className="flex-1 flex items-center justify-center">
        <Card variant="glass" className="border-destructive/30 max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-destructive/20 to-rose/20 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-destructive" /></div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Erro ao Carregar</h3>
            <p className="text-muted-foreground">Não foi possível carregar os motoristas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <div className="flex flex-col gap-4 md:gap-6 p-3 sm:p-4 md:p-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl sm:rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25"><Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" /></div>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight"><span className="gradient-text">Motoristas</span></h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2"><Sparkles className="w-3 h-3 text-accent" /><span className="truncate">Gerenciamento e avaliação</span></p>
            </div>
          </div>
          <div className="sm:hidden"><DataRefreshIndicator lastUpdated={lastUpdated} isRefreshing={isFetching} onRefresh={handleRefresh} variant="minimal" /></div>
          <Card variant="glass" className="hidden sm:block px-3 sm:px-5 py-2 sm:py-3">
            <div className="flex items-center gap-3 sm:gap-5">
              <Button variant="ghost" size="icon-sm" onClick={handleRefresh} disabled={isFetching} className="h-8 w-8"><RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /></Button>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-1.5 sm:gap-2"><span className="status-dot-glow bg-success" /><span className="text-sm font-semibold">{stats.approved}</span><span className="text-xs text-muted-foreground hidden md:inline">aprovados</span></div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-1.5 sm:gap-2"><span className="status-dot-glow bg-warning" /><span className="text-sm font-semibold">{stats.pending}</span><span className="text-xs text-muted-foreground hidden md:inline">pendentes</span></div>
              <div className="w-px h-5 bg-border" />
              <div className="flex items-center gap-1.5 sm:gap-2"><span className="status-dot-glow bg-destructive" /><span className="text-sm font-semibold">{stats.blocked}</span><span className="text-xs text-muted-foreground hidden md:inline">bloqueados</span></div>
            </div>
          </Card>
        </div>

        <div className="hidden sm:block"><DataRefreshIndicator lastUpdated={lastUpdated} isRefreshing={isFetching} onRefresh={handleRefresh} variant="compact" /></div>
        <DriverStatsCards stats={stats} />

        {/* Filters */}
        <Card variant="glass" className="animate-fade-up" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
              <SearchInputWithHelp value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nome, telefone, placa... (? para ajuda)" className="flex-1" inputClassName="bg-secondary/50 border-border/50 h-10" />
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {['ALL', 'WHITELIST', 'APPROVED', 'PENDING_APPROVAL', 'BLOCKED', 'BLACKLIST'].map(status => (
                  <Button key={status} variant={statusFilter === status ? 'gradient' : 'outline'} size="sm" onClick={() => setStatusFilter(status as DriverStatus | 'ALL')} className={cn("shrink-0 h-8 px-2.5 sm:px-3 text-xs sm:text-sm", statusFilter !== status ? 'bg-secondary/50' : '')}>
                    {status === 'ALL' ? 'Todos' : statusLabels[status as DriverStatus]}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredDrivers.length > 0 && <div className="text-xs text-muted-foreground text-center py-2 animate-pulse">💡 Dica: Deslize os cards para ações rápidas (aprovar, bloquear, etc.)</div>}

        {/* Drivers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {filteredDrivers.map((driver, index) => {
              const { leftActions, rightActions } = getSwipeActions(driver);
              return (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  index={index}
                  leftActions={leftActions}
                  rightActions={rightActions}
                  onApprove={(id) => approveMutation.mutate(id)}
                  onOpenDialog={openDialog}
                  onRemoveWhitelist={(id) => removeWhitelistMutation.mutate(id)}
                  onRemoveBlacklist={(id) => removeBlacklistMutation.mutate(id)}
                  isApproving={approveMutation.isPending}
                />
              );
            })}
          </AnimatePresence>
        </div>

        {filteredDrivers.length === 0 && (
          <div className="flex-1 flex items-center justify-center animate-fade-in">
            <Card variant="gradient" className="max-w-md">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8 text-primary" /></div>
                <p className="text-lg font-medium text-foreground">Nenhum motorista encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros de busca</p>
              </CardContent>
            </Card>
          </div>
        )}

        <DriverConfirmDialog open={dialogOpen} onOpenChange={setDialogOpen} dialogType={dialogType} selectedDriver={selectedDriver} reasonText={reasonText} onReasonChange={setReasonText} onConfirm={handleDialogConfirm} />
      </div>
    </PullToRefresh>
  );
}
