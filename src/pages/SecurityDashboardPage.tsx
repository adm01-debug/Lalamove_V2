import { motion } from 'framer-motion';
import { 
  Shield, ShieldCheck, ShieldAlert, Key, Users, 
  Activity, AlertTriangle, Clock, Settings, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePermissions } from '@/hooks/usePermissions';
import { useRole } from '@/hooks/useRole';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { useMFA } from '@/hooks/useMFA';
import { useAuthLogs } from '@/hooks/useAuthLogs';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { MFASettings } from '@/components/auth/MFASettings';
import { PushNotificationSettings } from '@/components/notifications/PushNotificationSettings';
import { PasskeySettings } from '@/components/auth/PasskeySettings';

export default function SecurityDashboardPage() {
  const { userRoles, isAdmin } = usePermissions();
  const { roleStats } = useRole();
  const { stats: rateLimitStats, blockedIPs } = useRateLimiting();
  const { isMFAEnabled, factors } = useMFA();
  const { stats: authStats, authLogs } = useAuthLogs({ limit: 10 });
  const { hasPasskeys } = useWebAuthn();

  // Calcular score de segurança
  const calculateSecurityScore = () => {
    const checks = {
      mfaEnabled: isMFAEnabled ? 20 : 0,
      hasPasskeys: hasPasskeys ? 15 : 0,
      hasRole: (userRoles?.length || 0) > 0 ? 15 : 0,
      noBlockedActivity: rateLimitStats.blockedRequests === 0 ? 20 : 10,
      recentLoginSuccess: authStats.successful > authStats.failed ? 15 : 5,
      // Monitoring counts only when auth events are actually being recorded.
      activeMonitoring: authStats.total > 0 ? 15 : 0,
    };

    return Object.values(checks).reduce((a, b) => a + b, 0);
  };

  const securityScore = calculateSecurityScore();
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const quickLinks = [
    { title: 'Gerenciar Roles', icon: Users, href: '/roles', description: 'Atribuir e revogar permissões' },
    { title: 'Rate Limiting', icon: Activity, href: '/rate-limiting', description: 'Monitorar e bloquear IPs' },
    { title: 'Configurações', icon: Settings, href: '/settings', description: 'Preferências de segurança' },
  ];

  const recentActivity = authLogs?.slice(0, 5) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Central de Segurança
          </h2>
          <p className="text-muted-foreground">Monitore e gerencie a segurança do sistema</p>
        </div>
      </div>

      {/* Security Score Card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="glass-card md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Score de Segurança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(securityScore / 100) * 352} 352`}
                    className={getScoreColor(securityScore)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(securityScore)}`}>
                    {securityScore}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">MFA Ativo</span>
                {isMFAEnabled ? (
                  <Badge variant="default" className="bg-success">Sim</Badge>
                ) : (
                  <Badge variant="secondary">Não</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Role Atribuída</span>
                {userRoles && userRoles.length > 0 ? (
                  <Badge variant="default">{userRoles[0].role}</Badge>
                ) : (
                  <Badge variant="secondary">Nenhuma</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <div className="md:col-span-2 space-y-6">
          <PasskeySettings />
          <MFASettings />
          <PushNotificationSettings />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{roleStats?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Usuários c/ Role</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rateLimitStats.activeBlockedIPs}</p>
                  <p className="text-sm text-muted-foreground">IPs Bloqueados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{authStats.successful}</p>
                  <p className="text-sm text-muted-foreground">Logins OK</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{authStats.failed}</p>
                  <p className="text-sm text-muted-foreground">Logins Falhos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Links & Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Links */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Acesso Rápido</CardTitle>
            <CardDescription>Gerencie a segurança do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickLinks.map((link, index) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={link.href}>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <link.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{link.title}</p>
                        <p className="text-sm text-muted-foreground">{link.description}</p>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Atividade Recente</CardTitle>
            <CardDescription>Últimos eventos de autenticação</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma atividade recente</p>
                </div>
              ) : (
                recentActivity.map((log, index) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      log.success 
                        ? 'bg-muted/50 border-border/50' 
                        : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    {log.success ? (
                      <ShieldCheck className="h-4 w-4 text-success" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.event_type}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.ip_address || 'IP desconhecido'}
                      </p>
                    </div>
                    <Badge variant={log.success ? 'default' : 'destructive'} className="text-xs">
                      {log.success ? 'OK' : 'Falha'}
                    </Badge>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Recommendations */}
      {securityScore < 80 && (
        <Card className="glass-card border-warning/20 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Recomendações de Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {!isMFAEnabled && (
                <li className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-warning" />
                  <span>Ative a autenticação de dois fatores (MFA) para maior segurança</span>
                </li>
              )}
              {authStats.failed > authStats.successful && (
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span>Muitas tentativas de login falhadas detectadas</span>
                </li>
              )}
              {rateLimitStats.blockedRequests > 0 && (
                <li className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-warning" />
                  <span>Revise os IPs bloqueados por rate limiting</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
