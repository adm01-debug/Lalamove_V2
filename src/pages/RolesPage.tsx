import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Users, Crown, UserCog, Eye, Plus, Search, 
  MoreVertical, Trash2, Clock, Check, X, Loader2
} from 'lucide-react';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { HighlightText } from '@/components/ui/highlight-match';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRole } from '@/hooks/useRole';
import { usePermissions, type AppRole } from '@/hooks/usePermissions';
import { PermissionGate } from '@/components/auth/PermissionGate';

const roleConfig: Record<AppRole, { icon: React.ElementType; color: string; label: string; description: string }> = {
  admin: {
    icon: Crown,
    color: 'text-warning',
    label: 'Administrador',
    description: 'Acesso total ao sistema',
  },
  manager: {
    icon: UserCog,
    color: 'text-info',
    label: 'Gerente',
    description: 'Gerenciamento de operações',
  },
  operator: {
    icon: Users,
    color: 'text-success',
    label: 'Operador',
    description: 'Operações do dia-a-dia',
  },
  viewer: {
    icon: Eye,
    color: 'text-muted-foreground',
    label: 'Visualizador',
    description: 'Apenas visualização',
  },
};

export default function RolesPage() {
  const { rolesSummary, roleStats, updateUserRole, isUpdating, isLoading } = useRole();
  const { allPermissions } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState({ userId: '', role: 'viewer' as AppRole, notes: '' });

  const handleAssignRole = () => {
    if (!newUserData.userId) return;
    
    updateUserRole({
      userId: newUserData.userId,
      role: newUserData.role,
      action: 'assign',
      notes: newUserData.notes || undefined,
    });
    
    setShowAddUserDialog(false);
    setNewUserData({ userId: '', role: 'viewer', notes: '' });
  };

  const handleRevokeRole = (userId: string, role: AppRole) => {
    updateUserRole({ userId, role, action: 'revoke' });
  };

  const currentRoleData = rolesSummary.find(r => r.role === selectedRole);
  
  // Fuzzy search with Fuse.js for users - with match highlighting
  const userSearchKeys = useMemo(() => ['user_id'], []);
  const userSearchResults = useFuseSearchWithMatches(currentRoleData?.users || [], userSearchKeys, searchTerm);
  const displayedUsers = searchTerm.trim() 
    ? userSearchResults.map(r => ({ ...r.item, _matches: r.matches }))
    : (currentRoleData?.users || []);
  
  const config = roleConfig[selectedRole];
  const Icon = config.icon;

  // Filtrar permissões por role
  const rolePermissions = allPermissions?.filter(() => {
    // Em uma implementação real, você filtraria baseado no role_permissions
    return true;
  });

  // Agrupar permissões por módulo
  const permissionsByModule = rolePermissions?.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, typeof rolePermissions>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionGate permission="users.roles" showLocked>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Gerenciamento de Roles</h2>
            <p className="text-muted-foreground">Configure permissões e atribua roles aos usuários</p>
          </div>
          <Button onClick={() => setShowAddUserDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Atribuir Role
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(roleConfig).map(([role, cfg]) => {
            const RoleIcon = cfg.icon;
            const count = roleStats?.[role as AppRole] || 0;
            return (
              <Card 
                key={role} 
                className={`glass-card cursor-pointer transition-all hover:scale-[1.02] ${
                  selectedRole === role ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedRole(role as AppRole)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${cfg.color}`}>
                      <RoleIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-muted-foreground">{cfg.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Role Details */}
          <Card className="glass-card md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>{config.label}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="users">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="users">Usuários ({currentRoleData?.users.length || 0})</TabsTrigger>
                  <TabsTrigger value="permissions">Permissões</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4 mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuário..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    <AnimatePresence>
                      {displayedUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>{searchTerm.trim() ? 'Nenhum usuário encontrado' : 'Nenhum usuário com esta role'}</p>
                        </div>
                      ) : (
                        displayedUsers.map((userRole) => (
                          <motion.div
                            key={userRole.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{userRole.user_id.slice(0, 8)}...</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(userRole.assigned_at), {
                                    addSuffix: true,
                                    locale: ptBR,
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={userRole.is_active ? 'default' : 'secondary'}>
                                {userRole.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleRevokeRole(userRole.user_id, selectedRole)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Revogar Role
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </TabsContent>

                <TabsContent value="permissions" className="mt-4">
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {permissionsByModule && Object.entries(permissionsByModule).map(([module, perms]) => (
                      <div key={module} className="space-y-2">
                        <h4 className="text-sm font-medium capitalize flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          {module}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          {perms?.map((perm) => (
                            <div
                              key={perm.id}
                              className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50"
                            >
                              <Check className="h-4 w-4 text-success" />
                              <span className="text-muted-foreground">{perm.description || perm.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Role Hierarchy */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Hierarquia de Roles</CardTitle>
              <CardDescription>Níveis de acesso do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(roleConfig).map(([role, cfg], index) => {
                const RoleIcon = cfg.icon;
                const isSelected = selectedRole === role;
                return (
                  <motion.div
                    key={role}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => setSelectedRole(role as AppRole)}
                  >
                    <div className={`p-2 rounded-lg bg-background ${cfg.color}`}>
                      <RoleIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Add User Dialog */}
        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir Role a Usuário</DialogTitle>
              <DialogDescription>
                Selecione o usuário e a role que deseja atribuir
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>ID do Usuário</Label>
                <Input
                  placeholder="UUID do usuário"
                  value={newUserData.userId}
                  onChange={(e) => setNewUserData({ ...newUserData, userId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newUserData.role}
                  onValueChange={(value: AppRole) => setNewUserData({ ...newUserData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleConfig).map(([role, cfg]) => (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  placeholder="Motivo ou observações..."
                  value={newUserData.notes}
                  onChange={(e) => setNewUserData({ ...newUserData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={handleAssignRole} disabled={!newUserData.userId || isUpdating}>
                {isUpdating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Atribuir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
