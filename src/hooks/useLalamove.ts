import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lalamove, type QuoteParams, type LalamoveStatusResponse, type LalamoveApiResponse, type LalamoveWalletHistoryResponse } from '@/lib/lalamove-api';
import { parseServiceAreas, parseVehicles, parseWallet, parseWalletFlow, uapiData } from '@/lib/lalamoveUapiPayload';
import { isLalamoveConfigured } from '@/lib/lalamove-config';

// ── Status & Test ──

export function useLalamoveStatus() {
  return useQuery<LalamoveStatusResponse>({
    queryKey: ['llm', 'status'],
    queryFn: () => lalamove.status() as Promise<LalamoveStatusResponse>,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    enabled: isLalamoveConfigured(),
    retry: false,
  });
}

export function useLalamoveTest() {
  return useQuery({
    queryKey: ['llm', 'test'],
    queryFn: lalamove.test,
    enabled: false, // manual trigger via refetch()
  });
}

// ── UAPI: Wallet & User ──

export function useWallet() {
  return useQuery({
    queryKey: ['llm', 'wallet'],
    queryFn: lalamove.wallet,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: isLalamoveConfigured(),
    retry: false,
    select: (d: LalamoveApiResponse) => parseWallet(d),
  });
}

export function useLalamoveUser() {
  return useQuery({
    queryKey: ['llm', 'user'],
    queryFn: lalamove.user,
    staleTime: 5 * 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
    select: (d: LalamoveApiResponse) => uapiData<Record<string, unknown>>(d),
  });
}

// ── V3: Cities ──

export function useCities() {
  return useQuery({
    queryKey: ['llm', 'cities'],
    queryFn: lalamove.cities,
    staleTime: 24 * 60 * 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
    select: (d: LalamoveApiResponse) => ({ all: uapiData<unknown[]>(d), sp: d.sp_summary }),
  });
}

// ── V3: Quote ──

export function useQuote() {
  return useMutation({
    mutationFn: (p: QuoteParams) => lalamove.quote(p),
  });
}

// ── V3: Order Operations ──

export function useOrderGet(orderId: string | null) {
  return useQuery({
    queryKey: ['llm', 'order', orderId],
    queryFn: () => lalamove.orderGet(orderId!),
    enabled: !!orderId && isLalamoveConfigured(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useDriverLocation(orderId: string | null, driverId: string | null) {
  return useQuery({
    queryKey: ['llm', 'driver-location', orderId, driverId],
    queryFn: () => lalamove.driverLocation(orderId!, driverId!),
    enabled: !!orderId && !!driverId && isLalamoveConfigured(),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useOrderCreate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: lalamove.orderCreate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm', 'wallet'] }),
  });
}

export function useOrderCancel() {
  return useMutation({ mutationFn: lalamove.orderCancel });
}

// ── Credentials ──

export function useUpdateUapiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { token: string; refreshToken: string }) =>
      lalamove.updateUapiToken(params.token, params.refreshToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm'] }),
  });
}

export function useUpdateV3Keys() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apiKey, apiSecret }: { apiKey: string; apiSecret: string }) =>
      lalamove.updateV3Keys(apiKey, apiSecret),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm'] }),
  });
}

// ── Token Refresh ──

export function useRefreshUapiToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => lalamove.refreshToken(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm'] }),
  });
}

// ── Wallet History ──

export function useWalletHistory(page = 1) {
  return useQuery({
    queryKey: ['llm', 'wallet-history', page],
    queryFn: () => lalamove.walletHistory(String(page)) as Promise<LalamoveWalletHistoryResponse>,
    staleTime: 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
    select: (d: LalamoveWalletHistoryResponse) => parseWalletFlow(d),
  });
}

// ── Vehicles (UAPI) ──

export function useVehicles() {
  return useQuery({
    queryKey: ['llm', 'vehicles'],
    queryFn: lalamove.vehicles,
    staleTime: 24 * 60 * 60_000, // 24h
    enabled: isLalamoveConfigured(),
    retry: false,
    select: (d: LalamoveApiResponse) => parseVehicles(d),
  });
}

// ── Service Areas (UAPI) ──

export function useServiceAreas() {
  return useQuery({
    queryKey: ['llm', 'service-areas'],
    queryFn: lalamove.serviceAreas,
    staleTime: 24 * 60 * 60_000,
    enabled: isLalamoveConfigured(),
    retry: false,
    select: (d: LalamoveApiResponse) => parseServiceAreas(d),
  });
}

// ── Generic V3 Call ──

export function useV3Call(path: string | null, method = 'GET', body?: unknown) {
  return useQuery({
    queryKey: ['llm', 'v3', path, method, body],
    queryFn: () => lalamove.v3Call(path!, method, body),
    enabled: !!path && isLalamoveConfigured(),
    retry: false,
  });
}

export function useV3CallMutation() {
  return useMutation({
    mutationFn: ({ path, method, body }: { path: string; method?: string; body?: unknown }) =>
      lalamove.v3Call(path, method || 'GET', body),
  });
}

// ── Re-export old names for backward compat ──
export { useWallet as useWalletBalance };
export { useLalamoveStatus as useUAPIStatus };
export { useLalamoveUser as useUAPIUser };