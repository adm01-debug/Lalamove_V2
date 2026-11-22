import { logger } from '@/utils/logger';
import { useState, forwardRef, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  Bell,
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
  KeyRound,
  Copy,
  ExternalLink,
  Star,
  Ban,

} from 'lucide-react';
import { toast } from 'sonner';
import { Order, OrderStatus } from '@/types';
import { useEvaluateDriver } from '@/hooks/useEvaluateDriver';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import { supabase } from '@/integrations/supabase/client';
import { StatusTimeline } from './StatusTimeline';
import { OrderTrackingMap } from '@/components/map/OrderTrackingMap';
import { OrderGeoEvents } from './OrderGeoEvents';
import { evaluateOrderOperation, validatePriorityFee } from '@/lib/lalamoveOrderEdit';
import { changeDriverReasonOptions, cancelOrderReasonOptions } from '@/lib/lalamoveReasons';
import { useFleetMutation, UapiError } from '@/hooks/useLalamoveUapi';


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
  QUOTED: { label: 'Cotado', variant: 'muted' },
  ASSIGNING_DRIVER: { label: 'Atribuindo Motorista', variant: 'info' },
  DELIVERING: { label: 'Entregando', variant: 'warning' },
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
  const [priorityReason, setPriorityReason] = useState('');
  const [showPriorityInput, setShowPriorityInput] = useState(false);
  const [showChangeDriver, setShowChangeDriver] = useState(false);
  const [changeDriverReason, setChangeDriverReason] = useState<string>('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelNotes, setCancelNotes] = useState<string>('');

  // Motivos vêm do contrato canônico (src/lib/lalamoveReasons.ts) — a API
  // recusa qualquer código fora dessa lista com ERR_INVALID_FIELD.
  const changeDriverReasons = changeDriverReasonOptions;
  const cancelReasons = cancelOrderReasonOptions;


  const changeDriverMutation = useMutation({
    mutationFn: async ({ orderId, driverId, reason }: { orderId: string; driverId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('lalamove-api', {
        body: { action: 'change-driver', orderId, driverId, reason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Solicitação de troca de motorista enviada');
      setShowChangeDriver(false);
      setChangeDriverReason('');
    },
    onError: (err: Error) => toast.error('Erro ao trocar motorista', { description: err.message }),
  });

  // Frota enterprise no contexto do pedido: o `driverId` da v3 é o mesmo
  // identificador aceito pelas listas de favoritos/bloqueados da UAPI.
  const fleetMutation = useFleetMutation();

  const handleFleetAction = async (action: 'add' | 'block') => {
    if (!order.driverId) return;
    try {
      await fleetMutation.mutateAsync({ driverFid: order.driverId, action });
      toast.success(
        action === 'add'
          ? 'Motorista adicionado aos favoritos.'
          : 'Motorista bloqueado para pedidos futuros.',
      );
    } catch (err) {
      toast.error(
        err instanceof UapiError ? err.message : 'Falha ao atualizar a frota Lalamove.',
      );
    }
  };


  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, reason, notes }: { orderId: string; reason: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke('lalamove-api', {
        body: { action: 'cancel', orderId, reason, notes: notes || undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Pedido cancelado com sucesso');
      setShowCancel(false);
      setCancelReason('');
      setCancelNotes('');
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error('Erro ao cancelar', { description: err.message }),
  });

  const priorityMutation = useMutation({
    mutationFn: async ({ orderId, amount, reason }: { orderId: string; amount: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('lalamove-api', {
        body: { action: 'priority-fee', orderId, amount, reason: reason || undefined },
      });
      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Bônus de prioridade aplicado', {
        description: 'A Lalamove recomputará o matching com o novo valor.',
      });
      setPriorityFee('');
      setPriorityReason('');
      setShowPriorityInput(false);
    },
    onError: (err: Error) => toast.error('Erro ao adicionar bônus', { description: err.message }),
  });

  // Bloco B — a janela de cada operação vem da matriz canônica (ERR_ORDER_EDIT
  // e afins são previstos localmente, antes de gastar uma chamada na Lalamove).
  const editContext = { status: order.status, driverId: order.driverId ?? '' };
  const cancelVerdict = evaluateOrderOperation('cancel', editContext);
  const priorityVerdict = evaluateOrderOperation('priorityFee', editContext);
  const changeDriverVerdict = evaluateOrderOperation('changeDriver', editContext);
  const editVerdict = evaluateOrderOperation('edit', editContext);

  const canCancel = cancelVerdict.allowed;
  const canAddPriority = priorityVerdict.allowed;
  const canChangeDriver = changeDriverVerdict.allowed;
  const isTerminal = ['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(order.status);

  const priorityCheck = validatePriorityFee(priorityFee);

  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
      {/* Bloco B — janela de operações (previne ERR_ORDER_EDIT/ERR_CANCELLATION). */}
      {!isTerminal && (!editVerdict.allowed || !canCancel || !canAddPriority) && (
        <div className="rounded-md border border-border/50 bg-muted/40 p-3 space-y-1">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            Operações indisponíveis neste status
          </p>
          {!editVerdict.allowed && (
            <p className="text-[11px] text-muted-foreground">Editar: {editVerdict.reason}</p>
          )}
          {!canCancel && (
            <p className="text-[11px] text-muted-foreground">Cancelar: {cancelVerdict.reason}</p>
          )}
          {!canAddPriority && (
            <p className="text-[11px] text-muted-foreground">Bônus: {priorityVerdict.reason}</p>
          )}
          {!canChangeDriver && (
            <p className="text-[11px] text-muted-foreground">
              Trocar motorista: {changeDriverVerdict.reason}
            </p>
          )}
        </div>
      )}
      {/* Priority Fee */}
      {canAddPriority && (
        <div className="space-y-2">
          {showPriorityInput ? (
            <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-warning" /> Bônus de prioridade (Lalamove v3)
              </p>
              <p className="text-xs text-muted-foreground">
                O valor deve ser <strong>maior</strong> que o atual — a Lalamove não permite reduções.
                Teto de segurança: R$ 500,00.
              </p>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Valor (ex: 5.00)"
                  value={priorityFee}
                  onChange={(e) => setPriorityFee(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="500"
                  inputMode="decimal"
                  className="w-32"
                  aria-label="Valor do bônus"
                />
              </div>
              {priorityFee && priorityCheck.error && (
                <p className="text-xs text-destructive" role="alert">
                  {priorityCheck.error}
                </p>
              )}

              <textarea
                value={priorityReason}
                onChange={(e) => setPriorityReason(e.target.value.slice(0, 200))}
                placeholder="Motivo (opcional, máx. 200 caracteres — ex.: pedido urgente do cliente)"
                className="w-full min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Motivo do bônus"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setShowPriorityInput(false); setPriorityFee(''); setPriorityReason(''); }}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    priorityMutation.mutate({
                      orderId: order.lalamoveId,
                      amount: String(priorityCheck.amount),
                      reason: priorityReason,
                    })
                  }
                  disabled={priorityMutation.isPending || !priorityCheck.valid}
                >
                  {priorityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar bônus'}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowPriorityInput(true)}>
              <Zap className="w-4 h-4" />
              Adicionar bônus de prioridade
            </Button>
          )}
        </div>
      )}

      {/* Change Driver */}
      {canChangeDriver && (
        <div className="space-y-2">
          {showChangeDriver ? (
            <div className="flex flex-wrap items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={changeDriverReason} onValueChange={setChangeDriverReason}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {changeDriverReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (!order.driverId || !changeDriverReason) return;
                  if (confirm('Confirmar solicitação de troca de motorista?')) {
                    changeDriverMutation.mutate({
                      orderId: order.lalamoveId,
                      driverId: order.driverId,
                      reason: changeDriverReason,
                    });
                  }
                }}
                disabled={changeDriverMutation.isPending || !changeDriverReason}
              >
                {changeDriverMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Troca'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowChangeDriver(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowChangeDriver(true)}>
              <User className="w-4 h-4" />
              Trocar Motorista
            </Button>
          )}
        </div>
      )}

      {/* Frota no contexto do pedido — favoritar/bloquear o motorista atual */}
      {order.driverId && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={fleetMutation.isPending}
            onClick={() => handleFleetAction('add')}
          >
            <Star className="w-4 h-4" />
            Favoritar motorista
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={fleetMutation.isPending}
            onClick={() => handleFleetAction('block')}
          >
            <Ban className="w-4 h-4" />
            Bloquear motorista
          </Button>
        </div>
      )}




      {/* Cancel with reason */}
      {canCancel && showCancel && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-foreground">Motivo do cancelamento</p>
          <Select value={cancelReason} onValueChange={setCancelReason}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o motivo" />
            </SelectTrigger>
            <SelectContent>
              {cancelReasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <textarea
            value={cancelNotes}
            onChange={(e) => setCancelNotes(e.target.value.slice(0, 1000))}
            placeholder="Observações (opcional, máx. 1000 caracteres)"
            className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Observações do cancelamento"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setShowCancel(false); setCancelReason(''); setCancelNotes(''); }}>
              Voltar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={cancelMutation.isPending || !cancelReason}
              onClick={() => cancelMutation.mutate({ orderId: order.lalamoveId, reason: cancelReason, notes: cancelNotes })}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Confirmar Cancelamento
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          {canCancel && !showCancel && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setShowCancel(true)}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="w-4 h-4" />
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
interface StopProof {
  id: string;
  stop_id: string;
  pod_status?: string | null;
  pod_image_url?: string | null;
  pod_delivered_at?: string | null;
  pop_status?: string | null;
  pop_image_url?: string | null;
  pop_picked_up_at?: string | null;
  delivery_code?: string | null;
  delivery_code_status?: string | null;
}

interface Stop {
  id: string;
  order_id: string;
  stop_index: number;
  address?: string;
  pod_image_url?: string | null;
  pod_delivered_at?: string | null;
  pod_status?: string | null;
  lalamove_stop_proofs?: StopProof[] | null;
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

    // Fetch POD/POP stops data + proofs granulares (delivery code)
    const { data: stopsData, isError: stopsError } = useQuery({
      queryKey: ['order-stops', order?.id],
      queryFn: async (): Promise<Stop[]> => {
        if (!order?.id) return [];
        const { data } = await supabase
          .from('lalamove_stops')
          .select('*, lalamove_stop_proofs(*)')
          .eq('order_id', order.id)
          .order('stop_index');
        return (data ?? []) as Stop[];
      },
      enabled: !!order?.id && open,
    });

    /**
     * Etapa 58 — dados do mini-mapa: coordenadas ficam em `lalamove_orders` (o objeto
     * `Order` da UI não carrega lat/lng) e a rota contratada em `active_tracking`.
     */
    const { data: trackingMapData } = useQuery({
      queryKey: ['order-tracking-map', order?.id],
      queryFn: async () => {
        if (!order?.id) return null;
        const [{ data: coords }, { data: tracking }] = await Promise.all([
          supabase
            .from('lalamove_orders')
            .select('pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude')
            .eq('id', order.id)
            .maybeSingle(),
          supabase
            .from('active_tracking')
            .select('current_latitude, current_longitude, expected_route, tracking_status')
            .eq('order_id', order.id)
            .order('last_updated', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        const num = (v: unknown): number | null => {
          if (v === null || v === undefined || v === '') return null;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };
        return {
          pickup: coords
            ? { lat: num(coords.pickup_latitude), lng: num(coords.pickup_longitude) }
            : null,
          delivery: coords
            ? { lat: num(coords.delivery_latitude), lng: num(coords.delivery_longitude) }
            : null,
          driver: tracking
            ? { lat: num(tracking.current_latitude), lng: num(tracking.current_longitude) }
            : null,
          expectedRoute: tracking?.expected_route ?? null,
          // Etapa 79: o mini-mapa é lazy — só monta quando o rastreio está de fato ativo.
          isTrackingActive: tracking?.tracking_status === 'ACTIVE',
        };
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
              <div className="flex items-center gap-2">
                {order.shareLink && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8"
                      onClick={() => window.open(order.shareLink, '_blank', 'noopener,noreferrer')}
                      aria-label="Abrir link de rastreio Lalamove"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Rastrear
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(order.shareLink!);
                          toast.success('Link de rastreio copiado');
                        } catch {
                          toast.error('Não foi possível copiar o link');
                        }
                      }}
                      aria-label="Copiar link de rastreio"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                <Badge variant={status.variant} className="text-sm">
                  {status.label}
                </Badge>
              </div>
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

            {/* Trajeto no mapa (etapa 58) — lazy (etapa 79): sem tracking ativo o
                mini-mapa não é instanciado, evitando map load sem uso. */}
            {trackingMapData?.isTrackingActive ? (
              <div className="glass-card p-4 rounded-lg">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Trajeto
                </h3>
                <OrderTrackingMap
                  pickup={trackingMapData?.pickup}
                  delivery={trackingMapData?.delivery}
                  driver={trackingMapData?.driver}
                  expectedRoute={trackingMapData?.expectedRoute}
                  className="h-56 w-full"
                />
              </div>
            ) : (
              order.shareLink && (
                <div className="glass-card p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Trajeto
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    O rastreamento deste pedido não está ativo no momento.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(order.shareLink!, '_blank', 'noopener,noreferrer')}
                  >
                    Abrir rastreio Lalamove
                    <ExternalLink className="w-3.5 h-3.5 ml-2" />
                  </Button>
                </div>
              )
            )}

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

            {/* Guardian Intelligence Section */}
            {(order.status === 'ON_GOING' || (order.pod_required && !order.pod_url)) && (
              <div className="glass-card p-4 rounded-lg border-primary/20 bg-primary/5 animate-in zoom-in-95 duration-300">
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Guardian Intelligence
                </h3>
                <div className="space-y-3">
                  {order.status === 'ON_GOING' && (
                    <div className="flex items-start gap-3 p-2 rounded bg-background/50 border border-border/50">
                      <div className="p-2 rounded-full bg-warning/20">
                        <Clock className="w-4 h-4 text-warning" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Monitoramento de Parada</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Motorista monitorado com limite de {order.stalled_threshold_minutes || 15} min. 
                          {order.auto_notify_supplier ? " Notificação automática de fornecedor ativa." : " Notificação manual configurada."}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Ativo</Badge>
                    </div>
                  )}
                  {order.pod_required && !order.pod_url && (
                    <div className="flex items-start gap-3 p-2 rounded bg-background/50 border border-border/50">
                      <div className="p-2 rounded-full bg-destructive/20">
                        <Camera className="w-4 h-4 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Falta Prova de Entrega (POD)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Este pedido exige comprovação fotográfica. Alerta Guardian disparado para o motorista.
                        </p>
                      </div>
                      <Badge variant="destructive" className="animate-pulse">Crítico</Badge>
                    </div>
                  )}
                  {order.supplier_contact && (
                    <div className="flex items-center justify-between p-2 rounded bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium">Fornecedor: {order.supplier_contact}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => toast.info(`Contatando fornecedor: ${order.supplier_contact}`)}>
                        Contatar via WhatsApp
                      </Button>
                    </div>
                  )}
                </div>
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

            {/* Delivery Codes (Lalamove v3) */}
            {stopsError && (
              <div className="glass-card p-4 rounded-lg border-destructive/30">
                <p className="text-sm text-destructive">
                  Não foi possível carregar as paradas deste pedido.
                </p>
              </div>
            )}
            {(() => {
              const stops = (stopsData ?? []) as Stop[];
              const codes = stops
                .map((s) => {
                  const proof = s.lalamove_stop_proofs?.[0];
                  return proof?.delivery_code
                    ? {
                        stopId: s.id,
                        stopIndex: s.stop_index,
                        address: s.address,
                        code: proof.delivery_code,
                        status: proof.delivery_code_status,
                      }
                    : null;
                })
                .filter((v): v is NonNullable<typeof v> => v !== null);

              if (codes.length === 0) return null;

              return (
                <div className="glass-card p-4 rounded-lg border-primary/20 bg-primary/5">
                  <h3 className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Códigos de Entrega
                  </h3>
                  <div className="space-y-2">
                    {codes.map((c) => (
                      <div
                        key={c.stopId}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background/60 border border-border/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" size="sm">
                              Parada {c.stopIndex}
                            </Badge>
                            {c.status && (
                              <Badge
                                variant={c.status.toUpperCase() === 'VERIFIED' ? 'success' : 'muted'}
                                size="sm"
                              >
                                {c.status}
                              </Badge>
                            )}
                          </div>
                          {c.address && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{c.address}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="px-3 py-1.5 rounded-md bg-primary/10 text-primary font-mono text-base font-bold tracking-widest">
                            {c.code}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Copiar código de entrega"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(c.code);
                                toast.success('Código copiado');
                              } catch {
                                toast.error('Não foi possível copiar');
                              }
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* POD/POP - Provas de Entrega */}
            {stopsData && stopsData.length > 0 && (stopsData as Stop[]).some((s) => s.pod_image_url || s.lalamove_stop_proofs?.[0]?.pod_image_url || s.lalamove_stop_proofs?.[0]?.pop_image_url) && (
              <div className="glass-card p-4 rounded-lg">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Provas de Entrega
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(stopsData as Stop[]).map((stop) => {
                    const proof = stop.lalamove_stop_proofs?.[0];
                    const imgUrl = proof?.pod_image_url ?? proof?.pop_image_url ?? stop.pod_image_url;
                    if (!imgUrl) return null;
                    const isPickup = stop.stop_index === 0 || !!proof?.pop_image_url;
                    const status = isPickup ? proof?.pop_status : (proof?.pod_status ?? stop.pod_status);
                    const timestamp = isPickup
                      ? proof?.pop_picked_up_at
                      : (proof?.pod_delivered_at ?? stop.pod_delivered_at);
                    return (
                      <div key={stop.id} className="space-y-1.5">
                        <Badge variant="secondary" size="sm">
                          {isPickup ? 'Coleta (POP)' : `Entrega ${stop.stop_index} (POD)`}
                        </Badge>
                        <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={imgUrl}
                            alt={`Prova - Parada ${stop.stop_index}`}
                            className="w-full h-32 object-cover rounded-lg border border-border/50 hover:opacity-80 transition-opacity cursor-pointer"
                            loading="lazy"
                          />
                        </a>
                        {timestamp && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(timestamp).toLocaleString('pt-BR')}
                          </p>
                        )}
                        {status && (
                          <Badge
                            variant={
                              status.toLowerCase() === 'delivered' || status.toLowerCase() === 'picked_up'
                                ? 'success'
                                : 'muted'
                            }
                            size="sm"
                          >
                            {status}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Eventos geográficos: aproximação/chegada do motorista + reenvio
                manual do aviso (etapas 62/63 do plano Google). */}
            <div className="glass-card p-4 rounded-lg">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Eventos de rastreio
              </h3>
              <OrderGeoEvents orderId={order.id} driverId={order.driverId} />
            </div>

            {/* Timeline de Status (auditável) */}
            <StatusTimeline orderId={order.id} />

            {/* Order Actions */}
            <OrderActions order={order} onOpenChange={onOpenChange} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
