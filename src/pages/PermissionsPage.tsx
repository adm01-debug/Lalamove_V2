import { useState, useMemo } from 'react';
import { usePermissions, type AppRole, type Permission } from '@/hooks/usePermissions';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import {
  Shield, Eye, Check, Users, Settings, Package, Bell, BarChart3, Map,
  AlertTriangle, Webhook, Database, Key, Crown, UserCog, Save, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Skeleton } from '@/components/ui/skeleton';
import { DataErrorBanner } from '@/components/ui/data-error-banner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PermissionModuleList } from './permissions/PermissionModuleList';

const moduleIcons: Record<string, React.ElementType> = {
  dashboard: BarChart3, drivers: Users, orders: Package, alerts: Bell,
  reports: BarChart3, settings: Settings, security: Shield, users: Users,
  integrations: Database, tracking: Map, incidents: AlertTriangle,
  evaluations: Eye, risk: Shield, webhooks: Webhook, system: Database,
  bitrix24: Database, approvals: Check, analytics: BarChart3,
};

const roleConfig: Record<AppRole, { icon: React.ElementType; color: string; label: string; description: string }> = {
  admin: { icon: Crown, color: 'from-destructive/20 to-destructive/5 border-destructive/30 text-destructive', label: 'Administrador', description: 'Acesso total ao sistema' },
  manager: { icon: UserCog, color: 'from-primary/20 to-primary/5 border-primary/30 text-primary', label: 'Gerente', description: 'Gerencia equipes e operações' },
  operator: { icon: Users, color: 'from-info/20 to-info/5 border-info/30 text-info', label: 'Operador', description: 'Executa operações do dia a dia' },
  viewer: { icon: Eye, color: 'from-muted to-muted/50 border-border text-muted-foreground', label: 'Visualizador', description: 'Apenas visualização' },
};

interface RolePermissionMatrix { [role: string]: { [permissionId: string]: boolean }; }

