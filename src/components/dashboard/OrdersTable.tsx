import { forwardRef, useState, useMemo, useEffect } from 'react';
import { Order } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Eye, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Package, 
  User, 
  Truck, 
  DollarSign, 
  Navigation,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { HoverPreview } from '@/components/ui/hover-preview';
import { BatchActionsToolbar } from './BatchActionsToolbar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface OrdersTableProps {
  orders: Order[];
  onViewDetails?: (order: Order) => void;
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted' | 'gradient' | 'gradient-success' | 'gradient-warning' | 'gradient-destructive' | 'glow' | 'glow-success' | 'glow-destructive' | 'live' | 'pending' | 'inactive';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'Pendente', variant: 'muted' },
  MATCHED: { label: 'Atribuído', variant: 'info' },
  ON_GOING: { label: 'Em Trânsito', variant: 'live' },
  PICKED_UP: { label: 'Coletado', variant: 'info' },
  COMPLETED: { label: 'Concluído', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  REJECTED: { label: 'Rejeitado', variant: 'destructive' },
  EXPIRED: { label: 'Expirado', variant: 'muted' },
};

// Guardian: Check for stalled drivers (> 15 min), route deviation (> 15 min delay), or missing PODs
const getGuardianAlert = (order: Order) => {
  if (order.status === 'ON_GOING' || order.status === 'PICKED_UP') {
    if (order.stalled_threshold_minutes && order.stalled_threshold_minutes > 15) {
      return { label: 'Motorista Parado', variant: 'glow-destructive' as BadgeVariant };
    }
    if (order.route_deviation_threshold_minutes && order.route_deviation_threshold_minutes > 15) {
      return { label: 'Desvio de Rota', variant: 'glow-destructive' as BadgeVariant };
    }
  }
  if (order.status === 'COMPLETED' && order.pod_required && !order.pod_url) {
    return { label: 'Falta POD', variant: 'glow-warning' as BadgeVariant };
  }
  return null;
};

const vehicleIcons: Record<string, string> = {
  MOTORCYCLE: '🏍️',
  CAR: '🚗',
  VAN: '🚐',
  TRUCK: '🚛',
};

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

