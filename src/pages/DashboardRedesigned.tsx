import { 
  Package, 
  Truck, 
  CheckCircle2, 
  Shield, 
  Bell, 
  Clock,
  TrendingUp,
  Users,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertActionCard } from '@/components/dashboard/AlertActionCard';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { LiveMapPlaceholder } from '@/components/dashboard/LiveMapPlaceholder';
import { OrdersTable } from '@/components/dashboard/OrdersTable';
import { ApprovalQueue } from '@/components/dashboard/ApprovalQueue';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { AIRouteChatbot } from '@/components/dashboard/AIRouteChatbot';
import { ActivityTimeline } from '@/components/ui/activity-timeline';
import { PredictionCard } from '@/components/ui/prediction-card';
import { PredictiveAlerts } from '@/components/alerts/PredictiveAlerts';
import { DashboardHeroSection, WelcomeBanner } from '@/components/dashboard/DashboardHeroSection';
import { UAPIStatusCards } from '@/components/dashboard/UAPIStatusCards';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { LiveRegion } from '@/components/ui/accessible-card';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useRecentOrders } from '@/hooks/useRecentOrders';
import { usePendingApprovals, useApprovalActions } from '@/hooks/usePendingApprovals';
import { useActiveAlerts, useAlertActions } from '@/hooks/useActiveAlerts';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnnounce } from '@/hooks/useAccessibility';
import { DriverApproval, Alert } from '@/types';
import { motion } from 'framer-motion';
import { useCallback, useState, useMemo } from 'react';

// Use displayStats after loading guard
const defaultStats = {
  totalOrders: 0, activeDeliveries: 0, completedToday: 0,
  pendingApprovals: 0, alertsCount: 0, avgDeliveryTime: 0,
  onTimeRate: 0, activeDrivers: 0,
};

