import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PredictiveAlert {
  id: string;
  type: "driver_risk" | "delivery_delay" | "sla_breach" | "capacity_issue" | "area_hotspot";
  title: string;
  description: string;
  probability: number;
  impact: "low" | "medium" | "high" | "critical";
  timeframe: string;
  recommendation: string;
  affectedEntities?: string[];
  dataPoints?: { label: string; value: string | number }[];
  lalamoveOrderId?: string;
}

interface AnalysisData {
  driversAtRisk: number;
  pendingApprovals: number;
  activeDeliveries: number;
  recentIncidents: number;
  avgDeliveryTime: number;
  slaCompliance: number;
  stalledDrivers: Array<{ id: string; minutes: number; orderId: string; lalamoveId: string }>;
  offRouteDrivers: Array<{ id: string; deviation: number; orderId: string; lalamoveId: string }>;
}

async function fetchAnalysisData(): Promise<AnalysisData> {
  const [driversResult, approvalsResult, ordersResult, incidentsResult] = await Promise.all([
    supabase.from("drivers").select("id, risk_score, risk_level, failure_rate").or("risk_level.eq.high,risk_level.eq.critical").limit(50),
    supabase.from("driver_approval_queue").select("id, risk_score").eq("status", "PENDING").limit(50),
    supabase.from("lalamove_orders").select("*").in("status", ["ON_GOING", "PICKED_UP", "MATCHED"]).limit(100),
    supabase.from("driver_incidents").select("id, severity, created_at").eq("resolved", false).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(50),
  ]);

  const orders = ordersResult.data || [];
  const avgDelay = orders.length > 0 ? orders.reduce((acc, o) => acc + (o.delay_minutes || 0), 0) / orders.length : 0;

  // Analisar motoristas parados (usando os novos campos do sistema Guardian)
  const stalledThreshold = 15; // 15 minutos parado
  const stalledDrivers = orders
    .filter(o => o.status === 'ON_GOING' && (o.delay_minutes || 0) >= stalledThreshold)
    .map(o => ({
      id: (o.driver_id as string) || 'unknown',
      minutes: o.delay_minutes || 0,
      orderId: o.id,
      lalamoveId: (o.lalamove_id as string) || o.id
    }));

  // Analisar desvios de rota (usando internal_notes ou outro campo se disponível, ou mockando se não houver coluna)
  const offRouteDrivers = orders
    .filter(o => o.status === 'ON_GOING' && (o.delay_minutes || 0) > 30) // Fallback simples para motoristas muito atrasados
    .map(o => ({
      id: (o.driver_id as string) || 'unknown',
      deviation: 0,
      orderId: o.id,
      lalamoveId: (o.lalamove_id as string) || o.id
    }));

  return {
    driversAtRisk: (driversResult.data || []).length,
    pendingApprovals: (approvalsResult.data || []).length,
    activeDeliveries: orders.length,
    recentIncidents: (incidentsResult.data || []).length,
    avgDeliveryTime: avgDelay,
    slaCompliance: avgDelay < 15 ? 95 : avgDelay < 30 ? 85 : 70,
    stalledDrivers,
    offRouteDrivers
  };
}

