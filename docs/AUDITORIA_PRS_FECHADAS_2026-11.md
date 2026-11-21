# Auditoria das PRs fechadas sem merge — 2026-11-21

> Objetivo: garantir que nenhum trabalho de agente/bot foi perdido ao fechar
> PRs sem merge. Metodo: PRs dependabot alteram **apenas** as strings de versao
> em `package.json`/`package-lock.json`; portanto comparar a versao-alvo da PR
> com a versao presente no `main` cobre 100% do conteudo do diff. Versoes do
> `main` lidas em `package.json` @ `c730393` (21/11).

## Resultado: 20/20 fechadas sem perda

| PR(s) fechada(s) | Pacote | Alvo da PR | No main hoje | Veredito |
|---|---|---|---|---|
| #7, #23, #33 | @radix-ui/react-collapsible | 1.1.20 | ^1.1.20 | incorporado (batch #52/bumps posteriores) |
| #16 | zod | 4.4.3 | ^4.4.3 | incorporado (#91 — fix de vulns) |
| #21, #35 | @radix-ui/react-menubar | 1.1.24 | ^1.1.24 | incorporado |
| #22, #34 | jsdom | 30.0.1 | ^30.0.1 | incorporado |
| #27 | date-fns | 4.4.0 | ^4.4.0 | incorporado |
| #28 | @hookform/resolvers | 5.9.1 | ^5.9.1 | incorporado |
| #29 | @radix-ui/react-radio-group | 1.4.7 | ^1.4.7 | incorporado |
| #30 | @radix-ui/react-navigation-menu | 1.2.22 | ^1.2.22 | incorporado |
| #31 | @radix-ui/react-checkbox | 1.3.11 | ^1.3.11 | incorporado |
| #32 | @radix-ui/react-progress | 1.1.16 | ^1.1.16 | incorporado |
| #42 | autoprefixer | 10.5.5 | ^10.5.5 | incorporado (#52) |
| #43 | @supabase/supabase-js | 2.116.0 | ^2.116.0 | incorporado (#52) |
| #44 | @radix-ui/react-tabs | 1.1.21 | ^1.1.21 | incorporado (#52) |
| #46 | mapbox-gl / @types/mapbox-gl | 3.30.0 / 3.5.0 | ^3.30.0 / ^3.5.0 | incorporado (diff da #46 conferido arquivo a arquivo) |
| #47 | @radix-ui/react-separator | 1.1.15 | ^1.1.15 | incorporado (#52) |
| #48 | @radix-ui/react-avatar | 1.2.6 | ^1.2.6 | incorporado (#52) |
| #49 | sonner | 2.0.8 | ^2.0.8 | incorporado (#52, declarado no titulo) |
| #51 | @radix-ui/react-slider | 1.4.7 | ^1.4.7 | incorporado (#52) |
| #74 | typescript-eslint | 8.71.1 | ^8.71.1 | incorporado |
| #89 | — (linha em branco no ci.yml) | diagnostico | — | obsoleta: o fix real do startup_failure foi o pin ubuntu-24.04 (#90, mergeada) |

## Branches

- Todas as branches `claude/*` desta e das sessoes anteriores foram apagadas
  **apenas apos squash-merge confirmado** na `main` (CI verde obrigatoria —
  branch protegida com 7 checks).
- `contexto`: branch orfa (sem ancestral comum com `main`), journal do
  workflow agendado "Contexto para agentes de IA" — **manter**, nao e codigo.
