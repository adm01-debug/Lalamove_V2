import { logger } from '@/utils/logger';
import { useState, forwardRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Clock,
  Phone,
  User,
  Package,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Shield,
  Camera,
  XCircle,
  DollarSign,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Order, OrderStatus } from '@/types';
import { useEvaluateDriver } from '@/hooks/useEvaluateDriver';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import { supabase } from '@/integrations/supabase/client';

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'muted' }
> = {
  PENDING: { label: 'Pendente', variant: 'muted' },
  MATCHED: { label: 'Atribuído', variant: 'info' },
  ON_GOING: { label: 'Em Trânsito', variant: 'warning' },
  PICKED_UP: { label: 'Coletado', variant: 'info' },
  COMPLETED: { label: 'Concluído', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  REJECTED: { label: 'Rejeitado', variant: 'destructive' },
  EXPIRED: { label: 'Expirado', variant: 'muted' },
};

const vehicleIcons: Record<string, string> = {
  MOTORCYCLE: '🏍️',
  CAR: '🚗',
  MPV: '🚙',
  VAN: '🚐',
  UV_FIORINO: '🚚',
  TRUCK: '🚛',
  TRUCK330: '🚛',
  TRUCK175: '🚛',
};

// ========== Order Actions Component ==========
function OrderActions({ order, onOpenChange }: { order: Order; onOpenChange: (open: boolean) => void }) {
  const [priorityFee, setPriorityFee] = useState('');
  const [showPriorityInput, setShowPriorityInput] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('lalamove-api', {
        body: { action: 'cancel', orderId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Pedido cancelado com sucesso');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error('Erro ao cancelar', { description: err.message }),
  });

  const priorityMutation = useMutation({
    mutationFn: async ({ orderId, amount }: { orderId: string; amount: string }) => {
      const { data, error } = await supabase.functions.invoke('lalamove-api', {
        body: { action: 'priority-fee', orderId, amount },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Taxa prioritária adicionada!');
      setPriorityFee('');
      setShowPriorityInput(false);
    },
    onError: (err: Error) => toast.error('Erro ao adicionar taxa', { description: err.message }),
  });

  const canCancel = ['PENDING', 'MATCHED', 'ASSIGNING_DRIVER'].includes(order.status);
  const canAddPriority = ['PENDING', 'MATCHED', 'ASSIGNING_DRIVER'].includes(order.status);
  const isTerminal = ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.status);

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
      {/* Priority Fee */}
      {canAddPriority && (
        <div className="space-y-2">
          {showPriorityInput ? (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Valor (ex: 5.00)"
                value={priorityFee}
                onChange={(e) => setPriorityFee(e.target.value)}
                type="number"
                step="0.01"
                min="1"
                className="w-32"
              />
              <Button
                size="sm"
                onClick={() => priorityMutation.mutate({ orderId: order.lalamoveId, amount: priorityFee })}
                disabled={priorityMutation.isPending || !priorityFee}
              >
                {priorityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowPriorityInput(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPriorityInput(true)}>
              <Zap className="w-4 h-4" />
              Adicionar Taxa Prioritária
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (confirm('Tem certeza que deseja cancelar este pedido?')) {
                  cancelMutation.mutate(order.lalamoveId);
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancelar Pedido
            </Button>
          )}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

// forwardRef aqui evita warnings quando este modal está dentro de animações/layout
interface Stop {
  id: string;
  order_id: string;
  stop_index: number;
  pod_image_url?: string;
  pod_delivered_at?: string;
  pod_status?: string;
}

export const OrderDetailModal = forwardRef<HTMLDivElement, OrderDetailModalProps>(
  function OrderDetailModal({ order, open, onOpenChange }, ref) {
    const evaluateDriver = useEvaluateDriver();
    const [evaluationResult, setEvaluationResult] = useState<{
      riskScore: number;
      riskLevel: string;
      approved: boolean;
      recommendation: string;
    } | null>(null);

    // Fetch POD/POP stops data
    const { data: stopsData } = useQuery({
      queryKey: ['order-stops', order?.id],
      queryFn: async () => {
        if (!order?.id) return [];
        const { data } = await supabase
          .from('lalamove_stops')
          .select('*')
          .eq('order_id', order.id)
          .order('stop_index');
        return data || [];
      },
      enabled: !!order?.id && open,
    });

    if (!order) return null;

    const status = statusConfig[order.status];
    const hasDriver = order.driverId && order.driverName;

    const handleEvaluateDriver = async () => {
      if (!order.driverId) return;

      try {
        const result = await evaluateDriver.mutateAsync({
          driverId: order.driverId,
          orderId: order.id,
          driverName: order.driverName,
        });

        setEvaluationResult({
          riskScore: result.evaluation.riskAnalysis.score,
          riskLevel: result.evaluation.riskAnalysis.level,
          approved: result.evaluation.approved,
          recommendation: result.evaluation.recommendation,
        });
      } catch (error) {
        logger.error('Failed to evaluate driver:', error);
      }
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{vehicleIcons[order.vehicleType]}</span>
                <div>
                  <DialogTitle className="text-xl">
                    {order.internalOrderId || order.lalamoveId}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">Lalamove ID: {order.lalamoveId}</p>
                </div>
              </div>
              <Badge variant={status.variant} className="text-sm">
                {status.label}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Customer Info */}
            <div className="glass-card p-4 rounded-lg">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Cliente
              </h3>
              <p className="font-medium text-foreground">{order.customerName}</p>
              {order.customerPhone && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {order.customerPhone}
                </div>
              )}
            </div>

            {/* Addresses */}
            <div className="glass-card p-4 rounded-lg">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereços
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-primary font-bold">A</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Coleta</p>
                    <p className="text-sm text-foreground">{order.pickupAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-success font-bold">B</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Entrega</p>
                    <p className="text-sm text-foreground">{order.deliveryAddress}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver Info */}
            {hasDriver && (
              <div className="glass-card p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Motorista
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEvaluateDriver}
                    disabled={evaluateDriver.isPending}
                    className="gap-2"
                  >
                    {evaluateDriver.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Avaliando...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Avaliar Motorista
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-medium">
                    {order.driverName?.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{order.driverName}</p>
                    {order.driverPhone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {order.driverPhone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Evaluation Result */}
                {evaluationResult && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-4">
                      <RiskScoreGauge score={evaluationResult.riskScore} size="md" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {evaluationResult.approved ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Aprovado
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Requer Atenção
                            </Badge>
                          )}
                          <Badge variant="secondary">{evaluationResult.riskLevel}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{evaluationResult.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Details */}
            <div className="glass-card p-4 rounded-lg">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Detalhes do Pedido
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Agendado para</p>
                  <p className="text-sm text-foreground flex items-center gap-1 mt-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {formatDate(order.scheduledAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {formatCurrency(order.totalCost, order.currency)}
                  </p>
                </div>
                {order.estimatedDelivery && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Previsão de Entrega</p>
                    <p className="text-sm text-foreground mt-1">{formatDate(order.estimatedDelivery)}</p>
                  </div>
                )}
                {order.actualDelivery && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Entrega Real</p>
                    <p className="text-sm text-foreground mt-1">{formatDate(order.actualDelivery)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {order.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {order.tags.map(tag => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* POD/POP - Provas de Entrega */}
            {stopsData && stopsData.length > 0 && (stopsData as Stop[]).some((s) => s.pod_image_url) && (
              <div className="glass-card p-4 rounded-lg">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Provas de Entrega
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(stopsData as Stop[]).map((stop) => {
                    if (!stop.pod_image_url) return null;
                    return (
                      <div key={stop.id} className="space-y-1.5">
                        <Badge variant="secondary" size="sm">
                          {stop.stop_index === 0 ? 'Coleta (POP)' : `Entrega ${stop.stop_index} (POD)`}
                        </Badge>
                        <a href={stop.pod_image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={stop.pod_image_url}
                            alt={`Prova - Parada ${stop.stop_index}`}
                            className="w-full h-32 object-cover rounded-lg border border-border/50 hover:opacity-80 transition-opacity cursor-pointer"
                            loading="lazy"
                          />
                        </a>
                        {stop.pod_delivered_at && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(stop.pod_delivered_at).toLocaleString('pt-BR')}
                          </p>
                        )}
                        {stop.pod_status && (
                          <Badge variant={stop.pod_status === 'DELIVERED' ? 'success' : 'muted'} size="sm">
                            {stop.pod_status}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order Actions */}
            <OrderActions order={order} onOpenChange={onOpenChange} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
