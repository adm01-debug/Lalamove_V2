# Plano Front-End Sênior — Lalamove V2: correções, contratos e melhorias em 190 etapas (22/11/2026)

Base verificada: repo `adm01-debug/Lalamove_V2` @ `95b66ec` (`main`, 22/11/2026). Leitura de `src/` (79.439 linhas em
71 páginas, 138 componentes, 88 hooks, 62 arquivos de teste, 7 specs e2e), `index.html`, `vite.config.ts`,
`tailwind.config.ts`, `eslint.config.js`, `tsconfig*.json`, `public/`, `e2e/` e das 26 Edge Functions em
`supabase/functions/`. Stack: Vite 8, React 18.3, TS 5.8, Tailwind 3.4, shadcn/ui, TanStack Query 5, react-router 7,
supabase-js 2.116, zod 4 (front) / zod 3.22 (edges, via deno.land), Vitest 5, Playwright 1.56.

**Objetivo de negócio:** a operação (pedidos, motoristas, mapa ao vivo, alertas, aprovações) deixa de depender de
telas que escondem erro, mostram dado inventado, abrem brecha de segurança ou travam no celular; e toda Edge
Function/webhook passa a recusar payload inválido com **uma única resposta 422** (código, mensagem, lista de campos),
versionada (v1/v2), coberta por testes de contrato — hoje só 8 das 26 edges fazem isso.

**Fora de escopo:** camada de mapas (planos Google/Mapbox), mensageria ao motorista (plano Zapp/SMS), migrações de
banco que não sejam pré-requisito direto de uma etapa daqui.

Legenda: **[F]** front (`src/`) · **[E]** edge function (`supabase/functions/`) · **[B]** banco (migration/RLS) ·
**[C]** CI/config/deploy · **[T]** teste · **[D]** decisão/ação do dono · 🔒 = PR fica aberta para o dono (DDL em
produção, segredo, CI/workflow, deleção, custo) · cada etapa tem checklist e **Evidência** (o que prova que está
pronta). Severidade dos achados: **CRÍTICO** quebra segurança/dado/funcionalidade; **ALTO** afeta usuário real com
frequência; **MÉDIO** qualidade/UX; **BAIXO** polimento. Ao concluir uma etapa, marque `[x]` na mesma PR que a entregou.

---

## 1. Estado real em 22/11/2026 (o ponto de partida)

| # | Achado | Sev. | Evidência |
|---|---|---|---|
| A1 | **XSS no mapa**: nome do motorista, cliente e endereços entram em `setHTML`/`innerHTML` sem escape; `escapeHtml` existe mas não é usado nesses pontos; `driverName` vai dentro de `onclick=""` inline | CRÍTICO | `src/components/map/markerFactories.ts:300-316`, `:324`, `:219`, `:243`, `:257` (helper em `:26`) |
| A2 | **Janela de bypass de MFA**: `ProtectedRoute` libera a rota antes da query `mfa-aal` resolver; `requireMFA` só barra quem já tem fator inscrito | CRÍTICO | `src/components/auth/ProtectedRoute.tsx:33`; `src/hooks/useMFA.ts:45-56` |
| A3 | **Bloqueio de login só no cliente** e `clear_login_attempts` chamada do front com erro ignorado | CRÍTICO | `src/pages/AuthPage.tsx:95-104`; `src/hooks/useLoginLockout.ts:77` |
| A4 | **Sem CSP** (nem meta, nem header) com sessão Supabase em `localStorage` | CRÍTICO | ausência em `index.html`, `vercel.json`, `public/_headers`; `src/integrations/supabase/previewAuthStorage.ts:18` |
| A5 | `errorMonitoring` faz SELECT/PATCH/POST em `runtime_error_logs` como `anon`, `user_id` vem do cliente, incremento ler-somar-gravar | ALTO | `src/services/errorMonitoring.ts:64-121` (`:87`, `:116`) |
| A6 | `AppLayout` remonta a cada navegação (`key={location.pathname}` em `<Routes>` dentro de `AnimatePresence`): role, contadores e canais realtime refeitos a cada clique | ALTO | `src/App.tsx:138` |
| A7 | Ctrl+K abre duas buscas sobrepostas (CommandPalette + GlobalSearchAdvanced) | ALTO | `src/hooks/useCommandPaletteSearch.ts:112`; `src/components/layout/AppLayout.tsx:211`; `src/hooks/useGlobalSearch.ts:110` |
| A8 | `datetime-local` com `min`/`max` em UTC: em BRT bloqueia 3h de horários válidos de coleta | ALTO | `src/components/orders/NewOrderDialog.tsx:905-907` |
| A9 | KPIs errados em silêncio: métricas sem filtro de data nem `range` (corte do PostgREST em 1000 linhas) e dashboard com 7 queries sem checar `error` | ALTO | `src/hooks/useDeliveryMetrics.ts:40-42`; `src/hooks/useDashboardStats.ts:28-116` |
| A10 | Signup público aberto numa app interna com RBAC | ALTO | `src/pages/AuthPage.tsx:132` |
| A11 | Aprovação de motorista em duas escritas não atômicas; desfazer ignora erro; `onError` sem toast | ALTO | `src/hooks/useApprovalActions.ts:33-38`, `:46-50`, `:68-69` |
| A12 | Injeção de filtro PostgREST: texto do usuário interpolado em `.or(\`...ilike.%${q}%\`)` | ALTO | `src/hooks/useGlobalSearch.ts:123-135`; `src/hooks/useCommandPaletteSearch.ts:191-197` |
| A13 | **Dados inventados mostrados como reais** (bateria, sinal, temperatura, sparkline, performance do motorista com `Math.random()`) | ALTO | `src/components/map/MapHUD.tsx:46-49`; `src/components/dashboard/DashboardHeroSection.tsx:29-38`; `src/components/drivers/DriverProfileModal.tsx:42-43` |
| A14 | Mapa ao vivo: polling 10 s + polling 5 s + realtime sem debounce + simulação a 3 s | ALTO | `src/pages/LiveMapPage.tsx:147`, `:131`; `src/components/map/hooks/useTrackingData.ts:93-102` |
| A15 | Bundle: sem `build.rollupOptions.output.manualChunks`; `framer-motion` em 90 arquivos (inclusive `App.tsx:17`); `xlsx` e `jspdf` estáticos; `react-window` instalado e nunca usado; `React.memo` inexistente | ALTO | `vite.config.ts`; `src/utils/exportUtils.ts:5`; `src/components/map/MapHistoryPanel.tsx:4`; `package.json:90` |
| A16 | Acessibilidade: 44 botões só com ícone sem nome acessível; 72 campos sem label associado; linhas/cards clicáveis sem `role`/`tabIndex`/teclado; IDs ARIA com `Math.random()` | ALTO | ex.: `src/pages/RiskRulesPage.tsx:305`; `src/components/orders/NewOrderDialog.tsx:610-611`; `src/components/dashboard/OrdersTable.tsx:202-209`; `src/components/ui/accessible-card.tsx:55-57` |
| A17 | PWA/SEO: manifest sem ícones 192/512 (não instalável); `index.html` referencia 7+ assets que não existem em `public/` (404); `theme-color` divergente; canonical de domínio de preview | ALTO | `public/manifest.json:13-19`; `index.html:15, 23, 30, 40, 65-68`; `src/pages/SystemHealthExpandedPage.tsx:226-240` |
| A18 | Testes: não há script `vitest` em `package.json` (só `test:e2e`), apesar do `vitest.config.ts` exigir 70 % de cobertura; `useAuth`, `useMFA`, `ProtectedRoute`, `useApprovalActions`, `markerFactories` (escape) e `errorMonitoring` sem teste; e2e se pula sozinho sem sessão | ALTO | `package.json:6-20`; `vitest.config.ts`; `e2e/rbac.e2e.ts:60,74`; `e2e/mfa.e2e.ts:29,38` |
| A19 | **18 de 26 Edge Functions sem camada de contrato** (sem Zod, erro 400 em formatos distintos, campo ausente virando 500): apply-fixes, bitrix24-process-queue, bitrix24-sync, check-driver-alerts, escalate-alerts, external-companies, external-db-bridge, get-mapbox-token, job-worker, lalamove-api, lalamove-gateway, lalamove-token-refresh, lalamove-uapi, llm-wh, mcp-query, rotate-tokens, seed-fix-rls, simulate-driver-movement. `docs/API_CONTRACTS.md:144-146` afirma "rollout completo" — está desatualizado | ALTO | `grep -L "_shared/contract.ts" supabase/functions/*/index.ts`; ex.: `job-worker/index.ts:1158-1190` (campo ausente → 500), `lalamove-api/index.ts:692,793,809…` (400 `{error:'x is required'}`), `bitrix24-sync/index.ts:158-162` (`.parse` lança → 500) |
| A20 | Edges legadas perigosas implantadas em produção: `apply-fixes` e `seed-fix-rls` chamam `rpc('exec')` com DDL que abre RLS para `anon` (sem auth em código, sem chamador); `external-db-bridge` permite insert/update/delete/rpc arbitrários no banco externo para **qualquer** usuário logado; `deploy-edges.yml` implanta todas as 26 sem filtro | CRÍTICO | `supabase/functions/apply-fixes/index.ts:19-41`; `seed-fix-rls/index.ts:20-120`; `external-db-bridge/index.ts:218-239`; `.github/workflows/deploy-edges.yml:11-17,47`; `scripts/db-audit/known-violations.json:6-7` |
| A21 | `lalamove-api` com `verify_jwt=true` deixa qualquer usuário logado (viewer) criar/cancelar pedido e `set-webhook`; `external-companies` sem checagem de papel e com `search` interpolado em `.or()` | ALTO | `supabase/functions/lalamove-api/index.ts:887-890,949-954`; `external-companies/index.ts:109,125`; `supabase/config.toml:18-19` |
| A22 | Bugs funcionais nas edges: `new-device-alert` usa `resend` nunca instanciado (e-mail nunca sai); `bitrix24-sync` lê `action` só do body mas o redirect OAuth vem em GET `?action=` (callback cai em "Unknown action"); `lalamove-uapi` remove `body.action` antes de `favorite-driver`/`block-driver` (sempre 400); crons de `escalate-alerts` e `lalamove-token-refresh` sem `Authorization` (provável 401) | ALTO | `new-device-alert/index.ts:236` (import `:3`); `bitrix24-sync/index.ts:44,58,75`; `lalamove-uapi/index.ts:495,655,665`; `supabase/migrations/20261122140000_fix_crons_dispatcher.sql:117-134` |
| A23 | Menu e rotas desalinhados: itens sem `requiredRole` no menu mas com manager/MFA na rota (operador vê link e cai em `/unauthorized`); 11 rotas sem entrada no menu; `/` e `/dashboard` sem role; `/profile` sem role; hierarquia de papéis copiada em 4 lugares | MÉDIO | `src/components/layout/sidebar-config.ts:42,55,60,67-75,102`; `src/App.tsx:149-150,176-201`; `ProtectedRoute.tsx:14`; `MobileSidebar.tsx:151` |
| A24 | Código morto confirmado: `useApprovalActionsEnhanced`, `useDriverEvaluations`, `useOfflineStorage`, `useGeo` (só testes), `SwipeableApprovalCard` (500 linhas), `AuditReportGenerator`, `ui/chart`, `fab-variants`, `hero-metric`, `timeline-item`; `AchievementsProvider` (425 linhas) montado na raiz sem consumidor vivo | MÉDIO | `src/App.tsx:128`; `src/hooks/useAchievementsSystem.tsx`; `rg -l` dos nomes retorna só o próprio arquivo |
| A25 | 9 arquivos acima de 500 linhas (`NewOrderDialog` 1171, `OrderDetailModal` 1016, `MapsSettingsPage` 963, `AdvancedReportsPage` 749, `LiveMap` 674 com 14 `useState`/12 `useEffect`…); `react-hook-form` instalado e importado em 0 arquivos; zod em só 4 telas | MÉDIO | `wc -l`; `package.json:84` |

