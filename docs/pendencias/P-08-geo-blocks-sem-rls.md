# P-08 · geo_blocks sem RLS (acesso do front)

**Status:** Pendente (gap de segurança)
**Origem:** docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md (linha rls)

## Problema
`geo_blocks` é acessada do front (src/pages/GeoBlockingPage.tsx) sem RLS encontrado nas migrations do repo. As demais telas de admin têm policy por papel; esta pode estar aberta ou depender de camada não documentada.

## Impacto no negócio
- Bloqueio geográfico é controle de segurança; sem RLS, qualquer autenticado pode ler/alterar a lista de geo-blocks.

## Ação
- Verificar no banco real (P-05 destrava) se geo_blocks tem policy; se não, migration aditiva criando policies admin-only (padrão das demais: admins ALL, managers SELECT — ver docs/contexto regras B).
- Regra 8: DDL em produção — confirmar com o dono.
