# Plano UX de Navegação e Transição entre Telas — Lalamove V2 — 200 etapas (22/11/2026)

Base verificada: repo `adm01-debug/Lalamove_V2` @ `4ee7ef0` (`origin/main`, 22/11/2026). Leitura de `src/App.tsx`
(55 rotas), `src/components/layout/{AppLayout,Header,Sidebar,MobileSidebar,MobileBottomNav,sidebar-config}`,
`src/components/auth/ProtectedRoute.tsx`, `src/pages/{AuthPage,MFAVerifyPage,UnauthorizedPage,NotFound,OrdersPage,AlertsPage,MapsSettingsPage}`,
`src/components/ui/{back-button,smart-breadcrumbs,breadcrumb-config,page-loader,keyboard-shortcuts-help,floating-action-button}`,
`src/components/orders/{NewOrderDialog,OrderDetailModal}`, `src/hooks/{useAccessibility,usePrefetch}` e `e2e/`.
Stack: Vite + React 18.3, TS 5.8, Tailwind 3.4, shadcn/ui, **react-router-dom 7.18.6**, TanStack Query 5,
framer-motion 12.23, Playwright 1.56.

**Objetivo de negócio:** o operador deixa de se perder. Hoje a app tem **três botões "Voltar" com três
comportamentos diferentes** na mesma tela mobile, 30 de 55 rotas com o título "Dashboard" na aba do navegador,
breadcrumb que mostra "advanced" em vez de "Relatórios Avançados", scroll que nunca volta ao topo, modal de
pedido que o Voltar do navegador não fecha e um wizard de 1171 linhas que apaga tudo se o usuário escorregar
fora do diálogo. Cada uma dessas coisas custa tempo de operação em cima de um pedido real da Lalamove.
Fechado o plano: **uma** fonte de verdade de rotas, **um** componente de Voltar com regra por contexto,
breadcrumb e título vindos dessa fonte, transição só no conteúdo, modal endereçável por URL, wizard com
progresso e rascunho retomável, guarda de saída e telemetria para provar que melhorou.

**Fora de escopo:** segurança e contratos das edges (ver `docs/planos/PLANO_FRONTEND_190_ETAPAS.md`, blocos 0–1);
camada de mapas (planos Google/Mapbox); mensageria ao motorista (plano Zapp/SMS); redesenho visual das telas
(este plano mexe em cabeçalho, transição e navegação, não no conteúdo de cada página); i18n (decisão D8 do
PLANO_FRONTEND_190 é "só pt-BR").

**Dependências do PLANO_FRONTEND_190_ETAPAS.md** (não repetir aqui, só consumir):
etapa **46** (tirar `key={location.pathname}` do `<Routes>`), **54** (`matchPath` para rota aninhada na sidebar),
**55** (`state.from` no login), **56** (scroll no container certo), **48** (`src/lib/roles.ts`), **49–50**
(menu × rotas), **58** (404 lazy), **59** (`/unauthorized` com contexto), **47** (uma única busca Ctrl+K).
Onde uma etapa daqui depende de uma delas, está escrito na própria etapa.

Legenda: **[F]** front (`src/`) · **[T]** teste (Vitest/Playwright) · **[C]** CI/config/deploy · **[D]** decisão
ou ação do dono · 🔒 = PR fica aberta para o dono (custo, dado pessoal no navegador, DDL, CI). Cada etapa tem
`Descrição`, `Exemplo prático`, `Benefícios` e `Evidência` (o que prova que está pronta). Ao concluir, marque o
status no cabeçalho na mesma PR.

Boas práticas de referência usadas no plano:
- Material Design 3 — Navigation: https://m3.material.io/foundations/layout/understanding-layout/overview e https://m3.material.io/components/navigation-bar/guidelines
- Apple HIG — Navigation and search: https://developer.apple.com/design/human-interface-guidelines/navigation-and-search e Back button: https://developer.apple.com/design/human-interface-guidelines/navigation-bars
- NN/g — "The Back Button": https://www.nngroup.com/articles/back-button/ · "Breadcrumbs: 11 Design Guidelines": https://www.nngroup.com/articles/breadcrumbs/ · "Modal & Nonmodal Dialogs": https://www.nngroup.com/articles/modal-nonmodal-dialog/
- WCAG 2.2 — 2.4.1 Bypass Blocks, 2.4.3 Focus Order, 2.4.4 Link Purpose, 2.4.5 Multiple Ways, 2.4.7 Focus Visible, 2.4.8 Location, 2.4.11 Focus Not Obscured, 3.2.3 Consistent Navigation, 3.2.4 Consistent Identification, 3.2.6 Consistent Help: https://www.w3.org/WAI/WCAG22/quickref/
- React Router 7 — `useBlocker`: https://reactrouter.com/api/hooks/useBlocker · `ScrollRestoration`: https://reactrouter.com/api/components/ScrollRestoration · `matchPath`: https://reactrouter.com/api/utils/matchPath
- WAI-ARIA APG — Breadcrumb: https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/ · Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ · Tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- MDN — View Transitions API: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API · `BroadcastChannel`: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel

---

## 1. Estado real em 22/11/2026 (o ponto de partida)

| # | Achado | Impacto | Evidência |
|---|---|---|---|
| N1 | `key={location.pathname}` no `<Routes>` dentro de `AnimatePresence`: todo o `AppLayout` (sidebar, header, breadcrumb, contadores, canais realtime) remonta a cada clique de menu; a "transição" é a tela inteira piscando | ALTO | `src/App.tsx:137-138` `<AnimatePresence mode="wait"><Routes location={location} key={location.pathname}>` |
| N2 | Scroll para o topo rola a **janela**, mas o scroll real está no `<main>` com `overflow-y-auto` → trocar de tela mantém a posição de rolagem da tela anterior | ALTO | `src/App.tsx:118-120` `window.scrollTo(0, 0)` vs. `src/components/layout/AppLayout.tsx:320-322` `<main id="main-content" className={cn("flex-1 overflow-y-auto", …)}` |
| N3 | A animação do conteúdo é um `motion.div key={pathname}` **sem** `AnimatePresence` ao redor: o `exit` declarado nunca roda | MÉDIO | `AppLayout.tsx:327-336` (`exit={{ opacity: 0, y: -10 }}` sem pai `AnimatePresence`) |
| N4 | `BackButton` decide por `window.history.length > 2`, que conta toda a sessão da aba (inclusive outros sites) e nunca diminui: depois de 3 navegações e um F5, `navigate(-1)` pode jogar o usuário **fora** da app | ALTO | `src/components/ui/back-button.tsx:29-37` |
| N5 | Três implementações de "Voltar" com regras diferentes: histórico com heurística (`back-button.tsx:31`), histórico com outra heurística (`MobileBottomNav.tsx:109-115`, `history.length > 1`) e `window.history.back()` cru na tela de acesso negado — que pode voltar para a rota recusada e repetir o redirect (loop) | ALTO | `back-button.tsx:31`; `src/components/layout/MobileBottomNav.tsx:109-115`; `src/pages/UnauthorizedPage.tsx:43` |
| N6 | No mobile, duas setas idênticas na mesma tela com semântica oposta: a do `Header` volta no **histórico**, a do `MobileBreadcrumbs` navega para a **rota pai** | ALTO | `src/components/layout/Header.tsx:131` `<BackButton …/>` vs. `src/components/ui/smart-breadcrumbs.tsx:135-138` (`parentPath`, `aria-label="Voltar"`) |
| N7 | Terceiro "Voltar" dentro da gaveta mobile: botão que troca de rota com o `Sheet` aberto, deixando a gaveta sobre a tela nova | MÉDIO | `src/components/layout/MobileSidebar.tsx:233` `<BackButton variant="ghost" size="icon" className="md:hidden" />` |
| N8 | Breadcrumb montado por **segmento de URL**, não por configuração de rota: `/reports/advanced` vira "Home › Relatórios › advanced" porque `advanced` não existe em `routeLabels` | ALTO | `smart-breadcrumbs.tsx:49-53` (`items.push({ label: info.label, … })`), `src/components/ui/breadcrumb-config.ts:24-57` (sem `advanced`, `uapi`, `maps`, `lalamove`) |
| N9 | `routeLabels` cobre 33 segmentos para 55 rotas: `/contacts`, `/lalamove-operacoes`, `/lalamove-quota`, `/telemetria`, `/slo`, `/performance`, `/error-monitoring`, `/map-tools`, `/external-data`, `/preferences`, `/profile`, `/analytics`, `/settings/*` aparecem com o slug cru no breadcrumb | MÉDIO | `breadcrumb-config.ts:24-57` × `rg -o 'path="([^"]*)"' src/App.tsx` |
| N10 | `pageConfig` do cabeçalho tem 25 entradas para 55 rotas: nas outras 30 o `<h1>` do Header mostra **"Dashboard"** (default) estando o usuário em `/webhooks`, `/roles`, `/contacts`… | ALTO | `AppLayout.tsx:23-48` e `:55` `const config = pageConfig[location.pathname] \|\| { title: 'Dashboard' }` |
| N11 | **Seis** fontes de verdade sobre a mesma navegação, sem relação entre si: rotas+RBAC (`App.tsx`), menu desktop (`sidebar-config.ts`), menu mobile (`MobileBottomNav.moreMenuItems`), títulos (`AppLayout.pageConfig`), labels/seções do breadcrumb (`breadcrumb-config.ts`) e prefetch (`usePrefetch.pageImports`, 41 de 55 rotas) | ALTO | `App.tsx:140-204`; `sidebar-config.ts:27-100`; `MobileBottomNav.tsx:46-63`; `AppLayout.tsx:23-48`; `breadcrumb-config.ts:24-86`; `src/hooks/usePrefetch.ts:4-41` |
| N12 | 18 rotas sem nenhuma entrada de menu (só por link direto): `/analytics /cache-status /dashboard /job-queue /lalamove-quota /live-map /preferences /profile /rate-limiting /reports /settings/uapi /system-health /system-health-expanded` + as 5 públicas | MÉDIO | `comm -23` entre `path="…"` de `App.tsx` e `path: '…'` de `sidebar-config.ts` |
| N13 | Login descarta a rota de origem: o `ProtectedRoute` manda `state.from`, o `AuthPage` ignora e joga todo mundo no dashboard | ALTO | `src/components/auth/ProtectedRoute.tsx:46` `<Navigate to="/auth" state={{ from: location }} replace />` vs. `src/pages/AuthPage.tsx:60-62` `if (user) { return <Navigate to="/" replace />; }` |
| N14 | `document.title` é definido em **3** páginas de 55; nas outras a aba, o histórico do navegador e os favoritos mostram o mesmo texto para todas as telas | ALTO | `src/pages/LalamoveOperationsPage.tsx:15`, `src/pages/LalamoveQuotaPage.tsx:51-54`, `src/pages/ContactsPage.tsx:62`; `rg -n "document.title\|Helmet" src` = 5 linhas |
| N15 | Sem `ScrollRestoration` e sem tratamento de `POP`: voltar para uma lista longa recomeça do topo (quando o scroll funciona) e perde o item que o operador estava olhando | MÉDIO | `rg -n "ScrollRestoration" src` = 0; `App.tsx:118-120` |
| N16 | Item de menu só acende em igualdade exata de path: em `/reports/advanced`, `/settings/maps` e `/settings/uapi` nenhum item fica ativo — o usuário não sabe onde está | MÉDIO | `src/components/layout/Sidebar.tsx:56` `path === '/' ? … : location.pathname === path`; idem `MobileSidebar.tsx:210` |
| N17 | Nenhum modal vive na URL: o detalhe do pedido abre por `useState`, então Voltar do navegador não fecha, Esc fecha sem registrar e o link não é compartilhável — embora **filtros** já estejam na URL nas duas telas que usam `useSearchParams` | ALTO | `src/pages/OrdersPage.tsx:70,233,261` (`setSelectedOrder`/`setDetailModalOpen`) vs. `OrdersPage.tsx:29-31` e `src/pages/AlertsPage.tsx:106-109` (`searchParams.get(...)`) |
| N18 | `NewOrderDialog` é um wizard de 5 estados em 1171 linhas **sem** barra de progresso, **sem** rascunho e **sem** guarda de saída: fora dos estados `quoting`/`creating`, clicar no backdrop fecha e `resetForm()` apaga endereço, telefone, item e requisitos especiais | ALTO | `src/components/orders/NewOrderDialog.tsx:83` (`type Step = 'form' \| 'quoting' \| 'quoted' \| 'creating' \| 'done'`), `:542` (`onOpenChange` só protege 2 estados), `:506` (`resetForm`); `rg -n "localStorage" src/components/orders/NewOrderDialog.tsx` = 0 |
| N19 | Zero guarda de saída no repo inteiro: nenhum `useBlocker`, nenhum `beforeunload`, nenhum `isDirty` — qualquer F5, Voltar ou clique de menu em cima de um formulário perde o que foi digitado | ALTO | `rg -n "beforeunload\|isDirty\|useBlocker" src` = 0 resultados |
| N20 | Seis confirmações destrutivas em `window.confirm` nativo (bloqueia a aba, sem estilo, sem foco gerenciado, invisível para o design system) mesmo existindo `AlertDialog` no projeto | MÉDIO | `src/pages/ProfilePage.tsx:389`; `src/pages/alert-configurations/AlertConfigCard.tsx:138`; `src/components/dashboard/BatchActionsToolbar.tsx:48`; `src/components/orders/OrderDetailModal.tsx:312`; `src/components/map/MapSettingsPanel.tsx:83,92`; componente em `src/components/ui/alert-dialog.tsx` |
| N21 | Patch global de acessibilidade: a cada troca de rota o hook varre o DOM e injeta `aria-label="Botão de ação"` em **todo** botão sem nome — o leitor de tela passa a anunciar "Botão de ação" e o `axe` para de acusar os 44 botões sem nome real; as linhas 41-51 ainda reescrevem `aria-current` por `querySelectorAll('nav a')`, duplicando o que o `<Link>` já faz | ALTO | `src/hooks/useAccessibility.tsx:24-37` (`document.querySelectorAll('button:not([aria-label])')` … `'Botão de ação'`), `:41-51`; `Sidebar.tsx:88` já passa `aria-current={active ? 'page' : undefined}` |
| N22 | Trocar de rota não move o foco nem anuncia nada: `useAnnounce` só é chamado no atalho `G`+tecla; o `<main tabIndex={-1}>` só recebe foco por Skip Link; quem usa teclado continua com o foco no item de menu e quem usa leitor de tela não ouve que a tela mudou | ALTO | `AppLayout.tsx:176` (único `announce` de navegação), `AppLayout.tsx:320-325`, `useAccessibility.tsx:91-111` |
| N23 | O guia de atalhos promete 10 atalhos que não existem (`r`, `Ctrl+Shift+T`, `Ctrl+A`, `Ctrl+E`, `f`, `j/k`, `a/x`, `Ctrl+/`) e `Ctrl+K` está registrado em dois lugares, abrindo duas buscas sobrepostas | MÉDIO | `src/components/ui/keyboard-shortcuts-help.tsx:27-52`; `AppLayout.tsx:211` e `src/hooks/useCommandPaletteSearch.ts:112` |
| N24 | 404 em inglês, fora do layout, sem Voltar e com `<a href="/">` (recarrega a app inteira) | MÉDIO | `src/pages/NotFound.tsx:12-21` ("Oops! Page not found", "Return to Home") |
| N25 | `prefers-reduced-motion` existe só no CSS e numa preferência de tela; as transições de rota e de breadcrumb em framer-motion não consultam nada | MÉDIO | `rg -n "prefers-reduced-motion\|useReducedMotion" src` → `src/index.css`, `src/pages/UserPreferencesPage.tsx`; animações em `AppLayout.tsx:329-332`, `smart-breadcrumbs.tsx:66,74`, `back-button.tsx:44-47` |
| N26 | Nenhum gesto de voltar no mobile; o único componente de swipe do projeto (`SwipeableApprovalCard`, 500 linhas) é código morto | BAIXO | `rg -n "SwipeableApprovalCard" src` só o próprio arquivo (A24 do PLANO_FRONTEND_190) |
| N27 | FAB mobile fixo que sempre vai para `/map`, sobreposto ao bottom nav e sem relação com a tela atual (no desktop o FAB é contextual, no mobile não) | MÉDIO | `MobileBottomNav.tsx:298-319` (`onClick={() => navigate('/map')}`) vs. `AppLayout.tsx:125-158` (`getContextualActions`) |
| N28 | Sem nenhuma medição de navegação: zero `trackEvent`, zero `BroadcastChannel`, e as 7 specs e2e não exercitam Voltar, breadcrumb, modal por URL nem mobile | ALTO | `rg -n "BroadcastChannel" src` = 0; `ls e2e/` = 7 specs, nenhuma de navegação |

## 2. Princípios de navegação (as regras que o resto do plano aplica)

**2.1 Hierarquia × histórico.** São duas coisas diferentes e a app precisa das duas:
- **Hierarquia** = onde a tela mora na estrutura (`/settings` › `/settings/maps`). É o que o **breadcrumb** mostra
  e é um destino **previsível**: sempre o mesmo, independente de como o usuário chegou (NN/g, breadcrumbs).
- **Histórico** = por onde o usuário passou. É o que o **Voltar do navegador** e o gesto de swipe fazem. Não é
  previsível pelo desenho da tela.
- Regra: **o botão da app não disputa com o navegador**. O botão dentro da app é *"Voltar para Pedidos"* (hierarquia,
  com o nome do destino escrito), o Voltar do navegador continua sendo histórico. Nunca uma seta muda chamada
  "Voltar" que às vezes é uma coisa e às vezes a outra (hoje são as duas, N6).

**2.2 Regras do Voltar por contexto.**

| Contexto | O que o Voltar da app faz | Fallback |
|---|---|---|
| Tela filha (`/settings/maps`, `/reports/advanced`) | navega para a **rota pai** da config, com rótulo ("Configurações") | — |
| Tela de 1º nível (`/orders`, `/alerts`) | **não mostra** botão de Voltar (o destino seria o dashboard, que já está no menu e no breadcrumb) | — |
| Modal/Sheet aberto | **fecha o modal primeiro**; o segundo Voltar sai da tela | — |
| Wizard (NewOrderDialog) | volta **uma etapa**; na primeira etapa pede confirmação se houver dado digitado | descarta ou salva rascunho |
| Deep-link / aba nova (sem histórico interno) | navega para a rota pai (nunca `navigate(-1)`, que sairia da app) | dashboard |
| Pós-login / pós-MFA | vai para `state.from` com `replace: true`, para que Voltar não caia na tela de login | dashboard |
| 404 | Voltar = histórico (`navigate(-1)`), porque não existe pai; mais um link para o dashboard | dashboard |
| `/unauthorized` | **nunca** `history.back()` (voltaria para a rota negada e redirecionaria de novo); vai para a última rota **permitida** do histórico próprio | dashboard |
| Busca global / filtro | o termo e os filtros estão na URL, então Voltar desfaz o filtro, não sai da tela | — |

**2.3 Como evitar loops.** Toda navegação que substitui a tela atual por decisão do sistema (login, MFA,
`/unauthorized`, redirect de alias `/map` → `/live-map`) usa `replace: true`, para não empilhar entrada no
histórico. O histórico próprio (`useNavigationHistory`) guarda **só rotas permitidas e visitadas de fato**, e
é dele que o Voltar tira o destino quando a rota pai não existe. Nenhum destino de Voltar pode ser a rota atual.

**2.4 Mobile × tablet × desktop.**
- **Desktop (≥1024px):** sidebar sempre visível = navegação lateral é o mapa; Voltar fica no cabeçalho, à
  esquerda do `<h1>`, só em telas filhas; breadcrumb completo abaixo do cabeçalho.
- **Tablet (768–1023px):** sidebar recolhida (ícones); breadcrumb compacto (pai + atual); Voltar no cabeçalho.
- **Mobile (<768px):** sem sidebar fixa; Voltar na primeira posição do cabeçalho (zona do polegar não alcança
  o topo, mas é onde o iOS/Android colocam — Apple HIG); bottom nav com 4 destinos fixos + "Mais"; **o slot
  "Voltar" sai do bottom nav** (hoje ele troca de identidade conforme a rota, violando WCAG 3.2.4).
