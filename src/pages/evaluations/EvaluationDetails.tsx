import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS, type RiskLevel } from '@/types/driver';

interface RiskFactor {
  factor: string;
  impact: number;
  description?: string;
  weight?: number;
  score?: number;
}

interface DriverEvaluation {
  id: string;
  driver_id: string;
  order_id: string | null;
  triggered_by: string;
  approved: boolean;
  requires_manual: boolean;
  auto_blocked: boolean;
  risk_score: number;
  risk_level: string;
  risk_factors: RiskFactor[];
  risk_reasons: string[];
  total_deliveries: number | null;
  completed_deliveries: number | null;
  failure_rate: number | null;
  incident_count: number | null;
  recommendation: string | null;
  action_required: string | null;
  evaluated_at: string;
  created_at: string;
  drivers?: { id: string; name: string };
}

export { type DriverEvaluation, type RiskFactor };

export function EvaluationDetailsPanel({ evaluation }: { evaluation: DriverEvaluation }) {
  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="space-y-6 pr-4">
        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Motorista</label>
            <p className="font-medium">{evaluation.drivers?.name || 'Desconhecido'}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Data da Avaliação</label>
            <p className="font-medium">
              {format(new Date(evaluation.evaluated_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Order ID</label>
            <p className="font-mono text-sm">{evaluation.order_id || '-'}</p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Trigger</label>
            <Badge variant="outline">{evaluation.triggered_by}</Badge>
          </div>
        </div>

        {/* Risk Score */}
        <Card className="border-2" style={{ 
          borderColor: evaluation.risk_level === 'CRITICAL' ? 'hsl(var(--destructive))' :
                       evaluation.risk_level === 'HIGH' ? 'hsl(var(--warning))' :
                       evaluation.risk_level === 'MEDIUM' ? 'hsl(var(--warning) / 0.7)' :
                       'hsl(var(--success))'
        }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Score de Risco</span>
              <Badge className={RISK_LEVEL_COLORS[evaluation.risk_level as RiskLevel] || ''}>
                {RISK_LEVEL_LABELS[evaluation.risk_level as RiskLevel] || evaluation.risk_level}
              </Badge>
            </div>
            <p className="text-4xl font-bold">
              {evaluation.risk_score.toFixed(1)}
              <span className="text-sm text-muted-foreground font-normal">/100</span>
            </p>
          </div>
        </Card>

        {/* Delivery Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{evaluation.total_deliveries ?? '-'}</p>
            <p className="text-xs text-muted-foreground">Total Entregas</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{evaluation.completed_deliveries ?? '-'}</p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{evaluation.incident_count ?? '-'}</p>
            <p className="text-xs text-muted-foreground">Incidentes</p>
          </div>
        </div>

        {/* Risk Factors */}
        {evaluation.risk_factors.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Fatores de Risco
            </h4>
            <div className="space-y-2">
              {evaluation.risk_factors.map((factor, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{factor.factor}</p>
                    {factor.description && (
                      <p className="text-xs text-muted-foreground">{factor.description}</p>
                    )}
                  </div>
                  <Badge variant={factor.impact > 20 ? 'destructive' : factor.impact > 10 ? 'warning' : 'secondary'}>
                    +{factor.impact.toFixed(1)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk Reasons */}
        {evaluation.risk_reasons?.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Motivos</h4>
            <ul className="space-y-1">
              {evaluation.risk_reasons.map((reason, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        {evaluation.recommendation && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <h4 className="text-sm font-semibold text-primary mb-1">Recomendação</h4>
            <p className="text-sm">{evaluation.recommendation}</p>
          </div>
        )}

        {/* Action Required */}
        {evaluation.action_required && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
            <h4 className="text-sm font-semibold text-warning mb-1">Ação Necessária</h4>
            <p className="text-sm">{evaluation.action_required}</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
