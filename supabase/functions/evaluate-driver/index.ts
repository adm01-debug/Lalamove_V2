import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { logger } from "../_shared/logger.ts";
import { resolveContractVersion, parseJsonBody, validateContract, errorResponse } from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============= TYPES =============

interface RiskRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: string;
    value: number;
  };
  score_impact: number;
  is_active: boolean;
}

interface Driver {
  id: string;
  name: string;
  total_deliveries: number;
  completed_deliveries: number;
  failed_deliveries: number;
  cancelled_deliveries: number;
  rating: number;
  risk_score: number;
  whitelisted: boolean;
  blacklisted: boolean;
  blacklist_reason: string | null;
  status: string;
  success_rate: number;
  failure_rate: number;
  avg_delay_minutes: number;
}

interface DriverStats {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  cancelledDeliveries: number;
  successRate: number;
  failureRate: number;
  incidentCount: number;
  avgDelayMinutes: number;
}

interface RiskFactor {
  factor: string;
  score: number;
  weight: number;
  description: string;
}

interface RiskAnalysis {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  reasons: string[];
}

interface EvaluationResult {
  approved: boolean;
  requiresManualApproval: boolean;
  autoBlocked: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  riskReasons: string[];
  recommendation: string;
  actionRequired?: string;
}

// ============= RISK CALCULATOR =============

const WEIGHTS = {
  LOW_DELIVERIES: 2.0,
  HIGH_FAILURE_RATE: 3.0,
  RECENT_INCIDENTS: 2.5,
  CRITICAL_INCIDENTS: 4.0,
  DELAYS: 1.5,
  FIRST_DELIVERY: 1.0,
  LOW_RATING: 2.0,
  CANCELLATIONS: 1.5
};