- Em todos: a posição e o rótulo do Voltar não mudam entre telas (WCAG 3.2.3 Consistent Navigation).

**2.5 Swipe.** Swipe-back da borda esquerda só no mobile, apenas quando a tela não tem conteúdo com scroll
horizontal (mapa, tabela larga, carrossel), com `touch-action` declarado e desligado por `prefers-reduced-motion`.
Decisão U7.

## 3. Decisões do dono (U1–U10)

| # | Decisão | Recomendação | Por quê |
|---|---|---|---|
| U1 | O Voltar da app segue hierarquia (rota pai) ou histórico? | **Hierarquia, com rótulo do destino** ("Voltar para Configurações"); histórico fica com o navegador e com o swipe | Destino previsível e nomeado atende NN/g e WCAG 2.4.4; hoje a mesma seta faz as duas coisas em telas diferentes (N4, N6) |
| U2 | Quantos botões de Voltar na tela mobile? | **Um só**, no cabeçalho: remover o do `MobileSidebar` (N7) e o do `MobileBreadcrumbs` (N6), e tirar o slot "Voltar" do bottom nav (N5) | Três controles com três regras é a causa raiz da confusão; o bottom nav deve ter destinos fixos (M3) |
| U3 | Detalhe de pedido/motorista passa a viver na URL (`?pedido=LAL-123`)? | **Sim**, para `OrderDetailModal`, `DriverProfileModal` e `NewOrderDialog` (`?novo=1`) | Link compartilhável no Bitrix/WhatsApp, Voltar do navegador fecha, F5 não perde o contexto (N17) |
| U4 | Rascunho do wizard de pedido guardado no navegador? 🔒 | **Sim**, `localStorage` por usuário, TTL 24 h, apagado ao criar o pedido; o rascunho contém **nome, telefone e endereço do cliente** — por isso é decisão do dono (LGPD) | 1171 linhas de formulário perdidas num clique fora do diálogo (N18); se o dono recusar, usar `sessionStorage` (morre com a aba) |
| U5 | Guarda de saída (aviso "sair sem salvar?") em quais telas? | **NewOrderDialog, RiskRulesPage, AlertConfigurationsPage, MapsSettingsPage, IPWhitelist**; nas demais não (atrito desnecessário) | `useBlocker` do react-router 7 + `beforeunload`; hoje não existe nada (N19) |
| U6 | As 18 rotas sem menu: entram no menu ou ficam "acesso por link"? | **13 entram** (ver etapa 50 do PLANO_FRONTEND_190) e 5 públicas ficam fora do breadcrumb; `/map` passa a redirect de `/live-map` | WCAG 2.4.5 Multiple Ways; hoje o operador descobre tela por sorte (N12) |
| U7 | Swipe-back no mobile? | **Sim**, só na borda esquerda e desligado em `/map`, `/heatmap` e tabelas largas | Esperado no celular; o risco é conflitar com o pan do mapa, por isso a exceção explícita |
| U8 | Telemetria de navegação: tabela no Supabase ou provedor externo? 🔒 | **Tabela própria** `ui_navigation_events` com retenção de 90 dias e `pg_cron` de limpeza; sem provedor pago | Custo zero adicional e dado fica no banco oficial; provedor externo é custo recorrente e dado de operação fora |
| U9 | Transição de rota: manter framer-motion ou CSS? | **CSS/View Transitions** no `Outlet`, com fallback sem animação; framer-motion fica só nos componentes que já o usam | `framer-motion` está em 90 arquivos (A15 do PLANO_FRONTEND_190); a transição de rota não precisa de JS |
| U10 | Remover o patch global de `aria-label` (`useAccessibility.tsx:24-37`)? | **Remover**, junto com a etapa que nomeia os botões de verdade (bloco 5) | Enquanto o patch existe, o `axe` passa e os 44 botões sem nome ficam escondidos; o leitor de tela diz "Botão de ação" (N21) |

## 4. Priorização impacto × esforço

| Faixa | Etapas | O que entrega | Esforço |
|---|---|---|---|
| **1. Alto impacto, baixo esforço** | 1–20, 21–30, 59–66 | fonte única de rotas, `document.title`, `pageConfig` completo, Voltar único com fallback correto, scroll e foco na troca de rota | 1 semana, sem migração |
| **2. Alto impacto, esforço médio** | 31–58, 67–96 | regra do Voltar por contexto, breadcrumb pela config, barra de progresso de navegação, skeleton por rota, `PageHeader` único | 2 semanas |
| **3. Impacto alto, esforço alto** | 117–164 | wizard com progresso e rascunho, guarda de saída, modais na URL, multi-aba | 2 semanas |
| **4. Acessibilidade e medição** | 97–116, 165–200 | foco/anúncio/swipe/reduced-motion, telemetria, KPIs, A/B, e2e de navegação | 2 semanas, contínuo |

Ordem recomendada: **Bloco 0 → 1 → 3 → 5 → 2 → 4 → 6 → 7 → 8 → 9**. O bloco 0 é pré-requisito de quase tudo:
enquanto houver seis fontes de verdade (N11), qualquer correção de breadcrumb ou de título volta a divergir.

---

## Bloco 0 — Fonte única de verdade das rotas (1–20)

### 1 — [F] Criar `src/routes/route-config.ts` como única fonte de verdade
- Descrição: um array tipado `ROUTES` com, por rota: `path`, `label`, `subtitle`, `icon`, `parent`, `section`,
  `requiredRole`, `requireMFA`, `menu` (`'sidebar' | 'more' | 'link-only'`), `loader` (import dinâmico) e
  `badgeType`. Substitui, nas etapas 2–8, `pageConfig`, `routeLabels`, `routeToSection`, `pageImports`,
  `moreMenuItems` e `menuCategories`.
- Exemplo prático: `export const ROUTES = [{ path: '/settings/maps', label: 'Provedores de mapa', parent: '/settings', section: 'Integrações', requiredRole: 'manager', requireMFA: true, menu: 'sidebar', loader: () => import('@/pages/MapsSettingsPage') }, …] as const satisfies readonly RouteDef[];`
- Benefícios: o título do cabeçalho, o breadcrumb, o destino do Voltar, o item de menu e o prefetch param de
  divergir (N10, N11, N9); qualquer rota nova entra em um lugar só.
- Evidência: `rg -c "" src/routes/route-config.ts` ≥ 55 entradas; `rg -n "path=\"" src/App.tsx | wc -l` igual ao
  número de entradas com `path` no arquivo novo.

### 2 — [F] Derivar as rotas do `App.tsx` da config
- Descrição: `App.tsx` passa a mapear `ROUTES` em `<Route>` (com `ProtectedRoute` montado a partir de
  `requiredRole`/`requireMFA`), em vez de 55 blocos JSX escritos à mão.
- Exemplo prático: `{ROUTES.filter(r => r.layout === 'app').map(r => <Route key={r.path} path={r.path} element={<Guarded route={r}><SuspenseWrapper><r.Component /></SuspenseWrapper></Guarded>} />)}` no lugar de `src/App.tsx:149-204`.
- Benefícios: impossível criar rota sem RBAC declarado (A23/N12); o teste de RBAC da etapa 60 do
  PLANO_FRONTEND_190 passa a ler a config em vez de reconstruir a lista à mão.
- Evidência: `src/App.tsx` sem nenhuma string de path literal exceto as 5 públicas; `npx tsc --noEmit -p tsconfig.app.json` limpo.

### 3 — [F] Cabeçalho lê o título da config
- Descrição: trocar `pageConfig` por lookup em `ROUTES` com `matchPath`, para que rotas filhas e com parâmetro
  também tenham título.
- Exemplo prático: em `AppLayout.tsx:55`, `const route = matchRoute(location.pathname); const config = { title: route?.label ?? 'Lalamove', subtitle: route?.subtitle };` — hoje `pageConfig[location.pathname] || { title: 'Dashboard' }`.
- Benefícios: acaba o `<h1>` dizendo "Dashboard" em 30 rotas (N10) — o usuário sempre sabe onde está (WCAG 2.4.8).
- Evidência: teste que percorre todas as rotas da config e falha se alguma cair no default; visual: `/webhooks` mostra "Webhooks".

### 4 — [F] Remover `pageConfig` do `AppLayout`
- Descrição: deletar o objeto `pageConfig` (`AppLayout.tsx:23-48`) e o uso dele no anúncio do atalho `G`
  (`AppLayout.tsx:176`), que passa a usar o `label` da config.
- Exemplo prático: `announce(\`Navegando para ${matchRoute(target)?.label ?? target}\`)`.
- Benefícios: menos 26 linhas duplicadas; anúncio correto nas rotas que não estavam no `pageConfig`.
- Evidência: `rg -n "pageConfig" src` = 0.

### 5 — [F] `breadcrumb-config.ts` passa a ser derivado, não escrito
- Descrição: `routeLabels` e `routeToSection` deixam de ser mapas manuais e passam a ser gerados de `ROUTES`;
  o arquivo mantém apenas os helpers de recentes/favoritos.
- Exemplo prático: `export const routeLabels = Object.fromEntries(ROUTES.map(r => [r.path, { label: r.label, description: r.subtitle ?? '' }]));` substituindo `breadcrumb-config.ts:24-57` e `:71-86`.
- Benefícios: `/reports/advanced` e `/settings/maps` param de aparecer como "advanced" e "maps" (N8, N9).
- Evidência: `rg -n "\"orders\": \{ label" src/components/ui/breadcrumb-config.ts` = 0; breadcrumb de `/reports/advanced` = "Home › Relatórios › Relatórios Avançados".

### 6 — [F] Menu desktop derivado da config
- Descrição: `sidebar-config.ts` mantém só as **categorias** (ordem, ícone, `defaultOpen`); os itens vêm de
  `ROUTES.filter(r => r.menu === 'sidebar')` agrupados por `section`.
- Exemplo prático: `export const menuCategories = SECTIONS.map(s => ({ ...s, items: ROUTES.filter(r => r.menu === 'sidebar' && r.section === s.id) }));` no lugar de `sidebar-config.ts:27-100`.
- Benefícios: fecha de vez o desalinhamento menu × rota (etapa 49 do PLANO_FRONTEND_190) por construção, não por teste.
- Evidência: teste `route-config.test.ts`: todo item de menu tem rota e todo `requiredRole` do menu é igual ao da rota.

### 7 — [F] Menu mobile ("Mais") derivado da config
- Descrição: eliminar `moreMenuItems` e montar a gaveta "Mais" com `ROUTES.filter(r => r.menu !== 'link-only')`
  agrupado por `section`, respeitando o papel do usuário.
- Exemplo prático: substituir `MobileBottomNav.tsx:46-63` (11 itens fixos, sem RBAC) por `useMenuForRole()`.
- Benefícios: o celular deixa de esconder 40 telas; operador não vê mais item que leva a `/unauthorized`.
- Evidência: no mobile, `/lalamove-operacoes` e `/contacts` aparecem em "Mais"; usuário `viewer` não vê "Webhooks".

### 8 — [F] Prefetch derivado da config
- Descrição: `usePrefetch` passa a usar o `loader` da `ROUTES` em vez do mapa paralelo de 41 imports.
- Exemplo prático: `const pageImports = Object.fromEntries(ROUTES.map(r => [r.path, r.loader]));` no lugar de `src/hooks/usePrefetch.ts:4-41`.
- Benefícios: as 14 rotas que hoje não têm prefetch (inclusive `/contacts`, `/telemetria`, `/slo`) passam a abrir
  sem espera; um arquivo a menos para esquecer de atualizar.
- Evidência: `rg -n "import('@/pages" src/hooks/usePrefetch.ts` = 0; hover no item de menu de `/slo` dispara request do chunk (aba Network).

### 9 — [F] `parent` explícito em toda rota filha
- Descrição: preencher `parent` para as rotas que têm pai lógico mesmo sem path aninhado:
  `/reports/advanced`→`/reports`, `/settings/{maps,uapi,lalamove}`→`/settings`, `/alert-configurations`→`/alerts`,
  `/notification-history`→`/alerts`, `/evaluations`→`/drivers`, `/delivery-metrics`→`/metrics`,
  `/system-health-expanded`→`/system-health`, `/cache-monitoring`→`/cache-status`, `/heatmap`→`/map`,
  `/lalamove-quota`→`/settings/lalamove`.
- Exemplo prático: `{ path: '/alert-configurations', parent: '/alerts', … }` — hoje `/alert-configurations` é
  irmã de `/alerts` no breadcrumb porque o path não é aninhado (`breadcrumb-config.ts:49-53`).
- Benefícios: o Voltar hierárquico (bloco 1) e o breadcrumb (bloco 2) passam a ter destino para 100% das telas.
- Evidência: teste: toda rota com `menu !== 'sidebar'` tem `parent` definido ou é raiz; nenhum `parent` aponta
  para rota inexistente; nenhum ciclo.

### 10 — [F] Validar a config em tempo de teste
- Descrição: teste unitário que falha se: path duplicado, `parent` inexistente, ciclo de `parent`, `label` vazio,
  `requiredRole` fora de `ROLE_ORDER` (etapa 48 do PLANO_FRONTEND_190), rota sem `loader`, ou `section`
  desconhecida.
- Exemplo prático: `src/routes/__tests__/route-config.test.ts` com `it('nenhum parent cria ciclo', …)` usando busca em profundidade.
- Benefícios: a fonte única não apodrece; qualquer PR que acrescente rota mal configurada fica vermelha no CI
  (`lint-and-typecheck` + `test`).
- Evidência: `npx vitest run src/routes/__tests__/route-config.test.ts` verde; introduzir `parent: '/naoexiste'` deixa vermelho.

### 11 — [F] `useRouteMeta()` — hook único de leitura
- Descrição: hook que devolve `{ route, parent, ancestors, title, section, isRoot }` para a rota atual, com
  `matchPath({ end: false })` para rotas aninhadas e parâmetros.
- Exemplo prático: `const { route, parent, isRoot } = useRouteMeta();` consumido por `Header`, `BackButton`,
  `SmartBreadcrumbs`, `MobileBottomNav` e pelo título do documento.
- Benefícios: cinco componentes param de recalcular a mesma coisa de cinco maneiras (`smart-breadcrumbs.tsx:32-37`,
  `AppLayout.tsx:55`, `Sidebar.tsx:56`, `MobileSidebar.tsx:210`, `MobileBottomNav.tsx:99-102`).
- Evidência: `rg -n "pathname.split" src` só dentro de `useRouteMeta`.

### 12 — [F] `useNavigationHistory()` — histórico próprio da app
- Descrição: contexto que registra as rotas visitadas **dentro** da app (path + título + timestamp, máx. 20),
  ignorando `replace`, rotas públicas e a rota atual; expõe `previous`, `canGoBack`, `popTo(path)` e `stack`.
- Exemplo prático: `src/hooks/useNavigationHistory.tsx` montado no `AppLayout`; `useEffect` em
  `location.key` com `if (navigationType !== 'POP') push(...)` via `useNavigationType()`.
- Benefícios: substitui as duas heurísticas de `window.history.length` (N4, N5), que não sabem se a entrada
  anterior é da app ou de outro site — a causa de "Voltar" jogar o usuário fora do sistema.
- Evidência: teste: abrir `/orders` em aba nova → `canGoBack === false`; navegar `/orders`→`/drivers` →
  `previous.path === '/orders'`; F5 não infla a pilha.

### 13 — [F] Persistir o histórico próprio em `sessionStorage`
- Descrição: a pilha sobrevive ao F5 e ao retry de chunk (etapa 57 do PLANO_FRONTEND_190), mas morre com a aba.
- Exemplo prático: `sessionStorage.setItem('nav-stack', JSON.stringify(stack.slice(-20)))` com try/catch e
  validação do JSON ao ler (nunca confiar no conteúdo).
- Benefícios: depois de um recarregamento numa tela profunda o Voltar continua certo, que é exatamente o caso em
  que a heurística atual erra (N4).
- Evidência: navegar 3 telas, F5, Voltar → volta para a tela anterior, não para o dashboard.

### 14 — [F] `replace: true` em todo redirect de sistema
- Descrição: auditar e corrigir os redirects que hoje empilham histórico: alias `/map` ↔ `/live-map`
  (`App.tsx:183-184`), `AppLayout.tsx:284` (`/auth`), `ProtectedRoute.tsx:46,51,61,67` e `AuthPage.tsx:61`.
- Exemplo prático: `/map` deixa de ser rota duplicada e passa a `<Route path="/map" element={<Navigate to="/live-map" replace />} />`.
- Benefícios: sem `replace`, Voltar cai na tela que o sistema acabou de recusar e o guard redireciona de novo —
  o loop descrito em N5.
- Evidência: e2e: deslogado abre `/orders` → login → Voltar **não** volta para `/auth`; `/map` → Voltar sai da app, não alterna entre aliases.

### 15 — [F] Login respeita `state.from` (consome a etapa 55 do PLANO_FRONTEND_190)
- Descrição: `AuthPage.tsx:60-62` passa a `<Navigate to={(location.state as any)?.from?.pathname ?? '/'} replace />`,
  como `MFAVerifyPage.tsx:7` já faz; validar que o destino é uma rota conhecida da config (nunca URL externa).
- Exemplo prático: `const from = safeInternalPath((location.state as { from?: Location })?.from?.pathname) ?? '/';`
- Benefícios: quem clica num link de pedido no Bitrix e precisa logar cai no pedido, não no dashboard (N13).
- Evidência: e2e `navegacao.e2e.ts`: `/webhooks` deslogado → login → URL final `/webhooks`.

### 16 — [F] MFA preserva o destino também quando falha e volta
- Descrição: `MFAVerifyPage.tsx:18` (`onCancel`) hoje manda para `/auth`; passar a voltar para a rota anterior
  permitida (histórico próprio) e manter `state.from` para a próxima tentativa.
- Exemplo prático: `onCancel={() => navigate(previous?.path ?? '/', { replace: true })}`.
- Benefícios: cancelar a verificação não derruba a sessão nem perde o destino; evita o ciclo
  `/webhooks` → `/mfa-verify` → `/auth` → dashboard.
- Evidência: manager sem TOTP em `/webhooks` → cancela → cai em `/`, sessão viva, e abrir `/webhooks` de novo
  volta a pedir MFA (não loop).

### 17 — [F] `/unauthorized` sem `history.back()`
- Descrição: trocar `window.history.back()` (`UnauthorizedPage.tsx:43`) por "Voltar para <última rota
  permitida>" vindo do `useNavigationHistory`, com fallback no dashboard; combinar com a etapa 59 do
  PLANO_FRONTEND_190 (mostrar rota e papel exigidos).
- Exemplo prático: `const target = lastAllowed() ?? '/'; <Button onClick={() => navigate(target, { replace: true })}>Voltar para {titleOf(target)}</Button>`.
- Benefícios: hoje o botão devolve o usuário à rota recusada, que redireciona para `/unauthorized` outra vez (N5).
- Evidência: e2e: `viewer` abre `/roles` → `/unauthorized` → Voltar vai para a última tela permitida, e a URL
  não volta a `/unauthorized`.

### 18 — [F] 404 dentro do layout, em pt-BR e com saída
- Descrição: reescrever `NotFound.tsx` com `PageHeader`, texto em português, `navigate(-1)` (único caso em que o
  botão da app usa histórico — não existe pai), link `<Link to="/">` em vez de `<a href="/">`, e sugestão das 3
  rotas mais parecidas com o path digitado. Complementa a etapa 58 do PLANO_FRONTEND_190 (tornar lazy).
- Exemplo prático: sugestões por distância de Levenshtein sobre `ROUTES.map(r => r.path)` — `/pedido` sugere `/orders` (Pedidos).
- Benefícios: `<a href>` recarrega a app toda (perde cache do React Query e 1,5 s de boot); hoje a tela está em
  inglês numa app pt-BR (N24).
