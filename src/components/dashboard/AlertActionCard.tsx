import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlertAction {
  text: string;
  count?: number;
  action: string;
  onClick: () => void;
}

interface AlertActionCardProps {
  severity: 'critical' | 'warning' | 'info';
  icon: LucideIcon;
  title: string;
  items: AlertAction[];
  primaryAction: () => void;
  primaryLabel: string;
  className?: string;
}

const severityStyles = {
  critical: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/50',
    iconBg: 'bg-destructive/20',
    iconColor: 'text-destructive',
    glow: 'shadow-lg shadow-destructive/20',
    pulse: true
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/50',
    iconBg: 'bg-warning/20',
    iconColor: 'text-warning',
    glow: 'shadow-lg shadow-warning/20',
    pulse: false
  },
  info: {
    bg: 'bg-info/10',
    border: 'border-info/50',
    iconBg: 'bg-info/20',
    iconColor: 'text-info',
    glow: 'shadow-lg shadow-info/20',
    pulse: false
  }
};

export function AlertActionCard({
  severity,
  icon: Icon,
  title,
  items,
  primaryAction,
  primaryLabel,
  className
}: AlertActionCardProps) {
  const style = severityStyles[severity];
  
  return (
    <div className={cn(
      "relative rounded-xl p-6 border-2 transition-all duration-300 hover:scale-[1.02]",
      style.bg,
      style.border,
      style.glow,
      className
    )}>
      {/* Pulse animation for critical */}
      {style.pulse && (
        <div className="absolute top-4 right-4">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
          </span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "p-3 rounded-lg",
          style.iconBg
        )}>
          <Icon className={cn("w-6 h-6", style.iconColor)} />
        </div>
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      </div>
      
      {/* Items */}
      <div className="space-y-2 mb-4">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors cursor-pointer group"
            onClick={item.onClick}
          >
            <div className="flex items-center gap-2">
              {item.count !== undefined && (
                <span className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                  style.iconBg,
                  style.iconColor
                )}>
                  {item.count}
                </span>
              )}
              <span className="text-sm text-foreground">{item.text}</span>
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              {item.action} →
            </span>
          </div>
        ))}
      </div>
      
      {/* Primary CTA */}
      <Button
        onClick={primaryAction}
        className={cn(
          "w-full font-semibold",
          severity === 'critical' && "bg-destructive hover:bg-destructive/90",
          severity === 'warning' && "bg-warning hover:bg-warning/90",
          severity === 'info' && "bg-primary hover:bg-primary/90"
        )}
        size="lg"
      >
        {primaryLabel}
      </Button>
    </div>
  );
}
