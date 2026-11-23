import { Suspense, useEffect } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { DeviceDetector } from "@/components/auth/DeviceDetector";
import { CommandPaletteEnhanced } from "@/components/CommandPaletteEnhanced";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OfflineIndicator, InstallPrompt } from "@/components/pwa/OfflineIndicator";
import { KeyboardShortcutsHelp } from "@/components/ui/keyboard-shortcuts-help";
import { HintProvider } from "@/components/ui/contextual-hints";
import { PageLoader } from "@/components/ui/page-loader";
import { AchievementsProvider } from "@/hooks/useAchievementsSystem";

// Lazy loaded pages - Auth
const AuthPage = lazyWithRetry(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const MFAVerifyPage = lazyWithRetry(() => import('./pages/MFAVerifyPage'));
const MFAEnrollPage = lazyWithRetry(() => import('./pages/MFAEnrollPage'));
const UnauthorizedPage = lazyWithRetry(() => import('./pages/UnauthorizedPage'));

// Lazy loaded pages - Dashboard
const DashboardRedesigned = lazyWithRetry(() => import('./pages/DashboardRedesigned').then(m => ({ default: m.DashboardRedesigned })));

// Lazy loaded pages - Main Features
const OrdersPage = lazyWithRetry(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const DriversPage = lazyWithRetry(() => import('./pages/DriversPage').then(m => ({ default: m.DriversPage })));
const ApprovalsPage = lazyWithRetry(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const IncidentsPage = lazyWithRetry(() => import('./pages/IncidentsPage').then(m => ({ default: m.IncidentsPage })));
const MetricsPage = lazyWithRetry(() => import('./pages/MetricsPage').then(m => ({ default: m.MetricsPage })));
const AlertsPage = lazyWithRetry(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const LiveMapPage = lazyWithRetry(() => import('./pages/LiveMapPage').then(m => ({ default: m.LiveMapPage })));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ReportsPage = lazyWithRetry(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AdvancedReportsPage = lazyWithRetry(() => import('./pages/AdvancedReportsPage'));
const HeatmapPage = lazyWithRetry(() => import('./pages/HeatmapPage').then(m => ({ default: m.HeatmapPage })));
const SLADashboardPage = lazyWithRetry(() => import('./pages/SLADashboardPage').then(m => ({ default: m.SLADashboardPage })));
const RiskRulesPage = lazyWithRetry(() => import('./pages/RiskRulesPage').then(m => ({ default: m.RiskRulesPage })));
const WebhooksPage = lazyWithRetry(() => import('./pages/WebhooksPage').then(m => ({ default: m.WebhooksPage })));
const Bitrix24Page = lazyWithRetry(() => import('./pages/Bitrix24Page'));
const UAPISettingsPage = lazyWithRetry(() => import('./pages/UAPISettingsPage'));
const LalamoveSettingsPage = lazyWithRetry(() => import('./pages/LalamoveSettingsPage'));
const MapsSettingsPage = lazyWithRetry(() => import('./pages/MapsSettingsPage'));
const AlertConfigurationsPage = lazyWithRetry(() => import('./pages/AlertConfigurationsPage').then(m => ({ default: m.AlertConfigurationsPage })));
const NotificationHistoryPage = lazyWithRetry(() => import('./pages/NotificationHistoryPage').then(m => ({ default: m.NotificationHistoryPage })));
const DeliveryMetricsPage = lazyWithRetry(() => import('./pages/DeliveryMetricsPage').then(m => ({ default: m.DeliveryMetricsPage })));
const EvaluationsPage = lazyWithRetry(() => import('./pages/EvaluationsPage').then(m => ({ default: m.EvaluationsPage })));
const UserPreferencesPage = lazyWithRetry(() => import('./pages/UserPreferencesPage'));
const AnalyticsDashboardPage = lazyWithRetry(() => import('./pages/AnalyticsDashboardPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const ExternalDataPage = lazyWithRetry(() => import('./pages/ExternalDataPage'));
const MapToolsPage = lazyWithRetry(() => import('./pages/MapToolsPage'));
const LalamoveQuotaPage = lazyWithRetry(() => import('./pages/LalamoveQuotaPage'));
const LalamoveOperationsPage = lazyWithRetry(() => import('./pages/LalamoveOperationsPage'));

const ContactsPage = lazyWithRetry(() => import('./pages/ContactsPage'));


// Lazy loaded pages - System
const SystemHealthPage = lazyWithRetry(() => import('./pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const SystemHealthExpandedPage = lazyWithRetry(() => import('./pages/SystemHealthExpandedPage'));
const CacheStatusPage = lazyWithRetry(() => import('./pages/CacheStatusPage'));
const JobQueuePage = lazyWithRetry(() => import('./pages/JobQueuePage'));
const CacheMonitoringPage = lazyWithRetry(() => import('./pages/CacheMonitoringPage').then(m => ({ default: m.CacheMonitoringPage })));
const PerformanceDashboardPage = lazyWithRetry(() => import('./pages/PerformanceDashboardPage').then(m => ({ default: m.PerformanceDashboardPage })));
const ErrorMonitoringPage = lazyWithRetry(() => import('./pages/ErrorMonitoringPage'));
const AdminTelemetriaPage = lazyWithRetry(() => import('./pages/AdminTelemetriaPage'));
const SLODashboardPage = lazyWithRetry(() => import('./pages/SLODashboardPage'));

// Lazy loaded pages - Security
const RolesPage = lazyWithRetry(() => import('./pages/RolesPage'));
const PermissionsPage = lazyWithRetry(() => import('./pages/PermissionsPage'));
const IPWhitelistPage = lazyWithRetry(() => import('./pages/IPWhitelistPage'));
const RateLimitDashboardPage = lazyWithRetry(() => import('./pages/RateLimitDashboardPage'));
const SecurityDashboardPage = lazyWithRetry(() => import('./pages/SecurityDashboardPage'));
const GeoBlockingPage = lazyWithRetry(() => import('./pages/GeoBlockingPage').then(m => ({ default: m.GeoBlockingPage })));
const PasswordResetApprovalsPage = lazyWithRetry(() => import('./pages/PasswordResetApprovalsPage').then(m => ({ default: m.PasswordResetApprovalsPage })));

// NotFound (item 58) - lazy + com retry de chunk
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// Suspense wrapper component
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

const AppContent = () => {
  const queryClient = getQueryClient();
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Rola o container principal (não a janela) e não restaura o topo em
    // navegação POP (voltar/avançar) para preservar a posição de scroll.
    if (navigationType === 'POP') return;
    const main = document.getElementById('main-content');
    if (main) main.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }, [location.pathname, navigationType]);

  const isAuthPage = location.pathname.startsWith('/auth');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AchievementsProvider>
            <TooltipProvider>
              <HintProvider>
                <Toaster />
                <DeviceDetector />
                <CommandPaletteEnhanced />
                <OfflineIndicator />
                <InstallPrompt />
                {!isAuthPage && <KeyboardShortcutsHelp />}
                  <Routes location={location}>
                    {/* Public auth routes */}
                    <Route path="/auth" element={<SuspenseWrapper><AuthPage /></SuspenseWrapper>} />
                    <Route path="/forgot-password" element={<SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper>} />
                    <Route path="/reset-password" element={<SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>} />
                    <Route path="/mfa-verify" element={<SuspenseWrapper><MFAVerifyPage /></SuspenseWrapper>} />
                    <Route path="/mfa-enroll" element={<SuspenseWrapper><MFAEnrollPage /></SuspenseWrapper>} />
                    <Route path="/unauthorized" element={<SuspenseWrapper><UnauthorizedPage /></SuspenseWrapper>} />
                    
                    {/* Protected routes with layout */}
                    <Route element={<AppLayout />}>
                      {/* Dashboard (item 51 — papel mínimo viewer) */}
                      <Route path="/" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><DashboardRedesigned /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/dashboard" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><DashboardRedesigned /></SuspenseWrapper></ProtectedRoute>} />
                      
                      {/* Security routes - Admin only */}
                      <Route path="/security" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><SecurityDashboardPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/roles" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><RolesPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/permissions" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><PermissionsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/ip-whitelist" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><IPWhitelistPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/rate-limiting" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><RateLimitDashboardPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/geo-blocking" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><GeoBlockingPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/password-reset-approvals" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><PasswordResetApprovalsPage /></SuspenseWrapper></ProtectedRoute>} />
                      
                      {/* Admin pages - Manager+ */}
                      <Route path="/system-health" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><SystemHealthPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/system-health-expanded" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><SystemHealthExpandedPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/cache-status" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><CacheStatusPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/cache-monitoring" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><CacheMonitoringPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/performance" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><PerformanceDashboardPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/slo" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><SLODashboardPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/job-queue" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><JobQueuePage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/error-monitoring" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><ErrorMonitoringPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/telemetria" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><AdminTelemetriaPage /></SuspenseWrapper></ProtectedRoute>} />
                      {/* Existing routes */}
                      <Route path="/orders" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><OrdersPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/contacts" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><ContactsPage /></SuspenseWrapper></ProtectedRoute>} />

                      <Route path="/drivers" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><DriversPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/approvals" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><ApprovalsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/incidents" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><IncidentsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/metrics" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><MetricsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/delivery-metrics" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><DeliveryMetricsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/alerts" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><AlertsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/alert-configurations" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><AlertConfigurationsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/notification-history" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><NotificationHistoryPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/live-map" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><LiveMapPage /></SuspenseWrapper></ProtectedRoute>} />
                      {/* item 50 — /map é alias legado de /live-map; redireciona para a rota canônica */}
                      <Route path="/map" element={<Navigate to="/live-map" replace />} />
                      <Route path="/heatmap" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><HeatmapPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/sla" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><SLADashboardPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/risk-rules" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><RiskRulesPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/evaluations" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><EvaluationsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/webhooks" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><WebhooksPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/bitrix24" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><Bitrix24Page /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/settings/uapi" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><UAPISettingsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/settings/lalamove" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><LalamoveSettingsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/settings/maps" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><MapsSettingsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/reports" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><ReportsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/reports/advanced" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><AdvancedReportsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><SettingsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><ProfilePage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/preferences" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><UserPreferencesPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/analytics" element={<ProtectedRoute requiredRole="viewer"><SuspenseWrapper><AnalyticsDashboardPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/external-data" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><ExternalDataPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/map-tools" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><MapToolsPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/lalamove-quota" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><LalamoveQuotaPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/lalamove-operacoes" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><LalamoveOperationsPage /></SuspenseWrapper></ProtectedRoute>} />

                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
              </HintProvider>
            </TooltipProvider>
          </AchievementsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