- Evidência: abrir `/pedidoz` mostra "Página não encontrada", sugere "Pedidos" e o Voltar funciona; Network sem
  request de documento ao clicar em "Ir para o Dashboard".

### 19 — [F] Alias de rota some da navegação
- Descrição: `/live-map` é a rota canônica, `/map` é redirect (etapa 14); `/dashboard` é redirect para `/`.
  A config marca os aliases com `alias: true` para que não apareçam em menu, breadcrumb nem telemetria.
- Exemplo prático: `{ path: '/dashboard', redirectTo: '/', alias: true }`.
- Benefícios: hoje o mesmo mapa tem dois paths com dois breadcrumbs ("Mapa ao Vivo" em ambos) e duas entradas em
  "páginas recentes"; métricas de uso ficam divididas.
- Evidência: `getRecentPages()` não registra `/map` nem `/dashboard`; `rg -n "'/live-map'" src` só na config e no redirect.

### 20 — [T] Teste de inventário: 55 rotas × 5 consumidores
- Descrição: teste de tabela que, para cada rota da config, verifica que existem título, breadcrumb resolvível,
  `parent` ou raiz, item de menu ou `link-only` declarado, e `loader`.
- Exemplo prático: `describe.each(ROUTES)('$path', (r) => { it('tem título', …); it('resolve breadcrumb', …); })`.
- Benefícios: transforma o inventário manual deste plano (N9–N12) em verificação automática; CI barra regressão.
- Evidência: `npx vitest run src/routes` verde com 55 casos; remover o `label` de uma rota deixa vermelho.

## Bloco 1 — Botão "Voltar" global (21–40)

### 21 — [F][D] Reescrever `BackButton` com destino hierárquico (U1)
- Descrição: o componente passa a receber o destino de `useRouteMeta().parent`; se não houver pai, usa
  `useNavigationHistory().previous`; se não houver nenhum dos dois, não renderiza. Nunca mais `navigate(-1)` cego.
- Exemplo prático: substituir `back-button.tsx:29-37` por
  `const target = parent ?? previous?.path; const handleBack = () => target && navigate(target, { state: { via: 'back-button' } });`
- Benefícios: acaba o risco de sair da app (N4) e o destino passa a ser previsível e nomeável.
- Evidência: `rg -n "history.length" src` = 0; abrir `/settings/maps` em aba nova → Voltar vai para `/settings`.

### 22 — [F] Rótulo com o nome do destino
- Descrição: o botão passa a mostrar "Voltar para <destino>" no desktop (texto) e seta + `aria-label` completo no
  mobile; o rótulo vem do `label` da config, nunca hardcoded.
- Exemplo prático: `aria-label={\`Voltar para ${titleOf(target)}\`}` — hoje `back-button.tsx:62` diz sempre
  "Voltar para a página anterior", mesmo quando o destino é conhecido.
- Benefícios: WCAG 2.4.4 (Link Purpose) e NN/g: o usuário sabe para onde vai antes de clicar.
- Evidência: em `/settings/maps` o `aria-label` é "Voltar para Configurações" (teste com `getByLabelText`).

### 23 — [F] Visibilidade por contexto
- Descrição: regra única — mostrar o botão apenas quando `parent` existe **ou** `canGoBack` é verdadeiro e a rota
  não é raiz; esconder em `/`, `/dashboard` e nas rotas públicas.
- Exemplo prático: trocar `back-button.tsx:27` (`isRootPath` comparando duas strings) por `const show = !isRoot && Boolean(parent ?? previous)`.
- Benefícios: hoje o botão aparece em `/orders` (1º nível) levando ao dashboard, que já está no menu, no
  breadcrumb e no bottom nav — ruído em 100% das telas de lista.
- Evidência: `/orders` não tem botão de Voltar; `/reports/advanced` tem.

### 24 — [F] Posição fixa por dispositivo
- Descrição: desktop/tablet — primeiro elemento do `PageHeader`, à esquerda do `<h1>`, altura 40px; mobile —
  primeira posição do cabeçalho, antes do botão de menu, área de toque mínima 44×44px.
- Exemplo prático: `Header.tsx:116-131` passa a `<div className="flex items-center gap-2"><BackButton /><MenuButton className="md:hidden" /><PageTitle /></div>` (hoje o menu vem antes do Voltar no mobile).
- Benefícios: WCAG 3.2.3 — o controle fica no mesmo lugar em todas as telas; hoje a posição muda entre
  cabeçalho, gaveta e bottom nav (N5–N7).
- Evidência: screenshot Playwright em 390px, 768px e 1440px com o botão na mesma coordenada relativa em 5 rotas.

### 25 — [F] Remover o Voltar da gaveta mobile (U2)
- Descrição: apagar `<BackButton>` de dentro do `SheetHeader` do `MobileSidebar` (`:233`).
- Exemplo prático: o header da gaveta fica só com logo + título; o fechamento da gaveta é o X/overlay do `Sheet`.
- Benefícios: hoje esse botão troca de rota **sem fechar** a gaveta, deixando o menu sobre a tela nova (N7).
- Evidência: `rg -n "BackButton" src/components/layout/MobileSidebar.tsx` = 0; e2e mobile: abrir gaveta → navegar → gaveta fechada.

### 26 — [F] Remover o Voltar do `MobileBreadcrumbs` (U2)
- Descrição: `smart-breadcrumbs.tsx:138` perde o botão; o componente fica só com seção + título da tela atual
  (o Voltar hierárquico já está no cabeçalho).
- Exemplo prático: `<motion.nav …>{sectionInfo && <Badge …/>}<span className="truncate">{currentPage}</span></motion.nav>`.
- Benefícios: elimina duas setas idênticas com semânticas diferentes na mesma tela (N6).
- Evidência: em 390px, `page.getByLabel('Voltar', { exact: false })` encontra exatamente 1 elemento.

### 27 — [F] Tirar o slot "Voltar" do bottom nav (U2)
- Descrição: o primeiro slot do bottom nav deixa de alternar entre "Home" e "Voltar" (`MobileBottomNav.tsx:86-97`)
  e passa a ser sempre "Início"; a lógica `#back` (`:109-115`) é removida.
- Exemplo prático: `{ id: 'dashboard', label: 'Início', icon: LayoutDashboard, path: '/' }` fixo, e os outros
  quatro slots também fixos (Pedidos, Aprovações, Alertas, Mais).
- Benefícios: WCAG 3.2.4 — o mesmo ícone/posição não pode significar coisas diferentes; M3 pede destinos
  estáveis na navigation bar. Hoje o primeiro item muda de identidade conforme a rota (N5).
- Evidência: `rg -n "#back" src` = 0; o bottom nav tem os mesmos 5 rótulos em qualquer rota (teste e2e mobile).

### 28 — [F] Fechar modal antes de voltar
- Descrição: enquanto houver um overlay aberto (`Dialog`/`Sheet`/`Drawer`/`AlertDialog`), o Voltar e o Esc fecham
  o overlay e **não** trocam de rota; a segunda ativação navega. Implementado por um registro central de
  overlays abertos.
- Exemplo prático: `src/hooks/useOverlayStack.ts` com `push/pop`; `BackButton.handleBack` começa com
  `if (overlayStack.length) { overlayStack.closeTop(); return; }`.
- Benefícios: hoje, com o `OrderDetailModal` aberto, o Voltar troca de rota com o modal aberto e o usuário volta
  para uma tela coberta por um diálogo de outro pedido (N17).
- Evidência: e2e: abrir detalhe do pedido → Voltar fecha o modal e a URL não muda; Voltar de novo sai da tela.

### 29 — [F] Voltar no wizard volta uma etapa
- Descrição: dentro de um fluxo multi-etapas, o Voltar global delega para o `onBack` do wizard registrado no
  `useOverlayStack`; só na primeira etapa o Voltar fecha (com a guarda da etapa 124).
- Exemplo prático: `NewOrderDialog` registra `{ kind: 'wizard', onBack: () => setStep('form') }` — hoje o botão
  "Voltar" só existe dentro do `QuotedStep` (`NewOrderDialog.tsx:576`) e não responde ao Voltar do navegador.
- Benefícios: o gesto esperado ("voltar uma etapa") passa a funcionar com o botão da app, o Esc e o Voltar do
  navegador — não três comportamentos.
- Evidência: e2e: cotação obtida → Voltar do navegador volta ao formulário com os dados preenchidos.

### 30 — [F] Fallback sem histórico e sem pai
- Descrição: a cascata final é `parent → previous → raiz da seção → '/'`. A "raiz da seção" usa `section` da
  config (ex.: tela de Segurança sem pai cai em `/security`).
- Exemplo prático: `const target = parent ?? previous?.path ?? sectionRoot(route.section) ?? '/';`
- Benefícios: nenhum clique em Voltar fica sem efeito (hoje, em aba nova, `history.length` pequeno manda tudo
  para `/`, descartando a seção em que o usuário estava).
- Evidência: teste unitário da função `resolveBackTarget` com 6 casos (pai, sem pai com histórico, sem nada, alias, rota pública, 404).

### 31 — [F] Atalho de teclado para voltar
- Descrição: `Alt+←` (e `Cmd+[` no macOS) acionam o mesmo `resolveBackTarget`; registrar no handler único do
  `AppLayout` (`:163-237`) e documentar no guia de atalhos.
- Exemplo prático: `if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); back(); }` junto dos atalhos `G`+letra.
- Benefícios: o operador que trabalha no teclado (fila de aprovações) não precisa alcançar o mouse.
- Evidência: `page.keyboard.press('Alt+ArrowLeft')` em `/settings/maps` leva a `/settings`.

### 32 — [F] Nunca voltar para a rota atual
- Descrição: guarda no `resolveBackTarget`: se o destino calculado for igual ao `location.pathname` (com ou sem
  query), pular para o próximo da cascata.
- Exemplo prático: ocorre hoje em `/alerts?severity=CRITICAL` → o "previous" é `/alerts?severity=ALL`, e o
  usuário clica Voltar duas vezes achando que travou.
- Benefícios: evita o Voltar "que não faz nada", principal queixa registrada em testes de usabilidade de filtros na URL.
- Evidência: teste: pilha `['/alerts?a=1','/alerts?a=2']` → Voltar vai para a rota pai, não para a própria tela.

### 33 — [F] Voltar não repete requisição
- Descrição: ao voltar, reaproveitar o cache do React Query (`staleTime` 10 s já configurado em `App.tsx:90`) e
  **não** forçar `refetch`; marcar a navegação com `state.via = 'back'` para que a página possa optar por não
  remontar gráficos pesados.
- Exemplo prático: em `LiveMapPage`, `useQuery({ …, refetchOnMount: navigationState.via === 'back' ? false : 'always' })`.
- Benefícios: voltar fica instantâneo em vez de recarregar 7 queries do dashboard; menos carga no Supabase.
- Evidência: aba Network ao voltar para `/` mostra 0 requests novos dentro de 10 s.

### 34 — [F] Voltar preserva filtros da tela de destino
- Descrição: ao voltar para uma rota que usa `useSearchParams`, restaurar a query string que estava ativa (vem do
  histórico próprio, que guarda `path + search`).
- Exemplo prático: pilha guarda `/orders?status=PENDING&page=3`; `navigate(entry.path + entry.search)`.
- Benefícios: hoje o operador que abre um pedido da página 3 e volta cai na página 1 sem filtro (`OrdersPage.tsx:29-31`).
- Evidência: e2e: filtrar `/orders?status=PENDING&page=3` → abrir detalhe (etapa 146) → Voltar → URL idêntica.

### 35 — [F] Rotas públicas fora do histórico próprio
- Descrição: `/auth`, `/forgot-password`, `/reset-password`, `/mfa-verify` e `/unauthorized` nunca entram na
  pilha; `/unauthorized` também não.
- Exemplo prático: `if (route?.layout !== 'app' || route?.alias) return;` no `useEffect` do `useNavigationHistory`.
- Benefícios: impede o Voltar de devolver o usuário à tela de login depois de autenticado (causa de loop, N5/N13).
- Evidência: logar e navegar 3 telas → `stack` sem nenhuma entrada `/auth`.

### 36 — [F] Voltar com `aria-keyshortcuts` e tooltip consistentes
- Descrição: o botão declara `aria-keyshortcuts="Alt+ArrowLeft"`, tooltip com o destino e atraso de 300 ms;
  remover o tooltip genérico atual.
- Exemplo prático: trocar `back-button.tsx:75-78` ("Voltar para a página anterior") por `<TooltipContent>Voltar para {titleOf(target)} · Alt+←</TooltipContent>`.
- Benefícios: descoberta do atalho sem abrir o guia; WCAG 3.2.4 (identificação consistente).
- Evidência: hover mostra o destino real em 3 rotas diferentes (teste visual Playwright).

### 37 — [F] Estados do botão (hover/focus/active/disabled)
- Descrição: aplicar `focus-visible:ring-2 ring-primary/40`, `active:scale-95` e, nos fluxos em que o Voltar está
  bloqueado (wizard em `quoting`/`creating`), `disabled` com tooltip explicando ("Aguarde a cotação").
- Exemplo prático: `disabled={blocked}` ligado ao mesmo estado que já bloqueia o `onOpenChange` do
  `NewOrderDialog` (`:542`).
- Benefícios: WCAG 2.4.7 (foco visível); o usuário entende por que o botão não responde durante a cotação, em vez
  de clicar três vezes.
- Evidência: Tab até o botão mostra anel de foco; durante `quoting` o botão está `aria-disabled="true"`.

### 38 — [F] Voltar e "abrir em nova aba" coexistem
- Descrição: o destino do Voltar também vira um `<a href>` real (não só `onClick`), para que Ctrl+clique /
  clique do meio abram a tela pai em nova aba.
- Exemplo prático: `<Button asChild><Link to={target}>…</Link></Button>` em vez de `onClick={handleBack}` puro
  (`back-button.tsx:55`).
- Benefícios: hábito universal no navegador; hoje o botão é um `<button>` e Ctrl+clique não faz nada.
- Evidência: Ctrl+clique no Voltar de `/settings/maps` abre `/settings` em nova aba (teste e2e com `context.waitForEvent('page')`).

### 39 — [T] Testes unitários do `resolveBackTarget` e do histórico
- Descrição: cobrir a matriz da seção 2.2 (9 contextos) em Vitest, com `MemoryRouter` e config de rotas de teste.
- Exemplo prático: `src/hooks/__tests__/useNavigationHistory.test.tsx` + `src/routes/__tests__/resolveBackTarget.test.ts`.
- Benefícios: a regra do Voltar é a parte mais fácil de regredir, porque cinco componentes a consomem.
- Evidência: 9 casos verdes; cobertura do arquivo ≥ 90% (limite global de 70% em `vitest.config.ts`).

### 40 — [T] E2E do Voltar nos 4 dispositivos
- Descrição: `e2e/navegacao-voltar.e2e.ts` em 390×844 (mobile), 820×1180 (tablet) e 1440×900, cobrindo:
  deep-link em aba nova, modal aberto, wizard, pós-login, 404, `/unauthorized`.
- Exemplo prático: `test.use({ viewport: { width: 390, height: 844 } })` + `page.goBack()` para comparar o Voltar
  do navegador com o da app.
- Benefícios: prova que a regra vale nos três tamanhos; nenhuma das 7 specs atuais testa navegação (N28).
- Evidência: job `E2E (Playwright)` verde com a nova spec; falha proposital (remover o fallback) deixa vermelho.

## Bloco 2 — Breadcrumbs e hierarquia (41–58)

### 41 — [F] Breadcrumb montado pela cadeia de `parent`, não por segmento de URL
- Descrição: trocar o `pathSegments.forEach` por `useRouteMeta().ancestors`, que sobe pela cadeia de `parent` da
  config até a raiz.
- Exemplo prático: substituir `smart-breadcrumbs.tsx:46-55` por `const breadcrumbs = [{ label: 'Início', path: '/' }, ...ancestors, current]`.
- Benefícios: `/alert-configurations` passa a mostrar "Início › Alertas › Config. Alertas" (hierarquia real), e
  `/reports/advanced` deixa de mostrar "advanced" (N8, N9).
- Evidência: teste de tabela com 10 rotas comparando o array de labels esperado.

### 42 — [F] Último item não é link e é o `<h1>` lógico
- Descrição: o item atual recebe `aria-current="page"` e não é clicável (hoje já não é link, mas não tem
  `aria-current`); o `<ol>` ganha `aria-label="Trilha de navegação"`.
- Exemplo prático: `smart-breadcrumbs.tsx:66-84` — `<nav aria-label="Trilha de navegação"><ol>…<li aria-current="page">`.
- Benefícios: padrão WAI-ARIA APG Breadcrumb; leitor de tela anuncia a posição (WCAG 2.4.8).
- Evidência: `axe` sem violação na região `nav[aria-label="Trilha de navegação"]`; snapshot de acessibilidade mostra `current: page`.

### 43 — [F] Breadcrumb não aparece em telas de 1º nível
- Descrição: esconder quando `ancestors.length === 0` (hoje a condição é `breadcrumbs.length <= 1`, que já
  esconde no dashboard mas mostra "Início › Pedidos" em `/orders`).
- Exemplo prático: `if (ancestors.length === 0) return null;` em `smart-breadcrumbs.tsx:61`.
- Benefícios: NN/g — breadcrumb de um nível é ruído; libera 32px de altura vertical no cabeçalho de 20 telas.
- Evidência: `/orders` sem trilha; `/settings/maps` com trilha de 3 itens.

### 44 — [F] Truncamento no meio, não no fim
- Descrição: com mais de 3 níveis, colapsar os intermediários num `…` com dropdown (padrão APG), mantendo
  sempre o primeiro e o último visíveis.
- Exemplo prático: reaproveitar o `DropdownMenu` já importado (`smart-breadcrumbs.tsx:93`) para os níveis ocultos.
- Benefícios: em 1024px a trilha de `/settings/lalamove` + ação rápida hoje empurra os botões para fora.
- Evidência: em 1024px nenhuma trilha causa overflow horizontal (teste `boundingBox().width <= container`).

### 45 — [F] Seção visível no desktop, badge só quando agrega
- Descrição: manter o `Badge` de seção (`smart-breadcrumbs.tsx:68`) apenas quando a seção não é o primeiro
  ancestral (evita "Operações › Início › Pedidos" com "Operações" duas vezes).
- Exemplo prático: `{sectionInfo && ancestors[0]?.section !== route.section && <Badge …/>}`.
- Benefícios: reduz repetição na faixa superior, que hoje tem título, badge, trilha, favorito e 2 ações rápidas.
- Evidência: `/evaluations` mostra "Operações" uma vez só.

### 46 — [F] Ações rápidas do breadcrumb vindas da config
- Descrição: `pageQuickActions` (4 rotas em `breadcrumb-config.ts:81-86`) passa a ser derivado: as ações rápidas
  de uma rota são as rotas **irmãs** (mesmo `parent`) mais usadas, limitadas a 2.
- Exemplo prático: em `/alerts`, irmãs são `/alert-configurations` e `/notification-history` — exatamente o que
  está escrito à mão hoje, mas sem manutenção.
- Benefícios: 51 rotas passam a ter atalhos laterais sem ninguém cadastrar; alinhado com U6 (menu × rotas).
- Evidência: `rg -n "pageQuickActions = \{" src` = 0 (passa a ser função); `/drivers` mostra "Aprovações" e "Avaliações" como hoje.

### 47 — [F] "Páginas recentes" sem alias e sem rota proibida
- Descrição: `saveRecentPage` (`breadcrumb-config.ts:91-99`) passa a ignorar aliases (etapa 19), rotas públicas e
  rotas que o papel do usuário não pode abrir; e grava o `label` da config, não o do componente.
- Exemplo prático: `if (!route || route.alias || !canAccess(route, role)) return;`
- Benefícios: hoje a lista pode oferecer um link que leva direto a `/unauthorized`, e registra `/map` e
  `/live-map` como duas páginas.
