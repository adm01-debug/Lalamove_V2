import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
  showDots?: boolean;
  showArea?: boolean;
  animated?: boolean;
  annotations?: Array<{
    index: number;
    label: string;
    color?: string;
  }>;
  highlightMax?: boolean;
  highlightMin?: boolean;
}

export function Sparkline({ 
  data, 
  color = 'currentColor',
  height = 32,
  className,
  showDots = false,
  showArea = true,
  animated = true,
  annotations = [],
  highlightMax = false,
  highlightMin = false,
}: SparklineProps) {
  if (!data || data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const width = 100;
  const padding = 4;
  const effectiveHeight = height - (padding * 2);
  
  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = effectiveHeight - ((value - min) / range) * effectiveHeight + padding;
    return { x, y, value };
  });
  
  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  
  // Area fill
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
  
  // Find max and min indices
  const maxIndex = data.indexOf(max);
  const minIndex = data.indexOf(min);
  
  // Trend calculation
  const trend = data[data.length - 1] - data[0];
  const trendColor = trend >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("w-full overflow-visible", className)}
      style={{ height: `${height}px` }}
      preserveAspectRatio="none"
    >
      {/* Gradient definitions */}
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Area fill */}
      {showArea && (
        <motion.path
          d={areaD}
          fill={`url(#sparkline-gradient-${color})`}
          initial={animated ? { opacity: 0 } : undefined}
          animate={animated ? { opacity: 1 } : undefined}
          transition={{ duration: 0.5 }}
        />
      )}
      
      {/* Main line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animated ? { pathLength: 0 } : undefined}
        animate={animated ? { pathLength: 1 } : undefined}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      
      {/* Dots */}
      {showDots && points.map((point, index) => (
        <motion.circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="2"
          fill={color}
          initial={animated ? { scale: 0 } : undefined}
          animate={animated ? { scale: 1 } : undefined}
          transition={{ delay: index * 0.05, duration: 0.2 }}
        />
      ))}
      
      {/* Highlight max point */}
      {highlightMax && (
        <motion.g
          initial={animated ? { scale: 0 } : undefined}
          animate={animated ? { scale: 1 } : undefined}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <circle
            cx={points[maxIndex].x}
            cy={points[maxIndex].y}
            r="4"
            fill="hsl(var(--success))"
            stroke="hsl(var(--background))"
            strokeWidth="2"
          />
        </motion.g>
      )}
      
      {/* Highlight min point */}
      {highlightMin && (
        <motion.g
          initial={animated ? { scale: 0 } : undefined}
          animate={animated ? { scale: 1 } : undefined}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          <circle
            cx={points[minIndex].x}
            cy={points[minIndex].y}
            r="4"
            fill="hsl(var(--destructive))"
            stroke="hsl(var(--background))"
            strokeWidth="2"
          />
        </motion.g>
      )}
      
      {/* Annotations */}
      {annotations.map((annotation, i) => {
        if (annotation.index < 0 || annotation.index >= points.length) return null;
        const point = points[annotation.index];
        return (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="3"
              fill={annotation.color || 'hsl(var(--primary))'}
            />
            <text
              x={point.x}
              y={point.y - 8}
              fontSize="8"
              textAnchor="middle"
              fill={annotation.color || 'hsl(var(--foreground))'}
            >
              {annotation.label}
            </text>
          </g>
        );
      })}
      
      {/* End point indicator */}
      <motion.circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={trendColor}
        initial={animated ? { scale: 0 } : undefined}
        animate={animated ? { scale: 1 } : undefined}
        transition={{ delay: 0.8, type: 'spring' }}
      />
    </svg>
  );
}

interface TrendIndicatorProps {
  value: number;
  previousValue?: number;
  label?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showValue?: boolean;
  showIcon?: boolean;
  animated?: boolean;
  format?: 'percent' | 'number' | 'currency';
  invertColors?: boolean;
}

export function TrendIndicator({ 
  value, 
  previousValue,
  label, 
  className,
  size = 'sm',
  showValue = true,
  showIcon = true,
  animated = true,
  format = 'percent',
  invertColors = false,
}: TrendIndicatorProps) {
  // Calculate percentage change if previousValue is provided
  const percentChange = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : value;
    
  const isPositive = percentChange > 0;
  const isNeutral = percentChange === 0;
  const isNegative = percentChange < 0;
  
  // Invert colors for metrics where down is good (e.g., error rate)
  const colorPositive = invertColors ? 'destructive' : 'success';
  const colorNegative = invertColors ? 'success' : 'destructive';
  
  const sizeClasses = {
    xs: 'text-[10px] px-1 py-0.5 gap-0.5',
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-1 gap-1',
    lg: 'text-base px-3 py-1.5 gap-1.5',
  };
  
  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  const formatValue = () => {
    const absValue = Math.abs(percentChange);
    switch (format) {
      case 'percent':
        return `${absValue.toFixed(1)}%`;
      case 'number':
        return absValue.toFixed(1);
      case 'currency':
        return `$${absValue.toFixed(2)}`;
      default:
        return `${absValue.toFixed(1)}%`;
    }
  };
  
  return (
    <motion.div
      initial={animated ? { scale: 0.8, opacity: 0 } : undefined}
      animate={animated ? { scale: 1, opacity: 1 } : undefined}
      transition={animated ? { type: 'spring' as const, stiffness: 500, damping: 25 } : undefined}
      className={cn(
        "inline-flex items-center rounded-full font-semibold",
        sizeClasses[size],
        isPositive && `bg-${colorPositive}/15 text-${colorPositive}`,
        isNeutral && "bg-muted text-muted-foreground",
        isNegative && `bg-${colorNegative}/15 text-${colorNegative}`,
        className
      )}
    >
      {showIcon && (
        <>
          {isPositive && <ArrowUpRight className={iconSizes[size]} />}
          {isNeutral && <Minus className={iconSizes[size]} />}
          {isNegative && <ArrowDownRight className={iconSizes[size]} />}
        </>
      )}
      {showValue && (
        <span>
          {isPositive && '+'}
          {formatValue()}
        </span>
      )}
      {label && <span className="text-muted-foreground font-normal ml-0.5">{label}</span>}
    </motion.div>
  );
}

// Mini sparkline for inline use
interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function MiniSparkline({ data, width = 50, height = 16, className }: MiniSparklineProps) {
  if (!data || data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const trend = data[data.length - 1] - data[0];
  const color = trend >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' L ');
  
  return (
    <svg
      width={width}
      height={height}
      className={cn("inline-block", className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Comparison indicator
interface ComparisonProps {
  current: number;
  previous: number;
  label?: string;
  className?: string;
  showAbsolute?: boolean;
}

export function Comparison({ current, previous, label, className, showAbsolute = false }: ComparisonProps) {
  const diff = current - previous;
  const percentChange = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0;
  const isPositive = diff > 0;
  
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <TrendIndicator value={percentChange} size="xs" />
      {showAbsolute && (
        <span className="text-muted-foreground">
          ({isPositive ? '+' : ''}{diff.toLocaleString()})
        </span>
      )}
      {label && <span className="text-muted-foreground">{label}</span>}
    </div>
  );
}
