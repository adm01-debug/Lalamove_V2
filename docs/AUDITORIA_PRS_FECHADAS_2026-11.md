# Auditoria das PRs fechadas sem merge — 2026-11-21 (byte a byte)

> Objetivo: garantir que **nenhum** trabalho de agente/bot foi perdido ao fechar PRs sem
> merge. Método: para cada PR fechada, a **lista completa de arquivos tocados** foi obtida
> via GraphQL (`pullRequests(states:CLOSED){files{path additions deletions}}`) e comparada
> com o estado atual da `main`. Nenhuma PR fechada tocou código: **25 de 25 mexem apenas em
> `package.json` + `package-lock.json`**, exceto a #89 (ver abaixo). Por isso a comparação
> versão-alvo × versão instalada cobre **100% do conteúdo** desses diffs.

## Resultado: 25/25 fechadas sem perda

| PR(s) | arquivos tocados (GraphQL) | pacote | alvo | no `main` hoje | veredito |
|---|---|---|---|---|---|
| #4 | package.json + lock | @lovable.dev/cloud-auth-js | 1.1.2 | `^1.0.0` → **resolvido 1.1.2** no lockfile | incorporado |
| #7, #23, #33 | package.json + lock | @radix-ui/react-collapsible | 1.1.20 | ^1.1.20 | incorporado |
| #16 | package.json + lock | zod | 4.4.3 | ^4.4.3 | incorporado (#91) |
| #21, #35 | package.json + lock | @radix-ui/react-menubar | 1.1.24 | ^1.1.24 | incorporado |
| #22, #34 | package.json + lock | jsdom | 30.0.1 | ^30.0.1 | incorporado |
| #27 | package.json + lock | date-fns | 4.4.0 | ^4.4.0 | incorporado |
| #28 | package.json + lock | @hookform/resolvers | 5.9.1 | ^5.9.1 | incorporado |
| #29 | package.json + lock | @radix-ui/react-radio-group | 1.4.7 | ^1.4.7 | incorporado |
| #30 | package.json + lock | @radix-ui/react-navigation-menu | 1.2.22 | ^1.2.22 | incorporado |
| #31 | package.json + lock | @radix-ui/react-checkbox | 1.3.11 | ^1.3.11 | incorporado |
| #32 | package.json + lock | @radix-ui/react-progress | 1.1.16 | ^1.1.16 | incorporado |
| #42 | package.json + lock | autoprefixer | 10.5.5 | ^10.5.5 | incorporado (#52) |
| #43 | package.json + lock | @supabase/supabase-js | 2.116.0 | ^2.116.0 | incorporado (#52) |
| #44 | package.json + lock | @radix-ui/react-tabs | 1.1.21 | ^1.1.21 | incorporado (#52) |
| #46 | package.json + lock | mapbox-gl / @types/mapbox-gl | 3.30.0 / 3.5.0 | ^3.30.0 / ^3.5.0 | incorporado — **mas removeu `@types/geojson`, que quebrou 8 tipos; reposto na #117** |
| #47 | package.json + lock | @radix-ui/react-separator | 1.1.15 | ^1.1.15 | incorporado (#52) |
| #48 | package.json + lock | @radix-ui/react-avatar | 1.2.6 | ^1.2.6 | incorporado (#52) |
| #49 | package.json + lock | sonner | 2.0.8 | ^2.0.8 | incorporado (#52) |
| #51 | package.json + lock | @radix-ui/react-slider | 1.4.7 | ^1.4.7 | incorporado (#52) |
| #74 | package.json + lock | typescript-eslint | 8.71.1 | ^8.71.1 | incorporado |
| **#89** | **só `.github/workflows/ci.yml` (+1 / −0)** | — | — | — | **diff literal = uma linha em branco no fim do arquivo. Zero conteúdo.** Diagnóstico de `startup_failure`, superado pelo fix real (#90, pin `ubuntu-24.04`, mergeado) |

### #89 — diff verbatim

```diff
@@ -123,3 +123,4 @@ jobs:
       - uses: actions/checkout@v7
       - name: Deploy Edge Functions
         run: echo "Deploy automático via Lovable"
+
```

## Trabalho que estava pela metade e foi concluído em 21/11

Bumps mergeados que deixaram o código quebrado — todos fechados na #117
(`tsc -p tsconfig.app.json`: 24 erros → 0):

| origem | o que ficou pela metade |
|---|---|
| mapbox-gl 3.30 (#46/#52) | `@types/geojson` sumiu; `mapbox-gl.d.ts` depende dele → 8 erros |
| zod 4 (#91) | `ZodError.errors` → `.issues` → 4 erros |
| react-router-dom 7 (#99) | prop `future` removida do `BrowserRouter` → 1 erro |
| @supabase/supabase-js 2.116 (#52) | `RejectExcessProperties` em `.update()/.insert()` → 11 erros |

## Branches

- Toda branch `claude/*` foi apagada **apenas após squash-merge confirmado** na `main`
  (protegida, 7 required checks — merge recusado com HTTP 405 enquanto algum falha).
- `contexto`: branch órfã (sem ancestral comum com `main`), journal do workflow agendado
  "Contexto para agentes de IA" — **manter**, não é código.
- PR **#116** (outro agente, aberta): `ErrorBoundary` + `VALIDATE CONSTRAINT`. Não tocada —
  conferido em produção (read-only) que a validação é segura: 50 pedidos, 0 violariam o
  CHECK, e `pg_constraint.convalidated` já está `true`.
