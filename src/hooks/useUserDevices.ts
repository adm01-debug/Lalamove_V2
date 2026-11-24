import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UserDevice {
  id: string;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device_name: string | null;
  location_city: string | null;
  location_country: string | null;
  is_trusted: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

export function useUserDevices() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: devices, isLoading, isError: devicesError, refetch: refetchDevices } = useQuery({
    queryKey: ['user-devices', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', user!.id)
        .order('last_seen_at', { ascending: false });

      if (error) throw error;
      return data as UserDevice[];
    },
    enabled: !!user?.id,
  });

  const trustDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('user_devices')
        .update({ is_trusted: true })
        .eq('id', deviceId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
      toast.success('Dispositivo marcado como confiável');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const removeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('id', deviceId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
      toast.success('Dispositivo removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const renameDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, name }: { deviceId: string; name: string }) => {
      const { error } = await supabase
        .from('user_devices')
        .update({ device_name: name })
        .eq('id', deviceId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-devices'] });
      toast.success('Dispositivo renomeado');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  return {
    devices: devices || [],
    isLoading,
    isError: devicesError,
    refetch: refetchDevices,
    trustDevice: trustDeviceMutation.mutate,
    removeDevice: removeDeviceMutation.mutate,
    renameDevice: renameDeviceMutation.mutate,
    isTrusting: trustDeviceMutation.isPending,
    isRemoving: removeDeviceMutation.isPending,
  };
}
