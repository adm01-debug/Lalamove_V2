import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { AppRole, UserRole } from './usePermissions';

export interface RoleWithUsers {
  role: AppRole;
  users: {
    id: string;
    user_id: string;
    assigned_at: string;
    expires_at: string | null;
    is_active: boolean;
    notes: string | null;
  }[];
  permissionsCount: number;
}

export function useRole() {
  const queryClient = useQueryClient();

  // Buscar todos os usuários com roles
  const { data: allUserRoles, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['all-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('role', { ascending: true });
      
      if (error) throw error;
      return data as UserRole[];
    },
  });

  // Agrupar por role
  const rolesSummary: RoleWithUsers[] = (['admin', 'manager', 'operator', 'viewer'] as const).map(role => ({
    role,
    users: allUserRoles?.filter(ur => ur.role === role) || [],
    permissionsCount: 0,
  }));

  // Buscar roles de um usuário específico
  const getUserRoles = async (userId: string): Promise<UserRole[]> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) throw error;
    return data as UserRole[];
  };

  // Criar/Atualizar role
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ 
      userId, 
      role, 
      action,
      notes,
      expiresAt 
    }: { 
      userId: string; 
      role: AppRole; 
      action: 'assign' | 'revoke';
      notes?: string;
      expiresAt?: string;
    }) => {
      if (action === 'assign') {
        const { data, error } = await supabase
          .from('user_roles')
          .upsert({
            user_id: userId,
            role,
            is_active: true,
            notes,
            expires_at: expiresAt,
          }, {
            onConflict: 'user_id,role',
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('role', role);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['all-user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success(
        variables.action === 'assign' 
          ? `Role ${variables.role} atribuída com sucesso` 
          : `Role ${variables.role} revogada com sucesso`
      );
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Buscar estatísticas de roles
  const { data: roleStats } = useQuery({
    queryKey: ['role-stats'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, is_active')
        .eq('is_active', true);
      
      if (rolesError) throw rolesError;

      const stats = {
        admin: 0,
        manager: 0,
        operator: 0,
        viewer: 0,
        total: 0,
      };

      roles?.forEach(r => {
        const role = r.role as AppRole;
        if (stats[role] !== undefined) {
          stats[role]++;
          stats.total++;
        }
      });

      return stats;
    },
  });

  return {
    allUserRoles,
    rolesSummary,
    roleStats,
    isLoading,
    isError,
    error,
    refetch,
    getUserRoles,
    updateUserRole: updateUserRoleMutation.mutate,
    isUpdating: updateUserRoleMutation.isPending,
  };
}
