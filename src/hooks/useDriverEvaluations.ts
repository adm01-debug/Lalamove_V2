import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
import { logger } from '@/utils/logger';
  DriverEvaluation, 
  CreateEvaluationInput, 
  RiskFactor,
  RiskLevel 
} from '@/types/driver';

// =============================================
// FUNÇÕES DE FETCH
// =============================================

async function fetchDriverEvaluations(driverId?: string): Promise<DriverEvaluation[]> {
  let query = supabase
    .from('driver_evaluations')
    .select('*')
    .order('evaluated_at', { ascending: false });

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data, error } = await query.limit(100);

  if (error) throw error;

  return (data || []).map((row): DriverEvaluation => ({
    id: row.id,
    driverId: row.driver_id,
    orderId: row.order_id ?? undefined,
    triggeredBy: row.triggered_by,
    approved: row.approved,
    requiresManual: row.requires_manual,
    autoBlocked: row.auto_blocked,
    riskScore: Number(row.risk_score),
    riskLevel: row.risk_level as RiskLevel,
    riskFactors: (row.risk_factors as unknown as RiskFactor[]) || [],
    riskReasons: row.risk_reasons || [],
    totalDeliveries: row.total_deliveries ?? 0,
    completedDeliveries: row.completed_deliveries ?? 0,
    failureRate: Number(row.failure_rate ?? 0),
    incidentCount: row.incident_count ?? 0,
    recommendation: row.recommendation ?? undefined,
    actionRequired: row.action_required ?? undefined,
    evaluatedAt: new Date(row.evaluated_at),
    createdAt: new Date(row.created_at),
  }));
}

async function fetchLatestEvaluation(driverId: string): Promise<DriverEvaluation | null> {
  const { data, error } = await supabase
    .from('driver_evaluations')
    .select('*')
    .eq('driver_id', driverId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    driverId: data.driver_id,
    orderId: data.order_id ?? undefined,
    triggeredBy: data.triggered_by,
    approved: data.approved,
    requiresManual: data.requires_manual,
    autoBlocked: data.auto_blocked,
    riskScore: Number(data.risk_score),
    riskLevel: data.risk_level as RiskLevel,
    riskFactors: (data.risk_factors as unknown as RiskFactor[]) || [],
    riskReasons: data.risk_reasons || [],
    totalDeliveries: data.total_deliveries ?? 0,
    completedDeliveries: data.completed_deliveries ?? 0,
    failureRate: Number(data.failure_rate ?? 0),
    incidentCount: data.incident_count ?? 0,
    recommendation: data.recommendation ?? undefined,
    actionRequired: data.action_required ?? undefined,
    evaluatedAt: new Date(data.evaluated_at),
    createdAt: new Date(data.created_at),
  };
}

// =============================================
// FUNÇÕES DE MUTAÇÃO
// =============================================

async function createEvaluation(input: CreateEvaluationInput): Promise<DriverEvaluation> {
  const insertData = {
    driver_id: input.driverId,
    order_id: input.orderId || null,
    triggered_by: input.triggeredBy || 'SYSTEM',
    approved: input.approved,
    requires_manual: input.requiresManual ?? false,
    auto_blocked: input.autoBlocked ?? false,
    risk_score: input.riskScore,
    risk_level: input.riskLevel,
    risk_factors: input.riskFactors as unknown,
    risk_reasons: input.riskReasons || [],
    total_deliveries: input.totalDeliveries ?? 0,
    completed_deliveries: input.completedDeliveries ?? 0,
    failure_rate: input.failureRate ?? 0,
    incident_count: input.incidentCount ?? 0,
    recommendation: input.recommendation || null,
    action_required: input.actionRequired || null,
  };

  const { data, error } = await supabase
    .from('driver_evaluations')
    .insert(insertData as never)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    driverId: data.driver_id,
    orderId: data.order_id ?? undefined,
    triggeredBy: data.triggered_by,
    approved: data.approved,
    requiresManual: data.requires_manual,
    autoBlocked: data.auto_blocked,
    riskScore: Number(data.risk_score),
    riskLevel: data.risk_level as RiskLevel,
    riskFactors: (data.risk_factors as unknown as RiskFactor[]) || [],
    riskReasons: data.risk_reasons || [],
    totalDeliveries: data.total_deliveries ?? 0,
    completedDeliveries: data.completed_deliveries ?? 0,
    failureRate: Number(data.failure_rate ?? 0),
    incidentCount: data.incident_count ?? 0,
    recommendation: data.recommendation ?? undefined,
    actionRequired: data.action_required ?? undefined,
    evaluatedAt: new Date(data.evaluated_at),
    createdAt: new Date(data.created_at),
  };
}

