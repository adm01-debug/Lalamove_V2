import { useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  User, 
  Truck, 
  Star, 
  AlertTriangle,
  UserPlus,
  UserMinus,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import { UrgencyIndicator, PriorityBadge, UrgencyRing } from './UrgencyIndicator';
import { DriverApproval } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

interface SwipeableApprovalCardProps {
  approval: DriverApproval;
  onApprove: (approval: DriverApproval, notes?: string) => void;
  onReject: (approval: DriverApproval, notes?: string) => void;
  onWhitelist: (approval: DriverApproval) => void;
  onBlacklist: (approval: DriverApproval, reason?: string) => void;
  onExpand?: (approval: DriverApproval) => void;
  isProcessing?: boolean;
  className?: string;
}

export function SwipeableApprovalCard({
  approval,
  onApprove,
  onReject,
  onWhitelist,
  onBlacklist,
  onExpand,
  isProcessing = false,
  className
}: SwipeableApprovalCardProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const [swipeState, setSwipeState] = useState<'idle' | 'swiping-left' | 'swiping-right'>('idle');
  
  const x = useMotionValue(0);
  const SWIPE_THRESHOLD = 100;

  // Transforms for visual feedback
  const leftOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rightOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const leftScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const rightScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);

  const handleDragStart = useCallback(() => {
    setSwipeState('idle');
  }, []);

  const handleDrag = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 30) {
      setSwipeState('swiping-right');
    } else if (info.offset.x < -30) {
      setSwipeState('swiping-left');
    } else {
      setSwipeState('idle');
    }
  }, []);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > SWIPE_THRESHOLD || velocity > 500) {
      // Swipe right = Approve
      onApprove(approval);
    } else if (offset < -SWIPE_THRESHOLD || velocity < -500) {
      // Swipe left = Reject
      onReject(approval);
    }
    
    x.set(0);
    setSwipeState('idle');
  }, [approval, onApprove, onReject, x]);

  const riskLevel = approval.riskScore >= 7 ? 'critical' : approval.riskScore >= 5 ? 'warning' : 'info';
  const riskColors = {
    critical: 'border-destructive/40',
    warning: 'border-warning/40',
    info: 'border-info/30',
  };

  // Get priority from approval if available
  const priority = approval.approvalPriority;

  return (
    <div className={cn("relative", className)}>
      {/* Swipe action backgrounds - Only on mobile */}
      {isMobile && (
        <>
          {/* Approve background (swipe right) */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-success via-success/80 to-success/60 rounded-xl flex items-center px-6"
            style={{ opacity: leftOpacity }}
          >
            <motion.div 
              className="flex items-center gap-3 text-white"
              style={{ scale: leftScale }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-lg">Aprovar</p>
                <p className="text-sm opacity-80">Liberar motorista</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Reject background (swipe left) */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-l from-destructive via-destructive/80 to-destructive/60 rounded-xl flex items-center justify-end px-6"
            style={{ opacity: rightOpacity }}
          >
            <motion.div 
              className="flex items-center gap-3 text-white"
              style={{ scale: rightScale }}
            >
              <div>
                <p className="font-bold text-lg text-right">Rejeitar</p>
                <p className="text-sm opacity-80 text-right">Negar acesso</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <X className="w-7 h-7" />
              </div>
            </motion.div>
          </motion.div>
        </>
      )}

      {/* Main Card */}
      {isMobile ? (
        <motion.div
          style={{ x, scale: cardScale }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
        >
          <CardInner 
            approval={approval}
            riskLevel={riskLevel}
            riskColors={riskColors}
            swipeState={swipeState}
            isMobile={isMobile}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            priority={priority}
            isProcessing={isProcessing}
            onApprove={onApprove}
            onReject={onReject}
            onWhitelist={onWhitelist}
            onBlacklist={onBlacklist}
          />
        </motion.div>
      ) : (
        <CardInner 
          approval={approval}
          riskLevel={riskLevel}
          riskColors={riskColors}
          swipeState={swipeState}
          isMobile={isMobile}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          priority={priority}
          isProcessing={isProcessing}
          onApprove={onApprove}
          onReject={onReject}
          onWhitelist={onWhitelist}
          onBlacklist={onBlacklist}
        />
      )}
    </div>
  );
}

interface CardInnerProps {
  approval: DriverApproval;
  riskLevel: 'critical' | 'warning' | 'info';
  riskColors: Record<string, string>;
  swipeState: 'idle' | 'swiping-left' | 'swiping-right';
  isMobile: boolean;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  isProcessing: boolean;
  onApprove: (approval: DriverApproval, notes?: string) => void;
  onReject: (approval: DriverApproval, notes?: string) => void;
  onWhitelist: (approval: DriverApproval) => void;
  onBlacklist: (approval: DriverApproval, reason?: string) => void;
}

function CardInner({
  approval,
  riskLevel,
  riskColors,
  swipeState,
  isMobile,
  isExpanded,
  setIsExpanded,
  priority,
  isProcessing,
  onApprove,
  onReject,
  onWhitelist,
  onBlacklist,
}: CardInnerProps) {
  return (
    <Card 
      variant="glass" 
      hover={!isMobile ? "lift" : undefined}
      className={cn(
        "relative overflow-hidden transition-all",
        riskColors[riskLevel],
        swipeState === 'swiping-right' && "border-success/50",
        swipeState === 'swiping-left' && "border-destructive/50",
        isMobile && "touch-pan-y"
      )}
    >
      {/* Urgency Ring */}
      <UrgencyRing requestedAt={approval.requestedAt} />

      {/* Risk indicator bar */}
      <div className={cn(
        "h-1 bg-gradient-to-r",
        riskLevel === 'critical' ? 'from-destructive via-destructive/70 to-destructive/50' :
        riskLevel === 'warning' ? 'from-warning via-warning/70 to-warning/50' :
        'from-info via-info/70 to-info/50'
      )} />
      
      {/* Card Header */}
      <div className="p-3 sm:p-4 border-b border-border/30">
        <div className="flex items-start justify-between gap-3">
          {/* Driver Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              {approval.driver?.photoUrl ? (
                <img 
                  src={approval.driver.photoUrl} 
                  alt={approval.driver.name} 
                  className="w-12 h-12 rounded-xl object-cover border-2 border-border/50 shadow-lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 via-accent/20 to-info/20 flex items-center justify-center border border-primary/20">
                  <User className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background",
                riskLevel === 'critical' ? 'bg-destructive' :
                riskLevel === 'warning' ? 'bg-warning' : 'bg-success'
              )} />
            </div>
            
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{approval.driver?.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Truck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{approval.driver?.vehicleType}</span>
                {approval.driver?.vehiclePlate && (
                  <span className="font-mono bg-secondary/50 px-1.5 py-0.5 rounded">
                    {approval.driver.vehiclePlate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Risk Score */}
          <div className="flex flex-col items-end gap-2">
            <RiskScoreGauge score={approval.riskScore} size="sm" />
            {priority && (
              <PriorityBadge priority={priority} size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Card Content */}
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: approval.driver?.totalDeliveries, label: 'Total' },
            { value: approval.driver?.completedDeliveries, label: 'Feitas' },
            { value: approval.driver?.rating?.toFixed(1), label: 'Nota', icon: Star },
            { value: `${(approval.driver?.totalDeliveries ?? 0) > 0 ? (((approval.driver?.completedDeliveries ?? 0) / (approval.driver?.totalDeliveries ?? 1)) * 100).toFixed(0) : 0}%`, label: 'Taxa' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-2 rounded-lg bg-secondary/30 border border-border/30">
              <div className="flex items-center justify-center gap-0.5">
                {stat.icon && <stat.icon className="w-3 h-3 text-warning fill-warning" />}
                <p className="text-sm font-bold text-foreground">{stat.value}</p>
              </div>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Risk Factors */}
        {approval.riskFactors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            {approval.riskFactors.slice(0, 3).map((factor, idx) => (
              <Badge key={idx} variant="destructive" className="text-[10px] px-1.5 py-0">
                {factor}
              </Badge>
            ))}
            {approval.riskFactors.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                +{approval.riskFactors.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Urgency Indicator */}
        <UrgencyIndicator requestedAt={approval.requestedAt} variant="compact" />

        {/* Mobile swipe hint */}
        {isMobile && (
          <div className="flex items-center justify-center gap-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <X className="w-3 h-3 text-destructive" />
              ← Rejeitar
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1">
              Aprovar →
              <Check className="w-3 h-3 text-success" />
            </span>
          </div>
        )}

        {/* Desktop Actions */}
        {!isMobile && (
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground h-9"
              onClick={() => onReject(approval)}
              disabled={isProcessing}
            >
              <X className="w-4 h-4 mr-1.5" />
              Rejeitar
            </Button>
            <Button 
              size="sm"
              className="flex-1 bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 text-success-foreground h-9"
              onClick={() => onApprove(approval)}
              disabled={isProcessing}
            >
              <Check className="w-4 h-4 mr-1.5" />
              Aprovar
            </Button>
          </div>
        )}

        {/* Advanced Actions (collapsed) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-2 border-t border-border/30">
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 text-success border-success/30 hover:bg-success/10 h-8 text-xs"
                  onClick={() => onWhitelist(approval)}
                  disabled={isProcessing}
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Whitelist
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 h-8 text-xs"
                  onClick={() => onBlacklist(approval)}
                  disabled={isProcessing}
                >
                  <UserMinus className="w-3.5 h-3.5 mr-1" />
                  Blacklist
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Menos opções' : 'Mais opções'}
          <ChevronRight className={cn("w-3.5 h-3.5 ml-1 transition-transform", isExpanded && "rotate-90")} />
        </Button>
      </CardContent>
    </Card>
  );
}

// Compact version for lists
interface CompactApprovalCardProps {
  approval: DriverApproval;
  onApprove: (approval: DriverApproval) => void;
  onReject: (approval: DriverApproval) => void;
  onClick?: () => void;
  isProcessing?: boolean;
}

export function CompactApprovalCard({
  approval,
  onApprove,
  onReject,
  onClick,
  isProcessing = false,
}: CompactApprovalCardProps) {
  const riskLevel = approval.riskScore >= 7 ? 'critical' : approval.riskScore >= 5 ? 'warning' : 'info';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl bg-card/50 border transition-all cursor-pointer hover:bg-card/80",
        riskLevel === 'critical' ? 'border-destructive/30' :
        riskLevel === 'warning' ? 'border-warning/30' : 'border-border/50'
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {approval.driver?.photoUrl ? (
          <img 
            src={approval.driver.photoUrl} 
            alt={approval.driver.name} 
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{approval.driver?.name}</p>
        <div className="flex items-center gap-2">
          <UrgencyIndicator requestedAt={approval.requestedAt} variant="compact" className="text-[10px] px-1.5 py-0.5" />
          <span className="text-[10px] text-muted-foreground">Score: {approval.riskScore.toFixed(1)}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          onClick={(e) => { e.stopPropagation(); onReject(approval); }}
          disabled={isProcessing}
        >
          <X className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 text-success hover:bg-success/10"
          onClick={(e) => { e.stopPropagation(); onApprove(approval); }}
          disabled={isProcessing}
        >
          <Check className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
