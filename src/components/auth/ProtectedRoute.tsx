import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useMFA } from '@/hooks/useMFA';
import { roleHierarchy, type AppRole } from '@/lib/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requiredPermission?: string;
  requireMFA?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  requiredPermission,
  requireMFA = false 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasRole, hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { needsMFAVerification, needsMFAEnrollment, loadingFactors, loadingAAL } = useMFA();
  const location = useLocation();

  // Loading state
  if (authLoading || permissionsLoading || loadingFactors || loadingAAL) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // MFA required but no verified factor -> must enroll first
  if (requireMFA && needsMFAEnrollment) {
    return <Navigate to="/mfa-enroll" state={{ from: location }} replace />;
  }

  // MFA required but not verified
  if (requireMFA && needsMFAVerification) {
    return <Navigate to="/mfa-verify" state={{ from: location }} replace />;
  }

  // Role check with hierarchy: admin > manager > operator > viewer.
  if (requiredRole) {
    const hasRequiredRole = (Object.keys(roleHierarchy) as AppRole[]).some(
      role => hasRole(role) && roleHierarchy[role] >= roleHierarchy[requiredRole],
    );

    if (!hasRequiredRole) {
      return (
        <Navigate
          to="/unauthorized"
          replace
          state={{ attemptedPath: location.pathname, requiredRole, requiredPermission }}
        />
      );
    }
  }

  // Permission check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ attemptedPath: location.pathname, requiredRole, requiredPermission }}
      />
    );
  }

  return <>{children}</>;
}
