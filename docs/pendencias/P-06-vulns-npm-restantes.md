# P-06 · Vulns npm restantes após PR #91

**Status:** CONCLUÍDO (PR #99 mergeada 2026-11-21 — 0 vulns restantes)
**Origem:** PR #91 resolveu 14 vulns (zod, undici, brace-expansion); restaram outras

## Resolução (PR #99, commit f1218b2)
Dono aprovou o bump major (item 2 dos próximos passos). Executado com diff mínimo:

| Pacote | Antes | Depois | Como |
|---|---|---|---|
| react-router-dom | 6.30.6 | **7.18.6** | bump direto — v7 re-exporta todos os símbolos usados (BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation, useNavigate, useSearchParams, 28 arquivos); React 18 satisfaz o peer. Zero mudança de código. |
| react-router | 6.30.6 (transitivo) | 7.18.6 | via react-router-dom |
| postcss-selector-parser | 6.0.10 (transitivo do typography) | **6.1.5** | `overrides` no package.json — evita o downgrade de @tailwindcss/typography para 0.5.4 que o `audit fix --force` sugeria |
| @tailwindcss/typography | 0.5.20 | 0.5.20 (mantido) | fix do transitivo, sem tocar o direto |

## Evidência real
- `npm audit` pós-fix: **found 0 vulnerabilities**
- `npm run build`: ✓ built in 2.13s
- `npm run lint`: 0 errors (532 warnings pré-existentes)
- CI da PR #99: 9/9 verde (incl. Deno Contract Tests, E2E, Vercel)
- Push pós-merge main `f1218b2`: CI/CD success
- Deploy produção: READY/PROMOTED em `f1218b2` (Vercel dpl_GcAfuAvVghe9R6zJtP1uUcaJQk84), site HTTP 200

## Histórico
- 2026-11-21: 4 vulns moderate (0 high) exigiam `--force` + bump major → AGUARDANDO HUMANO (goal seção 10).
- As 7 PRs dependabot paradas por `startup_failure` já foram MERGEADAS (#70-#77, CI verde).

## Regra 8
- Merge de PRs dependabot tocando package.json/lockfile exige CI verde (não é DDL; é dependência — validar antes).
