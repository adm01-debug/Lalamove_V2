# P-16 · Hooks orfaos: o que foi wireado e o que fica adiado

**Status:** PARCIAL (2026-11-21) — 3 de 51 hooks orfaos resolvidos (PR #125); 1 adiado por decisao de produto; 1 coberto pela PR #119; 46 declarados como descartados/adiados com motivo.
**Origem:** varredura de codigo morto pedida pelo dono ("recuperar todo trabalho de agentes de IA, nunca perder trabalho parcial").

## Metodo

Script PowerShell extraiu todos os `export function use*` de `src/hooks/*` e testou o nome contra todos os arquivos de `src/` fora de `hooks/`. Resultado: **51 hooks sem nenhum consumidor**. Cada um foi entao cruzado com o estado real de producao (contagens de tabela via Management API, policies de RLS, corpo das edge functions) para separar "trabalho perdido" de "feature adiada/superada".

## Resolvidos — PR #125 (squash `53b286b`)

| Hook | Onde foi ligado | Efeito |
|---|---|---|
| `useFeatureFlags` / `useFeatureFlag` | `AIRouteChatbot.tsx` (`ai_route_optimization`) e `LiveMapPage.tsx` (`realtime_map_updates`) | A tabela `feature_flags` (3 flags vivas em producao) passou a funcionar como kill-switch de produto: desligar a flag desliga o recurso sem deploy. O mapa cai para polling de 10s com badge indicando o modo. |
| `useAuthLogs` | `ProfilePage.tsx` (Total de Logins, falhas) | Substitui os numeros hardcoded `142` e o status fixo `Ativo`. |
| `useUserDevices` | `ProfilePage.tsx`, nova secao Dispositivos | Fecha a feature pela metade: `user_devices` ja tinha dados e detector de dispositivo novo ativo, mas nenhuma tela de gestao. |

## Coberto por outra PR aberta (nao tocar)

- `useCreateAlertConfiguration` / `useDeleteAlertConfiguration` / `useUpdateAlertConfiguration` — a **PR #119** ja wireia na `AlertConfigurationsPage.tsx`. Aparecem como orfaos apenas porque a main ainda nao a recebeu.

## Adiado por decisao de produto (nao wirear)

- **`useEvaluateDriverOnAssignment`** (`useEvaluateDriver.ts:100-131`) — wrapper de `useEvaluateDriver` que nao tem ponto de wire valido:
  1. Nao existe fluxo de atribuicao de motorista no front: a Lalamove atribui automaticamente. `grep` por `action: 'assign'` so encontra atribuicao de **role** (`useRole.ts:66`, `RolesPage.tsx:84`).
  2. O edge `evaluate-driver/index.ts` recalcula as estatisticas no servidor (`calculateStatsFromDriver`, ~linha 631) e ignora `totalDeliveries`/`rating` que o hook enviaria.
  3. A flag `driver_auto_evaluation` esta **desligada** em producao — decisao de produto ja tomada.
  4. A acao manual equivalente ja existe em `OrderDetailModal.tsx:490-509` (mutacao) e `:614-632` (botao).
  Conclusao: o codigo nao representa trabalho perdido, representa uma intencao de automacao descartada. Se a V3 passar a atribuir motorista no front, o hook volta a ser util.

## Descartados como cobertos por caminho alternativo

- **`useQuote` / `useOrderCreate` / `useOrderCancel`** (`useLalamove.ts`) — o front nao usa os hooks, mas a funcionalidade existe e esta em uso: `NewOrderDialog.tsx:346` invoca `supabase.functions.invoke('lalamove-api', { action: 'order' })` direto (e a cotacao em ~241); `OrderDetailModal.tsx:137` faz `action: 'cancel'` e `:100` faz `action: 'change-driver'`. Nenhuma funcionalidade faltando.

## Descartados como utilitarios genericos nao adotados

Nao representam funcionalidade de negocio perdida — sao wrappers/infra que o codigo de producao resolveu de outra forma:

`useJobQueue` (useAddJob), `useRealtimeSubscriptions` (useAlertsRealtime, useApprovalsRealtime, useLiveMapRealtime, useRealtimeManager, useSLAMetricsRealtime), `useAchievementsSystem` (useApprovalAchievements), `useApprovalActionsEnhanced` (useApprovalActionsWithAchievements), `useCacheViews` (useAutoRefreshCache, useCacheNeedsRefresh, useCacheRefreshHistory), `useCachedStats` (useDeliveryMetricsCache, useDriverStatsCache, useHourlyMetricsCache, useMetricsComparison, useTopDrivers), `useDriverEvaluations` (useCreateEvaluation, useDriverEvaluations, useLatestDriverEvaluation), `useErrorLogs` (useDeleteErrorLog), `useExternalData` (useExternalRecord), `useFuseSearch` (useFuseSearchWithPreset), `useGlobalUndo`, `useAccessibility` (useInputMethod), `useMapbox` (useMapboxReverseGeocode), `useOfflineStorage` (useOfflineSettings, useOfflineStorage), `useRegionResolver` (useRegionResolution, useRegionResolver), `useUAPI` (useUAPICall, useUAPIOrders, useUAPITest), `useLalamove` (useCities, useDriverLocation, useLalamoveGet/Test, useV3Call).

Criterio aplicado: se o dado que o hook busca nao tem tela, e o recurso de negocio correspondente ja e atendido por outro caminho (edge function, acao manual existente ou pagina equivalente), o hook fica como codigo de biblioteca nao adotado. Nenhum deles tem tabela com dados de producao dependente dele.

## Risco residual

Se algum desses hooks for retomado, o padrao de teste ja existe em `src/hooks/__tests__/` (helper `chainable` de `usePendingApprovals.test.ts`). Nao ha prazo nem dono para retomar — a V2 esta funcional sem eles.