import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'manager' | 'operator' | 'viewer';

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  module: string;
  action: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role: AppRole;
  permission_id: string;
  created_at: string;
}

export function usePermissions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Buscar roles do usuário atual
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (error) throw error;
      return data as UserRole[];
    },
    enabled: !!user?.id,
  });

  // Buscar permissões do usuário
  const { data: userPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id,
      });
      
      if (error) throw error;
      return data as { permission_name: string; module: string; action: string }[];
    },
    enabled: !!user?.id,
  });

  // Buscar todas as permissões do sistema
  const { data: allPermissions, isError: allPermissionsError, refetch: refetchAllPermissions } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module', { ascending: true });
      
      if (error) throw error;
      return data as Permission[];
    },
  });

  // Buscar permissões por role
  const { data: rolePermissions, isError: rolePermissionsError, refetch: refetchRolePermissions } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*, permissions(*)');
      
      if (error) throw error;
      return data;
    },
  });

  // Verificar se usuário tem uma role específica
  const hasRole = (role: AppRole): boolean => {
    if (!userRoles) return false;
    return userRoles.some(r => r.role === role && r.is_active);
  };

  // Verificar se usuário tem uma permissão específica
  const hasPermission = (permissionName: string): boolean => {
    if (!userPermissions) return false;
    return userPermissions.some(p => p.permission_name === permissionName);
  };

  // Verificar se usuário pode executar uma ação em um módulo
  const canAccess = (module: string, action: string): boolean => {
    if (!userPermissions) return false;
    return userPermissions.some(p => p.module === module && p.action === action);
  };

  // Verificar se é admin
  const isAdmin = (): boolean => hasRole('admin');

  // Verificar se é manager ou superior
  const isManagerOrAbove = (): boolean => hasRole('admin') || hasRole('manager');

  // Atribuir role a usuário
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role, notes }: { userId: string; role: AppRole; notes?: string }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role,
          assigned_by: user?.id,
          notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Role atribuída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atribuir role: ${error.message}`);
    },
  });

  // Revogar role de usuário
  const revokeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('role', role);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      toast.success('Role revogada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao revogar role: ${error.message}`);
    },
  });

  return {
    userRoles,
    userPermissions,
    allPermissions,
    rolePermissions,
    isLoading: rolesLoading || permissionsLoading,
    // Sem isso a matriz de permissoes renderiza vazia quando a leitura falha.
    isError: Boolean(allPermissionsError || rolePermissionsError),
    refetch: async () => {
      await Promise.all([refetchAllPermissions(), refetchRolePermissions()]);
    },
    hasRole,
    hasPermission,
    canAccess,
    isAdmin,
    isManagerOrAbove,
    assignRole: assignRoleMutation.mutate,
    revokeRole: revokeRoleMutation.mutate,
  };
}
