# P-10 · Scripts com chaves legacy hardcoded (12+ arquivos de diagnóstico)

**Status:** Decidido manter como estão (sem referência ativa)
**Origem:** auditoria de segredos 2026-11-26 (sessão)

## Contexto
- scripts/seed-database.ts (único referenciado em package.json, npm run seed) foi corrigido via PR #93 (lê SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY de env vars; service role de verdade). PR #93 MERGEADA 2026-11-26.
- ~12 scripts de diagnóstico restantes ainda têm chaves legacy hardcoded (anon ...Us06x... e service_role ...EvEAz... — todas 401 após rotação).

## Decisão (registrada)
- Manter os scripts de diagnóstico como estão: sem referência ativa, sem regressão funcional. NÃO hardcodar a secret nova neles.
- Se um script precisar rodar, exportar SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ACCESS_TOKEN no ambiente (regra de docs/agentes/banco.md).

## Impacto no negócio
- Nenhum — chaves já desabilitadas; código de diagnóstico inerte. Evita risco de vazar a secret nova em commit.
