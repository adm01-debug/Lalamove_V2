import { DriverApproval } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, AlertTriangle, User, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UrgencyIndicator, PriorityBadge, UrgencyRing } from '@/components/approvals/UrgencyIndicator';
import { SwipeableListItem, createSwipeAction } from '@/components/ui/swipeable-list';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';

interface ApprovalQueueProps {
  approvals: DriverApproval[];
  onApprove?: (approval: DriverApproval) => void;
  onReject?: (approval: DriverApproval) => void;
}

function getRiskColor(score: number): string {
  if (score >= 8) return 'text-destructive';
  if (score >= 6) return 'text-warning';
  if (score >= 4) return 'text-muted-foreground';
  return 'text-success';
}

function getRiskBg(score: number): string {
  if (score >= 8) return 'bg-destructive/20';
  if (score >= 6) return 'bg-warning/20';
  if (score >= 4) return 'bg-muted';
  return 'bg-success/20';
}

function formatTimeAgoValue(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Approval Card Component
function ApprovalCard({ 
  approval, 
  onApprove, 
  onReject,
  showActions = true,
  index = 0
}: { 
  approval: DriverApproval; 
  onApprove?: () => void; 
  onReject?: () => void;
  showActions?: boolean;
  index?: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 hover:bg-secondary/20 transition-colors relative"
    >
      {/* Urgency Ring for critical items */}
      <UrgencyRing requestedAt={approval.requestedAt} />
      <div className="flex items-start gap-4">
        {/* Driver Photo */}
        <div className="relative flex-shrink-0">
          {approval.driver?.photoUrl ? (
            <img 
              src={approval.driver.photoUrl} 
              alt={approval.driver?.name ?? 'Motorista'}
              className="w-12 h-12 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          {/* Risk Score Badge */}
          <div className={cn(
            "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-background",
            getRiskBg(approval.riskScore),
            getRiskColor(approval.riskScore)
          )}>
            {approval.riskScore.toFixed(0)}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-foreground">{approval.driver?.name ?? 'Motorista desconhecido'}</h4>
            <Badge variant="muted" className="text-xs">
              {approval.driver?.totalDeliveries ?? 0} entregas
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Pedido: <span className="font-mono text-foreground">{approval.order?.lalamoveId ?? approval.orderId ?? 'N/A'}</span>
          </p>

          {/* Risk Factors */}
          <div className="space-y-1">
            {approval.riskFactors.slice(0, 2).map((factor, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="w-3 h-3 text-warning" />
                <span>{factor}</span>
              </div>
            ))}
            {approval.riskFactors.length > 2 && (
              <p className="text-xs text-muted-foreground pl-5">
                +{approval.riskFactors.length - 2} fatores de risco
              </p>
            )}
          </div>
        </div>

        {/* Time & Actions */}
        <div className="flex flex-col items-end gap-2">
          {/* SLA Timer with visual urgency */}
          <UrgencyIndicator 
            requestedAt={approval.requestedAt} 
            variant="compact"
            showLabel={false}
          />
          
          {/* Priority badge if available */}
          {approval.approvalPriority && (
            <PriorityBadge priority={approval.approvalPriority} size="sm" />
          )}
          
          {showActions && (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onReject}
              >
                <X className="w-4 h-4 mr-1" />
                Rejeitar
              </Button>
              <Button 
                variant="success" 
                size="sm"
                onClick={onApprove}
              >
                <Check className="w-4 h-4 mr-1" />
                Aprovar
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ApprovalQueue({ approvals, onApprove, onReject }: ApprovalQueueProps) {
  const isMobile = useIsMobile();

  if (approvals.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-success/20 mx-auto mb-4 flex items-center justify-center">
          <Check className="w-6 h-6 text-success" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">Nenhuma aprovação pendente</h3>
        <p className="text-sm text-muted-foreground">Todas as solicitações foram processadas</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-foreground">Fila de Aprovação</h3>
        </div>
        <div className="flex items-center gap-2">
          {isMobile && (
            <Badge variant="outline" className="text-xs gap-1">
              <Hand className="w-3 h-3" />
              Deslize
            </Badge>
          )}
          <Badge variant="warning">{approvals.length} pendente{approvals.length > 1 ? 's' : ''}</Badge>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        <AnimatePresence mode="popLayout">
          {approvals.map((approval, index) => {
            // Mobile: Swipe actions
            if (isMobile) {
              return (
                <SwipeableListItem
                  key={approval.id}
                  leftActions={[
                    createSwipeAction(
                      'approve',
                      'Aprovar',
                      <Check className="w-5 h-5" />,
                      'success',
                      () => onApprove?.(approval)
                    ),
                  ]}
                  rightActions={[
                    createSwipeAction(
                      'reject',
                      'Rejeitar',
                      <X className="w-5 h-5" />,
                      'destructive',
                      () => onReject?.(approval)
                    ),
                  ]}
                >
                  <ApprovalCard 
                    approval={approval} 
                    showActions={false}
                    index={index}
                  />
                </SwipeableListItem>
              );
            }

            // Desktop: Regular buttons
            return (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={() => onApprove?.(approval)}
                onReject={() => onReject?.(approval)}
                index={index}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
