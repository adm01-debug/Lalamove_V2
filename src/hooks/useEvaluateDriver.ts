import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EvaluateDriverInput {
  driverId: string;
  orderId: string;
  driverName?: string;
  totalDeliveries?: number;
  completedDeliveries?: number;
  failedDeliveries?: number;
  cancelledDeliveries?: number;
  avgDelayMinutes?: number;
  rating?: number;
}

interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  contribution: number;
  description: string;
}

interface RiskAnalysis {
  score: number;
  level: string;
  factors: RiskFactor[];
  reasons: string[];
}

interface EvaluationResult {
  success: boolean;
  evaluation: {
    approved: boolean;
    requiresManualApproval: boolean;
    autoBlocked: boolean;
    riskAnalysis: RiskAnalysis;
    recommendation: string;
    actionRequired?: string;
  };
  driver: {
    id: string;
    name: string;
    status: string;
    riskScore: number;
    riskLevel: string;
  };
  approvalRequestId?: string;
  alertId?: string;
}

export function useEvaluateDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EvaluateDriverInput): Promise<EvaluationResult> => {
      const { data, error } = await supabase.functions.invoke('evaluate-driver', {
        body: input,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao avaliar motorista');
      }

      return data;
    },
    onSuccess: (data) => {
      const { evaluation, driver } = data;
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['driver-evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['active-alerts'] });

      // Show appropriate toast based on result
      if (evaluation.autoBlocked) {
        toast.error('Motorista Bloqueado', {
          description: `${driver.name} foi bloqueado automaticamente. Risco: ${evaluation.riskAnalysis.score.toFixed(1)}`,
        });
      } else if (evaluation.requiresManualApproval) {
        toast.warning('Aprovação Manual Necessária', {
          description: `${driver.name} requer aprovação manual. ${evaluation.recommendation}`,
        });
      } else if (evaluation.approved) {
        toast.success('Motorista Aprovado', {
          description: `${driver.name} aprovado automaticamente. Risco: ${evaluation.riskAnalysis.level}`,
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Erro na Avaliação', {
        description: error.message,
      });
    },
  });
}

export function useEvaluateDriverOnAssignment() {
  const evaluateDriver = useEvaluateDriver();

  const evaluateOnAssignment = async (
    driverId: string,
    orderId: string,
    driverInfo?: {
      name?: string;
      totalDeliveries?: number;
      completedDeliveries?: number;
      failedDeliveries?: number;
      rating?: number;
    }
  ) => {
    return evaluateDriver.mutateAsync({
      driverId,
      orderId,
      driverName: driverInfo?.name,
      totalDeliveries: driverInfo?.totalDeliveries,
      completedDeliveries: driverInfo?.completedDeliveries,
      failedDeliveries: driverInfo?.failedDeliveries,
      rating: driverInfo?.rating,
    });
  };

  return {
    evaluateOnAssignment,
    isEvaluating: evaluateDriver.isPending,
    lastResult: evaluateDriver.data,
    error: evaluateDriver.error,
  };
}