- Evidência: usuário `operator` não vê `/roles` em recentes nem em favoritos.

### 48 — [F] Favoritos migrados para a config
- Descrição: `getFavoritePages` valida cada entrada contra `ROUTES` ao ler e descarta as que não existem mais
  (rota removida continua no `localStorage` para sempre hoje).
- Exemplo prático: `return parsed.filter(p => matchRoute(p.path));` em `breadcrumb-config.ts:106`.
- Benefícios: favorito morto não gera 404 silencioso; a lista encolhe sozinha em deploys que removem tela.
- Evidência: inserir `{"path":"/rota-morta"}` no `localStorage` e recarregar → não aparece na lista.

### 49 — [F] Breadcrumb mobile = seção + título, sem trilha
- Descrição: `MobileBreadcrumbs` fica com o rótulo da seção e o título da tela, truncado, sem botão (etapa 26) e
  sem `motion` (etapa 101).
- Exemplo prático: `Header.tsx:429-433` mantém a condição de só mostrar fora da raiz, mas o componente deixa de
  navegar.
- Benefícios: 390px não tem largura para trilha; o Voltar nomeado do cabeçalho já dá a hierarquia.
- Evidência: em 390px a linha cabe sem truncar em 10 rotas (teste de largura).

### 50 — [F] Sidebar destaca a cadeia inteira (consome a etapa 54 do PLANO_FRONTEND_190)
- Descrição: além de `matchPath({ end: false })` no item, marcar a **categoria** como ativa quando qualquer
  ancestral da rota atual pertence a ela, e abrir a categoria automaticamente sem fechar as outras.
- Exemplo prático: `Sidebar.tsx:56-62` — `const active = Boolean(matchPath({ path: item.path, end: false }, pathname)) || ancestors.some(a => a.path === item.path);`
- Benefícios: em `/settings/maps` o item "Configurações" acende (hoje nada acende, N16) — o usuário sabe em que
  ramo está (WCAG 2.4.8).
- Evidência: e2e: `/reports/advanced` → item "Relatórios Avançados" com `aria-current="page"` e categoria
  "Analytics" aberta.

### 51 — [F] Bottom nav destaca pela cadeia, não por `startsWith`
- Descrição: `MobileBottomNav.isActive` (`:99-102`) usa `startsWith`, que marca "Pedidos" quando a rota é
  `/orders-algo-outro`; passar a usar `matchPath` + ancestrais.
- Exemplo prático: `const active = ancestors.concat(route).some(r => r.path === item.path);`
- Benefícios: destaque correto e consistente com a sidebar; mesma função de decisão nas duas navegações.
- Evidência: teste unitário: `/orders` ativo em "Pedidos"; `/alert-configurations` ativo em "Alertas".

### 52 — [F] Um único `isActive` compartilhado
- Descrição: extrair `isRouteActive(itemPath, pathname, ancestors)` para `src/routes/active.ts` e usar em
  `Sidebar`, `MobileSidebar`, `MobileBottomNav` e `SmartBreadcrumbs`.
- Exemplo prático: remove as quatro implementações (`Sidebar.tsx:56`, `MobileSidebar.tsx:210`,
  `MobileBottomNav.tsx:99`, `smart-breadcrumbs.tsx:71`).
- Benefícios: quatro regras diferentes de "estou aqui" produzem estados contraditórios na mesma tela.
- Evidência: `rg -n "const isActive" src` = 0 fora de `src/routes/active.ts`.

### 53 — [F] Categoria do menu não fecha ao navegar
- Descrição: o efeito que abre a categoria ativa (`Sidebar.tsx:59-62`, `MobileSidebar.tsx:195-203`) hoje só
  adiciona; garantir que a navegação para outra seção **não** colapse a seção aberta manualmente pelo usuário, e
  persistir o conjunto aberto em `localStorage`.
- Exemplo prático: `useLocalStorageState('sidebar-open-categories', ['main'])` com try/catch.
- Benefícios: o operador que trabalha em duas seções não reabre o menu a cada clique.
- Evidência: abrir "Analytics", navegar para `/orders`, recarregar → "Analytics" continua aberta.

### 54 — [F] Estado recolhido da sidebar persistido
- Descrição: `collapsed` (`Sidebar.tsx:25`) passa a ser persistido e sincronizado entre abas (etapa 161).
- Exemplo prático: `const [collapsed, setCollapsed] = usePersistedState('sidebar-collapsed', false)`.
- Benefícios: hoje toda troca de rota remontava o `AppLayout` (N1) e o menu voltava a expandir; mesmo após a
  etapa 46 do PLANO_FRONTEND_190, um F5 perde a preferência.
- Evidência: recolher, F5 → continua recolhida; abrir segunda aba → também recolhida.

### 55 — [F] `aria-current` só pelo React, sem varredura de DOM
- Descrição: remover o segundo `useEffect` de `useAccessibility` (`:41-51`), que reescreve `aria-current` em
  `nav a` a cada rota, e garantir `aria-current` declarativo em Sidebar, MobileSidebar, bottom nav e breadcrumb.
- Exemplo prático: `MobileSidebar` e `MobileBottomNav` passam a receber `aria-current={active ? 'page' : undefined}`
  (hoje só `Sidebar.tsx:88` tem).
- Benefícios: acaba a briga entre o React e o patch de DOM (o patch roda depois e pode marcar o link errado
  quando há dois `href` iguais); menos trabalho por navegação.
- Evidência: `rg -n "aria-current" src/hooks/useAccessibility.tsx` = 0; snapshot de acessibilidade com 1 item `current`.

### 56 — [F] Trilha também no `document.title` (prefixo da seção)
- Descrição: o título do documento passa a ser `<Tela> · <Seção> · Lalamove Hub`, consistente com a trilha.
- Exemplo prático: `useDocumentTitle(\`${route.label} · ${sectionLabel} · Lalamove Hub\`)` (ver etapa 67).
- Benefícios: o histórico do navegador (Ctrl+H) e os favoritos passam a ser navegáveis — hoje 52 rotas têm o
  mesmo título (N14).
- Evidência: `await page.title()` diferente em 10 rotas.

### 57 — [T] Teste de hierarquia × menu × breadcrumb
- Descrição: para cada rota, comparar a cadeia de `parent` com a seção do menu: se a rota está na sidebar, o
  primeiro ancestral deve pertencer à mesma seção.
- Exemplo prático: `expect(sectionOf(ancestors(route)[0])).toBe(route.section)` para as 37 rotas de menu.
- Benefícios: impede hierarquia inventada (ex.: `/heatmap` com pai `/map` mas seção "Analytics" — decidir e
  documentar na config).
- Evidência: teste verde; divergência intencional precisa de `// eslint-disable`-equivalente explícito na config (`hierarchyException: true`).

### 58 — [T] E2E de breadcrumb
- Descrição: spec que navega por 3 cadeias (`/settings`→`/settings/maps`, `/alerts`→`/alert-configurations`,
  `/reports`→`/reports/advanced`), clica no ancestral e confere a URL.
- Exemplo prático: `await page.getByRole('link', { name: 'Configurações' }).click(); await expect(page).toHaveURL('/settings');`
- Benefícios: breadcrumb que não leva a lugar é pior que não ter; hoje nada testa isso (N28).
- Evidência: spec verde no job `E2E (Playwright)`.

## Bloco 3 — Feedback visual da transição (59–78)

### 59 — [F] Transição só no `Outlet` (consome a etapa 46 do PLANO_FRONTEND_190)
- Descrição: depois de remover `key={location.pathname}` do `<Routes>` (`App.tsx:138`), envolver **apenas** o
  conteúdo com `AnimatePresence mode="wait"` dentro do `AppLayout`, usando a `location.key` como chave.
- Exemplo prático: `AppLayout.tsx:327-336` passa a `<AnimatePresence mode="wait" initial={false}><motion.div key={location.key}>…<Outlet /></motion.div></AnimatePresence>`.
- Benefícios: sidebar, cabeçalho e breadcrumb param de piscar; o `exit` declarado finalmente roda (N1, N3).
- Evidência: React DevTools Profiler: ao trocar de rota, `Sidebar` e `Header` não remontam; 1 subscription realtime por sessão.

### 60 — [F][D] Trocar a animação de rota por CSS (U9)
- Descrição: substituir a transição framer-motion do `Outlet` por classes CSS (`@keyframes` de 120 ms, só
  `opacity` + `translateY(4px)`), com `View Transitions` quando disponível.
- Exemplo prático: `document.startViewTransition?.(() => navigate(path))` no helper de navegação; fallback na
  classe `.route-enter`.
- Benefícios: tira `framer-motion` do caminho crítico de toda navegação (está em 90 arquivos, A15); transição
  composta só de propriedades que não causam layout.
- Evidência: Performance panel: nenhuma tarefa > 50 ms na troca de rota; bundle de `App` sem `framer-motion` (análise do `rollup-plugin-visualizer`).

### 61 — [F] Duração e curva padronizadas em tokens
- Descrição: criar `--motion-fast: 120ms`, `--motion-base: 200ms`, `--motion-slow: 320ms` e
  `--motion-ease: cubic-bezier(.2,0,0,1)` em `src/index.css` e usar nas transições de rota, modal, gaveta e
  breadcrumb.
- Exemplo prático: hoje há `0.2` (`AppLayout.tsx:332`), `0.15` (`smart-breadcrumbs.tsx:74`), `0.3`
  (`back-button.tsx:47`, `Header.tsx:135`) e `0.03*index` escritos à mão.
- Benefícios: a app passa a "se mover" de um jeito só; quatro durações diferentes na mesma tela dão sensação de
  interface improvisada.
- Evidência: `rg -n "duration: 0\." src/components/layout src/components/ui` = 0.

### 62 — [F] Barra de progresso de navegação
- Descrição: barra de 2px no topo do `<main>` que aparece quando a navegação demora > 150 ms (chunk ainda
  baixando), some ao montar a rota, e nunca passa de 90% antes de concluir.
- Exemplo prático: `src/components/layout/RouteProgressBar.tsx` alimentado por `useNavigation()`-equivalente:
  `const pending = useIsRoutePending()` baseado em `Suspense` + `useTransition`.
- Benefícios: as 50 páginas são `lazy` (`App.tsx:20-81`); em 3G o usuário clica no menu e nada acontece por 1 s —
  hoje o único retorno é o `PageLoader` substituindo a tela inteira.
- Evidência: com throttling "Slow 3G", a barra aparece ao clicar em "Relatórios Avançados" e desaparece quando a tela monta.

### 63 — [F] Suspense por rota com skeleton da própria tela
- Descrição: `SuspenseWrapper` (`App.tsx:106-112`) passa a aceitar um `fallback` por rota, vindo da config
  (`skeleton: 'table' | 'cards' | 'map' | 'form' | 'detail'`).
- Exemplo prático: `{ path: '/orders', skeleton: 'table' }` → `<Suspense fallback={<TableSkeleton rows={10} />}>`;
  hoje todas as 50 rotas mostram o mesmo spinner centralizado (`page-loader.tsx:10-40`).
- Benefícios: o usuário vê a forma da tela antes do dado (percepção de velocidade); 15 páginas já têm `Skeleton`
  interno, que fica alinhado com o fallback.
- Evidência: 5 rotas de tipos diferentes mostram esqueletos diferentes (screenshots Playwright com rede lenta).

### 64 — [F] Esqueleto não "salta" para o conteúdo
- Descrição: o skeleton usa a mesma grade, altura de linha e gutters do conteúdo real, para que a troca não
  mexa o layout; medir CLS antes/depois.
- Exemplo prático: `TableSkeleton` com as mesmas 7 colunas e `h-12` de `OrdersTable`.
- Benefícios: CLS alto na primeira navegação faz o operador clicar no lugar errado.
- Evidência: Lighthouse/`web-vitals`: CLS < 0,1 nas 5 rotas mais usadas.

### 65 — [F] Reservar a altura do cabeçalho e do breadcrumb
- Descrição: a faixa de cabeçalho tem altura fixa (`h-14 md:h-16` já existe) **e** a linha de breadcrumb reserva
  altura mesmo quando ausente, para que telas com e sem trilha não deslocar o conteúdo.
- Exemplo prático: `Header.tsx:424-433` → wrapper com `min-h-[32px]` em vez de montar/desmontar a div.
- Benefícios: ir de `/orders` (sem trilha, após a etapa 43) para `/settings/maps` (com trilha) deixa de empurrar
  a tela 32px para baixo.
- Evidência: screenshot diff: topo do primeiro card na mesma coordenada nas duas rotas.

### 66 — [F] Scroll ao topo no container correto (consome a etapa 56 do PLANO_FRONTEND_190)
- Descrição: `App.tsx:118-120` sai; o reset passa a ser no `<main>` via `ref`, apenas quando
  `useNavigationType() !== 'POP'`.
- Exemplo prático: `mainRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })`.
- Benefícios: hoje o `window.scrollTo` não tem efeito porque o scroll está no `<main overflow-y-auto>` (N2) —
  trocar de tela mantém o usuário no meio da página nova.
- Evidência: rolar `/orders` até o fim, ir para `/drivers` → topo; voltar com o navegador → posição anterior (etapa 68).

### 67 — [F] `useDocumentTitle` em todas as rotas
- Descrição: hook único chamado uma vez no `AppLayout` a partir da config, substituindo os três
  `document.title` escritos à mão; restaurar o título anterior no unmount.
- Exemplo prático: remover `LalamoveOperationsPage.tsx:15`, `LalamoveQuotaPage.tsx:51-54`, `ContactsPage.tsx:62`
  e usar `useDocumentTitle(titleFor(route))`.
- Benefícios: aba, histórico, favoritos e compartilhamento passam a identificar a tela (N14); base para a
  telemetria do bloco 8.
- Evidência: teste: navegar por 10 rotas e coletar `document.title` — 10 valores distintos.

### 68 — [F] Restauração de posição de scroll no POP
- Descrição: guardar `scrollTop` do `<main>` por `location.key` (mapa em memória + `sessionStorage`) e restaurar
  quando a navegação for `POP`; usar `ScrollRestoration` do react-router 7 se a app migrar para data router,
  senão a implementação manual.
- Exemplo prático: `useScrollRestoration(mainRef)` com `positions.set(location.key, el.scrollTop)` no cleanup.
- Benefícios: voltar da tela de um pedido para a lista devolve o operador à linha em que estava (N15) — é a
  ação mais repetida do dia.
- Evidência: e2e: rolar `/orders` 2000px, abrir detalhe, voltar → `scrollTop` entre 1900 e 2100.

### 69 — [F] Prefetch no hover **e** no foco do teclado
- Descrição: `usePrefetch` hoje só expõe handlers de mouse; adicionar `onFocus` e `onTouchStart`, e desligar com
  `navigator.connection.saveData`.
- Exemplo prático: `getPrefetchProps` devolve `{ onMouseEnter, onFocus, onTouchStart }`.
- Benefícios: quem navega por teclado (operação) não paga a espera do chunk; economia de dados respeitada.
- Evidência: Tab até "Relatórios" dispara o request do chunk; com `saveData` simulado, não dispara.

### 70 — [F] Prefetch dos dados, não só do código
- Descrição: no hover do menu, além do chunk, `queryClient.prefetchQuery` da query principal da rota declarada na
  config (`prefetchKey`).
- Exemplo prático: `{ path: '/approvals', prefetch: (qc) => qc.prefetchQuery(approvalsQuery()) }`.
- Benefícios: a tela abre com dado, não com skeleton; aproveita o `staleTime` de 10 s já configurado.
- Evidência: hover em "Aprovações" por 300 ms e clicar → lista renderiza sem estado de loading (teste e2e com `expect(skeleton).toHaveCount(0)`).

### 71 — [F] Transição de saída não bloqueia a entrada
- Descrição: `mode="wait"` só onde o conteúdo é curto; em telas pesadas (mapa, dashboard) usar `mode="popLayout"`
  ou nenhuma transição, para não somar 200 ms à navegação.
- Exemplo prático: `{ path: '/live-map', transition: 'none' }` na config.
- Benefícios: `LiveMapPage` já tem 674 linhas e 14 `useState` (A25); animar a saída atrasa o mapa.
- Evidência: medir `performance.measure('nav')` em `/live-map`: < 250 ms do clique ao primeiro frame do mapa.

### 72 — [F] Indicador de "carregando dados" separado do "trocando de tela"
- Descrição: dois sinais distintos: barra de topo = navegação; `isFetching` do React Query = atualização de dado
  (badge discreto no `PageHeader`).
- Exemplo prático: `const refreshing = useIsFetching({ queryKey: route.queryScope }) > 0` → ponto pulsante ao
  lado do título, em vez de trocar a tela por skeleton.
- Benefícios: hoje um refetch pode esvaziar a tela e parecer navegação; o operador perde o contexto.
- Evidência: clicar em "Atualizar" em `/orders` mantém a tabela visível com indicador ativo.

### 73 — [F] Loading de rota com limite de tempo e erro navegável
- Descrição: se o chunk não carregar em 10 s, mostrar estado de erro com "Tentar de novo" e "Voltar para
  <destino>", em vez do spinner infinito; integra com o retry de chunk (etapa 57 do PLANO_FRONTEND_190).
- Exemplo prático: `ErrorBoundary` por rota com `resetKeys={[location.key]}`.
- Benefícios: deploy no meio da navegação é a causa mais comum de tela branca em SPA com 50 chunks.
- Evidência: simular `ChunkLoadError` → tela de erro com os dois botões, e o Voltar funciona.

### 74 — [F] Transição respeita `prefers-reduced-motion`
- Descrição: hook `useReducedMotion()` (framer-motion já exporta) ou media query via `matchMedia`, consultado
  pela transição de rota, pela barra de progresso e pelo scroll suave.
- Exemplo prático: `transition: reduce ? { duration: 0 } : { duration: 0.12 }` e `behavior: reduce ? 'auto' : 'smooth'`.
- Benefícios: WCAG 2.3.3 (Animation from Interactions); hoje o CSS respeita, o JS não (N25).
- Evidência: com `prefers-reduced-motion: reduce` emulado, nenhuma animação de rota (teste Playwright com `emulateMedia`).

### 75 — [F] Preferência de usuário "reduzir animações" aplicada de verdade
- Descrição: a opção já existente em `UserPreferencesPage` passa a escrever um atributo em `<html>`
  (`data-reduce-motion="true"`) lido pelo CSS e pelo hook da etapa 74.
- Exemplo prático: `document.documentElement.dataset.reduceMotion = String(pref)`; CSS: `:root[data-reduce-motion="true"] * { animation: none !important; transition: none !important }`.
- Benefícios: a preferência deixa de ser decorativa; usuários com enjoo de movimento conseguem trabalhar.
- Evidência: ligar a preferência e navegar → sem transição, sem `motion` de breadcrumb.

### 76 — [F] Atalho `G`+letra passa pela config e anuncia direito
- Descrição: `navigationShortcuts` (`AppLayout.tsx:65-75`) sai do código e vem da config (`shortcut: 'o'`), com
  verificação de papel antes de navegar e anúncio do `label` real.
- Exemplo prático: `{ path: '/orders', shortcut: 'o' }`; `if (!canAccess(route, role)) { announce('Você não tem acesso a Pedidos'); return; }`
- Benefícios: hoje o atalho leva um `viewer` a `/approvals` e ele cai em `/unauthorized`; e o anúncio usa
  `pageConfig`, que não cobre todas as rotas (N10).
- Evidência: `viewer` pressiona `G`+`a` → anúncio de sem acesso, URL inalterada.

### 77 — [T] Teste de transição e scroll
- Descrição: Vitest para `useScrollRestoration` e `useDocumentTitle`; Playwright para barra de progresso (rede
  lenta) e reduced-motion.
- Exemplo prático: `src/hooks/__tests__/useScrollRestoration.test.tsx` com container falso e `location.key` controlada.
- Benefícios: scroll e título são os itens que mais silenciosamente regridem (nenhum teste quebra se pararem de funcionar).
- Evidência: 4 testes verdes; comentar o `scrollTo` deixa vermelho.