// Mobile card view for orders
function OrderCard({ 
  order, 
  onViewDetails, 
  isSelected, 
  onSelect 
}: { 
  order: Order; 
  onViewDetails?: (order: Order) => void;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const status = statusConfig[order.status] || { label: order.status, variant: 'muted' as const };
  
  return (
    <Card 
      variant="glass" 
      hover="lift"
      className={cn(
        "overflow-hidden cursor-pointer active:scale-[0.98] transition-all touch-manipulation relative",
        isSelected && "ring-2 ring-primary border-primary/50 bg-primary/5 shadow-lg"
      )}
      onClick={() => onViewDetails?.(order)}
    >
      <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={(checked) => onSelect(checked as boolean)}
          className="rounded-md border-primary/20 data-[state=checked]:bg-primary"
        />
      </div>
      <CardContent className="p-3 sm:p-4 pl-10 sm:pl-12">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <span className="text-xl sm:text-2xl flex-shrink-0">{vehicleIcons[order.vehicleType]}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <p className="font-mono text-xs sm:text-sm font-medium text-foreground truncate max-w-[100px] sm:max-w-none">
                  {order.internalOrderId || order.lalamoveId}
                </p>
                <div className="flex gap-1">
                  <Badge variant={status.variant} size="sm" dot={order.status === 'ON_GOING'} pulse={order.status === 'ON_GOING'} className="text-[10px] sm:text-xs">
                    {status.label}
                  </Badge>
                  {getGuardianAlert(order) && (
                    <Badge variant={getGuardianAlert(order)!.variant} size="sm" pulse className="text-[10px] sm:text-xs">
                      {getGuardianAlert(order)!.label}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
                {order.customerName}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
        </div>
        
        <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-border/30 flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {order.estimatedDelivery && (
              <div className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                <span>{formatTime(order.estimatedDelivery)}</span>
              </div>
            )}
            {order.driverName && (
              <div className="flex items-center gap-1 min-w-0">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-secondary flex items-center justify-center text-[9px] sm:text-[10px] font-medium shrink-0">
                  {order.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="truncate max-w-[60px] sm:max-w-[80px]">{order.driverName.split(' ')[0]}</span>
              </div>
            )}
          </div>
          <span className="font-medium text-foreground shrink-0">
            {formatCurrency(order.totalCost, order.currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Desktop table view
interface DesktopProps extends OrdersTableProps {
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  isAllSelected: boolean;
}

function OrdersTableDesktop({ 
  orders, 
  onViewDetails, 
  selectedIds, 
  onToggleSelect, 
  onToggleAll,
  isAllSelected
}: DesktopProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-secondary/30">
            <th className="p-4 w-[40px]">
              <Checkbox 
                checked={isAllSelected}
                onCheckedChange={(checked) => onToggleAll(checked as boolean)}
                className="rounded-md border-primary/20"
              />
            </th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Pedido</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden lg:table-cell">Motorista</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden xl:table-cell">Destino</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">ETA</th>
            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Valor</th>
            <th className="text-right p-4 text-sm font-medium text-muted-foreground">Ações</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, index) => {
            const status = statusConfig[order.status] || { label: order.status, variant: 'muted' as const };
            const isSelected = selectedIds.has(order.id);
            return (
              <HoverPreview
                key={order.id}
                delay={400}
                side="right"
                align="start"
                trigger={
                  <tr 
                    className={cn(
                      "border-b border-border/50 hover:bg-secondary/20 transition-colors animate-fade-in cursor-pointer",
                      isSelected && "bg-primary/5 hover:bg-primary/10"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => onToggleSelect(order.id, !isSelected)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={(checked) => onToggleSelect(order.id, checked as boolean)}
                        className="rounded-md border-primary/20"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{vehicleIcons[order.vehicleType]}</span>
                        <div>
                          <p className="font-medium text-foreground font-mono text-sm">
                            {order.internalOrderId || order.lalamoveId}
                          </p>
                          <p className="text-xs text-muted-foreground">{order.customerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex gap-1 items-center">
                          <Badge variant={status.variant} dot={order.status === 'ON_GOING'} pulse={order.status === 'ON_GOING'}>
                            {status.label}
                          </Badge>
                          {order.auto_notify_supplier && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" size="sm" className="px-1 border-primary/20 text-primary">
                                  <MessageSquare className="w-3 h-3" />
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Notificação Automática Ativa</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {getGuardianAlert(order) && (
                          <Badge variant={getGuardianAlert(order)!.variant} size="sm" pulse className="animate-in fade-in slide-in-from-top-1">
                            {getGuardianAlert(order)!.label}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {order.driverName ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                            {order.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="text-sm text-foreground">{order.driverName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{order.deliveryAddress}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {order.estimatedDelivery ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground font-medium">
                            {formatTime(order.estimatedDelivery)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(order.totalCost, order.currency)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        aria-label="Ver detalhes do pedido"
                        className="min-h-11 min-w-11 md:h-10 md:w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails?.(order);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                }
                preview={
                  <OrderPreviewCard order={order} status={status} />
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Componente de preview para Order
function OrderPreviewCard({ order, status }: { order: Order; status: { label: string; variant: BadgeVariant } }) {
  return (
    <div className="space-y-4 min-w-[280px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <span className="text-2xl">{vehicleIcons[order.vehicleType]}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground">
            {order.internalOrderId || order.lalamoveId}
          </h4>
          <p className="text-sm text-muted-foreground">{order.customerName}</p>
        </div>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </div>

      {/* Route info */}
      <div className="space-y-2 p-3 rounded-lg bg-secondary/30">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5">
            <Navigation className="w-3 h-3 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Origem</p>
            <p className="text-sm text-foreground truncate">{order.pickupAddress}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
            <MapPin className="w-3 h-3 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Destino</p>
            <p className="text-sm text-foreground truncate">{order.deliveryAddress}</p>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20">
          <User className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Motorista</p>
            <p className="text-sm font-medium text-foreground truncate">
              {order.driverName || 'Não atribuído'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Previsão</p>
            <p className="text-sm font-medium text-foreground">
              {order.estimatedDelivery ? formatTime(order.estimatedDelivery) : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20">
          <Truck className="w-4 h-4 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Veículo</p>
            <p className="text-sm font-medium text-foreground capitalize">
              {order.vehicleType.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10">
          <DollarSign className="w-4 h-4 text-success" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="text-sm font-bold text-success">
              {formatCurrency(order.totalCost, order.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2 border-t border-border/50">
        <Eye className="w-3 h-3" />
        <span>Clique para ver detalhes completos</span>
      </div>
    </div>
  );
}

export const OrdersTable = forwardRef<HTMLDivElement, OrdersTableProps>(function OrdersTable({ orders, onViewDetails }, ref) {
  const isMobile = useIsMobile();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(orders.map(o => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const selectedOrders = useMemo(() => 
    orders.filter(o => selectedIds.has(o.id)),
    [orders, selectedIds]
  );

  const isAllSelected = orders.length > 0 && selectedIds.size === orders.length;

  if (orders.length === 0) {
    return (
      <div className="glass-card rounded-xl overflow-hidden" ref={ref}>
        <div className="p-3 sm:p-4 border-b border-border">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
            <Package className="w-4 h-4" />
            Pedidos Recentes
          </h3>
        </div>
        <div className="p-6 sm:p-8 text-center">
          <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum pedido recente</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden relative" ref={ref}>
      <div className="p-3 sm:p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
          <Package className="w-4 h-4" />
          <span className="hidden xs:inline">Pedidos Recentes</span>
          <span className="xs:hidden">Pedidos</span>
        </h3>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Badge variant="glow" size="sm" className="animate-in zoom-in">
              {selectedIds.size} selecionado(s)
            </Badge>
          )}
          <Badge variant="secondary" size="sm">{orders.length}</Badge>
        </div>
      </div>
      
      {isMobile ? (
        <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
          {orders.slice(0, 5).map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onViewDetails={onViewDetails}
              isSelected={selectedIds.has(order.id)}
              onSelect={(checked) => handleToggleSelect(order.id, checked)}
            />
          ))}
          {orders.length > 5 && (
            <Button variant="ghost" className="w-full text-muted-foreground text-sm h-10">
              Ver mais {orders.length - 5} pedidos
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      ) : (
        <OrdersTableDesktop 
          orders={orders} 
          onViewDetails={onViewDetails} 
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleAll={handleToggleAll}
          isAllSelected={isAllSelected}
        />
      )}

      <BatchActionsToolbar 
        selectedOrders={selectedOrders}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  );
});