function calculateRiskAnalysis(
  stats: DriverStats, 
  incidentCount: number, 
  hasCriticalIncidents: boolean,
  driverRating: number
): RiskAnalysis {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // Factor 1: Experiência (entregas totais)
  if (stats.totalDeliveries === 0) {
    factors.push({
      factor: 'FIRST_DELIVERY',
      score: 5.0,
      weight: WEIGHTS.FIRST_DELIVERY,
      description: 'Primeira entrega com este motorista'
    });
    totalScore += 5.0 * WEIGHTS.FIRST_DELIVERY;
  } else if (stats.totalDeliveries < 10) {
    const score = 3.0;
    factors.push({
      factor: 'LOW_DELIVERIES',
      score,
      weight: WEIGHTS.LOW_DELIVERIES,
      description: `Apenas ${stats.totalDeliveries} entregas registradas`
    });
    totalScore += score * WEIGHTS.LOW_DELIVERIES;
  } else if (stats.totalDeliveries < 30) {
    const score = 1.5;
    factors.push({
      factor: 'LOW_DELIVERIES',
      score,
      weight: WEIGHTS.LOW_DELIVERIES,
      description: 'Motorista com experiência limitada'
    });
    totalScore += score * WEIGHTS.LOW_DELIVERIES;
  }

  // Factor 2: Taxa de falha
  if (stats.failureRate > 20) {
    const score = 8.0;
    factors.push({
      factor: 'HIGH_FAILURE_RATE',
      score,
      weight: WEIGHTS.HIGH_FAILURE_RATE,
      description: `Taxa de falha muito alta: ${stats.failureRate.toFixed(1)}%`
    });
    totalScore += score * WEIGHTS.HIGH_FAILURE_RATE;
  } else if (stats.failureRate > 15) {
    const score = 6.0;
    factors.push({
      factor: 'HIGH_FAILURE_RATE',
      score,
      weight: WEIGHTS.HIGH_FAILURE_RATE,
      description: `Taxa de falha alta: ${stats.failureRate.toFixed(1)}%`
    });
    totalScore += score * WEIGHTS.HIGH_FAILURE_RATE;
  } else if (stats.failureRate > 10) {
    const score = 3.0;
    factors.push({
      factor: 'HIGH_FAILURE_RATE',
      score,
      weight: WEIGHTS.HIGH_FAILURE_RATE,
      description: `Taxa de falha preocupante: ${stats.failureRate.toFixed(1)}%`
    });
    totalScore += score * WEIGHTS.HIGH_FAILURE_RATE;
  }

  // Factor 3: Incidentes
  if (hasCriticalIncidents) {
    const score = 9.0;
    factors.push({
      factor: 'CRITICAL_INCIDENTS',
      score,
      weight: WEIGHTS.CRITICAL_INCIDENTS,
      description: 'Histórico de incidentes críticos'
    });
    totalScore += score * WEIGHTS.CRITICAL_INCIDENTS;
  } else if (incidentCount > 5) {
    const score = 6.0;
    factors.push({
      factor: 'RECENT_INCIDENTS',
      score,
      weight: WEIGHTS.RECENT_INCIDENTS,
      description: `${incidentCount} incidentes registrados`
    });
    totalScore += score * WEIGHTS.RECENT_INCIDENTS;
  } else if (incidentCount > 2) {
    const score = 3.0;
    factors.push({
      factor: 'RECENT_INCIDENTS',
      score,
      weight: WEIGHTS.RECENT_INCIDENTS,
      description: `${incidentCount} incidentes no histórico`
    });
    totalScore += score * WEIGHTS.RECENT_INCIDENTS;
  }

  // Factor 4: Atrasos
  if (stats.avgDelayMinutes > 30) {
    const score = 4.0;
    factors.push({
      factor: 'DELAYS',
      score,
      weight: WEIGHTS.DELAYS,
      description: `Média de ${stats.avgDelayMinutes.toFixed(0)} minutos de atraso`
    });
    totalScore += score * WEIGHTS.DELAYS;
  } else if (stats.avgDelayMinutes > 15) {
    const score = 2.0;
    factors.push({
      factor: 'DELAYS',
      score,
      weight: WEIGHTS.DELAYS,
      description: 'Histórico de atrasos frequentes'
    });
    totalScore += score * WEIGHTS.DELAYS;
  }

  // Factor 5: Rating baixo
  if (driverRating < 3) {
    const score = 5.0;
    factors.push({
      factor: 'LOW_RATING',
      score,
      weight: WEIGHTS.LOW_RATING,
      description: `Avaliação muito baixa: ${driverRating.toFixed(1)}`
    });
    totalScore += score * WEIGHTS.LOW_RATING;
  } else if (driverRating < 4) {
    const score = 2.5;
    factors.push({
      factor: 'LOW_RATING',
      score,
      weight: WEIGHTS.LOW_RATING,
      description: `Avaliação abaixo da média: ${driverRating.toFixed(1)}`
    });
    totalScore += score * WEIGHTS.LOW_RATING;
  }

  // Factor 6: Cancelamentos
  const cancellationRate = stats.totalDeliveries > 0 
    ? (stats.cancelledDeliveries / stats.totalDeliveries) * 100 
    : 0;
  
  if (cancellationRate > 15) {
    const score = 4.0;
    factors.push({
      factor: 'CANCELLATIONS',
      score,
      weight: WEIGHTS.CANCELLATIONS,
      description: `Taxa de cancelamento alta: ${cancellationRate.toFixed(1)}%`
    });
    totalScore += score * WEIGHTS.CANCELLATIONS;
  } else if (cancellationRate > 10) {
    const score = 2.0;
    factors.push({
      factor: 'CANCELLATIONS',
      score,
      weight: WEIGHTS.CANCELLATIONS,
      description: `Taxa de cancelamento preocupante: ${cancellationRate.toFixed(1)}%`
    });
    totalScore += score * WEIGHTS.CANCELLATIONS;
  }

  // Normalizar score (0-10)
  const normalizedScore = factors.length > 0 
    ? Math.min(10, totalScore / factors.length) 
    : 0;

  // Determinar risk level
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  if (normalizedScore >= 8) level = 'CRITICAL';
  else if (normalizedScore >= 5) level = 'HIGH';
  else if (normalizedScore >= 3) level = 'MEDIUM';
  else level = 'LOW';

  // Gerar razões
  const reasons: string[] = [];
  if (level === 'CRITICAL') {
    reasons.push('BLOQUEIO RECOMENDADO: Risco crítico identificado');
  } else if (level === 'HIGH') {
    reasons.push('APROVAÇÃO MANUAL OBRIGATÓRIA: Alto risco');
  } else if (level === 'MEDIUM') {
    reasons.push('ATENÇÃO: Monitoramento recomendado');
  }
  factors.forEach(f => reasons.push(f.description));

  return {
    score: Math.round(normalizedScore * 10) / 10,
    level,
    factors,
    reasons
  };
}

// ============= DECISION MAKER =============