## 2. Prioridade de ataque (o que fazer primeiro)

1. **Semana 1 — segurança e dado errado (Bloco 0):** A1, A2, A3, A4, A5, A10, A12, A13, A20, A21. Tudo é diff pequeno e sem migração, exceto o lockout server-side (🔒) e a remoção das edges legadas (🔒).
2. **Semana 2 — contratos das 18 edges (Bloco 1):** schema Zod v1/v2, 422 único, testes de contrato (ausente/tipo/vazio), versionamento e docs. Entrega em uma PR de edges + uma de docs; nenhuma migração.
3. **Semana 3 — navegação, dados e performance (Blocos 2–4):** A6, A7, A8, A9, A11, A14, A15, A23.
4. **Semanas 4–5 — acessibilidade, UX, PWA, arquitetura e testes (Blocos 5–9):** A16, A17, A18, A24, A25.

## 3. Decisões do dono (D1–D8)

| # | Decisão | Recomendação técnica | Por quê |
|---|---|---|---|
| D1 | Remover `apply-fixes` e `seed-fix-rls` do repo e da produção | **Remover** (`supabase functions delete`) e tirar de `known-violations.json` e do baseline de erro | Sem auth, sem chamador, DDL que abre RLS para `anon`; só existem para serem exploradas |
| D2 | Manter `external-db-bridge` | Manter **só** com checagem de papel admin + allowlist de tabelas/RPCs; senão remover | CRUD/RPC arbitrário no banco externo com service_role externo para qualquer logado |
| D3 | Cadastro público (`signUp`) | **Desligar** a aba de cadastro; convite por admin (`auth.admin.inviteUserByEmail`) | App interna com RBAC não pode aceitar auto-cadastro |
| D4 | Exigir MFA inscrita para manager/admin (não só "verificar se tiver") | **Exigir inscrição** (`nextLevel==='aal2'` ou redirecionar para `/mfa-enroll`) | Hoje um manager sem TOTP entra em webhooks/bitrix/settings |
| D5 | Data de sunset da versão de contrato `v1` | Manter `2026-12-31` (`contract.ts:48`) e publicar aviso aos integradores (n8n, Bitrix, scripts) | Sem sunset a v2 nunca vira padrão |
| D6 | Ações destrutivas da Lalamove (`cancel`, `set-webhook`, `change-driver`, `priority-fee`) só para manager/admin | **Sim**, via `requireRole` na edge (igual `requireAdmin` do `lalamove-uapi:64-82`) | Hoje viewer logado consegue cancelar pedido |
| D7 | CSP em modo `report-only` por 1 semana antes de `enforce` | **Sim**, com `report-to` para `runtime_error_logs` | Mapbox/Google/Lovable precisam de allowlist; enforce direto pode derrubar o mapa |
| D8 | Idiomas: manter en/es ou só pt-BR | **Só pt-BR** até existir tradução completa (9 de ~360 módulos usam `useTranslation`) | Navegador em inglês hoje vê mistura de idiomas |

---

## Bloco 0 — Segurança e dado errado (1–20)

### 1 — [F] Escapar HTML nos popups e marcadores do mapa ✅
- [x] Em `src/components/map/markerFactories.ts`, aplicar `escapeHtml` (`:26`) em `driverName`, `customerName`, `pickupAddress`, `deliveryAddress` (`:300-316`), no nome do marcador (`:219`) e em `locationName` (`:243`, `:257`).
- [x] Trocar o `onclick="...'${driverName}'"` inline (`:324-325`) por `data-*` + `addEventListener` após `setHTML`, eliminando string JS com dado do usuário.
- [x] Teste em `src/components/map/__tests__/markerFactories.test.ts`: nome `<img src=x onerror=alert(1)>` vira texto escapado.
- **Evidência:** `rg -n "\\$\\{(driverName|customerName|pickupAddress|deliveryAddress|locationName)\\}" src/components/map/markerFactories.ts` só dentro de `escapeHtml(...)`; teste verde. PR #287 mergeada (`6e6c62b`), CI main 100% verde (12 jobs).

### 2 — [F] Unificar `escapeHtml` em `src/lib/html.ts` ✅
- [x] Mover o helper duplicado (`markerFactories.ts:26` e `GoogleMapsCanvas.tsx:53`) para `src/lib/html.ts` com teste de 5 entidades.
- **Evidência:** `rg -n "function escapeHtml" src` retorna 1 ocorrência. Teste `src/lib/__tests__/html.test.ts` (4 testes) verde; `tsc -p tsconfig.app.json` limpo.

### 3 — [F] Fechar a janela de bypass de MFA
- [x] `src/components/auth/ProtectedRoute.tsx:33`: incluir `loadingAAL` (query `mfa-aal`, `useMFA.ts:45-56`) na condição de loading; enquanto `aalLevel === undefined` renderizar o spinner, nunca a rota.
- [x] Teste unitário do `ProtectedRoute` com `requireMFA` e `aalLevel` pendente → não renderiza filho.
- **Evidência:** `src/components/auth/ProtectedRoute.test.tsx` (3 testes) verde: `loadingAAL=true` não renderiza o filho e mostra "Verificando autenticação..."; caso normal renderiza; `needsMFAVerification` redireciona para `/mfa-verify`.

### 4 — [F][D] Exigir inscrição de MFA para rotas `requireMFA` (D4)
- [x] Se `nextLevel !== 'aal2'` (sem fator), redirecionar para `/mfa-enroll` com `state.from`, em vez de liberar.
- [x] Criar rota `/mfa-enroll` reutilizando `components/auth/MFAEnroll.tsx`.
- **Evidência:** `src/hooks/useMFA.ts` expõe `needsMFAEnrollment` (`currentLevel === 'aal1' && nextLevel !== 'aal2'`); `src/components/auth/ProtectedRoute.tsx:49-52` redireciona para `/mfa-enroll` antes da checagem de `/mfa-verify`; `src/pages/MFAEnrollPage.tsx` reutiliza `MFAEnroll` com `state.from`; rota registrada em `src/App.tsx:145`. Teste `src/components/auth/ProtectedRoute.test.tsx` (4 casos) verde.

### 5 — [B][F] Bloqueio de login no servidor 🔒
- [ ] Migration: `record_failed_login(p_email)` e `is_login_locked(p_email)` como `SECURITY DEFINER`; revogar `EXECUTE` de `clear_login_attempts` para `anon`/`authenticated` (só trigger/edge).
- [ ] Front (`src/hooks/useLoginLockout.ts:77`): tratar `error` da RPC; `AuthPage.tsx:95-104` passa a consultar `is_login_locked` antes do `signIn` e nunca chama `clear_*`.
- **Evidência:** `select has_function_privilege('anon','clear_login_attempts(text)','EXECUTE')` = false; 6 tentativas via `curl` direto no GoTrue continuam bloqueadas pelo `is_login_locked` no hook.

### 6 — [C][D] CSP em `report-only` (D7) 🔒
- [ ] `vercel.json`: header `Content-Security-Policy-Report-Only` com `default-src 'self'`; `connect-src` para `*.supabase.co`, `api.mapbox.com`, `events.mapbox.com`, `maps.googleapis.com`; `img-src 'self' data: blob: https:`; `worker-src blob:`; `report-uri` para a edge de telemetria.
- [ ] Remover o `<script>` inline que injeta o manifest (`index.html:44-54`) para permitir `script-src 'self'`.
- **Evidência:** `curl -I https://<prod>/ | grep -i content-security` mostra o header; 7 dias sem violação nas rotas principais → etapa 7.

### 7 — [C] CSP em `enforce` 🔒
- [ ] Trocar `-Report-Only` por `Content-Security-Policy` mantendo `report-uri`.
- **Evidência:** mapa, gráficos e login funcionam em produção com o header ativo (teste manual registrado na PR).

### 8 — [F][B] `errorMonitoring` sem escrita anônima 🔒
- [ ] `src/services/errorMonitoring.ts:64-121`: usar `supabase.from('runtime_error_logs')` com a sessão do usuário e RPC `upsert_runtime_error(fingerprint, payload)` que incrementa `occurrence_count` no servidor (sem ler-somar-gravar) e preenche `user_id = auth.uid()`.
- [ ] Migration: RPC + política RLS `INSERT` para `authenticated`; remover UPDATE/SELECT de `anon`.
- **Evidência:** `select policyname from pg_policies where tablename='runtime_error_logs'` sem `anon`; erro forçado no front aparece na tabela com `user_id` do usuário logado.

### 9 — [F][D] Desligar o auto-cadastro (D3)
- [x] `src/pages/AuthPage.tsx:132`: remover a aba "Cadastrar" e `signUp` do `useAuth`; texto de sucesso "Você já está logado" sai junto.
- [ ] Painel Supabase: desabilitar signups (dono) — registrar na PR.
- **Evidência:** `rg -n "signUp" src` retorna 0 (só mock em `useActiveAlerts.test.ts`, não é o hook); `npx tsc --noEmit -p tsconfig.app.json` → 0 erros; `npx eslint` em `AuthPage.tsx`/`useAuth.tsx` → 0 erros; tela `/auth` só com login/esqueci a senha (removidos `Tabs`, `handleSignUp`, `validateSignupForm`, `signupSchema`, `PasswordStrengthIndicator`).

### 10 — [F] Sanitizar a busca global contra injeção de filtro PostgREST
- [x] Criar `src/lib/postgrest.ts` com `escapeIlike(q)` (remove `,`, `(`, `)`, `.`, `%`, `\\`) e `buildOrIlike(fields, q)`.
- [x] Usar em `src/hooks/useGlobalSearch.ts:123-135` e `src/hooks/useCommandPaletteSearch.ts:191-197`; tratar `error` das 4 queries.
- **Evidência:** teste unitário com `a,b)c` gera filtro válido; busca com vírgula não gera erro 400 na aba Network.

### 11 — [F] Validar a origem do `postMessage` do Bitrix24
- [x] `src/hooks/useBitrix24.ts:112`: aceitar só `event.origin === window.location.origin` (ou o domínio do callback); limpar o `setTimeout` de 120 s no cleanup; tratar `popup === null` (bloqueado) com toast.
- **Evidência:** `postMessage('bitrix24_connected','*')` de outra origem no console não dispara o sucesso. `src/lib/postMessage.ts` expõe `isTrustedBitrix24Origin` (aceita `window.location.origin` e a origem do `SUPABASE_URL` — o callback da edge `bitrix24-sync` roda na origem do Supabase); 5 testes em `src/lib/__tests__/postMessage.test.ts` cobrem origem própria, origem Supabase, origem maliciosa, URL inválida e esquema diferente.

### 12 — [F] `window.open` sempre com `noopener,noreferrer`
- [x] `MapHUD.tsx:61, 67, 351`, `BatchActionsToolbar.tsx:44, 49`, `MapProviderSelector.tsx:99-135`, `exportUtils.ts:119`, `markerFactories.ts:325`: usar helper `openExternal(url)` em `src/lib/html.ts`.
- **Evidência:** `openExternal` usado em todos os links externos; `rg -n "window.open\(" src` só retorna o helper (`html.ts:26`) + casos intencionalmente excluídos: `exportUtils.ts:119` (janela de impressão, precisa do ref `win`) e `useBitrix24.ts:110` (popup de auth com features). `UapiOrderHistoryPanel.tsx:26` e `OrderDetailModal.tsx:583,687` já passam `'noopener,noreferrer'` inline (seguros, fora da lista do item).

### 13 — [F] Campos de token como `password` e sem autofill
- [x] `src/pages/LalamoveSettingsPage.tsx:250-255` e `src/pages/UAPISettingsPage.tsx:143-148`: `type="password"`, `autoComplete="off"`, botão "mostrar"; remover a instrução de raspar token via DevTools (`UAPISettingsPage.tsx:138-139`) e substituir por link para o fluxo oficial (`set-token` exige admin em `lalamove-uapi/index.ts:64-82`).
- **Evidência:** inputs com `type="password"`; texto de DevTools ausente. `LalamoveSettingsPage.tsx` (UAPI token, V3 Key e V3 Secret) e `UAPISettingsPage.tsx` (UAPI token) usam `type={show ? 'text' : 'password'}` + `autoComplete="off"` + botão `Eye/EyeOff`; instrução "DevTools → get_user_info → token" removida das duas páginas.

