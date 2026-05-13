import { ReactNode } from 'react';
import { usePermissions, type AppRole } from '@/hooks/usePermissions';
import { Shield, Lock } from 'lucide-react';

interface PermissionGateProps {
  children: ReactNode;
  permission?: string;
  role?: AppRole;
  roles?: AppRole[];
  fallback?: ReactNode;
  showLocked?: boolean;
}

export function PermissionGate({
  children,
  permission,
  role,
  roles,
  fallback,
  showLocked = false,
}: PermissionGateProps) {
  const { hasPermission, hasRole, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  // Check permission
  if (permission && !hasPermission(permission)) {
    if (showLocked) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Você não tem permissão para acessar este recurso
          </span>
        </div>
      );
    }
    return <>{fallback}</> || null;
  }

  // Check single role
  if (role && !hasRole(role)) {
    if (showLocked) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Acesso restrito para {role}
          </span>
        </div>
      );
    }
    return <>{fallback}</> || null;
  }

  // Check multiple roles (any)
  if (roles && roles.length > 0) {
    const hasAnyRole = roles.some(r => hasRole(r));
    if (!hasAnyRole) {
      if (showLocked) {
        return (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Acesso restrito
            </span>
          </div>
        );
      }
      return <>{fallback}</> || null;
    }
  }

  return <>{children}</>;
}
