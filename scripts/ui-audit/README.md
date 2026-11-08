# scripts/ui-audit — auditoria de layout

Guardas de layout das páginas que rodam dentro do `AppLayout`. Portados do Zapp Web V2 e adaptados ao
contrato daqui: **o `<main>` do shell é quem rola** (`src/components/layout/AppLayout.tsx:322`) e **cada
página paga o próprio padding** — não existe `ViewContainer` neste repo.

| Arquivo | O que faz |
|---|---|
| `layout-guard.mjs` | Lê `src/App.tsx`, pega só as rotas dentro de `<Route element={<AppLayout />}>` e audita o `className` da raiz JSX de cada página. |
| `root-className.mjs` | Extrator da raiz JSX (tag + className). Usado pelo guard; sem dependência externa. |
| `width-check.mjs` | Predicado puro: overflow horizontal e "faixa morta" (conteúdo mais estreito que o `main`). |
| `width-regression.mjs` | Mede as rotas reais em Chromium a 1280x800 e 1920x1080 e aplica o predicado. |
| `layout-guard.unit.mjs`, `width-check.unit.mjs` | Testes (`node --test`). |

## Como rodar

```sh
node scripts/ui-audit/layout-guard.mjs            # exit 0 = sem violação, 1 = violação
node --test scripts/ui-audit/*.unit.mjs

# width-regression exige dev server + sessão autenticada (as páginas são protegidas):
npm run dev                                        # porta 8080
npx playwright open --save-storage=.auth/state.json http://localhost:8080
STORAGE_STATE=.auth/state.json node scripts/ui-audit/width-regression.mjs
```

Variáveis: `APP_URL` ou `VITE_PORT` (padrão `http://localhost:8080`), `STORAGE_STATE` (obrigatório no
`width-regression.mjs`; exit 2 sem ele — ele nunca mede a tela de login fingindo que mediu a página).

**Secrets: nenhum.** O `storageState.json` contém token de sessão — mantenha fora do git (`.auth/` não
está versionado) e nunca cole o conteúdo em PR ou chat.

## Regras do `layout-guard`

1. `overflow-y-auto`/`overflow-auto` na raiz — quem rola é o `<main>`; raiz rolando cria scroll aninhado.
2. `h-screen`/`min-h-screen`/`h-[100vh]`/`h-[100dvh]` na raiz — o shell já limita a viewport
   (`AppLayout.tsx:288`); repetir dobra a altura.
3. `h-full` em raiz flex-row sem `w-full`/`flex-1` — a faixa encolhe para o conteúdo.
4. Raiz **DOM** sem padding horizontal (`p-*`/`px-*`/`pl-*`/`pr-*`) — o `<main>` não dá gutter nenhum, o
   conteúdo cola na sidebar. Não vale quando a raiz é componente wrapper (ex.: `<PullToRefresh>`), porque
   aí o padding pode estar legitimamente dentro dele.

Exceções: `LiveMapPage` e `HeatmapPage` (tela cheia de propósito) estão em `TELA_CHEIA` no guard.

## O que NÃO foi portado do Zapp (e por quê)

- **Regra `p-6` duplica o gutter**: é o oposto do contrato daqui. No Zapp o `ViewContainer` aplica o
  gutter; aqui a página aplica (`src/pages/OrdersPage.tsx:112`). Virou a regra 4, invertida.
- **`view-container-padding.unit.mjs`**: audita `TalkXView`/`MultiplixView` e a premissa "o gutter é
  exclusivo do `ViewContainer`". Não existe `ViewContainer` em `src/` neste repo (`grep -rl ViewContainer src/`
  não retorna nada) e as telas são de outro produto.
- **`contacts-navy-header.unit.mjs`**: exige `<h1 className="sr-only">Contatos</h1>`, ausência de
  `PageHeader` e duas decisões de design em `docs/design/` e `docs/audits/`. Aqui
  `src/pages/ContactsPage.tsx:75` tem um `<h1>` **visível** por decisão própria e nenhum daqueles
  documentos existe.