### 14 — [F] Telemetria admin sem fallback para chave pública e com confirmação
- [x] `src/pages/AdminTelemetriaPage.tsx:86, 104`: falhar com toast se não houver `session.access_token` (nunca `|| VITE_SUPABASE_PUBLISHABLE_KEY`); `handleCleanup` (`:96-110`) com `try/catch` e `AlertDialog` "isso apaga 7 dias de telemetria".
- **Evidência:** sem sessão a tela mostra erro e não dispara `fetch`. As duas chamadas (query e DELETE) usam só `Bearer ${session.access_token}`; `handleCleanup` tem `try/catch`/`finally` e o botão "Limpar +7d" abre `AlertDialog` com a confirmação "Isso apaga todos os registros com mais de 7 dias".

### 15 — [E][D] Remover `apply-fixes` e `seed-fix-rls` (D1) 🔒
- [ ] Apagar `supabase/functions/apply-fixes/` e `supabase/functions/seed-fix-rls/`; limpar `scripts/db-audit/known-violations.json:6-7` e `scripts/ci/check-edge-error-exposure-baseline.json:5,25`; `supabase functions delete` nas duas (dono).
- **Evidência:** `supabase functions list` sem as duas; CI `security`/guards verdes.

### 16 — [E][D] Fechar `external-db-bridge` para admin + allowlist (D2) 🔒
- [ ] `supabase/functions/external-db-bridge/index.ts:218-239`: após `getUser`, exigir `app_metadata.role === 'admin'`; `table` e `rpc_name` numa allowlist explícita; `delete` só com `filters` não vazio.
- [ ] Atualizar `external-db-bridge/index.test.ts` e incluí-lo no CI (`ci.yml` job `contract-tests`).
- **Evidência:** chamada com JWT de operator → 403; teste no CI.

### 17 — [E] `external-companies` com papel e busca escapada
- [x] `supabase/functions/external-companies/index.ts`: exigir JWT + papel ≥ operator (`requireOperator` via `getClaims`, `ROLE_PRIORITY` admin>manager>operator>viewer); escapar `search` antes do `.or(ilike)` (`escapeIlike`, `:161`, `:309`, `:315`); `limit` máximo 200 (já no schema `schemas.ts:404`).
- **Evidência:** `deno check` 0 erros; `deno test` dos contratos 213 passed, incluindo `[external-companies] tabela fora da allowlist retorna 422`. Sem `Authorization` a edge devolve 401; role `viewer` devolve 403; o termo de busca remove `,()%\\` antes de interpolar no filtro.
- **Evidência:** `search="a,b)"` retorna 422/resultado vazio, não 500.

### 18 — [E][D] Ações destrutivas da `lalamove-api` só para manager/admin (D6)
- [ ] Extrair `requireRole(req, roles)` para `supabase/functions/_shared/auth.ts` (baseado em `lalamove-uapi/index.ts:64-82`) e aplicar em `cancel`, `set-webhook`, `change-driver`, `priority-fee`, `edit-order` (`lalamove-api/index.ts:887-954`).
- **Evidência:** viewer recebe 403 em `cancel`; manager recebe 200; teste Deno em `lalamove-api/auth.test.ts`.

### 19 — [E] Corrigir bugs funcionais nas edges (A22)
- [x] `new-device-alert/index.ts:42`: instanciar `new Resend(Deno.env.get('RESEND_API_KEY'))` — antes `resend.emails.send` (`:236`) lançava `ReferenceError: resend is not defined`.
- **Evidência:** `deno check` 0 erros. A edge agora cria o cliente `Resend` no início do handler, antes do uso em `:237`.
- [ ] `bitrix24-sync/index.ts:44`: `action = body.action ?? url.searchParams.get('action')` para o `oauth_callback` em GET; o `fetch` interno de `refresh_token` (`:178-182`) com `Authorization: Bearer service_role`.
- [ ] `lalamove-uapi/index.ts:495`: não remover `body.action` antes de `favorite-driver`/`block-driver` (renomear o campo de operação para `op`).
- **Evidência:** 3 testes Deno novos; e-mail de novo dispositivo chega (log `resend` 200).

### 20 — [B] Crons sem `Authorization` 🔒
- [ ] Migration que recria os crons de `escalate-alerts` e `lalamove-token-refresh` (`20261122140000_fix_crons_dispatcher.sql:117-134`) com `Authorization: Bearer <dispatcher key>` como os demais (`:71`).
- **Evidência:** `select status from net._http_response` das últimas execuções = 200 (hoje provavelmente 401).

## Bloco 1 — Contratos únicos para as 18 Edge Functions restantes (21–45)

Padrão (já existente em `_shared/contract.ts` e `_shared/schemas.ts`): `resolveContractVersion(req)` →
`parseJsonBody(req, version)` → `validateContract(getSchema("<nome>", version), input, version)` → `errorResponse`.
Resposta de falha **sempre** `422 { error: { code, message, fields: [{ field, message, code }] }, meta: { contractVersion,
timestamp, deprecation? } }`. Schemas fiéis ao código (obrigatório só o que hoje dá 400/throw), `.passthrough()` onde a
edge repassa campos, v2 = superset de v1. Para edge que ignora o body, o contrato é "objeto JSON (ou vazio)": array ou
string → 422. Chamadores do front já tratam qualquer não-2xx igual (`if (error) throw error`, ex.:
`src/hooks/useBitrix24.ts:44`), então 400→422 não muda UX.

### 21 — [E] Schemas `lalamove-api` (discriminador `action` de query **ou** body)
- [x] Em `_shared/schemas.ts`: `z.discriminatedUnion('action', [...])` com as ~15 ações e campos que o código exige (`quotationId` em `order`, `orderId` em `fetch-order`/`cancel`/`priority-fee`/`change-driver`, `orderIds[]` em `fetch-orders-bulk`, `url` em `set-webhook`…), `.passthrough()` nos corpos repassados à Lalamove.
- [x] `lalamove-api/index.ts:~663-669`: montar `input = { ...body, action: body.action ?? url.searchParams.get('action') }` e validar; remover os 15 `return 400 '<x> is required'`.
- **Evidência:** `[lalamove-api]` nos testes de contrato; `order` sem `quotationId` → 422 com `fields[0].field === 'quotationId'`.

### 22 — [E] Schemas `lalamove-uapi` (24 ações)
- [x] Discriminated union por `action` (query ou body) com `order_uuid`, `driver_fid`, `rating`, `code`, `access_token`/`refresh_token`, `user_fid`, `ep_role`, `city_id`, paginação; integrar em `lalamove-uapi/index.ts:~493`.
- **Evidência:** `favorite-driver` sem `driver_fid` → 422 nomeando o campo (hoje 400 fixo, A22).

### 23 — [E] Schema `lalamove-gateway`
- [x] `{ target?: 'unified'|'uapi', action: string(1..64), params?: record<string,string>, body?: unknown, method?: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE' }`; integrar em `lalamove-gateway/index.ts:243-251` mantendo `requestId` no `meta`.
- **Evidência:** `route.test.ts` + caso de contrato; front (`src/lib/lalamove-api.ts:70`) continua funcionando (e2e `new-order-autocomplete`).

### 24 — [E] Schema `job-worker` (envelope + payload por `type`)
- [x] `{ jobId: string, type: enum(12), payload: object, metadata?: object }` com `payload` refinado por tipo (`orderId`/`lalamove_id`, `driverId`, `trackingId`, `addresses[]`, `alert_id`…), `.passthrough()`; integrar em `job-worker/index.ts:~1149-1160` substituindo o 500 por 422.
- **Evidência:** job sem `jobId` → 422 (hoje 500 em `:1180-1190`); `eta-*.test.ts` continuam verdes.

### 25 — [E] Schema `bitrix24-sync`
- [x] Union por `action` (`get_auth_url{domain}`, `oauth_callback{code, domain}`, `refresh_token`, `sync_order{orderId: uuid, dealId: string|number}`, `get_connection_status`, `get_deals`, `disconnect`); substituir o `z.record(z.any())` + `.parse` (`:36`, `:158-162`) pela camada, para que ZodError vire 422 e não 500.
- **Evidência:** `sync_order` com `orderId` inválido → 422 (hoje 500 `:348-350`).

### 26 — [E] Schema `external-companies`
- [x] Union por `action` (`list{table?, search?, limit≤200, offset}`, `get{table?, id}`, `search_address{search, limit}`, `schema{table?}`, `stats`) com `table` em enum das 5 tabelas permitidas (`:29`).
- **Evidência:** `get` sem `id` → 422; `useExternalData.ts` continua listando.

### 27 — [E] Schema `external-db-bridge`
- [x] `{ operation: enum(select|insert|update|delete|rpc), table?, rpc_name?, select?, filters?, body?, limit?, offset?, order?{column, ascending?}, count_mode? }` com refinamento (`table` obrigatório fora de `rpc`; `rpc_name` obrigatório em `rpc`).
- **Evidência:** `{operation:'rpc'}` sem `rpc_name` → 422; `update`/`delete` sem `filters` → 422 (testes em `_shared/contract.test.ts`). O `index.test.ts` desta edge é de I/O contra a função implantada e segue fora do CI (etapa 39).

### 28 — [E] Schema `mcp-query`
- [x] `{ operation: enum(25 da allowlist `:20-46`), params?: { schema?, table?, column?, filter?, limit? } }`; manter 405 para não-POST antes do contrato.
- **Evidência:** `operation:'drop'` → 422 `invalid_enum_value`.

### 29 — [E] Schemas das edges disparadas por cron/sem body
- [x] `check-driver-alerts`, `escalate-alerts`, `lalamove-token-refresh`, `rotate-tokens`, `bitrix24-process-queue`, `get-mapbox-token`, `simulate-driver-movement`: `z.object({ time: z.string().optional(), healthCheck: z.boolean().optional(), ... }).passthrough()` — corpo vazio aceito, array/string → 422.
- **Evidência:** `[check-driver-alerts] body array retorna 422` nos testes; cron `*/2` continua 200.

### 30 — [E] Contrato do proxy `llm-wh` sem consumir o corpo
- [x] Validar `req.clone()` como JSON não vazio (`{ event: string }` mínimo) e repassar o corpo **cru** (HMAC depende dos bytes originais); 422 no formato único quando não for JSON.
- **Evidência:** `security.test.ts` do webhook continua verde; `llm-wh` com corpo `"x"` → 422.

### 31 — [E] Schemas `apply-fixes` e `seed-fix-rls` (até a remoção da etapa 15)
- [x] `apply-fixes`: `{ action: literal('fix_dashboard') }`; `seed-fix-rls`: objeto vazio permissivo. Ambos marcados `@deprecated` no registro.
- **Evidência:** 26/26 nomes em `CONTRACT_REGISTRY`; `grep -L "_shared/contract.ts" supabase/functions/*/index.ts` retorna só `_shared`.

### 32 — [T] Testes genéricos: campo ausente / tipo incorreto / valor vazio para TODOS os contratos
- [ ] Em `_shared/contract.test.ts`: fixtures `VALID_PAYLOADS`, `WRONG_TYPE`, `EMPTY_VALUE`, `MISSING_FIELD` por contrato (`Record<ContractName, …>` força cobertura total) e loops genéricos que exigem 422 + `fields[].field` esperado.
- [ ] Contratos sem campo obrigatório: `{}` aceito, `[]`/`"x"` → 422 (`(root)`).
- **Evidência:** `deno test supabase/functions/_shared/contract.test.ts` com ≥ 150 casos verdes; falha ao adicionar nome ao registro sem fixture (erro de tipo).

