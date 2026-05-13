import { useState, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, Zap, RefreshCw, ChevronRight, Info, Sparkles,
  Target, Truck, Users, MapPin, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePredictiveAnalysis, type PredictiveAlert as PredictiveAlertType } from "@/hooks/usePredictiveAnalysis";

const typeConfig: Record<string, { icon: typeof Brain; color: string; bg: string }> = {
  driver_risk: { icon: Users, color: "text-destructive", bg: "bg-destructive/10" },
  delivery_delay: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
  sla_breach: { icon: Target, color: "text-warning", bg: "bg-warning/10" },
  capacity_issue: { icon: Truck, color: "text-accent", bg: "bg-accent/10" },
  area_hotspot: { icon: MapPin, color: "text-destructive", bg: "bg-destructive/10" },
};

const impactConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixo", color: "bg-muted text-muted-foreground" },
  medium: { label: "Médio", color: "bg-warning/10 text-warning" },
  high: { label: "Alto", color: "bg-warning/10 text-warning" },
  critical: { label: "Crítico", color: "bg-destructive/10 text-destructive" },
};

interface PredictiveAlertsProps {
  className?: string;
  compact?: boolean;
  maxItems?: number;
}

export const PredictiveAlerts = forwardRef<HTMLDivElement, PredictiveAlertsProps>(function PredictiveAlerts({ className, compact = false, maxItems = 5 }, ref) {
  const { predictions, isLoading, isRefreshing, lastUpdated, error, refresh } = usePredictiveAnalysis();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div><Skeleton className="h-5 w-40 mb-1" /><Skeleton className="h-3 w-32" /></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-warning" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" />Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const displayPredictions = predictions.slice(0, maxItems);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-info/20 flex items-center justify-center border border-accent/20">
                <Brain className="w-5 h-5 text-accent" />
              </div>
              <motion.div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Alertas Preditivos
                <Badge variant="secondary" className="text-xs font-normal"><Sparkles className="w-3 h-3 mr-1" />AI</Badge>
              </CardTitle>
              <CardDescription className="text-xs">Análise preditiva baseada em padrões</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Atualizado {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refresh} disabled={isRefreshing}>
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar análise</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <AnimatePresence mode="popLayout">
          {displayPredictions.map((prediction, index) => {
            const config = typeConfig[prediction.type] || typeConfig.sla_breach;
            const impact = impactConfig[prediction.impact];
            const Icon = config.icon;
            const isExpanded = expandedId === prediction.id;

            return (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ delay: index * 0.05 }}
                className={cn("relative p-4 rounded-xl border transition-all duration-200", config.bg, "border-border/50 hover:border-border cursor-pointer", isExpanded && "ring-1 ring-primary/20")}
                onClick={() => setExpandedId(isExpanded ? null : prediction.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm">{prediction.title}</h4>
                      <Badge variant="outline" className={cn("text-xs shrink-0", impact.color)}>{impact.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{prediction.description}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Probabilidade</span>
                          <span className={cn("font-medium", config.color)}>{prediction.probability}%</span>
                        </div>
                        <Progress value={prediction.probability} className="h-1.5" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />{prediction.timeframe}
                      </div>
                    </div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="pt-4 mt-3 border-t border-border/50">
                            <div className="flex items-start gap-2 mb-3">
                              <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-foreground mb-0.5">Recomendação</p>
                                <p className="text-xs text-muted-foreground">{prediction.recommendation}</p>
                              </div>
                            </div>
                            {prediction.dataPoints && prediction.dataPoints.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {prediction.dataPoints.map((point, i) => (
                                  <div key={i} className="bg-background/50 rounded-lg p-2">
                                    <p className="text-xs text-muted-foreground">{point.label}</p>
                                    <p className="text-sm font-medium">{point.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-90")} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
          <Info className="w-3 h-3" /><span>Baseado em análise de dados dos últimos 7 dias</span>
        </div>
      </CardContent>
    </Card>
  );
});

export default PredictiveAlerts;
