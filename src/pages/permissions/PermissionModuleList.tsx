import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Shield, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Permission, AppRole } from '@/hooks/usePermissions';

interface ModuleListProps {
  filteredModules: string[];
  groupedPermissions: Record<string, Permission[]>;
  expandedModules: string[];
  selectedRole: AppRole;
  moduleIcons: Record<string, React.ElementType>;
  getEffectivePermission: (id: string) => boolean;
  getModuleStats: (module: string) => { enabled: number; total: number };
  handleTogglePermission: (id: string) => void;
  handleToggleModuleAll: (module: string, value: boolean) => void;
  toggleModule: (module: string) => void;
  pendingChanges: Record<string, boolean>;
  permissionMatrix: Record<string, Record<string, boolean>>;
  searchedPermissions?: Permission[];
  searchTerm?: string;
}

export function PermissionModuleList({
  filteredModules, groupedPermissions, expandedModules, selectedRole,
  moduleIcons, getEffectivePermission, getModuleStats,
  handleTogglePermission, handleToggleModuleAll, toggleModule,
  pendingChanges, permissionMatrix, searchedPermissions, searchTerm,
}: ModuleListProps) {
  return (
    <>
      {selectedRole === 'admin' && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Administradores têm acesso total. As permissões não podem ser alteradas.
          </p>
        </div>
      )}

      {filteredModules.map(module => {
        const Icon = moduleIcons[module] || Shield;
        const permissions = groupedPermissions[module] || [];
        const isExpanded = expandedModules.includes(module);
        const stats = getModuleStats(module);
        const allEnabled = stats.enabled === stats.total;
        const someEnabled = stats.enabled > 0 && stats.enabled < stats.total;

        const filteredPermissions = searchTerm?.trim() && searchedPermissions
          ? permissions.filter(p => searchedPermissions.some(sp => sp.id === p.id))
          : permissions;

        return (
          <Collapsible key={module} open={isExpanded} onOpenChange={() => toggleModule(module)}>
            <div className="rounded-lg border bg-card overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium capitalize flex items-center gap-2">
                      {module}
                      <Badge variant="outline" className="text-xs">{stats.enabled}/{stats.total}</Badge>
                    </h4>
                  </div>
                  {selectedRole !== 'admin' && (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={allEnabled}
                        onCheckedChange={(checked) => handleToggleModuleAll(module, !!checked)}
                        className={cn(someEnabled && "data-[state=checked]:bg-primary/50")}
                      />
                      <span className="text-xs text-muted-foreground">Todos</span>
                    </div>
                  )}
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t bg-muted/30 divide-y divide-border/50">
                  {filteredPermissions.map(permission => {
                    const isEnabled = getEffectivePermission(permission.id);
                    const hasChanged = pendingChanges[`${selectedRole}-${permission.id}`] !== undefined;

                    return (
                      <div key={permission.id} className={cn("flex items-center justify-between p-3 pl-12 transition-colors", hasChanged && "bg-warning/10")}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{permission.name}</span>
                            <Badge variant="outline" className="text-[10px]">{permission.action}</Badge>
                            {hasChanged && <Badge variant="secondary" className="text-[10px] bg-warning/20 text-warning">Alterado</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleTogglePermission(permission.id)}
                          disabled={selectedRole === 'admin'}
                          className={cn(
                            isEnabled && selectedRole === 'admin' && 'bg-destructive',
                            isEnabled && selectedRole === 'manager' && 'bg-primary',
                            isEnabled && selectedRole === 'operator' && 'bg-info'
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {filteredModules.length === 0 && (
        <div className="text-center py-12">
          <Lock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma permissão encontrada</p>
        </div>
      )}
    </>
  );
}