### 33 — [T] Invariantes do formato único e do versionamento
- [ ] Testes: todo erro tem `error.code ∈ ERROR_CODES`, `fields[]` com `field/message/code` string, `meta.contractVersion`, `meta.deprecation` só em v1; `Warning`/`Sunset`/`Deprecation`/`Link` nos headers via `jsonResponse` para v1 e ausentes em v2.
- **Evidência:** testes `headers de deprecação` verdes.

### 34 — [T] Compatibilidade retroativa v1→v2 para os 26 contratos
- [ ] Loop genérico: payload v1 válido aceito em v2; payload inválido rejeitado com os **mesmos** `fields` em v1 e v2; v2 aceita campos novos que v1 ignora.
- **Evidência:** `[<nome>] payload v1 válido continua válido em v2` para os 26.

### 35 — [E] Resposta de sucesso das 26 edges via `jsonResponse(..., version)`
- [ ] Trocar `new Response(JSON.stringify(...))` por `jsonResponse` para que `x-contract-version` e headers de deprecação saiam também no 200 (hoje só nos erros; ex.: `new-device-alert/index.ts:102, 271`).
- **Evidência:** `curl -i` em qualquer edge mostra `x-contract-version`.

### 36 — [E] 500 nunca vaza mensagem interna
- [ ] Padronizar o `catch` final das 26 edges com `buildErrorBody(ERROR_CODES.INTERNAL_ERROR, 'Erro interno', [], version)` e `requestId`; manter `scripts/ci/check-edge-error-exposure-baseline.json` zerado.
- **Evidência:** baseline vazio; `rg -n "error: err.message|error: error.message" supabase/functions` retorna 0.

### 37 — [E] Telemetria de uso de versão nas 18 edges novas
- [x] Chamar `trackContractUsage(name, version)` (`_shared/telemetry.ts:27`) em todas, para medir quem ainda manda v1.
- **Evidência:** `select contract_name, contract_version, count(*) from contract_usage group by 1,2` com os 23 contratos já integrados (as 3 restantes entram com as etapas 21, 22 e 24).

### 38 — [T] Testes de integração I/O para as 18 edges
- [ ] Estender `CASES` em `_shared/contract.integration.test.ts:90-155` com `missing`/`wrongType` por edge (só payloads inválidos nas que têm efeito colateral: `lalamove-api`, `job-worker`, `bitrix24-sync`, `rotate-tokens`).
- **Evidência:** job `edge-integration-tests` na `main` verde com ≥ 60 casos.

### 39 — [C] Todos os testes Deno no CI 🔒
- [ ] `ci.yml` job `contract-tests`: incluir `job-worker/*.test.ts`, `lalamove-api/*.test.ts`, `send-notification/*.test.ts`, `external-db-bridge/index.test.ts`, `_shared/{phone,geo-precision}.test.ts`, `_shared/channels/zapp.test.ts` (hoje fora do CI); `scripts/ci/check-test-inventory.unit.mjs` sem órfãos.
- **Evidência:** inventário sem órfão; run verde.

### 40 — [E] Versionamento: `v2` como padrão e `v1` com sunset (D5) 🔒
- [ ] Na data de sunset: `DEFAULT_VERSION = 'v2'` (`contract.ts:20`), `v1` sai de `SUPPORTED_VERSIONS` e passa a responder `UNSUPPORTED_VERSION` (422) com `Link` para o guia; antes disso, aviso aos integradores (n8n, Bitrix) registrado em `docs/API_CONTRACTS.md`.
- **Evidência:** `contract_usage` sem `v1` nos 7 dias anteriores; teste `v1 → UNSUPPORTED_VERSION` verde.

### 41 — [E] Rota de descoberta `GET /functions/v1/<edge>?contract=schema`
- [ ] `_shared/contract.ts`: helper `describeContract(name)` que devolve o JSON Schema (via `zod-to-json-schema`) de v1/v2, versão default, deprecação; opcional, atrás de JWT.
- **Evidência:** `curl ...?contract=schema` devolve `{ versions: { v1, v2 }, default, deprecated }`.

### 42 — [F] Cliente do front entende o formato único de erro
- [x] `src/lib/edge-error.ts`: `parseEdgeError(error)` que lê `error.context.json()` (FunctionsHttpError) e devolve `{ code, message, fields }`; `formatEdgeError` mostra `fields[0].field: message`. Evidência: `src/lib/edge-error.ts:11-36`, teste `src/lib/edge-error.test.ts` 6/6 passando.
- [x] Aplicar em `useBitrix24.ts`, `useExternalData.ts`, `useLalamoveUapi.ts:42-46`, `src/lib/lalamove-api.ts:70-88`. Evidência: `useLalamoveUapi.ts:43-46`, `lalamove-api.ts:76-82`, `useBitrix24.ts` (connect catch + syncOrder onError), `useExternalData.ts` (edgeThrow nos 4 queryFns).
- **Evidência:** `npx tsc --noEmit -p tsconfig.app.json` 0 erros; `npx eslint` 0 erros; `npx vitest run src/lib/edge-error.test.ts` 6/6; `npm run build` OK.

### 43 — [F] Formulários do front usam o **mesmo** schema das edges
- [ ] Publicar os schemas v2 de `lalamove-api`/`send-notification` em `src/contracts/` (zod 4 no front vs 3.22 na edge: gerar JSON Schema na etapa 41 e consumir com `zod-from-json-schema`, ou duplicar com teste de paridade por fixture).
- **Evidência:** teste de paridade: fixture inválida reprovada igual no front e na edge.

### 44 — [E] Documentação dos contratos atualizada
- [ ] `docs/API_CONTRACTS.md`: tabela com as 26 edges, versão, campos obrigatórios, exemplo de 422, chamadores; corrigir "rollout completo" (`:144-146`); `docs/agentes/lalamove-api.md` e `mapa-repo.md` apontam para o registro.
- **Evidência:** `grep -c "✅" docs/API_CONTRACTS.md` = 26.

### 45 — [C] Guard de CI: nenhuma edge nova sem contrato 🔒
- [ ] `scripts/ci/check-edge-contracts.mjs`: falha se existir `supabase/functions/<x>/index.ts` sem `_shared/contract.ts` ou sem entrada em `CONTRACT_REGISTRY`; teste `.unit.mjs`; ligado no job `lint-and-typecheck`.
- **Evidência:** criar edge de teste sem contrato → CI vermelha.

## Bloco 2 — Rotas, RBAC e navegação (46–60)

### 46 — [F] Parar de remontar o `AppLayout` a cada navegação
- [ ] `src/App.tsx:138`: tirar `key={location.pathname}` do `<Routes>`; animar só o `<Outlet>` interno do `AppLayout` (`AppLayout.tsx:320-322`) com `AnimatePresence` + `key` local.
- **Evidência:** React DevTools: `Sidebar`/`Header` não desmontam ao trocar de rota; uma única subscription realtime por sessão (`supabase.getChannels().length` estável).

### 47 — [F] Uma única busca global (Ctrl+K)
- [ ] Manter `CommandPaletteEnhanced` + `useCommandPaletteSearch`; remover `GlobalSearchAdvanced` (`AppLayout.tsx:211`) e `useGlobalSearch.ts` (ou o inverso) — decidir pelo que tem teste.
- **Evidência:** `rg -n "key === 'k'" src` retorna 1 ocorrência; Ctrl+K abre um só diálogo.

### 48 — [F] Hierarquia de papéis numa única fonte
- [ ] Criar `src/lib/roles.ts` (`ROLE_ORDER`, `hasRole(userRoles, required)`) e usar em `ProtectedRoute.tsx:14`, `sidebar-config.ts:102`, `MobileSidebar.tsx:151`, `Sidebar.tsx:78-79`.
- **Evidência:** `rg -n "admin.*manager.*operator.*viewer" src` retorna só `src/lib/roles.ts`; teste unitário.

### 49 — [F] Menu alinhado às rotas
- [ ] `sidebar-config.ts`: `requiredRole`/`requireMFA` em `approvals` (`:42`), `map-tools` (`:55`), `alert-config` (`:60`) e categoria `integrations` (`:67-75`) iguais aos de `App.tsx:176-201`; teste que compara `sidebar-config` × rotas do `App`.
- **Evidência:** teste `sidebar-config.test.ts` verde; operador não vê links que levam a `/unauthorized`.

### 50 — [F] Rotas sem entrada no menu
- [ ] Adicionar ao menu (ou documentar como "acesso por link") `/analytics`, `/reports`, `/system-health(-expanded)`, `/cache-status`, `/job-queue`, `/rate-limiting`, `/lalamove-quota`, `/settings/uapi`, `/preferences`, `/profile`; remover o alias `/map` de `/live-map` (`App.tsx:183-184`) com redirect.
- **Evidência:** cada rota de `App.tsx` tem item de menu ou está em "Mais" (teste da etapa 49 cobre).

### 51 — [F] Dashboard e perfil com papel mínimo
- [ ] `App.tsx:149-150` (`/`, `/dashboard`) e `/profile`: `ProtectedRoute requiredRole="viewer"`; usuário sem role vai para `/unauthorized` com texto "peça acesso ao administrador".
- **Evidência:** usuário sem linha em `user_roles` não vê KPIs.

### 52 — [F] Role via `usePermissions` (cache) em vez de `.single()` nas sidebars
- [ ] `Sidebar.tsx:34-40` e `MobileSidebar.tsx:137-147`: remover a query própria de `user_roles` (quebra com 2 roles) e usar `usePermissions`.
- **Evidência:** usuário com 2 roles vê seções de admin; 1 request a `user_roles` por sessão.

### 53 — [F] Contadores da sidebar no React Query, em paralelo
- [ ] `Sidebar.tsx:44-50` / `MobileSidebar.tsx:167-189`: hook `useSidebarCounts()` com `useQueries` (3 counts em paralelo, `staleTime` 30 s) compartilhado.
- **Evidência:** aba Network: 3 requests simultâneos, não 3 sequenciais repetidos por sidebar.

### 54 — [F] Sidebar destaca rotas aninhadas
- [ ] `Sidebar.tsx:56`: `matchPath({ path, end: false })` em vez de `===`.
- **Evidência:** `/reports/advanced` e `/settings/maps` destacam o item pai.

### 55 — [F] Login respeita a rota de origem
- [x] `AuthPage.tsx`: `const from = (location.state?.from as { pathname?: string } | null)?.pathname ?? '/'`; redirect de usuário autenticado usa `<Navigate to={from} replace />`. Evidência: `src/pages/AuthPage.tsx:33-35,66-68`.
- **Evidência:** abrir `/orders` deslogado → login → volta para `/orders`.

### 56 — [F] Scroll para o topo no container certo
- [x] `App.tsx`: `useEffect` rola `document.getElementById('main-content')` (o `<main>` com `overflow-y-auto`), e retorna cedo em `navigationType === 'POP'` (voltar/avançar preserva a posição). Evidência: `src/App.tsx:119-128`.
- **Evidência:** trocar de página longa volta ao topo.

### 57 — [F] Retry de chunk após deploy
- [ ] `src/lib/lazyWithRetry.ts`: `lazy(() => import(...).catch(() => { sessionStorage flag; location.reload() }))`; aplicar nos 50 `lazy()` de `App.tsx:20-81`.
- **Evidência:** simular `ChunkLoadError` recarrega uma vez e não cai no `ErrorBoundary`.

### 58 — [F] Página 404 lazy e com link de volta
- [ ] `NotFound` passa a `lazy` (hoje import estático) e usa `useNavigate(-1)` + link para o dashboard.
- **Evidência:** `App.tsx` sem import estático de página além dos públicos.

### 59 — [F] `/unauthorized` com contexto
- [ ] Mostrar a rota tentada e o papel exigido (vem do `state` do `ProtectedRoute`) e botão "solicitar acesso" (abre e-mail/Slack configurado).
- **Evidência:** tela exibe "Você precisa do papel manager para /webhooks".