export default function PermissionsPage() {
  const { allPermissions, rolePermissions, isLoading, isError, refetch } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const groupedPermissions = allPermissions?.reduce((acc, permission) => {
    const module = permission.module;
    if (!acc[module]) acc[module] = [];
    acc[module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>) || {};

  const modules = Object.keys(groupedPermissions).sort();
  const roles: AppRole[] = ['admin', 'manager', 'operator', 'viewer'];

  const permissionMatrix: RolePermissionMatrix = {};
  roles.forEach(role => {
    permissionMatrix[role] = {};
    allPermissions?.forEach(permission => {
      permissionMatrix[role][permission.id] = !!rolePermissions?.some(rp => rp.role === role && rp.permission_id === permission.id);
    });
  });

  const permissionSearchKeys = useMemo(() => ['name', 'description', 'module'], []);
  const permissionSearchResults = useFuseSearchWithMatches(allPermissions || [], permissionSearchKeys, searchTerm);
  const searchedPermissions = searchTerm.trim() ? permissionSearchResults.map(r => ({ ...r.item, _matches: r.matches })) : (allPermissions || []);

  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return modules;
    const ids = new Set(searchedPermissions.map(p => p.id));
    return modules.filter(m => (groupedPermissions[m] || []).some(p => ids.has(p.id)));
  }, [modules, groupedPermissions, searchedPermissions, searchTerm]);

  const toggleModule = (module: string) => setExpandedModules(prev => prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]);
  const expandAll = () => setExpandedModules(modules);
  const collapseAll = () => setExpandedModules([]);

  const getEffectivePermission = (permissionId: string) => {
    const key = `${selectedRole}-${permissionId}`;
    return key in pendingChanges ? pendingChanges[key] : (permissionMatrix[selectedRole]?.[permissionId] || false);
  };

  const handleTogglePermission = (permissionId: string) => {
    if (selectedRole === 'admin') return;
    const key = `${selectedRole}-${permissionId}`;
    setPendingChanges(prev => ({ ...prev, [key]: !getEffectivePermission(permissionId) }));
  };

  const handleToggleModuleAll = (module: string, value: boolean) => {
    if (selectedRole === 'admin') return;
    const changes: Record<string, boolean> = {};
    (groupedPermissions[module] || []).forEach(p => { changes[`${selectedRole}-${p.id}`] = value; });
    setPendingChanges(prev => ({ ...prev, ...changes }));
  };

  const getModuleStats = (module: string) => {
    const permissions = groupedPermissions[module] || [];
    return { enabled: permissions.filter(p => getEffectivePermission(p.id)).length, total: permissions.length };
  };

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  const saveChanges = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(pendingChanges)) {
        const [role, permissionId] = key.split('-') as [AppRole, string];
        const current = permissionMatrix[role]?.[permissionId] || false;
        if (value !== current) {
          if (value) await supabase.from('role_permissions').insert({ role, permission_id: permissionId });
          else await supabase.from('role_permissions').delete().eq('role', role).eq('permission_id', permissionId);
        }
      }
      setPendingChanges({});
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Permissões salvas com sucesso!');
    } catch (error) {
      toast.error(`Erro ao salvar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally { setSaving(false); }
  };

  const discardChanges = () => { setPendingChanges({}); toast.info('Alterações descartadas'); };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <DataErrorBanner
          message="Não foi possível carregar as permissões."
          details="A matriz de permissões fica vazia até a leitura voltar."
          onRetry={() => { void refetch(); }}
        />
      </div>
    );
  }

  const config = roleConfig[selectedRole];
  const RoleIcon = config.icon;

  return (
    <PermissionGate permission="users.roles" showLocked>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20"><Key className="h-6 w-6 text-primary" /></div>
              Gerenciar Permissões
            </h2>
            <p className="text-muted-foreground mt-1">Configure permissões granulares para cada função</p>
          </div>
          <AnimatePresence>
            {hasPendingChanges && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex gap-2">
                <Button variant="outline" onClick={discardChanges} disabled={saving}><RotateCcw className="h-4 w-4 mr-2" />Descartar</Button>
                <Button onClick={saveChanges} disabled={saving} className="bg-success hover:bg-success/90"><Save className="h-4 w-4 mr-2" />{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {roles.map(role => {
            const cfg = roleConfig[role];
            const Icon = cfg.icon;
            const isSelected = selectedRole === role;
            const total = allPermissions?.length || 0;
            const enabled = allPermissions?.filter(p => permissionMatrix[role]?.[p.id]).length || 0;
            return (
              <motion.div key={role} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card className={cn("cursor-pointer transition-all border-2", isSelected ? `bg-gradient-to-br ${cfg.color}` : "hover:border-primary/30")} onClick={() => setSelectedRole(role)}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className={cn("p-2 rounded-lg", isSelected ? "bg-background/50" : "bg-secondary")}><Icon className={cn("h-5 w-5", isSelected && cfg.color.split(' ').pop())} /></div>
                      {isSelected && <Badge variant="secondary" className="bg-background/50"><Check className="h-3 w-3 mr-1" />Selecionado</Badge>}
                    </div>
                    <div className="mt-3"><h3 className="font-semibold">{cfg.label}</h3><p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p></div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-background/50 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", role === 'admin' ? "bg-destructive" : role === 'manager' ? "bg-primary" : role === 'operator' ? "bg-info" : "bg-muted-foreground")} style={{ width: total > 0 ? `${(enabled / total) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-xs font-medium">{enabled}/{total}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Permissions Editor */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl bg-gradient-to-br", config.color)}><RoleIcon className="h-5 w-5" /></div>
                <div><CardTitle>Permissões: {config.label}</CardTitle><CardDescription>{config.description}</CardDescription></div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 min-w-[200px]"><SearchInputWithHelp value={searchTerm} onChange={setSearchTerm} placeholder="Buscar permissões..." /></div>
                <Button variant="outline" size="sm" onClick={expandAll}>Expandir</Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>Recolher</Button>
              </div>
            </div>
          </CardHeader>
          <ScrollArea className="h-[500px]">
            <CardContent className="pt-4 space-y-2">
              <PermissionModuleList
                filteredModules={filteredModules} groupedPermissions={groupedPermissions}
                expandedModules={expandedModules} selectedRole={selectedRole}
                moduleIcons={moduleIcons} getEffectivePermission={getEffectivePermission}
                getModuleStats={getModuleStats} handleTogglePermission={handleTogglePermission}
                handleToggleModuleAll={handleToggleModuleAll} toggleModule={toggleModule}
                pendingChanges={pendingChanges} permissionMatrix={permissionMatrix}
                searchedPermissions={searchedPermissions} searchTerm={searchTerm}
              />
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total de Módulos', value: modules.length },
            { label: 'Total de Permissões', value: allPermissions?.length || 0 },
            { label: `Permissões de ${config.label}`, value: allPermissions?.filter(p => getEffectivePermission(p.id)).length || 0 },
          ].map(stat => (
            <Card key={stat.label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stat.value}</div></CardContent></Card>
          ))}
        </div>
      </div>
    </PermissionGate>
  );
}