### 78 — [T] Métrica de duração de navegação no e2e
- Descrição: a spec de navegação mede `performance.now()` entre o clique no menu e o `h1` da rota nova, e falha
  acima de 1200 ms nas 5 rotas mais usadas (build de produção, CPU 4×).
- Exemplo prático: `const t = await page.evaluate(() => performance.getEntriesByName('nav')[0].duration)`.
- Benefícios: impede que skeleton, transição e prefetch sejam ajustados "no olho"; vira número no CI.
- Evidência: job e2e imprime a tabela de 5 rotas com a duração; regressão de 300 ms derruba o job.

## Bloco 4 — Consistência: um cabeçalho, um padrão (79–96)

### 79 — [F] Criar `PageHeader` único
- Descrição: componente `src/components/layout/PageHeader.tsx` com slots fixos: `BackButton` → ícone da seção →
  `<h1>` → subtítulo → `actions` → `meta` (indicador de atualização). Toda página passa a usá-lo via o layout,
  sem reconstruir cabeçalho próprio.
- Exemplo prático: `MapsSettingsPage.tsx:332-340` tem cabeçalho próprio com `<Link to="/settings">` e `<h1>`
  duplicando o `<h1>` do `Header.tsx:140` — duas vezes "Provedores de mapa" na mesma tela.
- Benefícios: acaba o `<h1>` duplicado e o Voltar paralelo; WCAG 3.2.3.
- Evidência: `rg -n "<h1" src/pages | wc -l` cai para ≤ 5 (só telas públicas e 404); `document.querySelectorAll('h1').length === 1` em 10 rotas.

### 80 — [F] Migrar as páginas com cabeçalho próprio
- Descrição: migrar `MapsSettingsPage`, `LalamoveSettingsPage`, `ExternalDataPage`, `LalamoveQuotaPage`,
  `LalamoveOperationsPage`, `ContactsPage`, `AdvancedReportsPage` para o `PageHeader` e remover os títulos e
  botões de volta locais.
- Exemplo prático: a tela declara `useHeaderActions(<Button>Exportar</Button>)`; o `PageHeader` renderiza no slot.
- Benefícios: 7 telas param de ter dois níveis de cabeçalho empilhados (gastam ~120px verticais num notebook de 768px).
- Evidência: screenshot das 7 telas com um cabeçalho só; `rg -n "ArrowLeft" src/pages` só em `NotFound` e páginas públicas.

### 81 — [F] `actions` do cabeçalho via contexto
- Descrição: `useHeaderActions()` para a página injetar botões no cabeçalho sem prop drilling; limpa no unmount.
- Exemplo prático: `useHeaderActions([{ label: 'Novo Pedido', icon: Plus, onClick: openNewOrder, variant: 'gradient' }])`
  substituindo `OrdersPage.tsx:160`.
- Benefícios: ação primária sempre no mesmo lugar (canto superior direito), em vez de flutuar dentro do conteúdo.
- Evidência: em 10 rotas a ação primária está na mesma coordenada (teste de posição).

### 82 — [F] FAB mobile contextual (ou removido)
- Descrição: o FAB flutuante do mobile para de ir sempre para `/map` e passa a executar a **ação primária da
  rota** (a mesma do `useHeaderActions`); em telas sem ação primária, não renderiza.
- Exemplo prático: substituir `MobileBottomNav.tsx:298-319` (`onClick={() => navigate('/map')}`) por
  `primaryAction?.onClick`.
- Benefícios: hoje o botão mais chamativo do celular faz a mesma coisa em todas as telas e cobre o canto do
  conteúdo (N27); M3 pede FAB = ação da tela, não navegação.
- Evidência: em `/orders` o FAB abre "Novo Pedido"; em `/metrics` não existe FAB.

### 83 — [F] Tokens de navegação
- Descrição: definir `--nav-item-h: 40px`, `--nav-icon: 16px`, `--nav-gap: 12px`, `--nav-indicator-w: 2px`,
  `--header-h: 56px/64px` e usar em Sidebar, MobileSidebar, bottom nav e breadcrumb.
- Exemplo prático: hoje `Sidebar` usa `px-3 py-2` + ícone `w-7 h-7` com `w-4 h-4` dentro; `MobileSidebar` e o
  bottom nav usam outras medidas (`h-5 w-5`, `h-16`).
- Benefícios: densidade igual nas três navegações; mudar a densidade passa a ser uma variável.
- Evidência: `rg -n "w-7 h-7|h-5 w-5" src/components/layout` = 0.

### 84 — [F] Indicador de item ativo unificado
- Descrição: um único tratamento visual: barra de 2px à esquerda (desktop) / em cima (bottom nav) + fundo
  `bg-primary/10` + texto `text-primary`; remover o `layoutId` duplicado.
- Exemplo prático: hoje `Sidebar.tsx:89` usa `layoutId="activeIndicator"` e `MobileBottomNav.tsx:151-155`
  `layoutId="activeTab"`, com formas e posições diferentes.
- Benefícios: o usuário aprende um sinal de "você está aqui" e o reconhece nas duas navegações (WCAG 3.2.4).
- Evidência: screenshots de desktop e mobile com o mesmo tratamento de ativo.

### 85 — [F] Contraste do item ativo e do inativo em WCAG AA
- Descrição: medir e corrigir `text-muted-foreground` sobre `bg-background/80` (sidebar com backdrop-blur) e o
  rótulo de 10px do bottom nav; mínimo 4.5:1 para texto e 3:1 para o indicador.
- Exemplo prático: `MobileBottomNav.tsx:183-188` usa `text-[10px]` em `text-muted-foreground` — abaixo de AA na
  maioria dos temas; subir para 11px/`--muted-foreground-strong`.
- Benefícios: WCAG 1.4.3/1.4.11; a navegação é o texto mais lido da app.
- Evidência: relatório `axe` (regra `color-contrast`) sem violação em Sidebar, bottom nav e breadcrumb, nos temas claro e escuro.

### 86 — [F] Área de toque mínima 44×44 na navegação mobile
- Descrição: auditar bottom nav, botão de menu, Voltar e itens da gaveta; o alvo de toque pode exceder o visual
  com `::after` invisível.
- Exemplo prático: `MobileBottomNav` tem `h-16` dividido por 5 itens num celular de 360px → 72px de largura e
  64px de altura (ok), mas os ícones de "Mais" na gaveta ficam em grid de 3 colunas com `p-3` (~40px) — subir.
- Benefícios: WCAG 2.5.8 (Target Size Minimum); erro de toque na operação custa pedido errado.
- Evidência: Playwright mede `boundingBox()` ≥ 44×44 em todos os alvos de navegação em 360px.

### 87 — [F] Micro-interação de clique com retorno imediato
- Descrição: todo item de navegação responde em < 100 ms com `active:scale-[0.98]` + mudança de fundo, antes de a
  rota trocar.
- Exemplo prático: o bottom nav já tem `active:scale-95` (`MobileBottomNav.tsx:145`); levar o mesmo para
  `Sidebar`, `MobileSidebar` e breadcrumb.
- Benefícios: em rede lenta o usuário sabe que o clique foi registrado e não clica três vezes (origem de rage
  clicks, medidos no bloco 8).
- Evidência: teste visual: `page.mouse.down()` em item de menu muda o estilo antes da navegação.

### 88 — [F] Hierarquia visual do cabeçalho
- Descrição: `<h1>` 20px/600 no desktop e 16px/600 no mobile; subtítulo 13px `muted`; trilha 12px; remover o
  gradiente no texto do título.
- Exemplo prático: `Header.tsx:138-141` usa `bg-gradient-to-r … bg-clip-text text-transparent` no `<h1>` — texto
  com gradiente perde contraste medível e some em `forced-colors`.
- Benefícios: o título volta a ser o elemento mais legível da tela; suporta modo de alto contraste.
- Evidência: `axe` sem violação de contraste no `h1`; render em `forced-colors: active` com título visível.

### 89 — [F] Reduzir o ruído da faixa superior
- Descrição: a faixa hoje acumula menu, Voltar, ícone decorativo, título, subtítulo, busca, tema, alertas,
  usuário, trilha, favorito, 2 ações rápidas e um menu "mais". Mover favorito + copiar link + compartilhar para
  dentro do menu "mais" e remover o ícone decorativo `Sparkles`.
- Exemplo prático: remover `Header.tsx:136-138` (bloco do `Sparkles`) e `smart-breadcrumbs.tsx:85` (estrela solta).
- Benefícios: menos 3 alvos de clique que não navegam, num cabeçalho que ocupa 96px de altura no mobile.
- Evidência: contagem de elementos interativos no `<header>` cai de 13 para ≤ 8 (teste `getByRole('button').count()`).

### 90 — [F] Um só gatilho de busca global (consome a etapa 47 do PLANO_FRONTEND_190)
- Descrição: depois de unificar a busca, o botão do cabeçalho (`Header.tsx:166-173`) e o `Ctrl+K` do
  `AppLayout.tsx:211` apontam para o mesmo componente; remover o segundo listener.
- Exemplo prático: `openCommandPalette()` exposto por um contexto único; `rg -n "=== 'k'" src` = 1.
- Benefícios: hoje `Ctrl+K` abre dois diálogos sobrepostos (N23) — e o Esc fecha só o de cima.
- Evidência: `Ctrl+K` abre 1 diálogo (`getByRole('dialog')` = 1).

### 91 — [F] Guia de atalhos só com atalhos que existem
- Descrição: gerar a lista do `KeyboardShortcutsModal` a partir de um registro central de atalhos
  (`src/lib/shortcuts.ts`), que é a mesma fonte do handler.
- Exemplo prático: remover os 10 atalhos inexistentes de `keyboard-shortcuts-help.tsx:35-52` e incluir `Alt+←`
  (etapa 31) e `G`+letras vindas da config.
- Benefícios: prometer atalho que não funciona queima a confiança no resto da interface (N23).
- Evidência: teste: todo item do guia tem handler registrado; `rg -n "Ctrl\+Shift\+T" src` = 0.

### 92 — [F] Dois modais de atalhos viram um
- Descrição: existem `KeyboardShortcutsHelp` (montado em `App.tsx:136`, abre com `?`) e
  `KeyboardShortcutsModal` (montado em `AppLayout.tsx:380`, também abre com `?`); manter um.
- Exemplo prático: apagar o duplicado e manter o que lê o registro da etapa 91.
- Benefícios: hoje `?` tenta abrir dois diálogos; um deles é renderizado fora do layout, em rota pública inclusive.
- Evidência: `?` abre 1 diálogo; `rg -n "KeyboardShortcuts" src/App.tsx src/components/layout/AppLayout.tsx` = 1 import.

### 93 — [F] Estados de botão padronizados no design system
- Descrição: revisar `src/components/ui/button.tsx` para garantir `hover`, `focus-visible`, `active`, `disabled`
  e `aria-busy` consistentes, e aplicar nos controles de navegação (Voltar, trilha, menu, bottom nav).
- Exemplo prático: `disabled:opacity-50 disabled:pointer-events-none` + `data-[loading=true]:cursor-progress`.
- Benefícios: o usuário distingue "não posso clicar" de "está carregando" — hoje o Voltar durante a cotação
  simplesmente não responde (N18).
- Evidência: storybook-equivalente (página de QA interna) com os 5 estados dos 4 controles; `axe` limpo.

### 94 — [F] Links de navegação são `<a>` de verdade
- Descrição: trocar `<button onClick={() => navigate(path)}>` por `<Link to={path}>` em: bottom nav
  (`MobileBottomNav.tsx:140-189`), gaveta "Mais" (`:249-265`), dropdown do breadcrumb (`:100-102`), ações rápidas
  (`:90`) e dropdown do usuário (`Sidebar.tsx:109-110`).
- Exemplo prático: `<Link to="/orders" className="…">` com `onClick` só para fechar a gaveta.
- Benefícios: Ctrl+clique, clique do meio, "copiar endereço do link", pré-visualização do destino na barra de
  status e leitura correta por leitor de tela ("link" em vez de "botão") — WCAG 2.4.4.
- Evidência: `rg -n "onClick=\{\(\) => navigate\(" src/components/layout src/components/ui` = 0.

### 95 — [T] Teste de consistência de cabeçalho
- Descrição: spec que, em 12 rotas, verifica: exatamente 1 `<h1>`, título igual ao `label` da config, presença do
  Voltar só em rotas com pai, e ação primária no mesmo contêiner.
- Exemplo prático: `for (const r of SAMPLE) { await page.goto(r.path); await expect(page.getByRole('heading', { level: 1 })).toHaveText(r.label); }`
- Benefícios: trava a consistência que as etapas 79–89 criaram.
- Evidência: spec verde; adicionar um `<h1>` local numa página deixa vermelho.

### 96 — [T] Auditoria de contraste e alvo automatizada no CI
- Descrição: rodar `@axe-core/playwright` nas 12 rotas, nos dois temas e em 2 viewports, falhando em violação
  `serious`/`critical` de `color-contrast`, `target-size` e `aria-*` dentro de `header`, `nav` e `aside`.
- Exemplo prático: `e2e/a11y-navegacao.e2e.ts` com `new AxeBuilder({ page }).include('header').include('nav')`.
- Benefícios: acessibilidade de navegação deixa de depender de inspeção manual; é o que o patch global escondia (N21).
- Evidência: job e2e com a spec verde e o relatório anexado como artifact.

## Bloco 5 — Acessibilidade da navegação (97–116)

### 97 — [F][D] Remover o patch global de `aria-label` (U10)
- Descrição: apagar o primeiro `useEffect` de `useAccessibility` (`:11-38`): o `aria-label` da `<aside>` e do
  `<main>` já são declarados no JSX (`Sidebar.tsx:124`, `AppLayout.tsx:325`), e a injeção de
  `aria-label="Botão de ação"` em todo botão sem nome precisa sair.
- Exemplo prático: o hook fica só com o retorno vazio ou é removido da chamada em `AppLayout.tsx:78`.
- Benefícios: o leitor de tela para de anunciar 44 botões como "Botão de ação" e o `axe` volta a mostrar o
  problema real, que o bloco 5 do PLANO_FRONTEND_190 (A16) resolve nome por nome.
- Evidência: `rg -n "Botão de ação" src` = 0; relatório `axe` passa a listar os botões sem nome (lista anexada à PR).

### 98 — [F] Nomes acessíveis reais nos controles de navegação
- Descrição: antes de remover o patch, nomear explicitamente os botões de navegação: menu, Voltar, recolher,
  "Mais", favorito, ações rápidas, item colapsável de categoria.
- Exemplo prático: `MobileBottomNav.tsx:140` não tem `aria-label` nem texto acessível fora do `<span>` de 10px;
  passar a `aria-label={\`${item.label}${item.badge ? \`, ${item.badge} pendentes\` : ''}\`}`.
- Benefícios: o contador de badge passa a ser lido ("Alertas, 3 não lidos"); hoje o número é visual puro.
- Evidência: snapshot de acessibilidade do `nav` do bottom nav com os 5 nomes corretos.

### 99 — [F] Foco no `<h1>` ao trocar de rota
- Descrição: ao concluir a navegação (e só quando a origem foi um clique de navegação, não um `POP`), mover o
  foco para o `<h1>` do `PageHeader` com `tabIndex={-1}` e sem scroll adicional.
- Exemplo prático: `useEffect(() => { if (navType !== 'POP') h1Ref.current?.focus({ preventScroll: true }); }, [location.key])`.
- Benefícios: WCAG 2.4.3 (Focus Order): hoje o foco fica no item de menu clicado e o usuário de teclado precisa
  tabular por toda a navegação de novo (N22).
- Evidência: e2e: `page.keyboard.press('Enter')` num item de menu → `document.activeElement` é o `h1` da rota nova.

### 100 — [F] Anúncio da troca de rota em `aria-live`
- Descrição: região `aria-live="polite"` (o `#sr-announcer` já criado por `useAnnounce`) recebe
  "<Tela> carregada" ao fim de cada navegação, com debounce de 300 ms para não anunciar redirects intermediários.
- Exemplo prático: `announce(\`${route.label} carregada\`)` no mesmo efeito da etapa 99.
- Benefícios: usuário de leitor de tela sabe que a navegação aconteceu — hoje só o atalho `G` anuncia
  ("Navegando para…", `AppLayout.tsx:176`) e o anúncio é antes, não depois.
- Evidência: teste com `getByRole('status')` contendo o texto após navegar; nenhum anúncio duplicado em redirect de login.

### 101 — [F] Barra de progresso com `role="progressbar"` acessível
- Descrição: a barra da etapa 62 declara `role="progressbar" aria-label="Carregando página"` e
  `aria-valuetext`; quando a navegação é instantânea, não é inserida no DOM.
- Exemplo prático: inserir apenas quando `pending` dura > 150 ms, para não gerar anúncio em toda navegação.
- Benefícios: informação de progresso sem poluir o leitor de tela.
- Evidência: `axe` limpo; com rede rápida, `getByRole('progressbar')` tem contagem 0.

### 102 — [F] Skip links para as três regiões
- Descrição: além do "Pular para o conteúdo principal" (`useAccessibility.tsx:91-111`), adicionar "Pular para a
  navegação" e "Pular para a busca", visíveis no foco.
- Exemplo prático: lista de skip links no topo do `AppLayout`, com `href="#main-content"`, `#primary-nav`, `#global-search`.
- Benefícios: WCAG 2.4.1 (Bypass Blocks) com a sidebar de 37 itens, que hoje é atravessada item por item.
- Evidência: Tab a partir do carregamento mostra os 3 links; cada um move o foco para a região certa.

### 103 — [F] `SkipLink` sem `scrollIntoView` suave forçado
- Descrição: `useAccessibility.tsx:98` chama `scrollIntoView({ behavior: 'smooth' })` sempre; respeitar
  reduced-motion e usar `preventScroll` quando o alvo já está visível.
- Exemplo prático: `main.focus({ preventScroll: true })` e `scrollIntoView` só se `getBoundingClientRect().top < 0`.
- Benefícios: evita rolagem animada desnecessária para quem pediu menos movimento (N25).
- Evidência: com reduced-motion emulado, `behavior` usado é `auto`.

### 104 — [F] Landmarks corretos e únicos
- Descrição: um `<nav aria-label="Menu principal">` (sidebar), um `<nav aria-label="Navegação inferior">`
  (bottom nav), um `<nav aria-label="Trilha de navegação">` (breadcrumb), um `<main>`, um `<header>`; remover
  `role="main"` redundante.
- Exemplo prático: `AppLayout.tsx:324` tem `role="main"` num `<main>` (redundante); `MobileBottomNav.tsx:133` e
  `MobileSidebar` `<nav>` sem `aria-label`.
- Benefícios: navegação por landmarks (atalho de leitor de tela) passa a funcionar; hoje há dois `nav` sem nome.
- Evidência: snapshot de landmarks com 5 regiões nomeadas e distintas.

### 105 — [F] Ordem de foco segue a ordem visual no mobile
- Descrição: no mobile o bottom nav está no fim do DOM (correto), mas o FAB flutuante (`MobileBottomNav.tsx:300`)
  recebe foco antes dele e cobre o conteúdo; reordenar e dar `aria-label`.
- Exemplo prático: mover o FAB para depois do `<nav>` no DOM e declarar `aria-label` com a ação primária (etapa 82).
- Benefícios: WCAG 2.4.3 e 2.4.11 (Focus Not Obscured): o FAB cobre o canto inferior direito, onde cai o foco de
  botões de tabela.
- Evidência: teste de ordem de tabulação em `/orders` no mobile; nenhum elemento focado fica sob o FAB.

### 106 — [F] Foco preso corretamente em gaveta e modal
- Descrição: verificar `Sheet`/`Drawer`/`Dialog` do shadcn com foco inicial no primeiro elemento interativo,
  retorno do foco ao gatilho no fechamento, e Esc fechando só o overlay do topo (etapa 28).
