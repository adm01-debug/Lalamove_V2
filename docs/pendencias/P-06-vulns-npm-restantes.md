# P-06 · Vulns npm restantes após PR #91

**Status:** Em andamento (dependabot)
**Origem:** PR #91 resolveu 14 vulns (zod, undici, brace-expansion); restaram outras

## Evidência
- CHANGELOG/commits main: 1ef5f30 "fix: resolve 14 vulns via npm audit (zod, undici, brace-expansion) (#91)".
- Dependabot abriu 7-10 PRs de upgrade que estavam paradas por startup_failure do GitHub Actions (ver resumo da sessão); re-trigger quando a CI ceder.

## Pendências
1. Revalidar/mergear PRs dependabot quando o startup_failure do GitHub ceder (7 upgrades limpas).
2. Atacar as vulns restantes: web-vitals #71 e vite #77 (major) já na fila; zod, undici, dompurify, brace-expansion, source-map-js precisam de fix.

## Impacto no negócio
- Vulnerabilidades altas abertas em dependências do frontend; risco de segurança e drift de versão.

## Regra 8
- Merge de PRs dependabot tocando package.json/lockfile exige CI verde (não é DDL; é dependência — validar antes).
