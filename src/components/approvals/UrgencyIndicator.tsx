import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  AlertTriangle, 
  Flame, 
  Timer,
  AlertOctagon,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getElapsedTime, formatElapsedTimeCompact, type ElapsedTime } from '@/utils/timeUtils';

type UrgencyLevel = 'normal' | 'attention' | 'urgent' | 'critical' | 'overdue';

interface UrgencyConfig {
  level: UrgencyLevel;
  label: string;
  shortLabel: string;
  icon: typeof Clock;
  bgClass: string;
  textClass: string;
  borderClass: string;
  pulseClass?: string;
  glowClass?: string;
}

const URGENCY_CONFIGS: Record<UrgencyLevel, UrgencyConfig> = {
  normal: {
    level: 'normal',
    label: 'Tempo Normal',
    shortLabel: 'Normal',
    icon: Clock,
    bgClass: 'bg-muted/50',
    textClass: 'text-muted-foreground',
    borderClass: 'border-muted',
  },
  attention: {
    level: 'attention',
    label: 'Requer Atenção',
    shortLabel: 'Atenção',
    icon: Timer,
    bgClass: 'bg-warning/10',
    textClass: 'text-warning',
    borderClass: 'border-warning/30',
    pulseClass: 'animate-pulse',
  },
  urgent: {
    level: 'urgent',
    label: 'Urgente',
    shortLabel: 'Urgente',
    icon: AlertTriangle,
    bgClass: 'bg-accent/15',
    textClass: 'text-accent',
    borderClass: 'border-accent/40',
    pulseClass: 'animate-pulse',
    glowClass: 'shadow-accent/20',
  },
  critical: {
    level: 'critical',
    label: 'Crítico',
    shortLabel: 'Crítico',
    icon: Flame,
    bgClass: 'bg-destructive/15',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/40',
    pulseClass: 'animate-pulse',
    glowClass: 'shadow-destructive/30 shadow-lg',
  },
  overdue: {
    level: 'overdue',
    label: 'Atrasado - Ação Imediata',
    shortLabel: 'Atrasado',
    icon: AlertOctagon,
    bgClass: 'bg-destructive/25',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/60',
    pulseClass: 'animate-pulse',
    glowClass: 'shadow-destructive/40 shadow-xl',
  },
};

function getUrgencyLevel(totalMinutes: number): UrgencyLevel {
  if (totalMinutes < 5) return 'normal';
  if (totalMinutes < 15) return 'attention';
  if (totalMinutes < 30) return 'urgent';
  if (totalMinutes < 60) return 'critical';
  return 'overdue';
}

interface UrgencyIndicatorProps {
  requestedAt: Date;
  className?: string;
  variant?: 'badge' | 'compact' | 'full' | 'minimal';
  showLabel?: boolean;
  animated?: boolean;
}