- Exemplo prático: `MobileSidebar` abre pelo botão do `Header.tsx:118-127`; ao fechar, o foco deve voltar nele.
- Benefícios: padrão APG Dialog; hoje, ao navegar pela gaveta, o foco fica perdido no `<body>`.
- Evidência: e2e: abrir gaveta, Esc, `document.activeElement` = botão de menu.

### 107 — [F] `aria-expanded` nas categorias colapsáveis
- Descrição: `CollapsibleTrigger` da sidebar e da gaveta declaram `aria-expanded` e `aria-controls`; o indicador
  de seta tem `aria-hidden`.
- Exemplo prático: `Sidebar.tsx:148-151` (trigger) hoje não tem nenhum dos dois atributos.
- Benefícios: o usuário de leitor de tela sabe se a seção está aberta antes de entrar nela.
- Evidência: `axe` limpo na sidebar; snapshot com `expanded: true/false` por categoria.

### 108 — [F] Badge de contagem lido como texto, não como enfeite
- Descrição: badges de alerta/aprovação/incidente passam a ter texto acessível
  (`<span className="sr-only">3 alertas não lidos</span>`) e `aria-hidden` no número visual quando truncado
  ("99+").
- Exemplo prático: `MobileBottomNav.tsx:166-179` e `Sidebar.tsx:92-94` (`{badgeCount > 9 ? '9+' : badgeCount}`).
- Benefícios: "9+" não informa nada por voz; a contagem é a informação que decide a próxima tela do operador.
- Evidência: leitor de tela anuncia o número real; teste com `getByText('3 alertas não lidos', { exact: false })`.

### 109 — [F][D] Swipe-back no mobile (U7)
- Descrição: gesto de arrastar da borda esquerda (até 24px) com limiar de 80px ou velocidade > 0.3, acionando o
  mesmo `resolveBackTarget`; desativado em `/live-map`, `/heatmap`, `/map-tools` e em contêineres com scroll
  horizontal, e desativado com reduced-motion.
- Exemplo prático: `src/hooks/useSwipeBack.ts` com Pointer Events; a config marca `swipeBack: false` nas rotas de mapa.
- Benefícios: gesto esperado no celular (Apple HIG / M3); com `SwipeableApprovalCard` morto (N26) não há conflito
  de biblioteca.
- Evidência: e2e mobile com `page.touchscreen` arrastando da borda em `/settings/maps` → URL `/settings`; em `/live-map` nada acontece.

### 110 — [F] Swipe não concorre com o gesto do sistema
- Descrição: declarar `touch-action: pan-y` nos contêineres que usam swipe e **não** chamar `preventDefault` no
  início do gesto, para não bloquear o back nativo do navegador no Android.
- Exemplo prático: `overscroll-behavior-x: contain` no `<main>`.
- Benefícios: evita a reclamação clássica de "o swipe do celular parou de funcionar nessa tela".
- Evidência: teste manual registrado na PR em Chrome Android e Safari iOS, com o gesto nativo funcionando.

### 111 — [F] Zoom e fonte ajustável sem quebrar a navegação
- Descrição: verificar em 200% de zoom e com `font-size: 20px` no root: o cabeçalho não pode cortar o título, o
  bottom nav não pode sobrepor conteúdo e a trilha deve truncar, não vazar.
- Exemplo prático: trocar as alturas fixas de `Header` (`h-14 md:h-16`) por `min-h` e os `text-[10px]` do bottom
  nav por `text-xs` com `clamp`.
- Benefícios: WCAG 1.4.4 (Resize Text) e 1.4.10 (Reflow) em 320px/400%.
- Evidência: screenshots em 320px e zoom 200% sem scroll horizontal nem texto cortado.

### 112 — [F] Preferência de tamanho de fonte da app
- Descrição: a preferência de `UserPreferencesPage` passa a aplicar `data-font-scale="sm|md|lg"` no root, com
  `--font-scale` multiplicando os tamanhos da navegação.
- Exemplo prático: `:root[data-font-scale="lg"] { font-size: 18px }` e `rem` em toda a navegação.
- Benefícios: operação em galpão lê a tela de longe; aumentar a fonte do sistema não deve ser a única saída.
- Evidência: trocar a preferência aumenta a navegação sem quebrar o layout (screenshot nos 3 valores).

### 113 — [F] `forced-colors` (alto contraste do Windows)
- Descrição: garantir que o indicador de item ativo não dependa só de cor de fundo: adicionar borda/sublinhado em
  `@media (forced-colors: active)` e remover `backdrop-blur` nesse modo.
- Exemplo prático: `@media (forced-colors: active) { [aria-current="page"] { outline: 2px solid; } }`.
- Benefícios: a sidebar hoje é `bg-background/80 backdrop-blur-xl` — em alto contraste o ativo some.
- Evidência: screenshot com `forced-colors: active` emulado mostrando o item ativo distinguível.

### 114 — [F] Navegação por teclado completa na gaveta e no bottom nav
- Descrição: `ArrowUp/Down` dentro da gaveta percorre itens, `Home/End` vai ao primeiro/último, `Esc` fecha; o
  bottom nav é uma lista de links com tabulação normal.
- Exemplo prático: roving tabindex no `nav` da gaveta, seguindo o padrão APG de menu.
- Benefícios: a gaveta tem 11+ itens em grid de 3 colunas (`MobileBottomNav.tsx:244-268`), hoje navegável só por
  Tab item a item.
- Evidência: teste de teclado percorre a gaveta em ≤ 6 teclas até o último item.

### 115 — [T] Testes de acessibilidade da navegação
- Descrição: Vitest + `@testing-library` para foco no `h1`, anúncio `aria-live`, `aria-current` e `aria-expanded`;
  `@axe-core/playwright` para as regiões (complementa a etapa 96).
- Exemplo prático: `src/components/layout/__tests__/navigation-a11y.test.tsx` com `MemoryRouter` e rotas falsas.
- Benefícios: acessibilidade que não tem teste volta em 2 sprints — o patch global (N21) é prova disso.
- Evidência: 8 testes verdes; remover o foco no `h1` deixa vermelho.

### 116 — [T] Checklist WCAG 2.2 da navegação na PR
- Descrição: adicionar ao `.github/PULL_REQUEST_TEMPLATE.md` um bloco curto para PRs que tocam navegação:
  2.4.1, 2.4.3, 2.4.4, 2.4.5, 2.4.7, 2.4.8, 2.4.11, 3.2.3, 3.2.4, 2.5.8 — marcado só com evidência. 🔒 (mexe em
  arquivo de `.github/`)
- Exemplo prático: `- [ ] 2.4.3 Ordem de foco verificada (como: …)`.
- Benefícios: transforma os critérios em verificação de rotina em vez de auditoria anual.
- Evidência: template atualizado; a primeira PR de navegação seguinte traz o bloco preenchido.

## Bloco 6 — Fluxos complexos: wizard, rascunho e guarda de saída (117–144)

### 117 — [F] `NewOrderDialog` virar wizard declarado em 4 passos
- Descrição: o `type Step` atual mistura passo e estado de carregamento (`'form' | 'quoting' | 'quoted' |
  'creating' | 'done'`). Separar em `step: 1..4` (Origem e destino → Item e serviço → Cotação → Confirmação) e
  `status: 'idle' | 'loading' | 'error'`.
- Exemplo prático: `NewOrderDialog.tsx:83,107` → `const [step, setStep] = useState<1|2|3|4>(1); const [status, setStatus] = useState<Status>('idle');`
- Benefícios: 1171 linhas num único passo de formulário (`:593-1050`) obrigam o operador a rolar o diálogo inteiro
  antes de saber o preço; passo a passo reduz o erro de preenchimento e permite medir abandono por passo.
- Evidência: o diálogo mostra "Passo 1 de 4"; `rg -n "type Step" src/components/orders/NewOrderDialog.tsx` com os dois tipos separados.

### 118 — [F] Barra de progresso do wizard com rótulos
- Descrição: `Stepper` no topo do diálogo com os 4 rótulos, passo atual destacado, passos concluídos clicáveis
  (voltar) e futuros desabilitados; `aria-current="step"` no atual.
- Exemplo prático: `src/components/ui/stepper.tsx` reutilizável; no diálogo substitui a `DialogDescription` que
  hoje troca de texto a cada estado (`NewOrderDialog.tsx:549-555`).
- Benefícios: o usuário sabe quanto falta — principal fator contra abandono em formulário longo.
- Evidência: screenshot dos 4 estados; `axe` limpo no stepper; clicar no passo 1 a partir do 3 volta sem perder dado.

### 119 — [F] Validação por passo, não no fim
- Descrição: cada passo valida só os próprios campos (zod por passo) e o botão "Continuar" fica desabilitado com
  a razão no tooltip; o erro aparece junto do campo.
- Exemplo prático: `const stepSchema = { 1: addressSchema, 2: itemSchema, … }` reaproveitando `parseOrderError`
  (`src/lib/orderErrors.ts`) já importado em `NewOrderDialog.tsx:17`.
- Benefícios: hoje o operador só descobre o problema depois de pedir cotação à Lalamove (chamada paga e com
  rate limit); validar antes economiza quota.
- Evidência: passo 1 com CEP inválido não avança e mostra o erro no campo; nenhuma chamada à edge `lalamove-api`.

### 120 — [F][D] Rascunho retomável do pedido (U4) 🔒
- Descrição: salvar o formulário (debounce 800 ms) em `localStorage` por usuário, com `version`, `savedAt` e TTL
  de 24 h; ao abrir o diálogo, oferecer "Retomar rascunho de <hora>" ou "Começar novo". Apagar ao criar o pedido
  com sucesso (`NewOrderDialog.tsx:462`) e ao expirar.
- Exemplo prático: chave `lalamove:new-order-draft:<user.id>`; sem `localStorage` disponível, degradar para
  `sessionStorage` (sem erro visível).
- Benefícios: o diálogo hoje fecha no clique no backdrop e `resetForm()` apaga tudo (N18) — perda típica de 2–4
  minutos de digitação por ocorrência.
- Evidência: preencher 2 passos, fechar, reabrir → oferta de retomar com os dados; criar o pedido → chave removida.

### 121 — [F] Rascunho não guarda dado além do necessário
- Descrição: o rascunho grava só os campos do formulário (nome, telefone, endereços, item, requisitos), nunca
  token, id de cotação ou resposta da Lalamove; e é apagado no logout.
- Exemplo prático: `signOut` (`Header.tsx` / `useAuth`) limpa as chaves `lalamove:*draft*`.
- Benefícios: requisito de U4; computador compartilhado na operação não deixa dado de cliente para o próximo turno.
- Evidência: inspeção do `localStorage` após logout = sem chaves de rascunho; o objeto salvo não contém `quotationId`.

### 122 — [F] Indicador "rascunho salvo"
- Descrição: texto discreto no rodapé do diálogo ("Rascunho salvo às 14:32"), com `aria-live="polite"` e sem
  toast.
- Exemplo prático: `<p className="text-xs text-muted-foreground" aria-live="polite">Rascunho salvo às {hora}</p>`.
- Benefícios: o usuário confia em sair do diálogo; sem o sinal, o rascunho existe mas ninguém sabe.
- Evidência: digitar um campo e esperar 1 s mostra o texto com a hora.

### 123 — [F] Fechar o wizard pede confirmação quando há dado
- Descrição: `onOpenChange` (`NewOrderDialog.tsx:542`) passa a consultar `isDirty`: se houver dado, abrir
  `AlertDialog` com "Descartar pedido?" / "Salvar rascunho e sair" / "Continuar editando"; sem dado, fecha direto.
- Exemplo prático: `onOpenChange={(v) => { if (!v && isDirty) { setConfirmClose(true); return; } … }}`.
- Benefícios: o backdrop deixa de ser um botão de apagar trabalho; hoje só os estados `quoting`/`creating`
  bloqueiam o fechamento.
- Evidência: com 1 campo preenchido, clicar no backdrop abre a confirmação; sem nada preenchido, fecha.

### 124 — [F] Esc no wizard respeita a confirmação
- Descrição: `onEscapeKeyDown` do `DialogContent` segue a mesma regra do backdrop e, dentro do wizard, no passo
  > 1, volta um passo em vez de fechar.
- Exemplo prático: `<DialogContent onEscapeKeyDown={(e) => { e.preventDefault(); handleBackOrClose(); }}>`.
- Benefícios: Esc é o atalho mais usado e hoje descarta 4 passos de digitação sem aviso.
- Evidência: Esc no passo 3 volta ao passo 2; Esc no passo 1 com dado abre a confirmação.

### 125 — [F][D] Guarda de saída com `useBlocker` (U5)
- Descrição: `src/hooks/useUnsavedChangesGuard.ts` usando `useBlocker` do react-router 7, que intercepta
  navegação interna quando `isDirty`; abre `AlertDialog` com "Sair sem salvar?" e, ao confirmar, `blocker.proceed()`.
