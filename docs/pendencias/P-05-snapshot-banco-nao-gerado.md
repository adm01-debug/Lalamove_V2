# P-05 · Snapshot do banco real (docs/contexto/supabase/) nunca gerado

**Status:** Bloqueado (sem credencial)
**Origem:** docs/contexto/00-INDEX.md — produtor do snapshot supabase/ nunca rodou; pasta vazia na branch contexto

## Problema
O contexto de banco (tabelas, colunas, RLS/políticas, funções, triggers, cron, storage — como está em produção) não existe. Toda afirmação sobre o banco real vira NÃO VERIFICADO.

## Evidência
- docs/contexto/00-INDEX.md linha "docs/contexto/supabase/ (ainda não existe — o produtor não rodou)".
- git ls-tree origin/contexto docs/contexto/ mostra apenas codigo/ e regras/, sem supabase/.

## Impacto no negócio
- Sem snapshot, decisões de migration/RLS dependem de leitura manual do painel; risco de divergência código x produção.

## Bloqueio
- O gerador (scripts/contexto/ ou equivalente) precisa de SUPABASE_ACCESS_TOKEN / SUPABASE_DB_URL, que não existem como secret no repo (secret ausente — ver estado persistente da sessão).