export function UrgencyIndicator({ 
  requestedAt, 
  className,
  variant = 'badge',
  showLabel = true,
  animated = true
}: UrgencyIndicatorProps) {
  const [elapsed, setElapsed] = useState(() => getElapsedTime(requestedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedTime(requestedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [requestedAt]);

  const urgencyLevel = getUrgencyLevel(elapsed.totalMinutes);
  const config = URGENCY_CONFIGS[urgencyLevel];
  const Icon = config.icon;

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div 
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full",
                config.bgClass,
                config.borderClass,
                "border",
                config.glowClass,
                className
              )}
              animate={animated && urgencyLevel !== 'normal' ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Icon className={cn("w-4 h-4", config.textClass)} />
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label}</p>
            <p className="text-xs opacity-70">Aguardando há {formatElapsedTimeCompact(elapsed)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.div 
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
          config.bgClass,
          config.textClass,
          config.borderClass,
          config.glowClass,
          className
        )}
        animate={animated && urgencyLevel !== 'normal' ? { opacity: [1, 0.7, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      >
        <Icon className="w-3 h-3" />
        <span>{formatElapsedTimeCompact(elapsed)}</span>
      </motion.div>
    );
  }

  if (variant === 'full') {
    return (
      <motion.div 
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border",
          config.bgClass,
          config.borderClass,
          config.glowClass,
          className
        )}
        animate={animated && (urgencyLevel === 'critical' || urgencyLevel === 'overdue') 
          ? { scale: [1, 1.02, 1] } 
          : {}
        }
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg",
          config.bgClass,
          "border",
          config.borderClass
        )}>
          <Icon className={cn("w-5 h-5", config.textClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold", config.textClass)}>{config.label}</p>
          <p className="text-xs text-muted-foreground">
            Aguardando há <span className="font-mono font-medium">{formatElapsedTimeCompact(elapsed)}</span>
          </p>
        </div>
        {urgencyLevel !== 'normal' && (
          <Badge variant={urgencyLevel === 'attention' ? 'warning' : 'destructive'} className="shrink-0">
            {config.shortLabel}
          </Badge>
        )}
      </motion.div>
    );
  }

  // Default: badge
  return (
    <motion.div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border",
        config.bgClass,
        config.textClass,
        config.borderClass,
        config.glowClass,
        config.pulseClass && urgencyLevel !== 'normal' ? config.pulseClass : '',
        className
      )}
    >
      <Icon className="w-4 h-4" />
      <span>Aguardando há {formatElapsedTimeCompact(elapsed)}</span>
      {showLabel && urgencyLevel !== 'normal' && (
        <Badge 
          variant={urgencyLevel === 'attention' ? 'warning' : 'destructive'} 
          className="ml-1 text-[10px] px-1.5 py-0"
        >
          {config.shortLabel}
        </Badge>
      )}
    </motion.div>
  );
}

// Priority Badge Component
interface PriorityBadgeProps {
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const PRIORITY_CONFIG = {
  LOW: { label: 'Baixa', color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-muted' },
  MEDIUM: { label: 'Média', color: 'text-info', bg: 'bg-info/10', border: 'border-info/30' },
  HIGH: { label: 'Alta', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  URGENT: { label: 'Urgente', color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  CRITICAL: { label: 'Crítica', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
};

export function PriorityBadge({ priority, className, size = 'md' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  const isCritical = priority === 'CRITICAL' || priority === 'URGENT';

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-1 font-medium rounded-md border",
        config.bg,
        config.color,
        config.border,
        sizeClasses[size],
        className
      )}
      animate={isCritical ? { scale: [1, 1.05, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1.5 }}
    >
      {isCritical && <Zap className="w-3 h-3" />}
      {config.label}
    </motion.span>
  );
}

// Urgency Ring Component - visual indicator for cards
interface UrgencyRingProps {
  requestedAt: Date;
  className?: string;
}

export function UrgencyRing({ requestedAt, className }: UrgencyRingProps) {
  const [elapsed, setElapsed] = useState(() => getElapsedTime(requestedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsedTime(requestedAt));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [requestedAt]);

  const urgencyLevel = getUrgencyLevel(elapsed.totalMinutes);
  
  const ringColors = {
    normal: 'from-muted via-muted to-muted',
    attention: 'from-warning via-warning/50 to-warning',
    urgent: 'from-accent via-accent/50 to-accent',
    critical: 'from-destructive via-destructive/50 to-destructive',
    overdue: 'from-destructive via-destructive/70 to-destructive',
  };

  if (urgencyLevel === 'normal') return null;

  return (
    <motion.div 
      className={cn(
        "absolute inset-0 rounded-xl pointer-events-none",
        "bg-gradient-to-r",
        ringColors[urgencyLevel],
        "opacity-30",
        className
      )}
      animate={{ opacity: [0.2, 0.4, 0.2] }}
      transition={{ repeat: Infinity, duration: 2 }}
    />
  );
}
