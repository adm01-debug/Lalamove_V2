import { Sparkles, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PredictionCardProps {
  prediction: string;
  confidence: number;
  trend?: 'up' | 'down' | 'stable';
  impact?: 'high' | 'medium' | 'low';
  timeframe?: string;
  recommendation?: string;
  className?: string;
}

const impactStyles = {
  high: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    text: 'text-destructive'
  },
  medium: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning'
  },
  low: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    text: 'text-success'
  }
};

export function PredictionCard({
  prediction,
  confidence,
  trend,
  impact = 'medium',
  timeframe,
  recommendation,
  className
}: PredictionCardProps) {
  const style = impactStyles[impact];
  
  return (
    <div className={cn(
      "relative rounded-xl p-6 border-2",
      style.bg,
      style.border,
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Previsão IA</h3>
            {timeframe && (
              <p className="text-xs text-muted-foreground">{timeframe}</p>
            )}
          </div>
        </div>
        
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend === 'up' ? "text-success" : trend === 'down' ? "text-destructive" : "text-muted-foreground"
          )}>
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4" />}
            {trend === 'stable' && <span>→</span>}
          </div>
        )}
      </div>
      
      {/* Prediction */}
      <p className="text-foreground mb-4 leading-relaxed">
        {prediction}
      </p>
      
      {/* Confidence */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Confiança</span>
          <span className="font-medium">{confidence}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              confidence >= 80 ? "bg-success" : confidence >= 60 ? "bg-warning" : "bg-destructive"
            )}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
      
      {/* Recommendation */}
      {recommendation && (
        <div className={cn(
          "p-3 rounded-lg border flex items-start gap-2",
          style.bg,
          style.border
        )}>
          <AlertCircle className={cn("w-4 h-4 mt-0.5 flex-shrink-0", style.text)} />
          <p className="text-xs text-foreground">
            <span className="font-medium">Recomendação: </span>
            {recommendation}
          </p>
        </div>
      )}
      
      {/* Impact badge */}
      <div className="absolute top-4 right-4">
        <Badge variant={impact === 'high' ? 'destructive' : impact === 'medium' ? 'default' : 'outline'}>
          Impacto {impact === 'high' ? 'Alto' : impact === 'medium' ? 'Médio' : 'Baixo'}
        </Badge>
      </div>
    </div>
  );
}

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export function InsightCard({
  icon,
  title,
  value,
  description,
  action,
  variant = 'default',
  className
}: InsightCardProps) {
  const variantStyles = {
    default: 'border-primary/30 bg-primary/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    destructive: 'border-destructive/30 bg-destructive/5'
  };
  
  return (
    <div className={cn(
      "rounded-lg p-4 border-2",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
          <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          {action && (
            <button
              onClick={action.onClick}
              className="text-xs font-medium text-primary hover:underline"
            >
              {action.label} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