export function DashboardRedesigned() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { announce } = useAnnounce();
  const [liveMessage, setLiveMessage] = useState('');
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useRecentOrders();
  const { data: approvals, isLoading: approvalsLoading, refetch: refetchApprovals } = usePendingApprovals();
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useActiveAlerts();
  
  const { approveMutation, rejectMutation } = useApprovalActions();
  const { dismissMutation } = useAlertActions();

  const isLoading = statsLoading || ordersLoading || approvalsLoading || alertsLoading;

  // Compute sparklines from real order data
  const ordersSparkline = useMemo(() => {
    const orders = ordersData?.orders ?? [];
    if (orders.length === 0) return [0, 0, 0, 0, 0];
    const now = Date.now();
    return [4, 3, 2, 1, 0].map(hoursAgo => {
      const from = now - (hoursAgo + 1) * 3600000;
      const to = now - hoursAgo * 3600000;
      return orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= from && t < to;
      }).length;
    });
  }, [ordersData]);

  const completionSparkline = useMemo(() => {
    const orders = ordersData?.orders ?? [];
    if (orders.length === 0) return [0, 0, 0, 0, 0];
    const now = Date.now();
    return [4, 3, 2, 1, 0].map(hoursAgo => {
      const from = now - (hoursAgo + 1) * 3600000;
      const to = now - hoursAgo * 3600000;
      return orders.filter(o => {
        const t = new Date(o.createdAt).getTime();
        return t >= from && t < to && o.status === 'COMPLETED';
      }).length;
    });
  }, [ordersData]);

  // Compute dynamic counts from real data
  const highRiskDriversCount = useMemo(() => {
    // Count drivers with HIGH/CRITICAL risk from approval queue
    return (approvals ?? []).filter(a => a.riskScore >= 70).length;
  }, [approvals]);

  const nearSLACount = useMemo(() => {
    // Orders that are active and close to estimated delivery
    const activeOrders = ordersData?.orders?.filter(o => 
      ['ON_GOING', 'PICKED_UP'].includes(o.status) && o.estimatedDelivery
    ) ?? [];
    const now = Date.now();
    return activeOrders.filter(o => {
      const eta = new Date(o.estimatedDelivery!).getTime();
      const remaining = eta - now;
      return remaining > 0 && remaining < 30 * 60 * 1000; // within 30 min
    }).length;
  }, [ordersData]);

  // Dynamic prediction based on current data
  const s = stats ?? defaultStats;
  const predictionText = useMemo(() => {
    const hour = new Date().getHours();
    const nextHours = `${hour}h-${hour + 2}h`;
    const estimatedOrders = Math.max(Math.round(s.totalOrders / 12), s.activeDeliveries + 5);
    return `Com base no histórico, esperamos ~${estimatedOrders} pedidos nas próximas 2 horas (${nextHours}).`;
  }, [s.totalOrders, s.activeDeliveries]);

  const predictionConfidence = useMemo(() => {
    return s.totalOrders > 50 ? 85 : s.totalOrders > 10 ? 65 : 40;
  }, [s.totalOrders]);

  const predictionRecommendation = useMemo(() => {
    if (s.activeDeliveries > s.activeDrivers * 2) {
      return `Demanda alta! Considere ativar mais ${Math.ceil(s.activeDeliveries / 3)} motoristas.`;
    }
    if (s.pendingApprovals > 3) {
      return `${s.pendingApprovals} aprovações pendentes requerem atenção imediata.`;
    }
    return 'Operação estável. Monitore o dashboard para mudanças.';
  }, [s]);
  
  // Build recent events from real data
  const recentEvents = useMemo(() => {
    const events: Array<{
      id: string;
      time: Date;
      type: 'delivery' | 'alert' | 'approval';
      title: string;
      description: string;
    }> = [];

    // Add recent orders as delivery events
    const recentOrdersList = ordersData?.orders?.slice(0, 2) ?? [];
    recentOrdersList.forEach((order, i) => {
      events.push({
        id: `order-${order.id}`,
        time: new Date(order.updatedAt || order.createdAt),
        type: 'delivery',
        title: `Pedido ${order.lalamoveId} — ${order.status}`,
        description: order.customerName || 'Cliente',
      });
    });

    // Add pending approvals
    const recentApprovals = (approvals ?? []).slice(0, 1);
    recentApprovals.forEach((a) => {
      events.push({
        id: `approval-${a.id}`,
        time: new Date(a.requestedAt),
        type: 'approval',
        title: 'Nova aprovação pendente',
        description: a.driver?.name || 'Motorista',
      });
    });

    // Add recent alerts
    const recentAlerts = (alerts ?? []).filter(a => !a.isRead).slice(0, 1);
    recentAlerts.forEach((a) => {
      events.push({
        id: `alert-${a.id}`,
        time: new Date(a.createdAt),
        type: 'alert',
        title: a.title,
        description: a.message,
      });
    });

    return events.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 5);
  }, [ordersData, approvals, alerts]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchStats(),
      refetchOrders(),
      refetchApprovals(),
      refetchAlerts()
    ]);
    setLiveMessage('Dashboard atualizado com sucesso');
    announce('Dashboard atualizado');
  }, [refetchStats, refetchOrders, refetchApprovals, refetchAlerts, announce]);

  const handleApprove = useCallback((approval: DriverApproval) => {
    approveMutation.mutate({ approvalId: approval.id, driverId: approval.driverId });
  }, [approveMutation]);

  const handleReject = useCallback((approval: DriverApproval) => {
    rejectMutation.mutate({ approvalId: approval.id, driverId: approval.driverId });
  }, [rejectMutation]);

  const handleDismissAlert = useCallback((alert: Alert) => {
    dismissMutation.mutate(alert.id);
  }, [dismissMutation]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const displayStats = stats ?? defaultStats;

  const dashboardContent = (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Live region for screen reader announcements */}
      <LiveRegion>{liveMessage}</LiveRegion>
      
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <WelcomeBanner userName={user?.email} />
      </motion.div>

      {/* UAPI Wallet & Status */}
      <UAPIStatusCards />

      {/* Hero Metrics Section */}
      <DashboardHeroSection stats={displayStats} />

      {/* HERO SECTION - Critical Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <AlertActionCard
          severity="critical"
          icon={AlertTriangle}
          title="Atenção Necessária"
          cardId="critical-attention"
          items={[
            {
              text: `${displayStats.pendingApprovals} aprovações pendentes`,
              count: displayStats.pendingApprovals,
              action: "Revisar",
              onClick: () => navigate('/approvals')
            },
            {
              text: "Motoristas alto risco",
              count: highRiskDriversCount,
              action: "Ver",
              onClick: () => navigate('/drivers')
            }
          ]}
          primaryAction={() => navigate('/approvals')}
          primaryLabel="Revisar Agora"
        />

        <AlertActionCard
          severity="warning"
          icon={Zap}
          title="Ação Rápida"
          cardId="quick-action"
          items={[
            {
              text: "Pedidos próximos ao SLA",
              count: nearSLACount,
              action: "Ver",
              onClick: () => navigate('/orders')
            },
            {
              text: "Alertas ativos",
              count: displayStats.alertsCount,
              action: "Ver",
              onClick: () => navigate('/alerts')
            }
          ]}
          primaryAction={() => navigate('/live-map')}
          primaryLabel="Ver Mapa"
        />
      </div>

      {/* Main Metrics with Sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          value={displayStats.totalOrders}
          label="Total Pedidos"
          icon={Package}
          sparkline={ordersSparkline}
          variant="primary"
          size="default"
        />
        
        <MetricCard
          value={displayStats.activeDeliveries}
          label="Ativas"
          icon={Truck}
          variant="warning"
          live
        />
        
        <MetricCard
          value={displayStats.completedToday}
          label="Concluídas"
          icon={CheckCircle2}
          sparkline={completionSparkline}
          comparison={`${displayStats.onTimeRate}% no prazo`}
          variant="success"
        />
        
        <MetricCard
          value={displayStats.pendingApprovals}
          label="Pendentes"
          icon={Shield}
          variant={displayStats.pendingApprovals > 0 ? 'warning' : 'default'}
          onClick={() => navigate('/approvals')}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          value={displayStats.alertsCount}
          label="Alertas"
          icon={Bell}
          variant={displayStats.alertsCount > 0 ? 'destructive' : 'default'}
          onClick={() => navigate('/alerts')}
        />
        <MetricCard
          value={`${displayStats.avgDeliveryTime}min`}
          label="Tempo Médio"
          icon={Clock}
        />
        <MetricCard
          value={`${displayStats.onTimeRate}%`}
          label="No Prazo"
          icon={TrendingUp}
          variant="success"
        />
        <MetricCard
          value={displayStats.activeDrivers}
          label="Motoristas"
          icon={Users}
          variant="primary"
          onClick={() => navigate('/drivers')}
        />
      </div>

      {/* Prediction Card - dynamic based on current stats */}
      <PredictionCard
        prediction={predictionText}
        confidence={predictionConfidence}
        trend={displayStats.activeDeliveries > 5 ? "up" : "stable"}
        impact={displayStats.activeDeliveries > 10 ? "high" : "medium"}
        timeframe="Próximas 2 horas"
        recommendation={predictionRecommendation}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Map (HERO SIZE) */}
        <div className="xl:col-span-2 space-y-4 md:space-y-6">
          <LiveMapPlaceholder 
            activeDeliveries={displayStats.activeDeliveries}
            className="h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px]"
          />
          <OrdersTable orders={ordersData?.orders ?? []} />
        </div>

        {/* Right Column - Activity & Approvals */}
        <div className="space-y-4 md:space-y-6">
          {/* Predictive Alerts - AI-powered */}
          <PredictiveAlerts maxItems={3} />
          
          {/* Activity Timeline */}
          <div className="glass-card rounded-xl p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4">
              Atividade Recente
            </h3>
            <ActivityTimeline events={recentEvents} maxItems={5} />
          </div>
          
          <ApprovalQueue 
            approvals={approvals ?? []} 
            onApprove={handleApprove}
            onReject={handleReject}
          />
          
          <AlertsPanel 
            alerts={alerts ?? []} 
            onDismiss={handleDismissAlert}
          />
        </div>
      </div>

      <AIRouteChatbot />
    </div>
  );

  // Wrap with pull-to-refresh on mobile
  if (isMobile) {
    return (
      <PullToRefresh 
        onRefresh={handleRefresh}
        className="h-full"
        refreshingText="Atualizando..."
        pullText="Puxe para atualizar"
        releaseText="Solte para atualizar"
      >
        <section role="region" aria-label="Dashboard principal">
          {dashboardContent}
        </section>
      </PullToRefresh>
    );
  }

  return (
    <section role="region" aria-label="Dashboard principal">
      {dashboardContent}
    </section>
  );
}
