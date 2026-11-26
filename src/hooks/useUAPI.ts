import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uapi, type UAPIResponse, type UAPIUserData } from '@/lib/uapi-proxy';
import { parseWallet, uapiData } from '@/lib/lalamoveUapiPayload';

export function useUAPIStatus() {
  return useQuery({
    queryKey: ['uapi', 'status'],
    queryFn: () => uapi.getStatus(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
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
    select: (data: UAPIResponse<UAPIUserData>) => uapiData<UAPIUserData>(data),
  });
}

export function useWalletBalance() {
  return useQuery({
    queryKey: ['uapi', 'wallet'],
    queryFn: () => uapi.getWalletBalance(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    select: (data: UAPIResponse<UAPIUserData>) => {
      const wallet = parseWallet(data);
      return { balanceCents: wallet.cents, balanceFormatted: wallet.formatted, raw: data };
    },
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
    mutationFn: (params: { token: string; refreshToken: string }) =>
      uapi.updateToken(params.token, params.refreshToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uapi'] });
    },
  });
}

export function useUAPICall<T = unknown>(method: string, args?: unknown, extraParams?: Record<string, string>) {
  return useQuery({
    queryKey: ['uapi', 'call', method, args, extraParams],
    queryFn: () => uapi.call<T>(method, args, extraParams),
    enabled: !!method,
  });
}