function makeDecision(riskAnalysis: RiskAnalysis, stats: DriverStats): EvaluationResult {
  // Primeira entrega
  if (stats.totalDeliveries === 0) {
    return {
      approved: true,
      requiresManualApproval: true,
      autoBlocked: false,
      riskScore: riskAnalysis.score,
      riskLevel: riskAnalysis.level,
      riskFactors: riskAnalysis.factors,
      riskReasons: riskAnalysis.reasons,
      recommendation: 'Primeira entrega - APROVAR MANUALMENTE',
      actionRequired: 'MANUAL_APPROVAL'
    };
  }

  // Risco crítico
  if (riskAnalysis.level === 'CRITICAL') {
    return {
      approved: false,
      requiresManualApproval: true,
      autoBlocked: true,
      riskScore: riskAnalysis.score,
      riskLevel: riskAnalysis.level,
      riskFactors: riskAnalysis.factors,
      riskReasons: riskAnalysis.reasons,
      recommendation: 'BLOQUEAR e solicitar troca de motorista',
      actionRequired: 'CHANGE_DRIVER'
    };
  }

  // Risco alto
  if (riskAnalysis.level === 'HIGH') {
    return {
      approved: false,
      requiresManualApproval: true,
      autoBlocked: false,
      riskScore: riskAnalysis.score,
      riskLevel: riskAnalysis.level,
      riskFactors: riskAnalysis.factors,
      riskReasons: riskAnalysis.reasons,
      recommendation: 'Aprovar manualmente antes de prosseguir',
      actionRequired: 'MANUAL_APPROVAL'
    };
  }

  // Risco médio
  if (riskAnalysis.level === 'MEDIUM') {
    return {
      approved: true,
      requiresManualApproval: false,
      autoBlocked: false,
      riskScore: riskAnalysis.score,
      riskLevel: riskAnalysis.level,
      riskFactors: riskAnalysis.factors,
      riskReasons: riskAnalysis.reasons,
      recommendation: 'Aprovado com ALERTA - monitorar entrega',
      actionRequired: 'MONITOR'
    };
  }

  // Risco baixo
  return {
    approved: true,
    requiresManualApproval: false,
    autoBlocked: false,
    riskScore: riskAnalysis.score,
    riskLevel: riskAnalysis.level,
    riskFactors: riskAnalysis.factors,
    riskReasons: riskAnalysis.reasons,
    recommendation: 'Motorista confiável - aprovação automática'
  };
}

// ============= STATS CALCULATOR =============

function calculateStatsFromOrders(orders: any[]): DriverStats {
  const total = orders.length;
  const completed = orders.filter((o: any) => o.outcome === 'SUCCESS').length;
  const failed = orders.filter((o: any) => 
    o.outcome === 'FAILED' || o.outcome === 'DAMAGED' || o.outcome === 'STOLEN'
  ).length;
  const cancelled = orders.filter((o: any) => o.status === 'CANCELLED').length;

  const delays = orders
    .filter((o: any) => o.delay_minutes != null)
    .map((o: any) => o.delay_minutes as number);
  
  const avgDelay = delays.length > 0 
    ? delays.reduce((a: number, b: number) => a + b, 0) / delays.length 
    : 0;

  return {
    totalDeliveries: total,
    completedDeliveries: completed,
    failedDeliveries: failed,
    cancelledDeliveries: cancelled,
    successRate: total > 0 ? (completed / total) * 100 : 0,
    failureRate: total > 0 ? (failed / total) * 100 : 0,
    incidentCount: 0,
    avgDelayMinutes: avgDelay
  };
}

function calculateStatsFromDriver(driver: Driver): DriverStats {
  const total = driver.total_deliveries || 0;
  const completed = driver.completed_deliveries || 0;
  const failed = driver.failed_deliveries || 0;
  const cancelled = driver.cancelled_deliveries || 0;

  return {
    totalDeliveries: total,
    completedDeliveries: completed,
    failedDeliveries: failed,
    cancelledDeliveries: cancelled,
    successRate: driver.success_rate || (total > 0 ? (completed / total) * 100 : 0),
    failureRate: driver.failure_rate || (total > 0 ? (failed / total) * 100 : 0),
    incidentCount: 0,
    avgDelayMinutes: driver.avg_delay_minutes || 0
  };
}

// ============= RULE EVALUATOR =============