// =============================================
// HOOKS
// =============================================

export function useDriverEvaluations(driverId?: string) {
  return useQuery({
    queryKey: ['driver-evaluations', driverId],
    queryFn: () => fetchDriverEvaluations(driverId),
    staleTime: 30000,
  });
}

export function useLatestDriverEvaluation(driverId: string) {
  return useQuery({
    queryKey: ['driver-evaluation-latest', driverId],
    queryFn: () => fetchLatestEvaluation(driverId),
    enabled: !!driverId,
    staleTime: 30000,
  });
}

export function useCreateEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEvaluation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver-evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['driver-evaluation-latest', data.driverId] });
      toast.success('Avaliação registrada', {
        description: `Motorista ${data.approved ? 'aprovado' : 'reprovado'} com score ${data.riskScore.toFixed(1)}`,
      });
    },
    onError: (error) => {
      logger.error('Error creating evaluation:', error);
      toast.error('Falha ao registrar avaliação.');
    },
  });
}

// =============================================
// FUNÇÕES UTILITÁRIAS DE AVALIAÇÃO
// =============================================

export function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 8) return RiskLevel.CRITICAL;
  if (score >= 6) return RiskLevel.HIGH;
  if (score >= 4) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

export function evaluateDriver(stats: {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  cancelledDeliveries: number;
  incidentCount: number;
  avgDelayMinutes: number;
}): {
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  approved: boolean;
  requiresManual: boolean;
} {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Fator 1: Taxa de falha
  const failureRate = stats.totalDeliveries > 0 
    ? (stats.failedDeliveries / stats.totalDeliveries) * 100 
    : 0;
  
  if (failureRate > 20) {
    const score = Math.min(3, failureRate / 10);
    factors.push({
      factor: 'FAILURE_RATE',
      score,
      weight: 1.5,
      description: `Taxa de falha alta: ${failureRate.toFixed(1)}%`
    });
    totalScore += score * 1.5;
  }

  // Fator 2: Incidentes
  if (stats.incidentCount > 0) {
    const score = Math.min(3, stats.incidentCount);
    factors.push({
      factor: 'INCIDENTS',
      score,
      weight: 2,
      description: `${stats.incidentCount} incidente(s) registrado(s)`
    });
    totalScore += score * 2;
  }

  // Fator 3: Atraso médio
  if (stats.avgDelayMinutes > 15) {
    const score = Math.min(2, stats.avgDelayMinutes / 30);
    factors.push({
      factor: 'AVG_DELAY',
      score,
      weight: 1,
      description: `Atraso médio de ${stats.avgDelayMinutes.toFixed(0)} minutos`
    });
    totalScore += score;
  }

  // Fator 4: Cancelamentos
  const cancelRate = stats.totalDeliveries > 0
    ? (stats.cancelledDeliveries / stats.totalDeliveries) * 100
    : 0;
  
  if (cancelRate > 10) {
    const score = Math.min(2, cancelRate / 10);
    factors.push({
      factor: 'CANCELLATION_RATE',
      score,
      weight: 1.2,
      description: `Taxa de cancelamento: ${cancelRate.toFixed(1)}%`
    });
    totalScore += score * 1.2;
  }

  // Fator 5: Poucas entregas (novo motorista)
  if (stats.totalDeliveries < 5) {
    factors.push({
      factor: 'NEW_DRIVER',
      score: 1,
      weight: 0.5,
      description: 'Motorista novo - poucas entregas para análise'
    });
    totalScore += 0.5;
  }

  const riskScore = Math.min(10, totalScore);
  const riskLevel = calculateRiskLevel(riskScore);

  return {
    riskScore,
    riskLevel,
    factors,
    approved: riskScore < 6,
    requiresManual: riskScore >= 4 && riskScore < 8
  };
}
