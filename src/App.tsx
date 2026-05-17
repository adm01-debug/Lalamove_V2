import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import { AnimatePresence } from 'framer-motion';

// Lazy loaded pages - Auth
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const MFAVerifyPage = lazy(() => import('./pages/MFAVerifyPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));

// Lazy loaded pages - Dashboard
const DashboardRedesigned = lazy(() => import('./pages/DashboardRedesigned').then(m => ({ default: m.DashboardRedesigned })));

// Lazy loaded pages - Main Features
const OrdersPage = lazy(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const DriversPage = lazy(() => import('./pages/DriversPage').then(m => ({ default: m.DriversPage })));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage').then(m => ({ default: m.ApprovalsPage })));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage').then(m => ({ default: m.IncidentsPage })));
const MetricsPage = lazy(() => import('./pages/MetricsPage').then(m => ({ default: m.MetricsPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then(m => ({ default: m.AlertsPage })));
const LiveMapPage = lazy(() => import('./pages/LiveMapPage').then(m => ({ default: m.LiveMapPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage').then(m => ({ default: m.HeatmapPage })));
const SLADashboardPage = lazy(() => import('./pages/SLADashboardPage').then(m => ({ default: m.SLADashboardPage })));
const RiskRulesPage = lazy(() => import('./pages/RiskRulesPage').then(m => ({ default: m.RiskRulesPage })));
const WebhooksPage = lazy(() => import('./pages/WebhooksPage').then(m => ({ default: m.WebhooksPage })));
const Bitrix24Page = lazy(() => import('./pages/Bitrix24Page'));
const UAPISettingsPage = lazy(() => import('./pages/UAPISettingsPage'));
const LalamoveSettingsPage = lazy(() => import('./pages/LalamoveSettingsPage'));
const AlertConfigurationsPage = lazy(() => import('./pages/AlertConfigurationsPage').then(m => ({ default: m.AlertConfigurationsPage })));
const NotificationHistoryPage = lazy(() => import('./pages/NotificationHistoryPage').then(m => ({ default: m.NotificationHistoryPage })));
const DeliveryMetricsPage = lazy(() => import('./pages/DeliveryMetricsPage').then(m => ({ default: m.DeliveryMetricsPage })));
const EvaluationsPage = lazy(() => import('./pages/EvaluationsPage').then(m => ({ default: m.EvaluationsPage })));
const UserPreferencesPage = lazy(() => import('./pages/UserPreferencesPage'));
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage'));
const ExternalDataPage = lazy(() => import('./pages/ExternalDataPage'));
const MapToolsPage = lazy(() => import('./pages/MapToolsPage'));

// Lazy loaded pages - System
const SystemHealthPage = lazy(() => import('./pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const SystemHealthExpandedPage = lazy(() => import('./pages/SystemHealthExpandedPage'));
const CacheStatusPage = lazy(() => import('./pages/CacheStatusPage'));
const JobQueuePage = lazy(() => import('./pages/JobQueuePage'));
const CacheMonitoringPage = lazy(() => import('./pages/CacheMonitoringPage').then(m => ({ default: m.CacheMonitoringPage })));
const PerformanceDashboardPage = lazy(() => import('./pages/PerformanceDashboardPage').then(m => ({ default: m.PerformanceDashboardPage })));
const ErrorMonitoringPage = lazy(() => import('./pages/ErrorMonitoringPage'));
const AdminTelemetriaPage = lazy(() => import('./pages/AdminTelemetriaPage'));

// Lazy loaded pages - Security
const RolesPage = lazy(() => import('./pages/RolesPage'));
const PermissionsPage = lazy(() => import('./pages/PermissionsPage'));
const IPWhitelistPage = lazy(() => import('./pages/IPWhitelistPage'));
const RateLimitDashboardPage = lazy(() => import('./pages/RateLimitDashboardPage'));
const SecurityDashboardPage = lazy(() => import('./pages/SecurityDashboardPage'));
const GeoBlockingPage = lazy(() => import('./pages/GeoBlockingPage').then(m => ({ default: m.GeoBlockingPage })));
const PasswordResetApprovalsPage = lazy(() => import('./pages/PasswordResetApprovalsPage').then(m => ({ default: m.PasswordResetApprovalsPage })));

// NotFound - keep direct import for immediate feedback
import NotFound from "./pages/NotFound";

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

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
                <KeyboardShortcutsHelp />
                <AnimatePresence mode="wait">
                  <Routes location={location} key={location.pathname}>
                    {/* Public auth routes */}
                    <Route path="/auth" element={<SuspenseWrapper><AuthPage /></SuspenseWrapper>} />
                    <Route path="/forgot-password" element={<SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper>} />
                    <Route path="/reset-password" element={<SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper>} />
                    <Route path="/mfa-verify" element={<SuspenseWrapper><MFAVerifyPage /></SuspenseWrapper>} />
                    <Route path="/unauthorized" element={<SuspenseWrapper><UnauthorizedPage /></SuspenseWrapper>} />
                    
                    {/* Protected routes with layout */}
                    <Route element={<AppLayout />}>
                      {/* Dashboard */}
                      <Route path="/" element={<SuspenseWrapper><DashboardRedesigned /></SuspenseWrapper>} />
                      <Route path="/dashboard" element={<SuspenseWrapper><DashboardRedesigned /></SuspenseWrapper>} />
                      
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
                      <Route path="/job-queue" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><JobQueuePage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/error-monitoring" element={<ProtectedRoute requiredRole="manager"><SuspenseWrapper><ErrorMonitoringPage /></SuspenseWrapper></ProtectedRoute>} />
                      <Route path="/telemetria" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><AdminTelemetriaPage /></SuspenseWrapper></ProtectedRoute>} />
                      {/* Existing routes */}
                      <Route path="/orders" element={<SuspenseWrapper><OrdersPage /></SuspenseWrapper>} />
                      <Route path="/drivers" element={<SuspenseWrapper><DriversPage /></SuspenseWrapper>} />
                      <Route path="/approvals" element={<SuspenseWrapper><ApprovalsPage /></SuspenseWrapper>} />
                      <Route path="/incidents" element={<SuspenseWrapper><IncidentsPage /></SuspenseWrapper>} />
                      <Route path="/metrics" element={<SuspenseWrapper><MetricsPage /></SuspenseWrapper>} />
                      <Route path="/delivery-metrics" element={<SuspenseWrapper><DeliveryMetricsPage /></SuspenseWrapper>} />
                      <Route path="/alerts" element={<SuspenseWrapper><AlertsPage /></SuspenseWrapper>} />
                      <Route path="/alert-configurations" element={<SuspenseWrapper><AlertConfigurationsPage /></SuspenseWrapper>} />
                      <Route path="/notification-history" element={<SuspenseWrapper><NotificationHistoryPage /></SuspenseWrapper>} />
                      <Route path="/map" element={<SuspenseWrapper><LiveMapPage /></SuspenseWrapper>} />
                      <Route path="/live-map" element={<SuspenseWrapper><LiveMapPage /></SuspenseWrapper>} />
                      <Route path="/heatmap" element={<SuspenseWrapper><HeatmapPage /></SuspenseWrapper>} />
                      <Route path="/sla" element={<SuspenseWrapper><SLADashboardPage /></SuspenseWrapper>} />
                      <Route path="/risk-rules" element={<SuspenseWrapper><RiskRulesPage /></SuspenseWrapper>} />
                      <Route path="/evaluations" element={<SuspenseWrapper><EvaluationsPage /></SuspenseWrapper>} />
                      <Route path="/webhooks" element={<SuspenseWrapper><WebhooksPage /></SuspenseWrapper>} />
                      <Route path="/bitrix24" element={<SuspenseWrapper><Bitrix24Page /></SuspenseWrapper>} />
                      <Route path="/settings/uapi" element={<SuspenseWrapper><UAPISettingsPage /></SuspenseWrapper>} />
                      <Route path="/settings/lalamove" element={<SuspenseWrapper><LalamoveSettingsPage /></SuspenseWrapper>} />
                      <Route path="/reports" element={<SuspenseWrapper><ReportsPage /></SuspenseWrapper>} />
                      <Route path="/settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
                      <Route path="/preferences" element={<SuspenseWrapper><UserPreferencesPage /></SuspenseWrapper>} />
                      <Route path="/analytics" element={<SuspenseWrapper><AnalyticsDashboardPage /></SuspenseWrapper>} />
                      <Route path="/external-data" element={<SuspenseWrapper><ExternalDataPage /></SuspenseWrapper>} />
                      <Route path="/map-tools" element={<SuspenseWrapper><MapToolsPage /></SuspenseWrapper>} />
                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AnimatePresence>
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