### 60 — [T] E2E de RBAC cobrindo as 57 rotas
- [ ] `e2e/rbac.e2e.ts:19-28`: gerar `PROTECTED_ROUTES` a partir de um export tipado de `App.tsx` (lista de rotas) × 4 papéis; sessão via `storageState` por papel (fixtures em `e2e/fixtures/`).
- **Evidência:** matriz 57 × 4 verde no CI (job `E2E (Playwright)`).

## Bloco 3 — Dados, erros e estados de tela (61–85)

### 61 — [F] Dashboard checa o `error` das 7 queries
- [ ] `src/hooks/useDashboardStats.ts:28-116`: `Promise.allSettled`; qualquer `error` → `isError` + toast "não foi possível carregar X"; KPI mostra "—" e não "0".
- **Evidência:** RLS negada em uma tabela → card com "—" e toast; teste unitário com mock.

### 62 — [F] Métricas com filtro de período e paginação
- [ ] `src/hooks/useDeliveryMetrics.ts:40-42`: filtro `created_at >= periodo` + `range()` paginado (ou RPC agregada `delivery_metrics(period)`), `count: 'exact'` para avisar "mostrando 1.000 de N".
- **Evidência:** base com > 1.000 pedidos: KPI bate com `select count(*)`.

### 63 — [F] Agrupamento diário em `America/Sao_Paulo`
- [ ] `useDeliveryMetrics.ts:210` e `useCachedStats.ts:139`: `formatInTimeZone(date, 'America/Sao_Paulo', 'yyyy-MM-dd')` (`date-fns-tz`) em vez de `toISOString().split('T')[0]`.
- **Evidência:** pedido de 22h BRT cai no dia correto no gráfico.

### 64 — [F] Tempo médio de entrega só com pares completos
- [ ] `useDashboardStats.ts:89-102`: filtrar registros com `actual` e `scheduled_at`; dividir pelo tamanho filtrado.
- **Evidência:** teste unitário com 3 registros (1 incompleto) → média dos 2.

### 65 — [F] `datetime-local` em hora local
- [ ] `NewOrderDialog.tsx:905-907`: helper `toLocalInputValue(date)` (ajusta `getTimezoneOffset`) para `min`/`max`.
- **Evidência:** em BRT o `min` é agora + 31 min, não + 3 h 31.

### 66 — [F] Aprovação de motorista atômica com feedback
- [ ] RPC `approve_driver(queue_id, decision)` (migration 🔒) que atualiza `driver_approval_queue` + `drivers` numa transação; `useApprovalActions.ts:33-38` chama a RPC; `onError` (`:50`) com toast; desfazer trata `error` (`:46-47`, `:68-69`).
- **Evidência:** falha forçada na segunda escrita não deixa fila "aprovada" com motorista "pendente".

### 67 — [F] `AuthProvider` nunca fica carregando para sempre
- [ ] `useAuth.tsx:35`: `.catch(() => setLoading(false))` + `finally`; `value` com `useMemo` (`:75`).
- **Evidência:** rejeitar `getSession` em teste → `loading=false` e tela de login.

### 68 — [F] Logout limpa o cache e os canais
- [ ] `useAuth.tsx:63-72`: `queryClient.clear()`, `supabase.removeAllChannels()`, limpar `localStorage` de preferências por usuário.
- **Evidência:** logar com usuário B após A não mostra pedidos de A (teste e2e).

### 69 — [F] Estado de erro no mapa ao vivo
- [ ] `LiveMapPage.tsx:86-89`, `useTrackingData.ts:71-74`, `useTrackingTrails.ts:44-47`: expor `error` e renderizar banner "falha ao atualizar, tentando de novo em 10 s" com botão.
- **Evidência:** desligar rede → banner aparece; religar → some.

### 70 — [F] Paradas do pedido tratam erro
- [ ] `OrderDetailModal.tsx:481-485`: ler `error`; mostrar "não foi possível carregar paradas" em vez de "sem paradas".
- **Evidência:** erro simulado → mensagem correta.

### 71 — [F] Busca global: cancelamento e paralelismo
- [ ] `useGlobalSearch.ts:147` / `useCommandPaletteSearch.ts:183-203`: `useQuery` com `signal` (AbortController) e `Promise.all` das 4 fontes; `debounce` 300 ms.
- **Evidência:** digitar rápido não deixa resultado antigo sobrescrever o novo (teste com atraso artificial).

### 72 — [F] `setCountdown` sem efeito colateral e sem reiniciar por tecla
- [ ] `AuthPage.tsx:46-53`: mover `clearInterval`/`checkLockout` para `useEffect` dependente de `countdown === 0`; remover `email` das deps do timer.
- **Evidência:** StrictMode não dispara `checkLockout` 2×; digitar não reinicia a contagem.

### 73 — [F] Conquistas: `JSON.parse` protegido e por usuário
- [ ] `useAchievementsSystem.tsx:254-256`: `try/catch` + chave `achievements:<userId>`; (ou remover o provider — etapa 170).
- **Evidência:** `localStorage.setItem('achievements','{')` não derruba a app.

### 74 — [F] Listener do Service Worker sem acúmulo
- [ ] `useServiceWorker.ts:170`: registrar `controllerchange` uma vez (`useEffect` com cleanup).
- **Evidência:** 3 cliques em "atualizar" = 1 listener (`getEventListeners` no DevTools).

### 75 — [F] Clipboard assíncrono com tratamento
- [ ] `BatchActionsToolbar.tsx:58`: `await navigator.clipboard.writeText(...)` em `try/catch`; toast de erro quando negado.
- **Evidência:** permissão negada → toast de erro, não de sucesso.

### 76 — [F] Telefone e link de rastreamento pelas fontes oficiais
- [ ] `BatchActionsToolbar.tsx:41, 57` e `MapHUD.tsx:67`: `toWhatsAppUrl(phone)` de `src/lib/phone.ts` (DDI 55) e `order.shareLink` em vez de `track.lalamove.com/<id>`.
- **Evidência:** `rg -n "wa.me/|track.lalamove.com" src` só em `src/lib/phone.ts`/tipos.

### 77 — [F] `useQuery` com `isError` visível em todas as páginas
- [ ] Componente `QueryState` (`loading`/`error`/`empty` com retry) em `src/components/ui/query-state.tsx`; aplicar nas 20 páginas que hoje só tratam `isLoading` (levantar com `rg -n "isLoading" src/pages -l | xargs rg -L "isError|error"`).
- **Evidência:** `rg -L "isError|error" $(rg -l "useQuery" src/pages)` retorna 0 arquivos.

### 78 — [F] Mutations invalidam as queries certas
- [ ] Auditar `useMutation` sem `onSuccess → invalidateQueries` (`rg -n "useMutation" src -A8 | rg -v invalidate`); chaves centralizadas em `src/lib/queryKeys.ts`.
- **Evidência:** criar pedido atualiza a lista sem F5.

### 79 — [F] Tipos gerados cobrem `runtime_error_logs` e telemetria
- [ ] Regerar `src/integrations/supabase/types.ts` (CLI `supabase gen types`) e trocar os `fetch` REST crus de `AdminTelemetriaPage.tsx:81` e `errorMonitoring.ts:64` por `supabase.from(...)` tipado.
- **Evidência:** `rg -n "rest/v1" src` retorna 0.

### 80 — [F] Zerar `any`/`as any`
- [ ] `LiveMapPage.tsx:101`, `useCacheViews.ts:59, 142`, `AlertConfigCard.tsx:113` e demais (`rg -n ": any|as any" src`); `no-explicit-any` para `error` no `eslint.config.js`.
- **Evidência:** `npx eslint src` sem warnings de `no-explicit-any`.

### 81 — [F] `logger` silencia em produção e nunca loga payload pessoal
- [ ] `src/utils/logger.ts:12`: `error` em produção envia para `errorMonitoring` e não imprime payload; remover `console.error` diretos (`ProfilePage.tsx:94`, `useMapSettings.ts:86, 112`); regra ESLint `no-console`.
- **Evidência:** `rg -n "console\\.(log|error|warn)" src --glob '!**/logger.ts'` retorna 0.

### 82 — [F] Realtime com debounce e um canal por recurso
- [ ] `useTrackingData.ts:93-97`: `postgres_changes` com debounce 1 s e atualização incremental do item alterado (não refetch completo com joins); `useRealtimeSubscriptions.ts` (464 linhas) com registro central de canais.
- **Evidência:** 10 eventos em 1 s = 1 refetch.

### 83 — [F] Polling com pausa em segundo plano
- [ ] Todos os `refetchInterval` (`useJobQueue.ts:110, 218`, `useSLAMetrics.ts:191`, `useLalamove.ts:80, 90`, `usePendingApprovals.ts:136` e ~15 hooks a 30 s): `refetchIntervalInBackground: false` e `refetchOnWindowFocus: true`; mínimo 15 s fora do mapa.
- **Evidência:** aba em segundo plano por 2 min → 0 requests.

### 84 — [F] Mapa ao vivo: uma fonte de atualização
- [ ] `LiveMapPage.tsx:147` (10 s) × `useTrackingData.ts:102` (5 s) × simulação `:131` (3 s): manter só o realtime (etapa 82) + fallback de polling 15 s quando o canal cair.
- **Evidência:** Network em 1 min: ≤ 5 requests sem evento.

### 85 — [T] Testes dos hooks de dados críticos
- [ ] Vitest para `useDashboardStats`, `useDeliveryMetrics`, `useApprovalActions`, `useAuth`, `useGlobalSearch` com mock do client (`src/test/supabaseMock.ts`).
- **Evidência:** 5 arquivos novos em `src/hooks/__tests__/`, verdes.

## Bloco 4 — Performance e bundle (86–110)

### 86 — [C] `vite.config.ts` com `build` explícito
- [ ] `build.target 'es2022'`, `sourcemap: 'hidden'`, `chunkSizeWarningLimit: 600`, `rollupOptions.output.manualChunks` (`react-vendor`, `supabase`, `mapbox`, `charts`, `motion`, `export`); remover o bloco `test:` duplicado (`vite.config.ts:12-15`).
- **Evidência:** `npm run build` lista chunks nomeados; maior chunk inicial < 300 kB gz.

### 87 — [F] `framer-motion` fora do bundle inicial
- [ ] Remover de `App.tsx:17`, `AppLayout`, `Sidebar`, `Header`, `MobileBottomNav`, `contextual-hints`; usar transições CSS (Tailwind `animate-*`) no layout; manter motion só em componentes lazy.
- **Evidência:** `npx vite-bundle-visualizer`: `framer-motion` ausente do chunk `index`.

### 88 — [F] `xlsx` e `jspdf` dinâmicos
- [ ] `exportUtils.ts:5` e `MapHistoryPanel.tsx:4`: `const XLSX = await import('xlsx')` no clique (padrão de `AdminTelemetriaPage.tsx:146`).
- **Evidência:** chunks `xlsx-*.js`/`jspdf-*.js` carregados só ao exportar.

### 89 — [F] `AchievementsProvider` fora da raiz
- [ ] `App.tsx:128`: remover o provider (consumidor único `useApprovalActionsEnhanced.ts` é código morto — etapa 170).
- **Evidência:** `rg -n "AchievementsProvider" src` retorna 0 ou só em rota lazy.

### 90 — [F] Virtualizar listas longas
- [ ] `OrdersTable.tsx:200-210`, lista de motoristas (`useDrivers.ts:37-40` sem paginação), contatos (`useContacts.ts:30`, `limit(500)`), histórico de notificações (`useNotificationHistory.ts:40`, `limit(200)`): `react-window` (já instalado, `package.json:90`) ou `@tanstack/react-virtual`; paginação server-side com `range()`.
- **Evidência:** 2.000 pedidos renderizam < 100 linhas no DOM.

### 91 — [F] `React.memo` nas linhas e cards de lista
- [ ] `OrdersTable` row, `DriverCard`, `ApprovalCard`, `AlertCard`: `memo` + callbacks estáveis (`useCallback`); remover `style={{ animationDelay: index*50ms }}` (`OrdersTable.tsx:208`) acima de 20 itens.
- **Evidência:** React Profiler: trocar seleção de 1 linha re-renderiza 1 linha.

