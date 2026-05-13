import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uapi } from '@/lib/uapi-proxy';

export function useUAPIStatus() {
  return useQuery({
    queryKey: ['uapi', 'status'],
    queryFn: () => uapi.getStatus(),
    refetchInterval: 60_000,
  });
}

export function useUAPITest() {
  return useQuery({
    queryKey: ['uapi', 'test'],
    queryFn: () => uapi.testConnection(),
    enabled: false,
  });
}

export function useUAPIUser() {
  return useQuery({
    queryKey: ['uapi', 'user'],
    queryFn: () => uapi.getUserInfo(),
    staleTime: 5 * 60_000,
  });
}

export function useWalletBalance() {
  return useQuery({
    queryKey: ['uapi', 'wallet'],
    queryFn: () => uapi.getWalletBalance(),
    refetchInterval: 30_000,
    select: (data) => ({
      balanceCents: data.body?.data?.balance_fen ?? 0,
      balanceFormatted: data.formatted ?? 'R$ 0,00',
      raw: data,
    }),
  });
}

export function useUAPIOrders(page = 1, size = 10) {
  return useQuery({
    queryKey: ['uapi', 'orders', page, size],
    queryFn: () => uapi.getOrders(page, size),
  });
}

export function useUpdateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { token: string; xSignJs?: string; xFingerprint?: string }) =>
      uapi.updateToken(params.token, params.xSignJs, params.xFingerprint),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uapi'] });
    },
  });
}

export function useUAPICall<T = any>(method: string, args?: any, extraParams?: Record<string, string>) {
  return useQuery({
    queryKey: ['uapi', 'call', method, args, extraParams],
    queryFn: () => uapi.call<T>(method, args, extraParams),
    enabled: !!method,
  });
}
