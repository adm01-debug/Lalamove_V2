import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lalamove, type QuoteParams, type LalamoveStatusResponse, type LalamoveApiResponse, type LalamoveWalletHistoryResponse } from '@/lib/lalamove-api';
import { parseServiceAreas, parseSnapshotMeta, parseVehicles, parseWallet, parseWalletFlow, uapiData, type LalamoveRawResponse } from '@/lib/lalamoveUapiPayload';
import { isLalamoveConfigured } from '@/lib/lalamove-config';
import { uapi } from '@/lib/uapi-proxy';

// ── Status & Test ──

/**
 * Monta o status que as telas leem a partir das chamadas reais de cada canal.
 *
 * v3 lista cidades; a UAPI responde o usuário logado. O estado da sessão vem da
 * action `status` (lê `lalamove_uapi_sessions` e avalia a expiração), porque o
 * perfil pode ser servido de snapshot antigo e não prova token válido. Antes o
 * gateway mandava `status` para `cities`, que nunca devolveu o objeto
 * `{v3, uapi}` esperado aqui — daí os cards mostrarem "Erro"/"Token Expirado"
 * com a API respondendo.
 */
export function buildLalamoveStatus(
  v3: PromiseSettledResult<unknown>,
  uapi: PromiseSettledResult<unknown>,
  session?: PromiseSettledResult<{ ok?: boolean; session?: { is_active?: boolean } }>,
): LalamoveStatusResponse {
  const user =
    uapi.status === 'fulfilled'
      ? uapiData<{ email?: string }>(uapi.value as LalamoveRawResponse)
      : undefined;
  const username = typeof user?.email === 'string' && user.email ? user.email : undefined;
  // O perfil pode vir do snapshot do robô (`_meta.servedFromSnapshot`), que é
  // cópia antiga: servir cópia não prova que o token ainda vale. Quem responde
  // pelo estado cadastrado é a action `status`, que avalia a expiração.
  // Sem ela (chamadas antigas/testes), snapshot deixa de contar como conectado.
  const fromSnapshot =
    uapi.status === 'fulfilled' &&
    (uapi.value as { _meta?: { servedFromSnapshot?: boolean } } | null)?._meta
      ?.servedFromSnapshot === true;
  const sessionOk = session?.status === 'fulfilled'
    ? session.value?.session?.is_active === true
    : undefined;
  const uapiOk = sessionOk ?? (uapi.status === 'fulfilled' && uapi.value != null && !fromSnapshot);
  return {
    v3: { ok: v3.status === 'fulfilled' && v3.value != null },
    uapi: {
      ok: uapiOk,
      ...(username ? { username } : {}),
    },
  };
}

export function useLalamoveStatus() {
  return useQuery<LalamoveStatusResponse>({
    queryKey: ['llm', 'status'],
    queryFn: async () => {
      const [v3Res, uapiRes, sessionRes] = await Promise.allSettled([
        lalamove.cities(),
        lalamove.user(),
        uapi.getStatus(),
      ]);
      return buildLalamoveStatus(v3Res, uapiRes, sessionRes);
    },
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
    select: (d: LalamoveApiResponse) => ({ ...parseWallet(d), freshness: parseSnapshotMeta(d) }),
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