### 92 — [F] Contextos com `useMemo`
- [ ] `useAuth.tsx:75`, `contextual-hints.tsx:115` e demais providers: `value` memoizado.
- **Evidência:** Profiler sem re-render em cascata ao digitar no header.

### 93 — [F] Health check sem invocar a edge do token Mapbox
- [ ] `useSystemHealth.ts:29, 47`: checar saúde via `HEAD` em `/functions/v1/get-mapbox-token` com `healthCheck: true` tratado na edge (etapa 29) ou via tabela `system_health`; intervalo 60 s.
- **Evidência:** `get-mapbox-token` não aparece nos logs a cada 30 s.

### 94 — [F] Imagens com `loading="lazy"` e dimensões
- [ ] `DriverCard.tsx:71`, `ApprovalCard.tsx:38`, `ApprovalQueue.tsx:68` e todas as `<img>`: `loading="lazy" decoding="async" width height`; avatares via componente `Avatar` do shadcn.
- **Evidência:** `rg -n "<img" src | rg -v 'loading="lazy"'` retorna 0.

### 95 — [F] Fonte Inter removida ou usada
- [ ] `index.html:73`: remover o `<link>` da Inter (só fallback em `src/index.css:158`) ou adotar como fonte principal; `display=swap` e `preconnect` para `fonts.gstatic.com`.
- **Evidência:** Lighthouse: sem fonte não usada.

### 96 — [F] i18n por idioma sob demanda (D8)
- [ ] `src/i18n/index.ts:5-7`: só `pt-BR` estático; `en`/`es` via `import()` quando selecionados (ou remover até existir tradução completa).
- **Evidência:** chunk inicial sem `en.json`/`es.json`.

### 97 — [F] Prefetch de rotas prováveis
- [ ] Ao passar o mouse no item do menu, `import()` do chunk da rota (`onMouseEnter`/`onFocus` na `Sidebar`).
- **Evidência:** navegação para `/orders` após hover não mostra o `Suspense` fallback.

### 98 — [F] `staleTime` padrão e por recurso
- [ ] `QueryClient` global com `staleTime: 30_000`, `gcTime: 5 min`, `retry: 1`; `staleTime` menor só no mapa e na fila de jobs.
- **Evidência:** voltar a uma página em < 30 s não refaz as queries.

### 99 — [F] Mapa: `mapbox-gl` só na rota do mapa
- [ ] Conferir que `mapbox-gl`/`@mapbox/*` não entram em `index`; `MapProviderSelector` e `useMapboxToken` só dentro de `components/map` lazy.
- **Evidência:** visualizer: `mapbox-gl` em chunk próprio carregado em `/live-map`.

### 100 — [F] Web Vitals reportados
- [ ] `src/utils/webVitals.ts:114` recebe `analyticsEndpoint` em `main.tsx:10-13` (edge `send-telemetry` ou tabela `web_vitals`); painel em `/performance`.
- **Evidência:** LCP/INP/CLS da produção visíveis em `/performance`.

### 101 — [C] Orçamento de bundle no CI 🔒
- [ ] `scripts/ci/bundle-budget.mjs` já existe mas não está no `ci.yml` nem tem `performance-budget.json` (sai 2, fail-closed): gerar o budget com `npm run build && node scripts/ci/bundle-budget.mjs --update-budget` e ligar no job `build`; metas: `index` ≤ 300 kB gz, inicial ≤ 800 kB gz.
- **Evidência:** PR que importa `xlsx` estático fica vermelha.

### 102 — [F] Debounce nos filtros de tabela
- [ ] Inputs de busca em `OrdersPage`, `DriversPage`, `ContactsPage`: `useDebouncedValue(300)` antes da query.
- **Evidência:** digitar 10 letras = 1-2 requests.

### 103 — [F] Suspense granular por painel
- [ ] Dashboard: cada card com `Suspense` próprio e `ErrorBoundary` local (um card quebrado não derruba a página).
- **Evidência:** erro em `DashboardHeroSection` mantém os outros cards.

### 104 — [F] `OrderDetailModal` carregado sob demanda
- [ ] `OrderDetailModal.tsx` (1016 linhas) e `NewOrderDialog.tsx` (1171) via `lazy()` abertos pelo botão; `Suspense` com skeleton do dialog.
- **Evidência:** chunk `OrderDetailModal-*.js` só ao abrir um pedido.

### 105 — [F] Service Worker com estratégia explícita
- [ ] `public/sw.js`: `stale-while-revalidate` para assets com hash, `network-first` para `/functions/` e `/rest/`; versão por build (`__BUILD_ID__`); remover a lista duplicada de hosts (`index.html:44-54` × `sw.js:6-19`).
- **Evidência:** deploy novo → prompt "atualizar" em < 1 min; API nunca servida do cache.

### 106 — [F] Evitar `select('*')` nas listas
- [ ] `useDrivers.ts:37-40` e demais `select('*')` (`rg -n "select\\('\\*'\\)" src`): listar colunas usadas.
- **Evidência:** `rg -n "select\\('\\*'\\)" src/hooks` retorna 0.

### 107 — [F] Imagens de mapa estático com cache
- [ ] Preview de rota (`static-map`) com `Cache-Control` e `srcset`; placeholder enquanto carrega.
- **Evidência:** segunda abertura do pedido não refaz o request da imagem.

### 108 — [F] Reduzir re-render do `Header`
- [ ] `Header.tsx` (366 linhas): dividir em `HeaderSearch`, `HeaderNotifications`, `HeaderUser`; notificações com `useQuery` próprio.
- **Evidência:** Profiler: digitar na busca não re-renderiza o avatar/menu.

### 109 — [F] `useEffect` com `setInterval` sempre limpos
- [ ] Auditar `rg -n "setInterval" src` e garantir `clearInterval` no cleanup (ex.: `AuthPage.tsx:46`, `LiveMapPage.tsx:147`).
- **Evidência:** navegar 20× entre páginas não acumula timers (`performance.memory` estável).

### 110 — [T] Lighthouse CI na pré-visualização 🔒
- [ ] `lhci autorun` no job `build` contra o preview do Vercel para `/auth`, `/dashboard`, `/orders`; limiares: performance ≥ 80, a11y ≥ 90, best-practices ≥ 90.
- **Evidência:** relatório anexado à PR; vermelho abaixo do limiar.

## Bloco 5 — Acessibilidade (111–135)

### 111 — [C] `eslint-plugin-jsx-a11y` ligado
- [ ] `eslint.config.js`: `jsx-a11y/recommended` (como `warn` na 1ª PR, `error` após zerar); `lint:a11y` do `package.json:12` passa a ser o lint normal.
- **Evidência:** `npx eslint src` lista as regras `jsx-a11y/*`.

### 112 — [F] Nome acessível nos 44 botões só com ícone
- [ ] `aria-label` (ou `<span className="sr-only">`) em `RiskRulesPage.tsx:305, 312`, `HeatmapControls.tsx:101-107`, `LiveMapPage.tsx:253`, `ReportsPage.tsx:75`, `GeoBlockingPage.tsx:367`, `RolesPage.tsx:243`, `RateLimitDashboardPage.tsx:323, 388`, `DriversPage.tsx:178`, `DriverCard.tsx:104`, `CoordinateInput.tsx:28`, `Header.tsx:345`, `Sidebar.tsx:159`, `MobileBottomNav.tsx:201`, `PasskeySettings.tsx:194-251`, `MFASettings.tsx:112`, `MFAEnroll.tsx:137`, `AIRouteChatbot.tsx:120-243`, `floating-action-button.tsx:145, 192`, `keyboard-shortcuts-help.tsx:132`.
- [ ] O ratchet `scripts/ci/a11y-button-name-ratchet.mjs` (`npm run lint:a11y`, baseline 82 em `a11y-button-name-baseline.json`) não roda no `ci.yml`: ligar no job `lint-and-typecheck` e baixar a baseline a cada PR até 0.
- **Evidência:** baseline = 0; `jsx-a11y/control-has-associated-label` = 0; axe no e2e sem "button-name".

### 113 — [F] Componente `IconButton` com `label` obrigatório
- [ ] `src/components/ui/icon-button.tsx`: prop `label: string` (TS obriga) → `aria-label` + tooltip; migrar os botões da etapa 112.
- **Evidência:** `rg -n "<Button[^>]*size=\"icon\"" src` retorna 0 fora de `icon-button.tsx`.

### 114 — [F] Labels associados nos 72 campos
- [ ] `useId()` + `htmlFor`/`id` em `NewOrderDialog.tsx:610-998` (12 campos), `WebhooksPage.tsx:256`, `LalamoveSettingsPage.tsx:250`, `UAPISettingsPage.tsx:143`, `ProfilePage.tsx:130`, `AlertConfigurationsPage.tsx:156-164`, `RolesPage.tsx:198, 342, 371` e demais.
- **Evidência:** `jsx-a11y/label-has-associated-control` = 0; axe sem "label".

### 115 — [F] Campo de formulário padrão (`FormField`)
- [ ] `src/components/ui/form-field.tsx`: `Label` + controle + mensagem de erro (`aria-describedby`, `aria-invalid`) + `required`/`aria-required`; usado pelas etapas 114 e 136.
- **Evidência:** erro de validação é lido pelo leitor de tela (NVDA/VoiceOver, registro na PR).

### 116 — [F] Linhas e cards clicáveis acessíveis
- [ ] `OrdersTable.tsx:202-209` (`<tr onClick>`): checkbox real + botão "abrir"; `PermissionsPage.tsx:171`, `PasswordResetApprovalsPage.tsx:99`, `GlobalSearchAdvanced.tsx:84, 127`, `AlertsAdvanced.tsx:88, 100`, `timeline-item.tsx:69`: `role="button"`, `tabIndex=0`, `onKeyDown` Enter/Espaço (ou `<button>`).
- **Evidência:** `jsx-a11y/click-events-have-key-events` = 0; navegação por Tab abre o pedido.

### 117 — [F] `MotionConfig reducedMotion="user"`
- [ ] Envolver a app em `<MotionConfig reducedMotion="user">`; `useReducedMotion` no confete (`useAchievementsSystem.tsx:144-175`), FAB (`floating-action-button.tsx:142`) e `animate-pulse` (`MapHUD.tsx:156`).
- **Evidência:** com "reduzir movimento" no SO, nenhuma animação JS roda (teste e2e com `reducedMotion: 'reduce'`).

### 118 — [F] IDs ARIA estáveis
- [ ] `accessible-card.tsx:55-57`: `useId()` em vez de `Math.random()`.
- **Evidência:** `aria-labelledby` não muda entre renders (teste).

### 119 — [F] `<html lang>` acompanha o idioma
- [ ] `i18n/index.ts`: `i18n.on('languageChanged', l => document.documentElement.lang = l)`.
- **Evidência:** trocar para `en` muda `document.documentElement.lang`.

### 120 — [F] Tamanho mínimo de fonte 12 px
- [ ] Substituir as 185 ocorrências de `text-[7-10px]` por `text-xs` (12 px) — `MapHUD.tsx:156`, `AlertsPage.tsx:400`, `OrdersTable.tsx:144`…; regra ESLint/Stylelint que proíbe `text-[<12px]`.
- **Evidência:** `rg -n "text-\\[(7|8|9|10)px\\]" src` retorna 0.

### 121 — [F] Contraste AA
- [ ] Auditar `text-muted-foreground` em fundo claro/escuro (`tailwind.config.ts` tokens) e badges coloridas; ajustar tokens para ≥ 4.5:1.
- **Evidência:** axe sem "color-contrast" nas 10 páginas principais.

### 122 — [F] FAB com semântica de menu
- [ ] `floating-action-button.tsx:203`: `aria-expanded`, `aria-haspopup="menu"`, `role="menu"`/`menuitem`, foco preso e `Esc` fecha.
- **Evidência:** teclado abre, navega e fecha o menu.