function generatePredictions(data: AnalysisData): PredictiveAlert[] {
  const alerts: PredictiveAlert[] = [];

  if (data.driversAtRisk > 3) {
    alerts.push({
      id: "pred-driver-risk", type: "driver_risk",
      title: "Alto Risco de Problemas com Motoristas",
      description: `${data.driversAtRisk} motoristas estão em categorias de risco elevado.`,
      probability: Math.min(65 + data.driversAtRisk * 5, 95),
      impact: data.driversAtRisk > 10 ? "critical" : "high",
      timeframe: "Próximas 24h",
      recommendation: "Revise os motoristas de alto risco e considere suspensões preventivas.",
      affectedEntities: [`${data.driversAtRisk} motoristas`],
      dataPoints: [{ label: "Motoristas em risco", value: data.driversAtRisk }, { label: "Incidentes recentes", value: data.recentIncidents }],
    });
  }

  if (data.slaCompliance < 90) {
    alerts.push({
      id: "pred-sla-breach", type: "sla_breach",
      title: "Risco de Violação de SLA",
      description: `Compliance atual em ${data.slaCompliance}%. Tendência de atrasos pode resultar em violações.`,
      probability: Math.min(100 - data.slaCompliance + 10, 90),
      impact: data.slaCompliance < 80 ? "critical" : "high",
      timeframe: "Próximas 4h",
      recommendation: "Priorize entregas atrasadas e aloque motoristas adicionais.",
      dataPoints: [{ label: "Compliance atual", value: `${data.slaCompliance}%` }, { label: "Atraso médio", value: `${Math.round(data.avgDeliveryTime)}min` }],
    });
  }

  if (data.pendingApprovals > 5 && data.activeDeliveries > 20) {
    alerts.push({
      id: "pred-capacity", type: "capacity_issue",
      title: "Gargalo de Capacidade Previsto",
      description: `${data.pendingApprovals} aprovações pendentes com ${data.activeDeliveries} entregas ativas.`,
      probability: Math.min(50 + data.pendingApprovals * 3, 85),
      impact: "medium", timeframe: "Próximas 2h",
      recommendation: "Acelere aprovações pendentes e monitore a fila.",
      affectedEntities: [`${data.pendingApprovals} aprovações`, `${data.activeDeliveries} entregas`],
      dataPoints: [{ label: "Aprovações pendentes", value: data.pendingApprovals }, { label: "Entregas ativas", value: data.activeDeliveries }],
    });
  }

  if (data.avgDeliveryTime > 20) {
    alerts.push({
      id: "pred-delay", type: "delivery_delay",
      title: "Padrão de Atrasos Detectado",
      description: `Atraso médio de ${Math.round(data.avgDeliveryTime)} minutos está acima do normal.`,
      probability: 75, impact: data.avgDeliveryTime > 30 ? "high" : "medium",
      timeframe: "Em andamento",
      recommendation: "Verifique condições de tráfego e redistribua entregas.",
      dataPoints: [{ label: "Atraso médio", value: `${Math.round(data.avgDeliveryTime)}min` }, { label: "Entregas ativas", value: data.activeDeliveries }],
    });
  }

  if (data.recentIncidents > 3) {
    alerts.push({
      id: "pred-hotspot", type: "area_hotspot",
      title: "Área Problemática Identificada",
      description: `${data.recentIncidents} incidentes recentes sugerem problemas recorrentes.`,
      probability: 60, impact: "medium", timeframe: "Últimos 7 dias",
      recommendation: "Analise o mapa de calor para identificar áreas específicas.",
      dataPoints: [{ label: "Incidentes recentes", value: data.recentIncidents }],
    });
  }

  if (data.stalledDrivers.length > 0) {
    const mainStalled = data.stalledDrivers[0];
    alerts.push({
      id: `pred-stalled-${mainStalled.orderId}`,
      type: "driver_stopped",
      title: "Motorista Imobilizado Detectado",
      description: `Motorista no pedido ${mainStalled.lalamoveId} está parado há ${mainStalled.minutes} min.`,
      probability: 90,
      impact: mainStalled.minutes > 30 ? "high" : "medium",
      timeframe: "Imediato",
      recommendation: "Entre em contato com o motorista para verificar problemas técnicos ou de segurança.",
      lalamoveOrderId: mainStalled.orderId,
      dataPoints: [
        { label: "Tempo Parado", value: `${mainStalled.minutes} min` },
        { label: "Pedido", value: mainStalled.lalamoveId }
      ],
    } as any);
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "pred-healthy", type: "sla_breach",
      title: "Sistema Operando Normalmente",
      description: "Nenhum risco significativo detectado.",
      probability: 5, impact: "low", timeframe: "Atual",
      recommendation: "Mantenha as práticas atuais.",
      dataPoints: [{ label: "Compliance", value: `${data.slaCompliance}%` }, { label: "Entregas ativas", value: data.activeDeliveries }],
    });
  }

  return alerts.sort((a, b) => b.probability - a.probability);
}

export function usePredictiveAnalysis() {
  const [predictions, setPredictions] = useState<PredictiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      const data = await fetchAnalysisData();
      const newPredictions = generatePredictions(data);
      setPredictions(newPredictions);
      setLastUpdated(new Date());
    } catch (err) {
      logger.error("Prediction error:", err);
      setError("Erro ao gerar predições. Tente novamente.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    runAnalysis();
    const interval = setInterval(() => runAnalysis(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { predictions, isLoading, isRefreshing, lastUpdated, error, refresh: () => runAnalysis(true) };
}