function evaluateCondition(driver: Driver, incidentCount: number, rule: RiskRule): boolean {
  const { field, operator, value } = rule.condition;
  
  let fieldValue: number;
  
  switch (field) {
    case 'total_deliveries':
      fieldValue = driver.total_deliveries || 0;
      break;
    case 'completed_deliveries':
      fieldValue = driver.completed_deliveries || 0;
      break;
    case 'failed_deliveries':
      fieldValue = driver.failed_deliveries || 0;
      break;
    case 'cancelled_deliveries':
      fieldValue = driver.cancelled_deliveries || 0;
      break;
    case 'rating':
      fieldValue = driver.rating || 5;
      break;
    case 'risk_score':
      fieldValue = driver.risk_score || 0;
      break;
    case 'failure_rate':
      fieldValue = driver.failure_rate || 0;
      break;
    case 'success_rate':
      fieldValue = driver.success_rate || 100;
      break;
    case 'avg_delay_minutes':
      fieldValue = driver.avg_delay_minutes || 0;
      break;
    case 'incident_count':
      fieldValue = incidentCount;
      break;
    default:
      return false;
  }

  switch (operator) {
    case 'less_than':
    case '<':
      return fieldValue < value;
    case 'less_than_or_equal':
    case '<=':
      return fieldValue <= value;
    case 'greater_than':
    case '>':
      return fieldValue > value;
    case 'greater_than_or_equal':
    case '>=':
      return fieldValue >= value;
    case 'equals':
    case '=':
    case '==':
      return fieldValue === value;
    case 'not_equals':
    case '!=':
      return fieldValue !== value;
    default:
      return false;
  }
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("evaluate-driver", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) {
      return errorResponse(parsedBody, corsHeaders);
    }

    const contract = validateContract(
      getSchema("evaluate-driver", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) {
      return errorResponse(contract, corsHeaders);
    }

    const parseResult = { data: contract.data as {
      driverId: string;
      orderId?: string | null;
      triggeredBy: 'WEBHOOK' | 'MANUAL' | 'SYSTEM';
      driverName?: string | null;
      totalDeliveries?: number | null;
      completedDeliveries?: number | null;
      failedDeliveries?: number | null;
      cancelledDeliveries?: number | null;
      avgDelayMinutes?: number | null;
      rating?: number | null;
    } };
    const { driverId, triggeredBy } = parseResult.data;
    const orderId: string | null = parseResult.data.orderId ?? null;

    logger.log(`[evaluate-driver] Starting evaluation for driver ${driverId}, order ${orderId}, triggered by ${triggeredBy}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch driver
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .maybeSingle();

    if (driverError) {
      logger.error('[evaluate-driver] Error fetching driver:', driverError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar motorista', details: driverError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If driver doesn't exist, create a new one
    let evaluatedDriver = driver as Driver;
    if (!driver) {
      logger.log('[evaluate-driver] Driver not found, creating new driver record');
      
      const { data: newDriver, error: createError } = await supabase
        .from('drivers')
        .insert({
          id: driverId,
          name: parseResult.data.driverName || 'Motorista Novo',
          status: 'PENDING_APPROVAL',
          vehicle_type: 'MOTORCYCLE',
          total_deliveries: 0,
          completed_deliveries: 0,
          failed_deliveries: 0,
          cancelled_deliveries: 0,
          risk_score: 5,
          rating: 5
        })
        .select()
        .single();

      if (createError) {
        logger.error('[evaluate-driver] Error creating driver:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar motorista', details: createError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      evaluatedDriver = newDriver as Driver;
    }

    logger.log(`[evaluate-driver] Driver: ${evaluatedDriver.name}, status: ${evaluatedDriver.status}, whitelisted: ${evaluatedDriver.whitelisted}, blacklisted: ${evaluatedDriver.blacklisted}`);

    // Check blacklist first
    if (evaluatedDriver.blacklisted || evaluatedDriver.status === 'BLACKLIST') {
      logger.log('[evaluate-driver] Driver is BLACKLISTED - auto-blocking');
      
      const result: EvaluationResult = {
        approved: false,
        requiresManualApproval: false,
        autoBlocked: true,
        riskScore: 10,
        riskLevel: 'CRITICAL',
        riskFactors: [],
        riskReasons: [evaluatedDriver.blacklist_reason || 'Motorista na BLACKLIST'],
        recommendation: 'TROCAR MOTORISTA IMEDIATAMENTE',
        actionRequired: 'CHANGE_DRIVER'
      };

      // Create alert
      await supabase.from('alerts').insert({
        type: 'DRIVER_BLOCKED',
        severity: 'CRITICAL',
        title: 'Motorista Bloqueado Detectado',
        message: `Motorista ${evaluatedDriver.name} está na blacklist e foi bloqueado automaticamente.`,
        driver_id: driverId,
        order_id: orderId || null,
      });

      // Save evaluation
      await saveEvaluation(supabase, driverId, orderId, triggeredBy, result, { totalDeliveries: 0, completedDeliveries: 0, failedDeliveries: 0, cancelledDeliveries: 0, successRate: 0, failureRate: 0, incidentCount: 0, avgDelayMinutes: 0 }, 0);

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check whitelist - auto approve
    if (evaluatedDriver.whitelisted || evaluatedDriver.status === 'WHITELIST') {
      logger.log('[evaluate-driver] Driver is WHITELISTED - auto-approving');
      
      const result: EvaluationResult = {
        approved: true,
        requiresManualApproval: false,
        autoBlocked: false,
        riskScore: 0,
        riskLevel: 'LOW',
        riskFactors: [],
        riskReasons: ['Motorista na WHITELIST - aprovado automaticamente'],
        recommendation: 'Motorista confiável - aprovação automática'
      };

      // Save evaluation
      await saveEvaluation(supabase, driverId, orderId, triggeredBy, result, calculateStatsFromDriver(evaluatedDriver), 0);

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch recent orders for this driver
    const { data: orders } = await supabase
      .from('lalamove_orders')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Fetch incidents
    const { data: incidents } = await supabase
      .from('driver_incidents')
      .select('*')
      .eq('driver_id', driverId)
      .eq('resolved', false);

    const incidentCount = (incidents || []).length;
    const hasCriticalIncidents = (incidents || []).some(
      (i: { severity: string }) => i.severity === 'CRITICAL' || i.severity === 'HIGH'
    );

    logger.log(`[evaluate-driver] Found ${(orders || []).length} orders, ${incidentCount} unresolved incidents (${hasCriticalIncidents ? 'HAS' : 'NO'} critical)`);

    // Calculate stats - prefer manual payload, then from orders if available, else from driver record
    let stats: DriverStats;
    if (parseResult.data.totalDeliveries !== undefined && parseResult.data.totalDeliveries !== null) {
      stats = {
        totalDeliveries: parseResult.data.totalDeliveries || 0,
        completedDeliveries: parseResult.data.completedDeliveries || 0,
        failedDeliveries: parseResult.data.failedDeliveries || 0,
        cancelledDeliveries: parseResult.data.cancelledDeliveries || 0,
        successRate: parseResult.data.totalDeliveries ? ((parseResult.data.completedDeliveries || 0) / parseResult.data.totalDeliveries) * 100 : 0,
        failureRate: parseResult.data.totalDeliveries ? ((parseResult.data.failedDeliveries || 0) / parseResult.data.totalDeliveries) * 100 : 0,
        incidentCount: incidentCount,
        avgDelayMinutes: parseResult.data.avgDelayMinutes || 0
      };
    } else if (orders && orders.length > 0) {
      stats = calculateStatsFromOrders(orders);
    } else {
      stats = calculateStatsFromDriver(evaluatedDriver);
    }
    stats.incidentCount = incidentCount;

    logger.log(`[evaluate-driver] Stats: deliveries=${stats.totalDeliveries}, completed=${stats.completedDeliveries}, failed=${stats.failedDeliveries}, failureRate=${stats.failureRate.toFixed(1)}%`);

    // Fetch and apply active risk rules
    const { data: rules } = await supabase
      .from('risk_rules')
      .select('*')
      .eq('is_active', true);

    let ruleBonus = 0;
    const ruleFactors: string[] = [];

    for (const rule of (rules || [])) {
      try {
        if (evaluateCondition(evaluatedDriver, incidentCount, rule as RiskRule)) {
          ruleBonus += (rule as RiskRule).score_impact;
          ruleFactors.push(`Regra "${rule.name}": +${rule.score_impact} pontos`);
          logger.log(`[evaluate-driver] Rule "${rule.name}" matched, impact: ${rule.score_impact}`);
        }
      } catch (e) {
        logger.error(`[evaluate-driver] Error evaluating rule ${rule.name}:`, e);
      }
    }

    // Calculate risk analysis
    const riskAnalysis = calculateRiskAnalysis(
      stats,
      incidentCount,
      hasCriticalIncidents,
      parseResult.data.rating ?? evaluatedDriver.rating ?? 5
    );

    // Add rule bonus to score
    const finalScore = Math.min(10, riskAnalysis.score + (ruleBonus / 2));
    riskAnalysis.score = Math.round(finalScore * 10) / 10;

    // Recalculate level with final score
    if (riskAnalysis.score >= 8) riskAnalysis.level = 'CRITICAL';
    else if (riskAnalysis.score >= 5) riskAnalysis.level = 'HIGH';
    else if (riskAnalysis.score >= 3) riskAnalysis.level = 'MEDIUM';
    else riskAnalysis.level = 'LOW';

    // Add rule factors to reasons
    if (ruleFactors.length > 0) {
      riskAnalysis.reasons.push(...ruleFactors);
    }

    logger.log(`[evaluate-driver] Risk analysis: score=${riskAnalysis.score}, level=${riskAnalysis.level}, factors=${riskAnalysis.factors.length}`);

    // Make decision
    const result = makeDecision(riskAnalysis, stats);

    // Update driver record
    await supabase
      .from('drivers')
      .update({
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        last_evaluated_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        success_rate: stats.successRate,
        failure_rate: stats.failureRate,
        avg_delay_minutes: stats.avgDelayMinutes
      })
      .eq('id', driverId);

    // Save evaluation to database
    await saveEvaluation(supabase, driverId, orderId, triggeredBy, result, stats, incidentCount);

    // Handle actions based on decision
    if (result.autoBlocked) {
      logger.log('[evaluate-driver] AUTO-BLOCKING driver');
      
      await supabase
        .from('drivers')
        .update({ status: 'BLOCKED' })
        .eq('id', driverId);

      await supabase.from('alerts').insert({
        type: 'DRIVER_BLOCKED',
        severity: 'CRITICAL',
        title: 'Motorista Bloqueado Automaticamente',
        message: `Motorista ${evaluatedDriver.name} foi bloqueado devido a risco crítico (score: ${result.riskScore.toFixed(1)}).`,
        driver_id: driverId,
        order_id: orderId || null,
        metadata: { riskFactors: result.riskFactors, riskReasons: result.riskReasons }
      });
    } else if (result.requiresManualApproval && orderId) {
      logger.log('[evaluate-driver] Creating MANUAL APPROVAL request');
      
      await supabase.from('driver_approval_queue').insert({
        driver_id: driverId,
        driver_name: evaluatedDriver.name,
        order_id: orderId,
        risk_score: result.riskScore,
        risk_factors: result.riskReasons,
        status: 'PENDING',
        approval_priority: result.riskLevel === 'HIGH' ? 'HIGH' : result.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
        notes: result.recommendation
      });

      await supabase.from('alerts').insert({
        type: 'APPROVAL_REQUIRED',
        severity: 'WARNING',
        title: 'Aprovação Manual Necessária',
        message: `Motorista ${evaluatedDriver.name} (Score: ${result.riskScore.toFixed(1)}) requer aprovação manual.`,
        driver_id: driverId,
        order_id: orderId,
        metadata: { riskFactors: result.riskFactors, riskReasons: result.riskReasons }
      });
    }

    logger.log(`[evaluate-driver] Evaluation complete: approved=${result.approved}, requiresManual=${result.requiresManualApproval}, blocked=${result.autoBlocked}`);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    logger.error('[evaluate-driver] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= HELPER FUNCTIONS =============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveEvaluation(
  supabase: ReturnType<typeof createClient<any, "public", any>>,
  driverId: string,
  orderId: string | null,
  triggeredBy: string,
  result: EvaluationResult,
  stats: DriverStats,
  incidentCount: number
): Promise<void> {
  try {
    await supabase.from('driver_evaluations').insert([{
      driver_id: driverId,
      order_id: orderId || null,
      triggered_by: triggeredBy,
      approved: result.approved,
      requires_manual: result.requiresManualApproval,
      auto_blocked: result.autoBlocked,
      risk_score: result.riskScore,
      risk_level: result.riskLevel,
      risk_factors: JSON.parse(JSON.stringify(result.riskFactors)),
      risk_reasons: result.riskReasons,
      total_deliveries: stats.totalDeliveries,
      completed_deliveries: stats.completedDeliveries,
      failure_rate: stats.failureRate,
      incident_count: incidentCount,
      recommendation: result.recommendation,
      action_required: result.actionRequired || null
    }]);
    logger.log('[evaluate-driver] Evaluation saved to database');
  } catch (e) {
    logger.error('[evaluate-driver] Error saving evaluation:', e);
  }
}
