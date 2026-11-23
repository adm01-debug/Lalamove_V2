import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DataRefreshIndicator } from '@/components/ui/data-refresh-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, Plus, Download, Upload, Package, CheckCircle2, XCircle,
  Truck, Sparkles, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useRecentOrders } from '@/hooks/useRecentOrders';
import { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
const OrderDetailModal = lazy(() =>
  import('@/components/orders/OrderDetailModal').then(m => ({ default: m.OrderDetailModal }))
);
const NewOrderDialog = lazy(() =>
  import('@/components/orders/NewOrderDialog').then(m => ({ default: m.NewOrderDialog }))
);
import { FetchOrderDialog } from '@/components/orders/FetchOrderDialog';
import { ImportCSVDialog } from '@/components/orders/ImportCSVDialog';
import { useQueryClient } from '@tanstack/react-query';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { OrderCard, statusConfig } from './orders/OrderCard';

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const q = searchParams.get('q') || '';
  const statusFilter = (searchParams.get('status') as OrderStatus | 'ALL') || 'ALL';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [searchQuery, setSearchQuery] = useState(q);
  
  // Sync local search to URL with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams);
      if (searchQuery) {
        if (newParams.get('q') !== searchQuery) {
          newParams.set('q', searchQuery);
          newParams.set('page', '1');
          setSearchParams(newParams, { replace: true });
        }
      } else if (newParams.has('q')) {
        newParams.delete('q');
        newParams.set('page', '1');
        setSearchParams(newParams, { replace: true });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, setSearchParams, searchParams]);

  const setStatusFilter = useCallback((status: OrderStatus | 'ALL') => {
    const newParams = new URLSearchParams(searchParams);
    if (status !== 'ALL') newParams.set('status', status);
    else newParams.delete('status');
    newParams.set('page', '1');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const setCurrentPage = useCallback((updater: number | ((prev: number) => number)) => {
    const nextItem = typeof updater === 'function' ? updater(currentPage) : updater;
    const newParams = new URLSearchParams(searchParams);
    if (nextItem > 1) newParams.set('page', nextItem.toString());
    else newParams.delete('page');
    setSearchParams(newParams);
  }, [currentPage, searchParams, setSearchParams]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const queryClient = useQueryClient();
  const { data: ordersData, isLoading, error, isFetching } = useRecentOrders(currentPage, statusFilter, q);
  const orders = ordersData?.orders || [];
  const totalPages = ordersData?.totalPages ?? 1;
  const totalCount = ordersData?.totalCount ?? 0;

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['recent-orders'] });
    setLastUpdated(new Date());
  }, [queryClient]);

  const searchKeys = useMemo(() => ['lalamoveId', 'customerName', 'internalOrderId'], []);
  const searchResults = useFuseSearchWithMatches(orders || [], searchKeys, searchQuery);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    // If we have a search query, we still use Fuse for local highlighting and refinement if needed,
    // but the primary filtering is now done at the database level.
    if (searchQuery.trim()) {
      return searchResults.map(r => ({ ...r.item, _matches: r.matches }));
    }
    
    return orders;
  }, [orders, searchResults, searchQuery]);

  const stats = useMemo(() => ({
    total: totalCount,
    inProgress: orders?.filter(o => ['ON_GOING', 'PICKED_UP', 'MATCHED'].includes(o.status)).length ?? 0,
    completed: orders?.filter(o => o.status === 'COMPLETED').length ?? 0,
    cancelled: orders?.filter(o => ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(o.status)).length ?? 0,
  }), [orders, totalCount]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 md:gap-6 p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-4"><Skeleton className="w-12 h-12 rounded-xl" /><div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-48" /></div></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">{[1,2,3,4].map(i => <Card key={i} variant="glass"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">{[1,2,3,4,5,6].map(i => <Card key={i} variant="glass"><CardContent className="p-4 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-full" /></CardContent></Card>)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col p-6 animate-fade-in">
        <div className="flex-1 flex items-center justify-center">
          <Card variant="glass" className="border-destructive/30 max-w-md">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-destructive/20 to-rose/20 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-destructive" /></div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Erro ao Carregar</h3>
              <p className="text-muted-foreground">Não foi possível carregar os pedidos</p>
              <Button onClick={handleRefresh} variant="outline" className="mt-4"><RefreshCw className="w-4 h-4 mr-2" />Tentar Novamente</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <div className="flex flex-col gap-4 md:gap-6 p-3 sm:p-4 md:p-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-success to-emerald rounded-xl sm:rounded-2xl blur-xl opacity-50 animate-pulse" />
              <div className="relative p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-success to-emerald shadow-lg shadow-success/25">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-success-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight"><span className="gradient-text">Pedidos</span></h2>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2"><Sparkles className="w-3 h-3 text-accent" /><span className="truncate">Gerencie entregas Lalamove</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="sm:hidden"><DataRefreshIndicator lastUpdated={lastUpdated} isRefreshing={isFetching} onRefresh={handleRefresh} variant="minimal" /></div>
            <Button variant="outline" size="icon" aria-label="Atualizar pedidos" className="bg-secondary/50 hidden sm:flex h-9 w-9 sm:h-10 sm:w-10" onClick={handleRefresh} disabled={isFetching}><RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} /></Button>
            <Button variant="outline" size="sm" className="bg-secondary/50 h-9 sm:h-10 px-2.5 sm:px-4" onClick={() => setFetchDialogOpen(true)}><Search className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Buscar por ID</span></Button>
            <Button variant="outline" size="sm" className="bg-secondary/50 h-9 sm:h-10 px-2.5 sm:px-4" onClick={() => setImportDialogOpen(true)}><Upload className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Importar CSV</span></Button>
            <Button variant="outline" size="sm" className="bg-secondary/50 h-9 sm:h-10 px-2.5 sm:px-4"><Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Exportar</span></Button>
            <Button variant="gradient" size="sm" className="h-9 sm:h-10 px-2.5 sm:px-4" onClick={() => setNewOrderDialogOpen(true)}><Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Novo Pedido</span></Button>
          </div>
        </div>

        <div className="hidden sm:block"><DataRefreshIndicator lastUpdated={lastUpdated} isRefreshing={isFetching} onRefresh={handleRefresh} variant="compact" /></div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          {[
            { icon: Package, value: stats.total, label: 'Total', variant: 'primary' as const },
            { icon: Truck, value: stats.inProgress, label: 'Em andamento', variant: 'warning' as const },
            { icon: CheckCircle2, value: stats.completed, label: 'Concluídos', variant: 'success' as const },
            { icon: XCircle, value: stats.cancelled, label: 'Cancelados', variant: 'destructive' as const },
          ].map((stat, index) => (
            <Card 
              key={stat.label} 
              variant={
                stat.variant === 'primary' ? 'gradientPrimary' :
                stat.variant === 'success' ? 'gradientSuccess' :
                stat.variant === 'warning' ? 'gradientWarning' :
                'gradientDestructive'
              }
              hover="lift" 
              className="animate-fade-up overflow-hidden" 
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <CardContent className="p-3 sm:p-4 relative">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg",
                    stat.variant === 'primary' && "bg-gradient-to-br from-primary/30 to-accent/20",
                    stat.variant === 'success' && "bg-gradient-to-br from-success/30 to-emerald/20",
                    stat.variant === 'warning' && "bg-gradient-to-br from-warning/30 to-amber/20",
                    stat.variant === 'destructive' && "bg-gradient-to-br from-destructive/30 to-rose/20"
                  )}>
                    <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5",
                      stat.variant === 'primary' && "text-primary", stat.variant === 'success' && "text-success",
                      stat.variant === 'warning' && "text-warning", stat.variant === 'destructive' && "text-destructive"
                    )} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-3xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card variant="glass" className="animate-fade-up" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
              <SearchInputWithHelp value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por ID, cliente... (? para ajuda)" className="flex-1" inputClassName="bg-secondary/50 border-border/50 h-10" />
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {['ALL', 'PENDING', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED'].map((status) => (
                  <Button key={status} variant={statusFilter === status ? 'gradient' : 'outline'} size="sm"
                    onClick={() => setStatusFilter(status as OrderStatus | 'ALL')}
                    className={cn("shrink-0 h-8 px-2.5 sm:px-3 text-xs sm:text-sm", statusFilter !== status ? 'bg-secondary/50' : '')}
                  >
                    {status === 'ALL' ? 'Todos' : statusConfig[status as OrderStatus].label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout" initial={false}>
            {filteredOrders.map((order, index) => (
              <OrderCard key={order.id} order={order} index={index} searchQuery={searchQuery}
                onViewDetails={(o) => { setSelectedOrder(o); setDetailModalOpen(true); }}
              />
            ))}
          </AnimatePresence>
        </div>

        {filteredOrders.length === 0 && !isLoading && (
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title="Nenhum pedido encontrado"
            description="Tente ajustar os filtros de busca"
            action={{ label: 'Novo pedido', onClick: () => setNewOrderDialogOpen(true) }}
            className="flex-1 animate-fade-in"
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} · {totalCount} pedidos</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1 || isFetching} onClick={() => setCurrentPage(p => p - 1)} className="h-9"><ChevronLeft className="w-4 h-4 mr-1" />Anterior</Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages || isFetching} onClick={() => setCurrentPage(p => p + 1)} className="h-9">Próxima<ChevronRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </div>
        )}

        <Suspense fallback={null}>
          <OrderDetailModal order={selectedOrder} open={detailModalOpen} onOpenChange={setDetailModalOpen} />
        </Suspense>
        <FetchOrderDialog open={fetchDialogOpen} onOpenChange={setFetchDialogOpen} onSuccess={handleRefresh} />
        <ImportCSVDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onSuccess={handleRefresh} />
        <Suspense fallback={null}>
          <NewOrderDialog open={newOrderDialogOpen} onOpenChange={setNewOrderDialogOpen} onSuccess={handleRefresh} />
        </Suspense>
      </div>
    </PullToRefresh>
  );
}
