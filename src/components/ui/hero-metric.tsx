import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCounter, AnimatedPercentage } from './micro-interactions';

interface HeroMetricProps {
  title: string;
  value: number;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percentage' | 'time';
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const colorMap = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    gradient: 'from-primary/20 to-primary/5',
  },
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    gradient: 'from-success/20 to-success/5',
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    gradient: 'from-warning/20 to-warning/5',
  },
  destructive: {
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    gradient: 'from-destructive/20 to-destructive/5',
  },
  info: {
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/20',
    gradient: 'from-info/20 to-info/5',
  },
};

export function HeroMetric({
  title,
  value,
  previousValue,
  format = 'number',
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  size = 'md',
  className,
  onClick,
}: HeroMetricProps) {
  const colors = colorMap[color];
  
  // Calculate trend if not provided
  const calculatedTrend = trend || (previousValue !== undefined
    ? value > previousValue ? 'up' : value < previousValue ? 'down' : 'neutral'
    : 'neutral');
  
  const calculatedTrendValue = trendValue ?? (previousValue !== undefined && previousValue > 0
    ? Math.abs(((value - previousValue) / previousValue) * 100)
    : 0);

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'time':
        return `${val}min`;
      default:
        return val.toLocaleString('pt-BR');
    }
  };

  const TrendIcon = calculatedTrend === 'up' ? TrendingUp : calculatedTrend === 'down' ? TrendingDown : Minus;
  const trendColor = calculatedTrend === 'up' ? 'text-success' : calculatedTrend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  const sizeClasses = {
    sm: {
      container: 'p-3',
      icon: 'w-8 h-8',
      iconInner: 'w-4 h-4',
      value: 'text-xl',
      title: 'text-xs',
    },
    md: {
      container: 'p-4',
      icon: 'w-12 h-12',
      iconInner: 'w-6 h-6',
      value: 'text-3xl',
      title: 'text-sm',
    },
    lg: {
      container: 'p-6',
      icon: 'w-16 h-16',
      iconInner: 'w-8 h-8',
      value: 'text-4xl',
      title: 'text-base',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: onClick ? 1.02 : 1 }}
      whileTap={{ scale: onClick ? 0.98 : 1 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-300",
        colors.border,
        onClick && "cursor-pointer",
        sizes.container,
        className
      )}
    >
      {/* Background gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", colors.gradient)} />
      
      {/* Content */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className={cn("text-muted-foreground font-medium mb-1", sizes.title)}>
            {title}
          </p>
          
          <div className="flex items-baseline gap-2">
            <motion.span 
              className={cn("font-bold tracking-tight", sizes.value)}
              key={value}
            >
              {format === 'number' ? (
                <AnimatedCounter value={value} />
              ) : (
                formatValue(value)
              )}
            </motion.span>
            
            {calculatedTrendValue > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn("flex items-center gap-0.5 text-sm font-medium", trendColor)}
              >
                <TrendIcon className="w-4 h-4" />
                <span>{calculatedTrendValue.toFixed(1)}%</span>
              </motion.div>
            )}
          </div>
          
          {previousValue !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              vs. {formatValue(previousValue)} anterior
            </p>
          )}
        </div>
        
        {/* Icon */}
        <motion.div
          whileHover={{ rotate: 5, scale: 1.1 }}
          className={cn(
            "rounded-xl flex items-center justify-center",
            colors.bg,
            sizes.icon
          )}
        >
          <Icon className={cn(colors.text, sizes.iconInner)} />
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-2xl", colors.bg)} />
    </motion.div>
  );
}

// Compact version for grids
interface CompactMetricProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  color?: keyof typeof colorMap;
  className?: string;
}

export function CompactMetric({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  className,
}: CompactMetricProps) {
  const colors = colorMap[color];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50",
        className
      )}
    >
      <div className={cn("p-2 rounded-lg", colors.bg)}>
        <Icon className={cn("w-4 h-4", colors.text)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold">
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </span>
          {trend && trendValue !== undefined && (
            <span className={cn("flex items-center text-xs", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {trendValue}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Metric with circular progress
interface CircularMetricProps {
  label: string;
  value: number;
  maxValue?: number;
  color?: keyof typeof colorMap;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CircularMetric({
  label,
  value,
  maxValue = 100,
  color = 'primary',
  size = 'md',
  className,
}: CircularMetricProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  // colors removed
  
  const sizeMap = {
    sm: 48,
    md: 64,
    lg: 80,
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("flex flex-col items-center gap-2", className)}
    >
      <AnimatedPercentage
        value={percentage}
        size={sizeMap[size]}
        color={`hsl(var(--${color === 'success' ? 'accent' : color}))`}
      />
      <div className="text-center">
        <p className="text-sm font-semibold">{value.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}