- Exemplo prático: `const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname);`
  (docs: https://reactrouter.com/api/hooks/useBlocker)
- Benefícios: hoje clicar no menu em cima de um formulário perde tudo, sem aviso, em 5 telas de configuração (N19).
- Evidência: editar `RiskRulesPage` e clicar em "Pedidos" → diálogo; cancelar mantém a rota e o dado.

### 126 — [F] `beforeunload` para F5 e fechar a aba
- Descrição: o mesmo hook registra `beforeunload` enquanto `isDirty`, removendo o listener no `cleanup` e ao
  salvar; mensagem genérica (os navegadores ignoram texto custom).
- Exemplo prático: `useEffect(() => { if (!isDirty) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [isDirty]);`
- Benefícios: `useBlocker` não cobre recarregar nem fechar a aba; sem isso a guarda tem buraco.
- Evidência: com formulário sujo, F5 mostra o aviso nativo; após salvar, não mostra.

### 127 — [F] `isDirty` de verdade nos 5 formulários (U5)
- Descrição: implementar `isDirty` comparando estado atual com o inicial (sem `react-hook-form`, que está
  instalado e não é usado em nenhum arquivo — A25): helper `useDirtyTracker(initial, current)` com comparação
  rasa por campo.
- Exemplo prático: aplicar em `NewOrderDialog`, `RiskRulesPage`, `AlertConfigurationsPage`, `MapsSettingsPage`,
  `IPWhitelistPage`.
- Benefícios: guarda de saída sem `isDirty` confiável gera aviso em tela limpa (pior que não ter).
- Evidência: abrir e fechar cada tela sem tocar em nada → nenhum aviso; mudar 1 campo → aviso.

### 128 — [F] Guarda não dispara em navegação do próprio fluxo
- Descrição: a navegação feita pelo próprio formulário após salvar (ex.: voltar para a lista) marca
  `state.bypassGuard = true` e não é bloqueada.
- Exemplo prático: `navigate('/orders', { state: { bypassGuard: true }, replace: true })` após sucesso.
- Benefícios: evita o diálogo aparecer logo depois de salvar, que é o erro clássico de implementação de guarda.
- Evidência: salvar em `AlertConfigurationsPage` e ser redirecionado → sem diálogo.

### 129 — [F] Ações irreversíveis com `AlertDialog`, não `window.confirm`
- Descrição: substituir as 6 chamadas de `confirm`/`window.confirm` por `AlertDialog` com título que diz o que
  acontece, botão destrutivo nomeado pela ação ("Excluir configuração") e foco inicial no "Cancelar".
- Exemplo prático: `ProfilePage.tsx:389`, `AlertConfigCard.tsx:138`, `BatchActionsToolbar.tsx:48`,
  `OrderDetailModal.tsx:312`, `MapSettingsPanel.tsx:83,92`.
- Benefícios: `window.confirm` bloqueia a aba, não é estilizável, não é testável no Playwright sem handler e é
  invisível para o design system (N20); e "OK/Cancelar" não diz o que será feito.
- Evidência: `rg -n "window\.confirm|[^.]confirm\(" src` = 0; e2e clica em "Excluir configuração" no diálogo.

### 130 — [F] Ação destrutiva com consequência escrita
- Descrição: o corpo do `AlertDialog` diz o efeito concreto e irreversível ("O alerta de atraso para de ser
  notificado para todos os canais. Sem volta.").
- Exemplo prático: trocar `AlertConfigCard.tsx:138` ("Excluir a configuração de X? O alerta para de ser
  notificado.") para o `AlertDialog` com a mesma frase no corpo e o tipo do alerta em negrito.
- Benefícios: NN/g — confirmação genérica é clicada no automático; a específica é lida.
- Evidência: screenshot dos 6 diálogos com a consequência escrita.

### 131 — [F] Desfazer onde é possível, confirmar onde não é
- Descrição: para ações reversíveis (dispensar alerta, marcar como lido, remover favorito) trocar confirmação por
  toast com "Desfazer" de 8 s; manter confirmação só no irreversível.
- Exemplo prático: `Header.tsx:100` já faz `toast.success('Alerta dispensado')` — acrescentar
  `action: { label: 'Desfazer', onClick: undo }`.
- Benefícios: menos interrupção no fluxo mais repetido do dia; o operador para de temer clicar.
- Evidência: dispensar alerta mostra "Desfazer"; clicar restaura o alerta na lista.

### 132 — [F] Aprovação de motorista com próximo-da-fila explícito
- Descrição: depois de aprovar/rejeitar, a tela não navega: avança para o próximo item da fila com transição
  curta e mantém a URL com `?item=<id>`; "Fim da fila" é um estado de tela com link para `/drivers`.
- Exemplo prático: `ApprovalsPage` + `useApprovalActions`; a URL permite retomar a fila depois de um F5.
- Benefícios: a fila é trabalho em lote; hoje cada ação volta para o topo da lista e o operador reencontra o lugar
  à mão.
- Evidência: aprovar 3 em sequência sem tocar na lista; F5 no meio retoma no mesmo item.

### 133 — [F] Fila de aprovação com atalhos reais
- Descrição: implementar de fato `a` (aprovar), `x` (rejeitar), `j/k` (próximo/anterior) prometidos no guia
  (`keyboard-shortcuts-help.tsx:44-47`), com confirmação só na rejeição e foco visível no item corrente.
- Exemplo prático: registro de atalhos por rota (`src/lib/shortcuts.ts`, etapa 91) com `scope: '/approvals'`.
- Benefícios: ou os atalhos existem, ou saem do guia (N23); existindo, a fila fica 3× mais rápida no teclado.
- Evidência: e2e: `j`,`j`,`a` aprova o terceiro item; o guia lista só atalhos com handler.

### 134 — [F] Importação de CSV como fluxo de 4 passos
- Descrição: onde houver importação em massa (contatos, IP whitelist, base CRM), padronizar: Selecionar arquivo →
  Mapear colunas → Pré-visualizar com erros por linha → Confirmar; com contagem de válidos/invalidos e download do
  relatório de erro.
- Exemplo prático: `src/components/import/ImportWizard.tsx` reutilizando o `Stepper` da etapa 118; usado por
  `ContactsPage` e `IPWhitelistPage`.
- Benefícios: importação sem pré-visualização é a forma mais rápida de sujar o banco de produção.
- Evidência: importar CSV com 2 linhas inválidas mostra as 2 linhas, importa as válidas e oferece o relatório.

### 135 — [F] Importação não perde progresso ao navegar
- Descrição: o wizard de importação registra `isDirty` (etapa 127) e, durante o envio, bloqueia a navegação com
  mensagem própria ("Importação em andamento — sair cancela o restante").
- Exemplo prático: `useUnsavedChangesGuard({ when: status === 'uploading', message: '…' })`.
- Benefícios: sair no meio do upload deixa metade dos registros dentro e metade fora, sem rastro.
- Evidência: iniciar importação e clicar no menu → diálogo específico; confirmar cancela e informa quantas linhas entraram.

### 136 — [F] Configuração de alertas com salvamento explícito
- Descrição: `AlertConfigurationsPage`/`AlertConfigCard` passam a ter "Salvar" e "Cancelar" por cartão, com
  `isDirty` por cartão e aviso ao sair com cartão aberto em edição (`AlertConfigCard.tsx:138` hoje entra em
  edição inline sem fechamento claro).
- Exemplo prático: `setIsEditing(true)` registra o cartão no `dirtyRegistry`; `Cancelar` restaura o valor inicial.
- Benefícios: configuração de notificação é a tela que mais gera "alterei e não salvou".
- Evidência: editar um cartão e navegar → diálogo; cancelar restaura o valor anterior visualmente.

### 137 — [F] `MapsSettingsPage` sem cabeçalho concorrente e com guarda
- Descrição: migrar para `PageHeader` (etapa 80), remover o `<Link to="/settings">` local
  (`MapsSettingsPage.tsx:333-337`) e aplicar `isDirty` + guarda (U5).
- Exemplo prático: o Voltar do cabeçalho já leva a `/settings` por `parent` na config (etapa 9).
- Benefícios: 963 linhas de configuração de provedor de mapa com custo por chamada — sair sem salvar é prejuízo
  operacional, não só UX.
- Evidência: a tela tem 1 `h1` e 1 Voltar; alterar provedor e navegar → diálogo.

### 138 — [F] Fluxo de troca de motorista com confirmação tipada
- Descrição: `OrderDetailModal.tsx:312` (`confirm('Confirmar solicitação de troca de motorista?')`) vira
  `AlertDialog` com o nome do motorista atual, o custo possível e o id do pedido.
- Exemplo prático: "Trocar o motorista do pedido LAL-1234? O motorista João (placa ABC-1234) será liberado e a
  Lalamove pode cobrar nova taxa."
- Benefícios: é uma ação que custa dinheiro e chama a API da Lalamove; confirmação genérica não é suficiente.
- Evidência: o diálogo mostra pedido, motorista e aviso de taxa; cancelar não chama a edge.

### 139 — [F] Ações em lote com resumo antes de executar
- Descrição: `BatchActionsToolbar.tsx:48` pergunta item por item dentro de um loop. Trocar por um `AlertDialog`
  único com o resumo ("Enviar mensagem para 12 pedidos?") e progresso durante a execução, com possibilidade de
  parar.
- Exemplo prático: lista dos ids afetados (até 5 + "e mais 7") e barra de progresso com contagem.
- Benefícios: hoje o operador clica em "OK" 12 vezes num `confirm` nativo e não pode interromper.
- Evidência: selecionar 12 pedidos → 1 diálogo; cancelar no meio para a execução e informa quantos foram enviados.

### 140 — [F] Erro de fluxo não fecha o diálogo
- Descrição: padronizar: erro em qualquer passo mantém o diálogo aberto, mostra a mensagem no passo que falhou e
  oferece "Tentar de novo"; só o sucesso fecha.
- Exemplo prático: `NewOrderDialog.tsx:366` já volta para `'form'` em erro de cotação — estender para o erro de
  criação (`:395`) e manter o `error` visível junto do botão.
- Benefícios: erro que fecha o diálogo faz o operador recomeçar; é a reclamação mais comum em fluxo de pedido.
- Evidência: simular 500 na edge `lalamove-api` → diálogo aberto, mensagem no passo 3, dados preservados.

### 141 — [F] Timeout de cotação com caminho de saída
- Descrição: o contador de expiração da cotação (`useQuotationExpiry`, usado em `NewOrderDialog.tsx:15`) ao
  expirar não deve travar o passo: mostrar "Cotação expirada" com "Cotar de novo" (reusando os dados) e "Voltar
  ao formulário".
- Exemplo prático: `QuotedStep` (`:1077`) com `onRequote` já existente, mais o estado expirado explícito.
- Benefícios: expiração silenciosa levava a criar pedido com preço velho (erro da API) ou a fechar o diálogo.
- Evidência: forçar expiração → os dois botões aparecem e "Cotar de novo" reaproveita o formulário.

### 142 — [T] Testes do wizard e da guarda
- Descrição: Vitest para `useDirtyTracker`, `useUnsavedChangesGuard` (com `createMemoryRouter`) e para o
  rascunho (salvar/retomar/expirar/limpar no logout).
- Exemplo prático: `src/hooks/__tests__/useUnsavedChangesGuard.test.tsx` com `blocker.state === 'blocked'`.
- Benefícios: guarda de saída é código de borda que ninguém testa à mão e que, quando falha, falha calado.
- Evidência: 10 testes verdes; cobertura dos novos hooks ≥ 85%.

### 143 — [T] E2E do fluxo de novo pedido com interrupção
- Descrição: spec que preenche 2 passos, fecha, reabre, retoma, obtém cotação (mock da edge), navega para fora,
  é bloqueada, volta e conclui.
- Exemplo prático: estender `e2e/new-order-autocomplete.e2e.ts` com `page.route('**/lalamove-api', mock)`.
- Benefícios: é o fluxo que gera receita; hoje nenhuma spec cobre interrupção (N28).
- Evidência: spec verde no job e2e; remover o rascunho deixa vermelho.

### 144 — [T] E2E das confirmações destrutivas
- Descrição: spec que percorre as 6 ações destrutivas e verifica: diálogo com consequência escrita, foco no
  "Cancelar", Esc cancela, e a ação só ocorre no clique do botão destrutivo.
- Exemplo prático: `await expect(page.getByRole('alertdialog')).toContainText('Sem volta');`
- Benefícios: garante que ninguém reintroduza `window.confirm` (que a spec não conseguiria nem clicar sem handler).
- Evidência: spec verde; `page.on('dialog')` nunca é acionado durante a spec.

## Bloco 7 — Integração: URL como estado, modais endereçáveis e multi-aba (145–164)

### 145 — [F] Contrato de query params da app
- Descrição: documentar e implementar um contrato único: `q` (busca), `status`/`severity`/`groupBy` (filtros),
  `page`, `sort`, e `pedido`/`motorista`/`alerta` (overlay aberto). Helper `useUrlState(key, default, { replace })`
  que decide entre `push` e `replace` por tipo de parâmetro.
- Exemplo prático: `OrdersPage.tsx:38-68` repete 3 vezes o mesmo `new URLSearchParams(searchParams)`; o helper
  elimina a repetição e padroniza `replace: true` para digitação e `push` para abertura de modal.
- Benefícios: filtro digitado não deve criar 12 entradas no histórico (hoje cada tecla da busca pode criar uma);
  abrir um modal deve criar exatamente uma.
- Evidência: digitar "ABC" em `/orders` cria 1 entrada de histórico; abrir detalhe cria 1.

### 146 — [F][D] `OrderDetailModal` endereçável por URL (U3)
- Descrição: a tela de pedidos passa a ler `?pedido=<internalOrderId>`; abrir o detalhe faz
  `setSearchParams({ pedido: id })` (push) e fechar remove o parâmetro (push) — então o Voltar do navegador fecha.
- Exemplo prático: substituir `OrdersPage.tsx:70,233,261` (`selectedOrder`/`detailModalOpen` em `useState`) por
  `const orderId = searchParams.get('pedido')` + query por id.
- Benefícios: link de pedido compartilhável no Bitrix/WhatsApp, F5 mantém o detalhe aberto, Voltar fecha (N17).
- Evidência: abrir `/orders?pedido=LAL-123` direto mostra o modal; `page.goBack()` fecha e mantém os filtros.

### 147 — [F] Modal por URL busca o pedido se não estiver na lista
- Descrição: quando o id da URL não está na página atual da lista, buscar o registro por id em vez de mostrar
  modal vazio.
- Exemplo prático: `useQuery(['order', orderId], fetchOrderById, { enabled: Boolean(orderId) })` com skeleton no
  modal enquanto carrega.
- Benefícios: sem isso, o link compartilhado só funciona se o destinatário estiver na mesma página de filtro.
- Evidência: abrir `/orders?pedido=<id da página 7>` com filtro padrão → modal carrega o pedido.

### 148 — [F] `NewOrderDialog` por URL (`?novo=1`)
- Descrição: o diálogo de novo pedido abre por parâmetro, permitindo link direto ("criar pedido") do dashboard,
  do FAB e de fora da app.
- Exemplo prático: `OrdersPage.tsx:160,264` → `setSearchParams({ novo: '1' })`; o rascunho (etapa 120) se combina
  com isso.
- Benefícios: atalho operacional real ("abrir direto o formulário") e Voltar fecha o wizard pela regra única.
- Evidência: `/orders?novo=1` abre o wizard; Voltar fecha com a confirmação se houver dado.

### 149 — [F] `DriverProfileModal` e demais detalhes por URL
- Descrição: aplicar o mesmo padrão em motoristas (`?motorista=`), alertas (`?alerta=`) e incidentes
  (`?incidente=`).
- Exemplo prático: componente genérico `useOverlayParam('motorista')` que devolve `[id, open, close]`.
- Benefícios: consistência: uma regra de Esc, Voltar e compartilhamento para todos os detalhes.
- Evidência: as 4 telas de lista abrem o detalhe por URL; teste de tabela cobre as 4.

### 150 — [F] Esc fecha o overlay e limpa o parâmetro
- Descrição: `onOpenChange(false)` remove o parâmetro da URL (push), de forma que Esc, clique no backdrop, botão X
  e Voltar do navegador produzam o mesmo resultado.
- Exemplo prático: `const close = () => { const p = new URLSearchParams(searchParams); p.delete('pedido'); setSearchParams(p); }`.
- Benefícios: hoje Esc fecha o modal e a URL fica igual — então o Voltar do navegador leva para a tela anterior,
  não "desfaz" o Esc; comportamento imprevisível.
- Evidência: Esc → URL sem `pedido`; Voltar depois do Esc volta a abrir o modal (desfaz), que é o esperado.

### 151 — [F] Busca global preserva o termo na URL
- Descrição: ao escolher um resultado da busca que leva a uma lista, navegar com `?q=<termo>` para que o Voltar
  devolva a lista **com** o termo; a busca em si (paleta) não entra no histórico.
- Exemplo prático: resultado "Pedidos com ABC" → `/orders?q=ABC`; `CommandPalette` fecha com `replace`.
- Benefícios: hoje o operador busca, abre o resultado, volta e precisa digitar o termo de novo (N17 + `OrdersPage.tsx:29`).
- Evidência: buscar "ABC", abrir resultado, Voltar → `/orders?q=ABC` com o campo preenchido.

### 152 — [F] Paleta de comandos não quebra o Voltar
- Descrição: abrir/fechar a paleta nunca cria entrada no histórico; a navegação escolhida cria uma única entrada.
- Exemplo prático: estado local da paleta (não URL) + `navigate(path)` único no `onSelect`.
- Benefícios: evita o Voltar "que só fecha a paleta" repetidas vezes.
- Evidência: abrir e fechar a paleta 5 vezes e apertar Voltar → sai da tela atual, não 5 cliques.

### 153 — [F] Filtros com `replace`, ações com `push`
- Descrição: aplicar a regra do helper (etapa 145): digitação e troca de filtro usam `replace`; paginação,
  abertura de overlay e mudança de aba usam `push`.
- Exemplo prático: `OrdersPage.tsx:52` (debounce da busca) passa a `setSearchParams(p, { replace: true })`;
  `:68` (página) mantém push.
- Benefícios: o histórico passa a representar passos do usuário, não teclas digitadas.
- Evidência: digitar 5 letras + trocar de página = 2 entradas de histórico (teste com `page.goBack()` duas vezes).

### 154 — [F] Abas internas na URL
- Descrição: telas com abas (`OrderDetailModal`, `SettingsPage`, `SecurityDashboardPage`) guardam a aba ativa em
  `?aba=`, com `replace`, para que F5 e link mantenham a aba e o Voltar troque de aba.
- Exemplo prático: `OrderDetailModal` tem seções longas (`:611-1010`); `?pedido=LAL-1&aba=pod` abre direto na POD.
- Benefícios: suporte da operação manda "veja a POD do pedido X" e o link leva exatamente lá.
- Evidência: `/orders?pedido=LAL-1&aba=pod` abre o modal na aba de comprovante.

### 155 — [F] "Abrir em nova aba" em itens de lista
- Descrição: linhas de tabela e cartões ganham `<a href>` para o detalhe (mesmo abrindo modal no clique normal),
  com `onClick` chamando `preventDefault` só quando não há modificador.
- Exemplo prático: `OrdersTable` — `<a href={\`/orders?pedido=${id}\`} onClick={e => { if (e.metaKey||e.ctrlKey||e.button===1) return; e.preventDefault(); open(id); }}>`.
- Benefícios: o operador compara dois pedidos em duas abas — fluxo real que hoje é impossível (N17).
- Evidência: Ctrl+clique numa linha abre nova aba com o modal aberto.

### 156 — [F] `target="_blank"` sempre com `rel` e aviso
- Descrição: auditar os `window.open` existentes (`OrderDetailModal.tsx:583,687`, link de imagem `:964`) para
  usar `rel="noopener noreferrer"` (já presente em parte) e indicar visualmente "abre em nova aba" com ícone +
  `aria-label`.
- Exemplo prático: `<ExternalLink className="w-3 h-3" aria-hidden /><span className="sr-only">abre em nova aba</span>`.
- Benefícios: WCAG 3.2.5 (Change on Request) — abrir aba sem aviso desorienta, sobretudo com leitor de tela.
- Evidência: `rg -n "window.open|target=\"_blank\"" src` com 100% dos casos tendo `rel` e aviso.

### 157 — [F] Estado compartilhado entre abas com `BroadcastChannel`
- Descrição: canal `lalamove-ui` para sincronizar entre abas: tema, sidebar recolhida, categorias abertas, logout
  e invalidação de queries após criar/cancelar pedido.
- Exemplo prático: `src/lib/uiChannel.ts` com `postMessage({ type: 'order-created', id })` e, no receptor,
  `queryClient.invalidateQueries({ queryKey: ['orders'] })`.
- Benefícios: o operador trabalha com 2–3 abas; hoje criar pedido numa aba deixa a outra com lista velha (N28).
- Evidência: criar pedido na aba A → a lista da aba B atualiza em < 2 s sem F5.

### 158 — [F] Logout propaga para todas as abas
- Descrição: `signOut` publica no canal; as outras abas limpam o cache, apagam rascunhos (etapa 121) e navegam
  para `/auth` com `replace`.
- Exemplo prático: receptor em `AuthProvider`: `if (msg.type === 'signed-out') { queryClient.clear(); navigate('/auth', { replace: true }); }`.
- Benefícios: segurança operacional em máquina compartilhada; hoje a segunda aba continua mostrando dado do
  usuário anterior até o token expirar.
- Evidência: logout na aba A → aba B em `/auth` em < 2 s, cache vazio.

### 159 — [F] Fallback sem `BroadcastChannel`
- Descrição: onde a API não existir (navegador antigo/ambiente de teste), usar o evento `storage` do
  `localStorage` como transporte; a API do `uiChannel` não muda.
- Exemplo prático: `const post = 'BroadcastChannel' in window ? bc.postMessage : (m) => localStorage.setItem('ui-msg', JSON.stringify({ ...m, t: Date.now() }))`.
- Benefícios: não introduzir dependência de API moderna num fluxo de segurança (logout).
- Evidência: teste com `BroadcastChannel` deletado do `window` → sincronização por `storage` funciona.

### 160 — [F] Mensagens do canal são dados, não comandos
- Descrição: validar toda mensagem recebida com zod antes de agir; nunca aceitar path arbitrário para navegar nem
  executar nada vindo do canal além de um conjunto fechado de tipos.
- Exemplo prático: `const Msg = z.discriminatedUnion('type', [...]); const parsed = Msg.safeParse(e.data); if (!parsed.success) return;`
- Benefícios: `BroadcastChannel` é por origem, mas qualquer código na página pode publicar; validação evita
  navegação forçada.
- Evidência: publicar `{type:'navigate',path:'https://externo'}` no canal não muda a rota (teste unitário).

### 161 — [F] Preferências de navegação sincronizadas
- Descrição: sidebar recolhida (etapa 54), categorias abertas (etapa 53) e `data-reduce-motion`/`font-scale`
  (etapas 75, 112) viajam pelo canal, para que as abas não "briguem".
- Exemplo prático: um `usePersistedSyncedState(key, default)` que grava no `localStorage` e publica no canal.
- Benefícios: consistência percebida: o usuário não vê a mesma app com dois layouts.
- Evidência: recolher a sidebar na aba A → aba B recolhe.

### 162 — [F] Deep-link de fora da app (Bitrix/WhatsApp/e-mail)
- Descrição: garantir que os links canônicos (`/orders?pedido=`, `/live-map?motorista=`, `/approvals?item=`)
  funcionem deslogado → login → destino (etapa 15), com `parent` para o Voltar (etapa 30).
- Exemplo prático: documentar os links em `docs/agentes/regras-dominio.md` e usar nas notificações da edge
  `send-notification`.
- Benefícios: a notificação deixa de levar ao dashboard; é o que torna o alerta acionável em um clique.
- Evidência: e2e: abrir link canônico deslogado → login → destino exato com overlay aberto.

### 163 — [T] Testes de estado na URL
- Descrição: Vitest para `useUrlState`/`useOverlayParam` (push vs. replace, limpeza, valor inválido) e para o
  validador do canal.
- Exemplo prático: `src/hooks/__tests__/useUrlState.test.tsx` com `createMemoryRouter` e histórico inspecionável.
- Benefícios: push/replace errado é invisível em teste manual e destrói a experiência do Voltar.
- Evidência: 12 testes verdes; trocar um `replace` por `push` deixa vermelho.

### 164 — [T] E2E multi-aba
- Descrição: spec com dois `context.newPage()`: criar pedido na aba A e verificar atualização na B; logout na A e
  redirect na B; preferência de sidebar sincronizada.
- Exemplo prático: `const [a, b] = [await ctx.newPage(), await ctx.newPage()]`.
- Benefícios: multi-aba é o modo real de uso da operação e não tem nenhuma cobertura hoje (N28).
- Evidência: spec verde no job e2e.

## Bloco 8 — Métricas, telemetria e iteração (165–182)

### 165 — [F][D] Tabela de eventos de navegação (U8) 🔒
- Descrição: migration criando `ui_navigation_events` (`id`, `user_id` default `auth.uid()`, `session_id`,
  `event`, `from_path`, `to_path`, `via`, `duration_ms`, `viewport`, `created_at`) com RLS: `INSERT` para
  `authenticated` só com `user_id = auth.uid()`; `SELECT` só para `manager+`. Partição ou `pg_cron` de retenção
  de 90 dias.
- Exemplo prático: `supabase/migrations/<ts>_ui_navigation_events.sql`, seguindo o fluxo de `docs/agentes/banco.md`
  (arquivo → PR → merge → apply).
- Benefícios: sem dado não há como provar que o Voltar melhorou; e o dono recusou provedor externo (custo).
- Evidência: 🔒 PR aberta para o dono; depois do apply, `select count(*) from ui_navigation_events` cresce com uso.

### 166 — [F] `trackNavigation()` no cliente
- Descrição: serviço que enfileira eventos (buffer de 10 ou 5 s, `navigator.sendBeacon` no `pagehide`) e envia em
  lote; nunca bloqueia a navegação; respeita a preferência de telemetria do usuário.
- Exemplo prático: `src/services/navigationTelemetry.ts` chamado no mesmo efeito do `document.title` (etapa 67).
- Benefícios: medição com custo de rede quase nulo; sem isso, cada navegação seria um request.
- Evidência: navegar 20 telas gera ≤ 3 requests (aba Network).

### 167 — [F] Eventos mínimos instrumentados
- Descrição: `route_change` (from, to, via: menu|breadcrumb|back-button|browser-back|swipe|shortcut|deep-link|
  fab|search), `back_click`, `browser_back`, `overlay_open/close`, `wizard_step`, `wizard_abandon`,
  `guard_blocked`, `dead_end` (tela sem saída), `rage_click`.
- Exemplo prático: o `BackButton` envia `{ event: 'back_click', via: 'button', from, to }`; o
  `useNavigationHistory` detecta `POP` e envia `browser_back`.
- Benefícios: permite responder as perguntas dos KPIs abaixo sem adivinhação.
- Evidência: tabela com os 10 tipos de evento presentes após 1 dia de uso em produção.

### 168 — [F] KPI 1 — uso do Voltar da app × Voltar do navegador
- Descrição: painel com a razão `back_click / browser_back` por rota e por dispositivo.
- Exemplo prático: query em `AdminTelemetriaPage` (já existe a tela, `/telemetria`, admin): `select to_path, count(*) filter (where event='back_click'), count(*) filter (where event='browser_back') from ui_navigation_events group by 1`.
- Benefícios: se o navegador domina numa rota, é sinal de que o botão da app está mal posicionado ou escondido ali.
- Evidência: painel mostrando as 10 rotas com maior uso do Voltar do navegador.

### 169 — [F] KPI 2 — telas sem saída (dead ends)
- Descrição: rota onde a próxima ação do usuário é `browser_back` ou fechar a aba em > 30% das visitas, e rotas
  cuja única saída é o menu.
- Exemplo prático: `dead_end` registrado quando a visita dura > 3 s e termina em `POP` sem nenhum clique interno.
- Benefícios: aponta onde falta ação primária ou link de continuação (hoje suspeito: `/unauthorized`,
  `/notification-history`, `/cache-status`).
- Evidência: lista ordenada no painel; cada item vira etapa de correção na iteração (etapa 182).

### 170 — [F] KPI 3 — tempo de tarefa
- Descrição: medir 4 tarefas de ponta a ponta: criar pedido, aprovar motorista, achar um pedido por código,
  responder um alerta crítico — do primeiro clique ao evento de conclusão.
- Exemplo prático: `task_start`/`task_end` com `task_id` emitidos pelas telas envolvidas; p50 e p90 por semana.
- Benefícios: é a métrica que o dono entende: "aprovar motorista caiu de 48 s para 22 s".
- Evidência: painel com p50/p90 das 4 tarefas, série semanal.

### 171 — [F] KPI 4 — abandono do wizard por passo
- Descrição: funil dos 4 passos do novo pedido com taxa de saída por passo e taxa de retomada de rascunho.
- Exemplo prático: `wizard_step` + `wizard_abandon` + `draft_resumed`.
- Benefícios: mostra se o problema é endereço, serviço ou preço — hoje só se sabe que o pedido não foi criado.
- Evidência: funil com os 4 passos; after/before da etapa 120 (rascunho) comparável.

### 172 — [F] KPI 5 — rage clicks e cliques mortos
- Descrição: detectar 3+ cliques no mesmo elemento em 1 s e cliques em elementos sem handler; agregar por
  seletor estável (`data-track-id`).
- Exemplo prático: listener global no `AppLayout` com `closest('[data-track-id]')`; adicionar `data-track-id` nos
  controles de navegação.
- Benefícios: aponta botão que parece clicável e não é, e lentidão percebida (clicar 3× no menu em rede lenta).
- Evidência: top 10 seletores com rage click no painel; o nº 1 vira etapa de correção.

### 173 — [F] KPI 6 — profundidade e largura da navegação
- Descrição: distribuição de profundidade por sessão (quantas telas antes de concluir a tarefa) e quantas rotas
  distintas são usadas por papel.
- Exemplo prático: `select role, count(distinct to_path) from … group by 1`.
- Benefícios: valida U6 (rotas sem menu): se 40 das 55 rotas nunca são visitadas, o menu é o problema — ou as
  telas são.
- Evidência: relatório mensal com rotas sem nenhuma visita em 30 dias.

### 174 — [F] Painel de navegação em `/telemetria`
- Descrição: acrescentar uma aba "Navegação" na tela de telemetria existente (admin), com os 6 KPIs, filtro de
  período e de papel.
- Exemplo prático: `src/pages/AdminTelemetriaPage.tsx` + `?aba=navegacao` (etapa 154).
- Benefícios: o dono vê o efeito do plano sem pedir relatório; evita criar tela nova (a rota já existe e tem RBAC).
- Evidência: `/telemetria?aba=navegacao` mostra os 6 KPIs com dado real.

### 175 — [F] Consentimento e anonimização da telemetria
- Descrição: a telemetria é interna e identificada por `user_id`, mas não grava conteúdo (nenhum termo de busca,
  nenhum id de pedido no `to_path` — substituir por `:id`); a preferência do usuário pode desligar.
- Exemplo prático: normalizar `to_path`: `/orders?pedido=LAL-1` → `/orders?pedido=:id`.
- Benefícios: evita vazar dado de cliente numa tabela de métrica e reduz cardinalidade (consulta mais rápida).
- Evidência: `select distinct to_path from ui_navigation_events` sem nenhum valor com id real.

### 176 — [F] Heatmap de cliques próprio (sem provedor externo)
- Descrição: amostrar 5% das sessões gravando coordenada relativa (grade de 20×20 do viewport) dos cliques por
  rota; renderizar como mapa de calor no painel.
- Exemplo prático: `click_grid` com `cell_x`, `cell_y`, `route`, `viewport_bucket` — sem screenshot, sem gravação
  de sessão.
- Benefícios: mostra se o FAB (etapa 82) e o Voltar (etapa 24) estão onde a mão vai; sem custo de ferramenta.
- Evidência: heatmap das 5 rotas mais usadas em mobile e desktop.

### 177 — [F] Feedback in-app contextual
- Descrição: botão "Esta tela te ajudou?" (👍/👎 + campo opcional) no rodapé do `PageHeader`, gravando rota,
  papel e viewport; aparece no máximo 1× por rota por semana.
- Exemplo prático: tabela `ui_feedback` com RLS de insert próprio; reutiliza o padrão da etapa 165. 🔒
- Benefícios: liga o número ("tempo de tarefa subiu") à razão ("o filtro de data não existe aqui").
- Evidência: 20 respostas na primeira semana; relatório agrupado por rota no painel.

### 178 — [F][D] Infraestrutura mínima de A/B
- Descrição: `useExperiment('back-button-label', ['icone', 'icone+texto'])` com atribuição estável por hash do
  `user_id`, registrada no evento de navegação; sem serviço externo.
- Exemplo prático: `src/lib/experiment.ts` com `variant = hash(userId + key) % 2`; a variante entra no `via` do evento.
- Benefícios: decide por dado as escolhas com opinião forte (rótulo do Voltar, FAB mobile, posição do breadcrumb).
- Evidência: duas variantes distribuídas ~50/50 e comparáveis no painel.

### 179 — [T] Primeiro experimento: rótulo do Voltar
- Descrição: A = seta só; B = seta + "Voltar para <destino>". Medir `back_click` por visita, tempo de tarefa e
  uso do Voltar do navegador por 2 semanas.
- Exemplo prático: `useExperiment('back-label')` dentro do `BackButton` (etapa 22).
- Benefícios: resolve U1 com dado em vez de preferência; o rótulo custa largura no cabeçalho.
- Evidência: relatório com as duas variantes e a decisão registrada neste plano (seção 3).

### 180 — [T] Segundo experimento: FAB mobile contextual × ausente
- Descrição: A = FAB com ação primária (etapa 82); B = sem FAB. Medir conclusão da ação primária e rage clicks no
  canto inferior direito.
- Exemplo prático: variante controla a renderização em `MobileBottomNav`.
- Benefícios: o FAB cobre conteúdo (N27, etapa 105); só o dado justifica mantê-lo.
- Evidência: relatório com taxa de uso do FAB; se < 3%, remover.

### 181 — [C] Alerta de regressão de navegação
- Descrição: job semanal (ou `escalate-alerts`) que compara os KPIs com a semana anterior e notifica quando
  `browser_back` sobe > 20% ou `dead_end` aparece em rota nova.
- Exemplo prático: query agendada por `pg_cron` publicando em `alerts` com `alert_type` novo. 🔒
- Benefícios: o plano não termina no merge; regressão de UX passa a ter alarme como regressão de sistema.
- Evidência: alerta disparado num teste controlado (inserir dado sintético).

### 182 — [D] Rotina de iteração mensal
- Descrição: reunião curta (dono + agente) sobre: 3 piores telas por `dead_end`, top 3 rage clicks, funil do
  wizard e feedback in-app; cada item vira uma etapa com arquivo e linha.
- Exemplo prático: registrar as decisões em `docs/planos/PLANO_UX_NAVEGACAO_200_ETAPAS.md` (seção Status) e abrir
  as etapas correspondentes.
- Benefícios: evita que o plano vire documento morto; é o mecanismo que mantém os números melhorando.
- Evidência: primeira ata registrada no plano com 3 itens acionáveis.

## Bloco 9 — Testes de navegação, documentação e rollout (183–200)

### 183 — [T] Suíte e2e `navegacao.e2e.ts` (desktop)
- Descrição: spec base com `storageState` de `operator`: menu → 10 rotas, breadcrumb, Voltar, scroll, título da
  aba, foco no `h1`; cada verificação com asserção explícita.
- Exemplo prático: `for (const r of ROTAS) { await page.getByRole('link', { name: r.label }).click(); await expect(page).toHaveURL(r.path); await expect(page).toHaveTitle(new RegExp(r.label)); }`
- Benefícios: hoje nenhuma das 7 specs navega pelo menu (N28); essa spec vira a rede de segurança do plano.
- Evidência: spec verde no job `E2E (Playwright)` com 10 rotas × 5 asserções.

### 184 — [T] Suíte e2e mobile (390×844)
- Descrição: mesma cobertura em mobile: bottom nav com 5 itens fixos, gaveta, Voltar único no cabeçalho, swipe-back,
  FAB contextual, sem overflow horizontal.
- Exemplo prático: `test.describe('mobile', () => { test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); … })`.
- Benefícios: a operação usa celular em campo; as decisões U2/U7 só se sustentam com teste.
- Evidência: spec verde; `document.documentElement.scrollWidth <= clientWidth` em 10 rotas.

### 185 — [T] Suíte e2e tablet (820×1180)
- Descrição: sidebar recolhida, breadcrumb compacto, Voltar no cabeçalho, nenhum elemento sobreposto.
- Exemplo prático: comparar screenshots com baseline (`toHaveScreenshot`) nas 5 rotas principais.
- Benefícios: o tablet é o tamanho que ninguém testa e onde `hidden md:block`/`md:hidden` costumam colidir
  (`AppLayout.tsx:303-311`, `Header.tsx:131`).
- Evidência: 5 screenshots estáveis; mudança de layout exige atualizar a baseline na PR.

### 186 — [T] E2E de RBAC × navegação por papel
- Descrição: para cada papel (admin, manager, operator, viewer), percorrer o menu visível e garantir que nenhum
  item leva a `/unauthorized`; complementa a etapa 60 do PLANO_FRONTEND_190.
- Exemplo prático: `for (const link of await page.getByRole('navigation').getByRole('link').all()) { … expect(page).not.toHaveURL('/unauthorized') }`.
- Benefícios: o desalinhamento menu × rota (N12, A23) é o jeito mais rápido de fazer o operador achar que está
  sem permissão para o próprio trabalho.
- Evidência: matriz 4 papéis × menu visível verde.

### 187 — [T] E2E do Voltar do navegador em 6 cenários
- Descrição: `page.goBack()` após: filtro, paginação, abrir modal, mudar aba interna, login, wizard — conferindo
  que cada um desfaz exatamente um passo.
- Exemplo prático: `await page.goBack(); await expect(page.getByRole('dialog')).toHaveCount(0);`
- Benefícios: é a verificação que prova as etapas 145–154 (push vs. replace).
- Evidência: 6 cenários verdes.

### 188 — [T] E2E de deep-link em aba nova
- Descrição: abrir 8 rotas profundas direto pela URL, em contexto limpo, verificando título, breadcrumb, Voltar
  com destino de pai e ausência de erro de console.
- Exemplo prático: `const ctx = await browser.newContext({ storageState: 'e2e/fixtures/operator.json' })`.
- Benefícios: o caso em que a heurística atual de `history.length` erra (N4) passa a ser testado.
- Evidência: 8 rotas verdes; `page.on('console')` sem `error`.

### 189 — [T] Teste de regressão visual do cabeçalho e navegação
- Descrição: `toHaveScreenshot` do `header`, `aside` e `nav` em 3 viewports × 2 temas, com máscara nas áreas de
  contador (badges variam).
- Exemplo prático: `await expect(page.locator('header')).toHaveScreenshot('header-desktop-dark.png', { mask: [page.locator('[data-badge]')] })`.
- Benefícios: consistência visual (bloco 4) regride em qualquer PR de Tailwind; a imagem é a única prova prática.
- Evidência: 12 baselines no repo; diff acima de 0,2% derruba o job.

### 190 — [T] Teste de performance de navegação no CI
- Descrição: além da duração (etapa 78), medir no CI o número de componentes remontados por navegação
  (`react` profiler em modo de teste) e falhar se `Sidebar`/`Header` remontarem.
- Exemplo prático: `render` com `onRender` do `<Profiler>` contando `mountCount`.
- Benefícios: trava a correção de N1/A6; é fácil alguém reintroduzir `key={pathname}` numa PR de animação.
- Evidência: teste verde; reintroduzir o `key` deixa vermelho com mensagem clara.

### 191 — [T] Testes unitários dos componentes de navegação
- Descrição: `BackButton`, `PageHeader`, `SmartBreadcrumbs`, `MobileBottomNav`, `Sidebar` com `MemoryRouter`:
  renderização por contexto, `aria-*`, destino do clique, visibilidade.
- Exemplo prático: `src/components/layout/__tests__/` com 5 arquivos; usar `ROUTES` de teste, não a real.
- Benefícios: hoje nenhum componente de layout tem teste; cobertura exigida é 70% (`vitest.config.ts`).
- Evidência: `npx vitest run src/components/layout` verde; cobertura dos 5 arquivos ≥ 80%.

### 192 — [C] Guard de CI para a fonte única de rotas
- Descrição: script `scripts/ci/check-route-config.mjs` que falha se houver `path="` literal em `src/App.tsx`
  fora da config, `pageConfig`, `routeLabels` manual, `moreMenuItems` ou `pageImports` — o mesmo padrão dos
  guards existentes. 🔒 (toca em CI)
- Exemplo prático: rodar junto de `check-agents-md-integrity.mjs` no job `lint-and-typecheck`, com teste próprio
  em `scripts/ci/check-route-config.unit.mjs` (`node --test`).
- Benefícios: a fonte única só continua única se o CI cobrar; esse é o risco nº 1 do plano.
- Evidência: `node scripts/ci/check-route-config.mjs` verde no HEAD; reintroduzir `pageConfig` derruba.

### 193 — [C] Orçamento de bundle para a navegação
- Descrição: fixar limite para o chunk do layout/navegação (meta: < 60 KB gzip) e falhar o build se exceder;
  depende de `manualChunks` (A15 do PLANO_FRONTEND_190).
- Exemplo prático: `rollupOptions.output.manualChunks` separando `layout` e checagem de tamanho no job `build`.
- Benefícios: a navegação é carregada em 100% das sessões; cada KB aqui é pago por todo usuário.
- Evidência: job `build` imprime o tamanho do chunk `layout` e falha acima do limite.

### 194 — [F] Documentar a navegação em `docs/agentes/navegacao.md`
- Descrição: página curta com: a config como fonte única, a matriz do Voltar (seção 2.2), contrato de query
  params (etapa 145), regra de push/replace, overlays na URL e os eventos de telemetria.
- Exemplo prático: referenciar de `AGENTS.md` na seção "Serviços"/"Stack", como já se faz com `banco.md` e
  `deploy.md`.
- Benefícios: evita que a próxima sessão de agente reinvente `pageConfig`; o `AGENTS.md` manda corrigir o doc no
  mesmo PR do fix.
- Evidência: arquivo criado, linkado em `AGENTS.md`, e `node scripts/ci/check-agents-md-integrity.mjs` verde. 🔒

### 195 — [F] Atualizar `docs/planos/README.md`
- Descrição: acrescentar a linha deste plano na tabela do índice, com o resumo de conteúdo e as decisões U1–U10.
- Exemplo prático: ver `README_ROW.md` entregue junto deste plano.
- Benefícios: o índice é a porta de entrada dos planos; plano fora dele não é achado.
- Evidência: `docs/planos/README.md` com 6 linhas na tabela.

### 196 — [F] Remover o código morto de navegação
- Descrição: depois das migrações, apagar: `pageConfig`, `moreMenuItems`, `routeLabels`/`routeToSection` manuais,
  `pageQuickActions` estático, o `BackButton` do `MobileSidebar`, o segundo modal de atalhos,
  `SwipeableApprovalCard` (se o swipe da etapa 109 não o reaproveitar) e o `useAccessibility` esvaziado.
- Exemplo prático: uma PR só de remoção, depois de as etapas que os substituem estarem mergeadas.
- Benefícios: `AGENTS.md` proíbe deixar código morto; e cada duplicata é uma fonte de divergência futura (N11).
- Evidência: `rg -n "pageConfig|moreMenuItems|SwipeableApprovalCard" src` = 0; bundle menor no relatório do build.

### 197 — [C] Rollout por etapas com flag
- Descrição: as mudanças de maior percepção (Voltar hierárquico, modal na URL, FAB mobile, transição CSS) atrás de
  flags locais (`localStorage` + config), ligadas primeiro para admin, depois para todos.
- Exemplo prático: `src/lib/flags.ts` com `isEnabled('nav-v2')`; a flag também entra no evento de telemetria.
- Benefícios: permite reverter uma peça sem reverter o bloco; e comparar KPIs com e sem.
- Evidência: flag desligada reproduz o comportamento antigo (teste e2e com as duas variantes).

### 198 — [D] Piloto com 3 operadores por 1 semana
- Descrição: ligar `nav-v2` para 3 usuários reais, coletar os 6 KPIs e o feedback in-app, comparar com a semana
  anterior; decidir seguir, ajustar ou reverter.
- Exemplo prático: registrar no plano os números antes/depois das 4 tarefas da etapa 170.
- Benefícios: 200 etapas de navegação mudam o hábito de quem usa o sistema todo dia; piloto evita rejeição em bloco.
- Evidência: relatório do piloto com os números e a decisão escrita.

### 199 — [D] Liberar para 100% e fixar baselines
- Descrição: remover a flag, fixar as baselines de screenshot (etapa 189), os limites de duração (etapa 78) e o
  orçamento de bundle (etapa 193) como contrato de regressão.
- Exemplo prático: PR final que apaga `flags.ts` da navegação e atualiza as baselines.
- Benefícios: o estado bom passa a ser o padrão defendido pelo CI, não uma conquista temporária.
- Evidência: `rg -n "nav-v2" src` = 0; os 3 jobs de regressão verdes na `main`.

### 200 — [D] Fechar o plano com o antes/depois
- Descrição: atualizar a seção Status com 200/200, anexar a tabela de KPIs antes/depois, listar o que foi
  decidido em U1–U10 e abrir as 3 primeiras etapas do próximo ciclo (saídas da etapa 182).
- Exemplo prático: tabela com `back_click/browser_back`, `dead_end`, p50/p90 das 4 tarefas e abandono do wizard,
  em 22/11/2026 × data de fechamento.
- Benefícios: deixa provado o que mudou no negócio, não só no código — e dá o ponto de partida do ciclo seguinte.
- Evidência: plano com Status 200/200 e a tabela comparativa preenchida com dado de produção.

---

## Status

| Data | Concluídas | Observação |
|---|---|---|
| 22/11/2026 | **0/200** | Plano criado a partir da auditoria de navegação de `origin/main` @ `4ee7ef0`. Nada executado. Pendente de decisão do dono: U1–U10 (as 🔒 são U4, U8 e as etapas 116, 165, 177, 181, 192, 194 — CI, DDL e dado pessoal no navegador). |

Blocos: 0 (1–20) fonte única de rotas · 1 (21–40) botão Voltar · 2 (41–58) breadcrumbs e hierarquia ·
3 (59–78) feedback da transição · 4 (79–96) consistência · 5 (97–116) acessibilidade ·
6 (117–144) fluxos complexos · 7 (145–164) URL, modais e multi-aba · 8 (165–182) métricas ·
9 (183–200) testes, documentação e rollout.