### 123 — [F] Cabeçalhos de tabela com `scope`
- [ ] `WebhooksPage.tsx:281-286`, `AdminTelemetriaPage.tsx:443-445`, `MatrixTab.tsx:38-39` (`scope="row"` na 1ª coluna) e componente `Table` do shadcn com `scope="col"` padrão.
- **Evidência:** `rg -n "<th(?![^>]*scope)" src` retorna 0.

### 124 — [F] Popups e marcadores do mapa acessíveis por teclado
- [ ] `markerFactories.ts:98` (cluster `aria-hidden`), `:324-325` (`onclick` inline): marcador como `<button aria-label="Motorista X, pedido Y">`, popup com botões reais e foco ao abrir.
- **Evidência:** Tab percorre os marcadores; Enter abre o popup.

### 125 — [F] Botões revelados só por hover também por foco
- [ ] `AlertConfigCard.tsx:138`, `Header.tsx:348`: `focus-visible:opacity-100 focus-within:opacity-100`.
- **Evidência:** Tab até o botão o torna visível.

### 126 — [F] Skip-link e landmarks
- [ ] `AppLayout.tsx`: `<a href="#main" className="sr-only focus:not-sr-only">Pular para o conteúdo</a>`; `<nav aria-label>`, `<main id="main">`, `<header>`.
- **Evidência:** 1º Tab na página mostra o skip-link.

### 127 — [F] Foco gerenciado em diálogos e após ações
- [ ] Conferir `DialogTitle`/`DialogDescription` em todos os `Dialog`/`Sheet` (`rg -n "<DialogContent" src -l`); após excluir item, foco vai para o próximo/heading.
- **Evidência:** console sem aviso "DialogContent requires a DialogTitle".

### 128 — [F] `aria-live` para toasts e loaders
- [ ] `Toaster` com `aria-live="polite"`; loaders de página com `role="status"` e texto `sr-only` "Carregando".
- **Evidência:** leitor de tela anuncia "Pedido criado".

### 129 — [F] Textos alternativos
- [ ] Todas as `<img>` com `alt` significativo ou `alt=""` decorativo; ícones Lucide decorativos com `aria-hidden`.
- **Evidência:** axe sem "image-alt".

### 130 — [F] Zoom e viewport
- [ ] `index.html:5`: remover `maximum-scale`; nada de `user-scalable=no`.
- **Evidência:** pinça dá zoom no celular.

### 131 — [F] Ordem de tabulação e `tabIndex` positivos
- [ ] `rg -n "tabIndex=\\{[1-9]" src` → 0; ordem visual = ordem DOM nas sidebars.
- **Evidência:** `jsx-a11y/tabindex-no-positive` = 0.

### 132 — [F] Mensagens de erro ligadas ao campo
- [ ] `aria-describedby` + `aria-invalid` via `FormField` (etapa 115) em `AuthPage`, `NewOrderDialog`, settings.
- **Evidência:** axe sem "aria-valid-attr-value"; leitor de tela lê o erro ao focar.

### 133 — [F] Atalhos de teclado documentados e sem conflito
- [ ] `keyboard-shortcuts-help.tsx`: lista gerada a partir de um registro único (`src/lib/shortcuts.ts`); `?` abre a ajuda; sem `Ctrl+K` duplicado (etapa 47).
- **Evidência:** teste que falha ao registrar duas vezes o mesmo atalho.

### 134 — [T] axe no e2e
- [ ] `@axe-core/playwright` em `e2e/a11y.e2e.ts` para `/auth`, `/dashboard`, `/orders`, `/live-map`, `/approvals`, `/settings`; falha em violações `serious`/`critical`.
- **Evidência:** spec verde no CI.

### 135 — [F] Modo alto contraste e tema respeitam o SO
- [ ] `prefers-contrast: more` → tokens de borda/texto reforçados; `prefers-color-scheme` como padrão inicial do tema.
- **Evidência:** alternar no SO muda a app sem reload.

## Bloco 6 — UX, formulários e responsividade (136–155)

### 136 — [F] `NewOrderDialog` com `react-hook-form` + zod
- [ ] Criar `components/ui/form.tsx` (shadcn) e migrar a validação manual (`NewOrderDialog.tsx:260-290`) para `useForm({ resolver: zodResolver(newOrderSchema) })`; schema compartilhado com a edge (etapa 43).
- **Evidência:** campo inválido mostra erro junto ao campo; submit desabilitado enquanto `isSubmitting`.

### 137 — [F] Demais formulários em RHF + zod
- [ ] `AlertConfigurationsPage`, `WebhooksPage`, `LalamoveSettingsPage`, `UAPISettingsPage`, `ProfilePage`, `RolesPage`, `MapsSettingsPage` (`rg -n "<form|onSubmit" src -l`).
- **Evidência:** `rg -n "useForm\\(" src | wc -l` ≥ 8; `react-hook-form` deixa de ser dependência sem uso.

### 138 — [F] Máscaras e validação de telefone, CEP e moeda
- [ ] `src/lib/masks.ts` (telefone E.164 via `src/lib/phone.ts`, CEP, BRL) usados nos campos de contato/remetente/destinatário.
- **Evidência:** `(11) 9…` salva como `+5511…`; letra em CEP é rejeitada.

### 139 — [F] Ações destrutivas com `AlertDialog` (sem `confirm()`)
- [ ] `ProfilePage.tsx:389`, `AlertConfigCard.tsx:138`, `MapSettingsPanel.tsx:83, 92`, `OrderDetailModal.tsx:312`, `BatchActionsToolbar.tsx:48` (dentro de `setTimeout` em loop!), `AuditReportGenerator.tsx:19` (`alert`).
- **Evidência:** `rg -n "confirm\\(|alert\\(" src` retorna 0.

### 140 — [F] Toasts com causa e ação
- [ ] Padrão `toast.error(título, { description: parseEdgeError(...).message, action: { label: 'Tentar de novo' } })`; nunca "Erro desconhecido" quando há `error.message`.
- **Evidência:** `rg -n "Erro desconhecido" src` só no fallback do helper.

### 141 — [F] Formatação única de moeda e data
- [ ] `src/lib/format.ts` (`formatBRL`, `formatDate`, `formatDateTime` com `Intl` e `America/Sao_Paulo`); substituir `hover-preview.tsx:194`, `lalamoveOrderEdit.ts:173, 180`, `hero-metric.tsx:80` e os 6 `toLocaleString()` sem locale (`AnalyticsDashboardPage.tsx:83`, `CacheStatusPage.tsx:147`, `MapHistoryPanel.tsx:104-105`, `sparkline.tsx:356`).
- **Evidência:** `rg -n "toFixed\\(2\\)|R\\$ \\$\\{|toLocaleString\\(\\)" src` retorna 0.

### 142 — [F] Dados simulados fora da produção
- [ ] `MapHUD.tsx:46-49` (bateria/sinal/temperatura), `DashboardHeroSection.tsx:29-38` (sparkline), `DriverProfileModal.tsx:42-43`: remover ou ligar a dado real (telemetria do motorista, série de pedidos por dia, avaliações); nunca `Math.random()` em componente de produção.
- **Evidência:** `rg -n "Math.random" src/components src/pages` retorna 0.

### 143 — [F] Tabelas responsivas
- [ ] Todo `<Table>` dentro de `div.overflow-x-auto` e, abaixo de `md`, versão em cards para `OrdersTable`, `DriversPage`, `WebhooksPage`, `AdminTelemetriaPage`.
- **Evidência:** 360 px sem scroll horizontal da página (e2e mobile, etapa 185).

### 144 — [F] Grids com breakpoints
- [ ] `rg -n "grid-cols-[3-9]" src | rg -v "md:|lg:"` → adicionar `grid-cols-1 md:grid-cols-N`.
- **Evidência:** comando retorna 0.

### 145 — [F] Diálogos que cabem em 360 px
- [ ] `NewOrderDialog`, `OrderDetailModal`, `MapsSettingsPage` dialogs: `max-h-[90dvh] overflow-y-auto`, `w-[calc(100vw-2rem)] sm:max-w-lg`; footer fixo.
- **Evidência:** screenshots mobile anexados à PR sem corte.

### 146 — [F] Alvos de toque ≥ 44 px
- [ ] Botões `size="sm"`/`icon` em telas touch com `min-h-11 min-w-11` (classe utilitária `touch-target`).
- **Evidência:** Lighthouse "tap targets" verde.

### 147 — [F] Dark mode sem cores fixas
- [ ] `rg -n "bg-white|text-black|#[0-9a-fA-F]{6}" src --glob '!**/*.test.*'` → trocar por tokens (`bg-background`, `text-foreground`, `hsl(var(--…))`).
- **Evidência:** comando retorna 0 fora de `tailwind.config.ts`/`index.css`.

### 148 — [F] Textos em inglês residuais
- [ ] `rg -n "\\\"(Loading|Save|Cancel|Delete|Error|Success|Submit)\\\"" src` e `lint:i18n`: traduzir para PT-BR.
- **Evidência:** `npm run lint:i18n` sem achados.

### 149 — [F] Estados vazios com ação
- [ ] `EmptyState` (`icon`, `title`, `description`, `action`) nas listas de pedidos, motoristas, alertas, aprovações, notificações.
- **Evidência:** lista vazia mostra "Nenhum pedido hoje · Criar pedido".

### 150 — [F] Paginação server-side nas listas
- [ ] Pedidos, motoristas, contatos, histórico: `range()` + `count`, controles de página e tamanho (25/50/100) persistidos na URL (`?page=`).
- **Evidência:** F5 mantém a página; Network traz 25 linhas.

### 151 — [F] Filtros na URL
- [ ] Filtros de status/período/motorista em `searchParams` (compartilháveis); `useSearchParamsState` hook.
- **Evidência:** copiar a URL reproduz o filtro.

### 152 — [F] Desfazer em ações de lote
- [ ] `BatchActionsToolbar`: toast com "Desfazer" (10 s) para arquivar/cancelar em lote; sem `confirm()` em loop.
- **Evidência:** desfazer restaura os pedidos (teste).

### 153 — [F] Importação CSV com validação
- [ ] `ImportCSVDialog.tsx`: limite 5 MB, tipo `text/csv`, schema zod por linha, pré-visualização com erros por linha antes de enviar.
- **Evidência:** CSV com telefone inválido mostra a linha com erro e não chama a edge.

### 154 — [F] Preferências por usuário no servidor
- [ ] `user_preferences` (tabela existente?) em vez de `localStorage` para tema/idioma/densidade; `lalamove-config.ts:10` e `bitrix-config.ts:10` deixam de guardar flags de "configurado" no cliente.
- **Evidência:** preferências seguem o usuário em outro navegador.

### 155 — [F] Textos truncados com `title`/tooltip
- [ ] `truncate` sempre acompanhado de `title` ou `Tooltip` (ex.: endereços em `OrdersTable`, nomes em `Sidebar`).
- **Evidência:** hover mostra o texto completo.

## Bloco 7 — SEO, PWA e configuração (156–165)

### 156 — [F] Ícones do PWA e assets faltantes
- [ ] Gerar `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `favicon-32x32.png`, `favicon-16x16.png`, `safari-pinned-tab.svg`, `og-image.png`, `browserconfig.xml`, `lalamove-icon.svg`, `bitrix24-icon.svg`, `whatsapp-icon.svg` (ou remover as referências em `index.html:15, 30, 40, 65-68` e `SystemHealthExpandedPage.tsx:226-240`).
- **Evidência:** `curl -I` em cada asset = 200; Chrome oferece "Instalar app".

### 157 — [F] `manifest.json` completo
- [ ] `icons` 192/512 + maskable, `theme_color` igual ao `index.html:8`, `start_url: /dashboard`, `display: standalone`, `shortcuts` (Pedidos, Mapa), `screenshots`.
- **Evidência:** Lighthouse PWA instalável.

### 158 — [F] Meta sociais e canonical corretos
- [ ] `index.html:23`: canonical para o domínio de produção (Vercel); `og:image`/`twitter:image` absolutas (`:30, 40`); remover JSON-LD/keywords redundantes com `noindex` (`:20, 82-104`); `robots.txt` só `Disallow: /`.
- **Evidência:** validador OG mostra a imagem; `robots.txt` com 2 linhas.

### 159 — [C] Headers de segurança e cache no Vercel 🔒
- [ ] `vercel.json`: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Cache-Control: immutable` para `/assets/*`, SPA fallback; CSP das etapas 6-7.
- **Evidência:** securityheaders.com nota A.

