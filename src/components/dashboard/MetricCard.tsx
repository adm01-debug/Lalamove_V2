import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sparkline, TrendIndicator } from '@/components/ui/sparkline';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MetricCardProps {
  value: string | number;
  label: string;
  icon: LucideIcon;
  trend?: number;
  sparkline?: number[];
  comparison?: string;
  target?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  size?: 'default' | 'large';
  live?: boolean;
  className?: string;
  onClick?: () => void;
  index?: number;
}

const variantStyles = {
  default: {
    iconBg: 'bg-secondary',
    iconColor: 'text-foreground',
    accentColor: 'text-muted-foreground',
    gradient: 'from-secondary/30 to-muted/20',
    progressBg: 'bg-muted-foreground',
  },
  primary: {
    iconBg: 'bg-gradient-to-br from-primary/30 to-accent/20',
    iconColor: 'text-primary',
    accentColor: 'text-primary',
    gradient: 'from-primary/10 to-accent/5',
    progressBg: 'bg-primary',
  },
  success: {
    iconBg: 'bg-gradient-to-br from-success/30 to-emerald/20',
    iconColor: 'text-success',
    accentColor: 'text-success',
    gradient: 'from-success/10 to-emerald/5',
    progressBg: 'bg-success',
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-warning/30 to-amber/20',
    iconColor: 'text-warning',
    accentColor: 'text-warning',
    gradient: 'from-warning/10 to-amber/5',
    progressBg: 'bg-warning',
  },
  destructive: {
    iconBg: 'bg-gradient-to-br from-destructive/30 to-rose/20',
    iconColor: 'text-destructive',
    accentColor: 'text-destructive',
    gradient: 'from-destructive/10 to-rose/5',
    progressBg: 'bg-destructive',
  },
  info: {
    iconBg: 'bg-gradient-to-br from-info/30 to-cyan/20',
    iconColor: 'text-info',
    accentColor: 'text-info',
    gradient: 'from-info/10 to-cyan/5',
    progressBg: 'bg-info',
  }
};

export function MetricCard({
  value,
  label,
  icon: Icon,
  trend,
  sparkline,
  comparison,
  target,
  variant = 'default',
  size = 'default',
  live = false,
  className,
  onClick,
  index = 0
}: MetricCardProps) {
  const style = variantStyles[variant];
  const isLarge = size === 'large';
  
  // Calculate target progress
  const targetProgress = target && typeof value === 'number' 
    ? Math.min(Math.round((value / target.value) * 100), 100)
    : null;
  
  return (
    <Card
      variant="glass"
      hover={onClick ? "lift" : "none"}
      className={cn(
        "relative overflow-hidden animate-fade-up group",
        onClick && "cursor-pointer",
        isLarge && "col-span-2",
        className
      )}
      style={{ animationDelay: `${index * 75}ms` }}
      onClick={onClick}
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-70",
        style.gradient
      )} />
      
      {/* Decorative blur */}
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br from-primary/5 to-accent/5 blur-3xl" />
      
      <div className="relative p-6">
        {/* Live indicator */}
        {live && (
          <div className="absolute top-4 right-4">
            <Badge variant="live" size="sm" dot pulse>
              LIVE
            </Badge>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-3 rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-110",
            style.iconBg
          )}>
            <Icon className={cn(
              isLarge ? "w-6 h-6" : "w-5 h-5",
              style.iconColor
            )} />
          </div>
          
          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
              trend >= 0 
                ? "bg-success/15 text-success" 
                : "bg-destructive/15 text-destructive"
            )}>
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        
        {/* Value */}
        <div className="mb-2">
          <div className={cn(
            "font-bold text-foreground tracking-tight",
            isLarge ? "text-5xl" : "text-4xl"
          )}>
            {value}
          </div>
          <div className="text-sm text-muted-foreground mt-1.5 font-medium">
            {label}
          </div>
        </div>
        
        {/* Sparkline */}
        {sparkline && sparkline.length > 0 && (
          <div className="mb-3 mt-4">
            <Sparkline
              data={sparkline}
              color={style.accentColor}
              height={28}
            />
          </div>
        )}
        
        {/* Comparison */}
        {comparison && (
          <div className="text-xs text-muted-foreground mt-2">
            {comparison}
          </div>
        )}
        
        {/* Target progress */}
        {targetProgress !== null && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground font-medium">{target.label}</span>
              <span className={cn(
                "font-bold",
                targetProgress >= 100 ? "text-success" : "text-foreground"
              )}>
                {targetProgress}%
              </span>
            </div>
            <div className="w-full h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-700 rounded-full",
                  targetProgress >= 100 ? "bg-gradient-to-r from-success to-emerald" : style.progressBg
                )}
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
