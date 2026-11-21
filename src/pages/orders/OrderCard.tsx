import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Clock } from 'lucide-react';
import { Order, OrderStatus } from '@/types';
import { cn } from '@/lib/utils';
import { HighlightText } from '@/components/ui/highlight-match';
import type { WithMatches } from '@/hooks/useFuseSearch';
import { forwardRef } from 'react';

const statusConfig: Record<OrderStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'muted' | 'live' | 'pending' }> = {
  PENDING: { label: 'Pendente', variant: 'pending' },
  MATCHED: { label: 'Atribuído', variant: 'info' },
  ON_GOING: { label: 'Em Trânsito', variant: 'live' },
  PICKED_UP: { label: 'Coletado', variant: 'info' },
  COMPLETED: { label: 'Concluído', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  REJECTED: { label: 'Rejeitado', variant: 'destructive' },
  EXPIRED: { label: 'Expirado', variant: 'muted' },
  QUOTED: { label: 'Cotado', variant: 'pending' },
  ASSIGNING_DRIVER: { label: 'Atribuindo Motorista', variant: 'info' },
  DELIVERING: { label: 'Entregando', variant: 'live' },
};

const vehicleIcons: Record<string, string> = {
  MOTORCYCLE: '🏍️', CAR: '🚗', MPV: '🚙', VAN: '🚐',
  UV_FIORINO: '🚚', TRUCK: '🚛', TRUCK330: '🚛', TRUCK175: '🚛',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

interface OrderCardProps {
  order: Order;
  index: number;
  searchQuery: string;
  onViewDetails: (order: Order) => void;
}

export const OrderCard = forwardRef<HTMLDivElement, OrderCardProps>(function OrderCard({ order, index, searchQuery, onViewDetails }, ref) {
  const status = statusConfig[order.status];

  return (
    <motion.div
      ref={ref}
      key={order.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card variant="glass" hover="lift" className="overflow-hidden group">
        {/* Card Header */}
        <div className="p-4 border-b border-border/30 bg-gradient-to-r from-secondary/30 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{vehicleIcons[order.vehicleType]}</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {searchQuery.trim() && (order as WithMatches<typeof order>)._matches ? (
                  <HighlightText
                    text={order.internalOrderId || order.lalamoveId}
                    matches={(order as WithMatches<typeof order>)._matches}
                    matchKey={order.internalOrderId ? 'internalOrderId' : 'lalamoveId'}
                  />
                ) : (
                  order.internalOrderId || order.lalamoveId
                )}
              </span>
            </div>
            <Badge variant={status.variant} size="sm" dot={order.status === 'ON_GOING'} pulse={order.status === 'ON_GOING'}>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {searchQuery.trim() && (order as WithMatches<typeof order>)._matches ? (
              <HighlightText text={order.customerName} matches={(order as WithMatches<typeof order>)._matches} matchKey="customerName" />
            ) : (
              order.customerName
            )}
          </p>
        </div>

        {/* Card Body */}
        <CardContent className="p-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-info to-cyan flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                <span className="text-xs text-white font-bold">A</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{order.pickupAddress}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-success to-emerald flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg">
                <span className="text-xs text-white font-bold">B</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{order.deliveryAddress}</p>
            </div>
          </div>

          {order.driverName && (
            <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-secondary/50 border border-border/30">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden">
                {order.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {searchQuery.trim() && (order as WithMatches<typeof order>)._matches ? (
                    <HighlightText text={order.driverName} matches={(order as WithMatches<typeof order>)._matches} matchKey="driverName" />
                  ) : (
                    order.driverName
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{order.driverPhone}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{formatDate(order.scheduledAt)}</span>
            </div>
            <span className="font-bold text-foreground bg-gradient-to-r from-success/15 to-emerald/10 px-2.5 py-1 rounded-lg border border-success/20">
              {formatCurrency(order.totalCost, order.currency)}
            </span>
          </div>

          {order.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {order.tags.map(tag => (
                <Badge key={tag} variant="muted" size="sm">{tag}</Badge>
              ))}
            </div>
          )}
        </CardContent>

        <div className="px-4 pb-4">
          <Button
            variant="outline" size="sm"
            className="w-full bg-secondary/50 group-hover:bg-secondary group-hover:border-primary/30"
            onClick={() => onViewDetails(order)}
          >
            <Eye className="w-4 h-4 mr-2" />
            Ver Detalhes
          </Button>
        </div>
      </Card>
    </motion.div>
  );
});

export { statusConfig };