### 160 — [C] `.env.example` sincronizado
- [ ] Toda `import.meta.env.VITE_*` usada em `src` está no `.env.example` e vice-versa; script `scripts/ci/check-env-example.mjs`.
- **Evidência:** script no CI verde.

### 161 — [C] `package.json` saneado
- [ ] `name`/`version` reais; `@testing-library/*`, `jsdom`, `vitest` para `devDependencies` (`package.json:56-58, 74, 96`); `engines.node >= 22`; script `test` (etapa 181).
- **Evidência:** `npm ls --omit=dev` sem libs de teste.

### 162 — [C] `depcheck` sem dependências órfãs
- [ ] Remover ou usar `react-window` (etapa 90), `react-hook-form` (136), outras apontadas por `npx depcheck`.
- **Evidência:** `npx depcheck` sem "Unused dependencies".

### 163 — [C] `tsconfig` estrito de verdade
- [ ] `tsconfig.app.json:17-18`: `noUnusedLocals: true`, `noUnusedParameters: true`; `tsconfig.json:3`: `allowJs: false`; corrigir o que aparecer.
- **Evidência:** `npx tsc --noEmit -p tsconfig.app.json` verde com as flags.

### 164 — [C] ESLint sem `eslint-disable` espalhado
- [ ] Zerar os 60 `eslint-disable` (`ContactsPage.tsx:243-247`, `useGlobalSearch.ts:105, 146, 171`, `OrderTrackingMap.tsx:201-246`…) corrigindo a causa; `no-explicit-any: error`.
- **Evidência:** `rg -n "eslint-disable" src` retorna 0.

### 165 — [C] Sourcemaps protegidos e `define` de build
- [ ] `sourcemap: 'hidden'` + upload para monitoramento (ou desligado); `__APP_VERSION__`/`__BUILD_ID__` via `define` exibidos em `/system-health`.
- **Evidência:** `curl /assets/index-*.js.map` = 404; versão aparece na UI.

## Bloco 8 — Manutenibilidade e arquitetura (166–180)

### 166 — [F] Quebrar `NewOrderDialog` (1171 linhas)
- [ ] Extrair `useNewOrderForm` (estado/validação), `SenderStep`, `StopsStep`, `ScheduleStep`, `QuoteSummary`; o dialog fica < 250 linhas.
- **Evidência:** `wc -l src/components/orders/NewOrderDialog.tsx` < 250; e2e `new-order-autocomplete` verde.

### 167 — [F] Quebrar `OrderDetailModal` (1016 linhas)
- [ ] `OrderActions` (336 linhas em `:90`) para `orders/OrderActions.tsx`; abas `Resumo`, `Paradas`, `Rastreamento`, `POD` em arquivos próprios.
- **Evidência:** cada arquivo < 300 linhas.

### 168 — [F] Quebrar `LiveMap` (674 linhas, 14 `useState`/12 `useEffect`)
- [ ] `useLiveMapState` (reducer), `useMapLayers`, `useMapSelection`; o componente só compõe.
- **Evidência:** `LiveMap.tsx` < 200 linhas; testes de `components/map` verdes.

### 169 — [F] Quebrar `MapsSettingsPage` (963), `AdvancedReportsPage` (749), `AlertsPage` (601), `useAdvancedReports` (538)
- [ ] Um arquivo por seção/aba; hooks de dados separados da apresentação.
- **Evidência:** `find src -name "*.tsx" | xargs wc -l | awk '$1>500'` retorna 0.

### 170 — [F] Remover código morto
- [ ] `useApprovalActionsEnhanced.ts`, `useDriverEvaluations.ts`, `useOfflineStorage.ts`, `useGeo.ts` (+ testes), `SwipeableApprovalCard.tsx`, `debug/AuditReportGenerator.tsx`, `ui/chart.tsx`, `fab-variants.tsx`, `hero-metric.tsx`, `timeline-item.tsx`, `useAchievementsSystem.tsx` (se D-decisão).
- **Evidência:** `npx knip` (ou `ts-prune`) sem exports não usados; build verde.

### 171 — [F] Unificar funcionalidades duplicadas
- [ ] `SystemHealthPage` × `SystemHealthExpandedPage`, `CacheStatusPage` × `CacheMonitoringPage`, `HeatmapPage` × `reports/GeoHeatmap`, bloco "colar token" em `UAPISettingsPage` × `LalamoveSettingsPage`, `Sidebar` × `MobileSidebar` (role/contadores — etapas 52-53).
- **Evidência:** uma página por função; redirects das rotas antigas.

### 172 — [F] Linhas gigantes reformatadas
- [ ] Prettier com `printWidth 100` em `Bitrix24Page.tsx`, `AlertConfigCard.tsx`, `ApprovalsPage.tsx`, `Sidebar.tsx:159`, `useGlobalSearch.ts:84`; `format:check` no CI.
- **Evidência:** `rg -n ".{400,}" src --glob '*.tsx'` retorna 0.

### 173 — [F] Camada de serviços por domínio
- [ ] `src/services/orders.ts`, `drivers.ts`, `alerts.ts` concentram as chamadas Supabase/edges; hooks só orquestram React Query; páginas não chamam `supabase.from` direto (`rg -n "supabase.from" src/pages`).
- **Evidência:** comando retorna 0.

### 174 — [F] Chaves de query centralizadas
- [ ] `src/lib/queryKeys.ts` com factory por domínio (`orders.list(filters)`, `orders.detail(id)`); invalidações usam a factory.
- **Evidência:** `rg -n "queryKey: \\['" src` retorna 0 (todas via factory).

### 175 — [F] `ErrorBoundary` por rota com relatório
- [ ] Boundary em cada rota lazy, com botão "recarregar" e envio para `errorMonitoring` (etapa 8).
- **Evidência:** erro em uma página não derruba o layout.

### 176 — [F] Tipos únicos a partir de `types.ts`
- [ ] Remover interfaces duplicadas dos tipos gerados (`rg -n "interface Order\\b|type Order =" src`); `Tables<'lalamove_orders'>` como fonte.
- **Evidência:** 1 definição por entidade.

### 177 — [F] Estrutura de pastas por domínio
- [ ] `src/features/<orders|drivers|alerts|map|auth|settings>/{components,hooks,services}`; `src/components/ui` só primitivos; `docs/agentes/mapa-repo.md` atualizado.
- **Evidência:** `src/pages/*` só compõem features; mapa-repo descreve a árvore nova.

### 178 — [F] Comentários "MVP"/"simulated" eliminados
- [ ] `BatchActionsToolbar.tsx:36-37`, `MapHUD.tsx:45`: implementar ou remover o trecho.
- **Evidência:** `rg -in "in a real app|simulated|mock" src/components src/pages` retorna 0.

### 179 — [C] `knip`/`ts-prune` no CI 🔒
- [ ] Job que falha em export/arquivo/dependência não usada.
- **Evidência:** CI vermelha ao adicionar hook sem uso.

### 180 — [F] ADR das decisões de front
- [ ] `docs/adr/00XX-frontend-rbac-mfa.md`, `00XX-contratos-edge-v2.md`, `00XX-bundle-e-lazy.md` registrando D1–D8.
- **Evidência:** 3 ADRs linkados em `docs/ARCHITECTURE.md`.

## Bloco 9 — Testes e qualidade contínua (181–190)

### 181 — [C] Script `test` e cobertura reais
- [ ] `package.json`: `"test": "vitest run"`, `"test:coverage": "vitest run --coverage"`; job `test` do CI roda `npm test`; cobertura mínima inicial = atual (ratchet), subindo 5 pp por mês até os 70 % do `vitest.config.ts`.
- **Evidência:** `npm test` existe; job `test` publica o resumo de cobertura.

### 182 — [T] Testes de autenticação e RBAC
- [ ] `useAuth`, `useMFA`, `ProtectedRoute` (inclui bypass da etapa 3), `useLoginLockout`, `usePermissions`.
- **Evidência:** 5 arquivos em `src/hooks/__tests__/` e `src/components/auth/__tests__/`.

### 183 — [T] Testes de segurança do front
- [ ] `markerFactories` (escape XSS), `postgrest.ts` (escape de filtro), `html.ts` (`openExternal`), `edge-error.ts`.
- **Evidência:** 4 arquivos verdes; mutação (`npx stryker` opcional) ≥ 80 % nesses módulos.

### 184 — [T] Testes de páginas críticas
- [ ] `OrdersPage`, `DashboardRedesigned`, `ApprovalsPage`, `AlertsPage`, `LiveMapPage` com Testing Library + mock do client (estados loading/erro/vazio/dados).
- **Evidência:** 5 specs em `src/pages/__tests__/`.

### 185 — [T] Playwright com projeto mobile e sessões por papel
- [ ] `playwright.config.ts:31-33`: projetos `chromium` + `Pixel 7` + `iPhone 14`; `storageState` por papel gerado em `global-setup` (usuário de teste por papel no Supabase de CI); specs deixam de se pular (`rbac.e2e.ts:60, 74`, `mfa.e2e.ts:29, 38`, `livemap-route.e2e.ts:44`).
- **Evidência:** 0 `test.skip` por falta de sessão no relatório.

### 186 — [T] E2E dos fluxos de negócio
- [ ] Criar pedido (cotação → pedido), cancelar pedido, aprovar motorista, configurar alerta, importar CSV, buscar global, trocar tema/idioma.
- **Evidência:** 7 specs novos em `e2e/`, verdes no CI.

### 187 — [T] Testes de contrato front ↔ edge (consumer-driven)
- [ ] Fixtures em `src/contracts/fixtures/*.json` usadas pelo Vitest (front) e pelo Deno (`_shared/contract.test.ts`) — a mesma fixture inválida tem de falhar nos dois.
- **Evidência:** job `contract-tests` lê as fixtures do front.

### 188 — [T] Testes visuais das telas principais
- [ ] `toHaveScreenshot` em `/auth`, `/dashboard`, `/orders` (desktop + mobile, claro + escuro) com threshold 0.2 %.
- **Evidência:** baseline commitada; PR com regressão visual fica vermelha.

### 189 — [C] Pré-visualização por PR com checklist automático 🔒
- [ ] Comentário automático na PR com link do preview Vercel, Lighthouse (etapa 110), bundle (101), axe (134) e cobertura (181).
- **Evidência:** PR nova recebe o comentário em < 10 min.

### 190 — [D] Revisão mensal do plano
- [ ] Reunião de 30 min com o dono: etapas concluídas (`[x]`), achados novos (`inventario/`), decisões D1–D8 pendentes; atualizar este arquivo e `docs/planos/README.md`.
- **Evidência:** cabeçalho do plano com "Status em <data>: N/190".

---

## Status

| Data | Concluídas | Observações |
|---|---|---|
| 22/11/2026 | 0/190 | Plano criado. |
| 22/11/2026 | 12/190 | Bloco 1: **as 26 Edge Functions com entrada passaram a validar payload** (etapas 21–31 e 37). `job-worker` valida só o envelope de propósito (um 422 antes de `processJob` deixaria o job preso na fila) e `lalamove-api`/`lalamove-uapi` validam o input mesclado query+corpo, porque é assim que o gateway chama. 213 testes de contrato verdes. Faltam 32–36 e 38–45. |
| 22/11/2026 | 9/190 | Bloco 1 em andamento: etapas 23, 25–31 e 37 entregues (15 Edge Functions passaram a validar entrada com 422 único e versão v1/v2; 184 testes de contrato verdes). Faltam 21, 22, 24 (`lalamove-api`, `lalamove-uapi`, `job-worker`), 32–36 e 38–45. |
