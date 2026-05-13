import { cn } from '@/lib/utils';

interface RiskScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function getRiskLevel(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 8) return { label: 'Crítico', color: 'text-destructive', bgColor: 'bg-destructive' };
  if (score >= 6) return { label: 'Alto', color: 'text-warning', bgColor: 'bg-warning' };
  if (score >= 4) return { label: 'Médio', color: 'text-muted-foreground', bgColor: 'bg-muted-foreground' };
  return { label: 'Baixo', color: 'text-success', bgColor: 'bg-success' };
}

const sizeStyles = {
  sm: { container: 'w-12 h-12', text: 'text-sm', label: 'text-[10px]' },
  md: { container: 'w-16 h-16', text: 'text-lg', label: 'text-xs' },
  lg: { container: 'w-24 h-24', text: 'text-2xl', label: 'text-sm' },
};

export function RiskScoreGauge({ score, size = 'md', showLabel = true, className }: RiskScoreGaugeProps) {
  const { label, color, bgColor } = getRiskLevel(score);
  const styles = sizeStyles[size];
  
  // Calculate the stroke dasharray for the circle
  const radius = size === 'lg' ? 40 : size === 'md' ? 28 : 20;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className={cn("relative", styles.container)}>
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${(radius + 4) * 2} ${(radius + 4) * 2}`}>
          <circle
            cx={radius + 4}
            cy={radius + 4}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="4"
            className="text-secondary"
          />
          <circle
            cx={radius + 4}
            cy={radius + 4}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className={cn(color, "transition-all duration-500")}
          />
        </svg>
        
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold", styles.text, color)}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      
      {showLabel && (
        <span className={cn("font-medium uppercase tracking-wider", styles.label, color)}>
          {label}
        </span>
      )}
    </div>
  );
}
