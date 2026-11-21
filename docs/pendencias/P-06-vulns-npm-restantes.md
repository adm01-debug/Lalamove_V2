# P-06 · Vulns npm restantes após PR #91

**Status:** AGUARDANDO HUMANO (fix exige bump major com `--force` — decisão do dono)
**Origem:** PR #91 resolveu 14 vulns (zod, undici, brace-expansion); restaram outras

## Evidência (npm audit em main, 2026-11-21)
Restam **4 vulns moderate, 0 high, 0 critical**. Todas exigem `--force` com bump major:
| Pacote | Severidade | Tipo | Fix disponível | Major? |
|---|---|---|---|---|
| react-router-dom | moderate | direto | 7.18.6 | SIM (6→7) |
| react-router | moderate | transitivo | via react-router-dom 7.18.6 | SIM |
| @tailwindcss/typography | moderate | direto | 0.5.4 | SIM |
| postcss-selector-parser | moderate | transitivo | via @tailwindcss/typography 0.5.4 | SIM |

As 7 PRs dependabot que estavam paradas por `startup_failure` do GitHub já foram MERGEADAS
(#70-#77, CI verde). O `startup_failure` cedeu.

## Pendência
- **Decisão do dono (bump major)**: react-router 6→7 é breaking para rotas/guards existentes
  (`src/App.tsx`, `ProtectedRoute`); @tailwindcss/typography 0.5.4 pode alterar estilos de markdown.
  O goal proíbe mudar comportamento de funcionalidade existente (seção 10) — por isso o item
  fica AGUARDANDO HUMANO, não executado.

## Regra 8
- Merge de PRs dependabot tocando package.json/lockfile exige CI verde (não é DDL; é dependência — validar antes).
