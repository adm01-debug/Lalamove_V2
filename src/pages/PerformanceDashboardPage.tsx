import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Gauge, 
  MousePointerClick, 
  LayoutDashboard, 
  Zap, 
  Timer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Info
} from 'lucide-react';
import { useWebVitals, calculatePerformanceScore, getStoredMetrics } from '@/utils/webVitals';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Metric } from 'web-vitals';

interface MetricCardProps {
  name: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  metric?: Metric;
  unit: string;
  thresholds: { good: number; needsImprovement: number };
  isLowerBetter?: boolean;
}

const MetricCard = ({ 
  name, 
  label, 
  description, 
  icon, 
  metric, 
  unit, 
  thresholds,
  isLowerBetter = true 
}: MetricCardProps) => {
  const value = metric?.value ?? null;
  const rating = metric?.rating ?? 'unknown';
  
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-success';
      case 'needs-improvement': return 'text-warning';
      case 'poor': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };
  
  const getRatingBg = (rating: string) => {
    switch (rating) {
      case 'good': return 'bg-success/10 border-success/20';
      case 'needs-improvement': return 'bg-warning/10 border-warning/20';
      case 'poor': return 'bg-destructive/10 border-destructive/20';
      default: return 'bg-muted/50 border-border';
    }
  };
  
  const getProgressValue = () => {
    if (value === null) return 0;
    const max = thresholds.needsImprovement * 1.5;
    return Math.min((value / max) * 100, 100);
  };
  
  const getProgressColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'bg-success';
      case 'needs-improvement': return 'bg-warning';
      case 'poor': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };
  
  const formatValue = (val: number | null) => {
    if (val === null) return '—';
    if (name === 'CLS') return val.toFixed(3);
    return Math.round(val).toString();
  };
  
  const getTrendIcon = () => {
    if (!metric?.delta) return null;
    if (metric.delta > 0) {
      return isLowerBetter ? 
        <TrendingUp className="h-3 w-3 text-destructive" /> : 
        <TrendingUp className="h-3 w-3 text-success" />;
    }
    if (metric.delta < 0) {
      return isLowerBetter ? 
        <TrendingDown className="h-3 w-3 text-success" /> : 
        <TrendingDown className="h-3 w-3 text-destructive" />;
    }
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <Card className={cn("transition-all duration-300 border", getRatingBg(rating))}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", getRatingBg(rating))}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <CardDescription className="text-xs">{name}</CardDescription>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Info className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-sm">{description}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>✅ Bom: ≤ {thresholds.good}{unit}</p>
                <p>⚠️ Precisa melhorar: ≤ {thresholds.needsImprovement}{unit}</p>
                <p>❌ Ruim: &gt; {thresholds.needsImprovement}{unit}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className={cn("text-3xl font-bold", getRatingColor(rating))}>
                {formatValue(value)}
              </span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs capitalize",
                  rating === 'good' && "border-success text-success",
                  rating === 'needs-improvement' && "border-warning text-warning",
                  rating === 'poor' && "border-destructive text-destructive"
                )}
              >
                {rating === 'needs-improvement' ? 'melhorar' : rating === 'good' ? 'bom' : rating === 'poor' ? 'ruim' : 'aguardando'}
              </Badge>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>{thresholds.good}{unit}</span>
              <span>{thresholds.needsImprovement}{unit}</span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("absolute left-0 top-0 h-full rounded-full transition-all duration-500", getProgressColor(rating))}
                style={{ width: `${getProgressValue()}%` }}
              />
              {/* Threshold markers */}
              <div 
                className="absolute top-0 w-0.5 h-full bg-success/50"
                style={{ left: `${(thresholds.good / (thresholds.needsImprovement * 1.5)) * 100}%` }}
              />
              <div 
                className="absolute top-0 w-0.5 h-full bg-warning/50"
                style={{ left: `${(thresholds.needsImprovement / (thresholds.needsImprovement * 1.5)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const OverallScoreCard = ({ score }: { score: number }) => {
  const getScoreColor = () => {
    if (score >= 90) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };
  
  const getScoreLabel = () => {
    if (score >= 90) return 'Excelente';
    if (score >= 70) return 'Bom';
    if (score >= 50) return 'Precisa melhorar';
    return 'Ruim';
  };
  
  const getScoreBg = () => {
    if (score >= 90) return 'from-success/20 to-success/5';
    if (score >= 50) return 'from-warning/20 to-warning/5';
    return 'from-destructive/20 to-destructive/5';
  };

  return (
    <Card className={cn("bg-gradient-to-br border-2", getScoreBg())}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Score de Performance
        </CardTitle>
        <CardDescription>
          Pontuação geral baseada nas Core Web Vitals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${score * 3.52} 352`}
                strokeLinecap="round"
                className={getScoreColor()}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-4xl font-bold", getScoreColor())}>
                {Math.round(score)}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
        <div className="text-center">
          <Badge variant="outline" className={cn("text-lg px-4 py-1", getScoreColor())}>
            {getScoreLabel()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export const PerformanceDashboardPage = () => {
  const metrics = useWebVitals();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const score = calculatePerformanceScore(metrics);
  
  useEffect(() => {
    if (Object.keys(metrics).length > 0) {
      setLastUpdate(new Date());
    }
  }, [metrics]);
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  const metricsConfig = [
    {
      name: 'LCP',
      label: 'Largest Contentful Paint',
      description: 'Mede o tempo de carregamento do maior elemento visível na viewport. Indica quando o conteúdo principal foi renderizado.',
      icon: <LayoutDashboard className="h-4 w-4" />,
      unit: 'ms',
      thresholds: { good: 2500, needsImprovement: 4000 },
    },
    {
      name: 'INP',
      label: 'Interaction to Next Paint',
      description: 'Mede a responsividade geral às interações do usuário durante toda a visita à página. Substituiu FID como Core Web Vital.',
      icon: <MousePointerClick className="h-4 w-4" />,
      unit: 'ms',
      thresholds: { good: 200, needsImprovement: 500 },
    },
    {
      name: 'CLS',
      label: 'Cumulative Layout Shift',
      description: 'Mede a estabilidade visual da página. Valores baixos indicam que os elementos não se movem inesperadamente.',
      icon: <Activity className="h-4 w-4" />,
      unit: '',
      thresholds: { good: 0.1, needsImprovement: 0.25 },
    },
    {
      name: 'FCP',
      label: 'First Contentful Paint',
      description: 'Mede o tempo até o primeiro conteúdo ser renderizado na tela. Indica a velocidade de resposta inicial.',
      icon: <Zap className="h-4 w-4" />,
      unit: 'ms',
      thresholds: { good: 1800, needsImprovement: 3000 },
    },
    {
      name: 'TTFB',
      label: 'Time to First Byte',
      description: 'Mede o tempo até o primeiro byte da resposta do servidor. Indica a velocidade do servidor e da rede.',
      icon: <Timer className="h-4 w-4" />,
      unit: 'ms',
      thresholds: { good: 800, needsImprovement: 1800 },
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Dashboard de Performance
          </h1>
          <p className="text-muted-foreground">
            Métricas Web Vitals em tempo real
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>
      
      {/* Info banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Como funciona o monitoramento</p>
              <p className="text-sm text-muted-foreground">
                As métricas são coletadas automaticamente durante a navegação. Algumas métricas como CLS e INP 
                são atualizadas continuamente, enquanto outras como LCP e FCP são capturadas uma vez após o carregamento.
                Navegue pela aplicação para coletar mais dados.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Overall Score */}
        <div className="md:col-span-2 lg:col-span-1">
          <OverallScoreCard score={score} />
        </div>
        
        {/* Core Web Vitals */}
        {metricsConfig.slice(0, 2).map(config => (
          <MetricCard
            key={config.name}
            {...config}
            metric={metrics[config.name]}
          />
        ))}
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {metricsConfig.slice(2).map(config => (
          <MetricCard
            key={config.name}
            {...config}
            metric={metrics[config.name]}
          />
        ))}
      </div>
      
      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhes Técnicos</CardTitle>
          <CardDescription>Informações adicionais sobre a sessão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tipo de Navegação</p>
              <p className="font-medium">{metrics.LCP?.navigationType || metrics.FCP?.navigationType || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Conexão</p>
              <p className="font-medium">{('connection' in navigator && (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType) || 'Desconhecido'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Métricas Coletadas</p>
              <p className="font-medium">{Object.keys(metrics).length} / 5</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Ambiente</p>
              <Badge variant="outline">{import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceDashboardPage;
