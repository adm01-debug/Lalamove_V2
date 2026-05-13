import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RateLimitLog {
  id: string;
  ip_address: string;
  endpoint: string;
  user_id: string | null;
  request_count: number;
  window_start: string;
  window_end: string | null;
  blocked: boolean;
  user_agent: string | null;
  country_code: string | null;
  created_at: string;
}

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_by: string | null;
  blocked_at: string;
  expires_at: string | null;
  is_permanent: boolean;
  attempts_count: number;
  last_attempt_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IPWhitelist {
  id: string;
  ip_address: string;
  cidr_range: string | null;
  description: string;
  added_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRateLimiting() {
  const queryClient = useQueryClient();

  // Buscar logs de rate limit
  const { data: rateLimitLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['rate-limit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_limit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data as RateLimitLog[];
    },
  });

  // Buscar IPs bloqueados
  const { data: blockedIPs, isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked-ips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('blocked_at', { ascending: false });
      
      if (error) throw error;
      return data as BlockedIP[];
    },
  });

  // Buscar whitelist
  const { data: ipWhitelist, isLoading: whitelistLoading } = useQuery({
    queryKey: ['ip-whitelist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ip_whitelist')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as IPWhitelist[];
    },
  });

  // Estatísticas
  const stats = {
    totalRequests: rateLimitLogs?.length || 0,
    blockedRequests: rateLimitLogs?.filter(l => l.blocked).length || 0,
    uniqueIPs: new Set(rateLimitLogs?.map(l => l.ip_address)).size,
    activeBlockedIPs: blockedIPs?.filter(ip => 
      ip.is_permanent || (ip.expires_at && new Date(ip.expires_at) > new Date())
    ).length || 0,
    whitelistedIPs: ipWhitelist?.filter(ip => ip.is_active).length || 0,
  };

  // Bloquear IP
  const blockIPMutation = useMutation({
    mutationFn: async ({ 
      ipAddress, 
      reason, 
      isPermanent = false,
      expiresAt 
    }: { 
      ipAddress: string; 
      reason: string; 
      isPermanent?: boolean;
      expiresAt?: string;
    }) => {
      const { data, error } = await supabase
        .from('blocked_ips')
        .insert({
          ip_address: ipAddress,
          reason,
          is_permanent: isPermanent,
          expires_at: expiresAt,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-ips'] });
      toast.success('IP bloqueado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao bloquear IP: ${error.message}`);
    },
  });

  // Desbloquear IP
  const unblockIPMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blocked_ips')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-ips'] });
      toast.success('IP desbloqueado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desbloquear IP: ${error.message}`);
    },
  });

  // Adicionar à whitelist
  const addToWhitelistMutation = useMutation({
    mutationFn: async ({ 
      ipAddress, 
      description,
      cidrRange 
    }: { 
      ipAddress: string; 
      description: string;
      cidrRange?: string;
    }) => {
      const { data, error } = await supabase
        .from('ip_whitelist')
        .insert({
          ip_address: ipAddress,
          description,
          cidr_range: cidrRange,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
      toast.success('IP adicionado à whitelist');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Remover da whitelist
  const removeFromWhitelistMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ip_whitelist')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
      toast.success('IP removido da whitelist');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Toggle whitelist status
  const toggleWhitelistMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('ip_whitelist')
        .update({ is_active: isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] });
    },
  });

  return {
    // Data
    rateLimitLogs,
    blockedIPs,
    ipWhitelist,
    stats,
    isLoading: logsLoading || blockedLoading || whitelistLoading,

    // Actions
    blockIP: blockIPMutation.mutate,
    isBlocking: blockIPMutation.isPending,
    unblockIP: unblockIPMutation.mutate,
    isUnblocking: unblockIPMutation.isPending,
    addToWhitelist: addToWhitelistMutation.mutate,
    isAddingToWhitelist: addToWhitelistMutation.isPending,
    removeFromWhitelist: removeFromWhitelistMutation.mutate,
    toggleWhitelist: toggleWhitelistMutation.mutate,
  };
}
