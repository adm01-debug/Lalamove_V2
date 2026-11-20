# P-08 · geo_blocks sem RLS (acesso do front)

**Status:** OBSOLETO — verificado no banco real (2026-11-20, via PAT/PostgREST)
**Origem:** docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md (linha rls)

> **Verificação real:** `geo_blocks` tem 5 policies RLS ativas no banco de produção: admin INSERT/UPDATE/DELETE/ALL + manager SELECT (query `pg_policies`). O controle de segurança já existe — a lacuna era do doc de contexto, não do banco.

## Problema
`geo_blocks` é acessada do front (src/pages/GeoBlockingPage.tsx) sem RLS encontrado nas migrations do repo. As demais telas de admin têm policy por papel; esta pode estar aberta ou depender de camada não documentada.

## Impacto no negócio
- Bloqueio geográfico é controle de segurança; sem RLS, qualquer autenticado pode ler/alterar a lista de geo-blocks.

## Ação
- Verificar no banco real (P-05 destrava) se geo_blocks tem policy; se não, migration aditiva criando policies admin-only (padrão das demais: admins ALL, managers SELECT — ver docs/contexto regras B).
- Regra 8: DDL em produção — confirmar com o dono.
