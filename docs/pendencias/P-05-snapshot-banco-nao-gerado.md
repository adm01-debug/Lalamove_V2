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
- O gerador (`scripts/supabase_snapshot/snapshot.py`) conecta no Postgres via `SUPABASE_DB_URL`
  (connection string session-pooler, usuário postgres) — **PAT/Management API não substitui**;
  precisa da senha do banco, que só o dono tem.
- Não existe como secret no repo (secret ausente — ver estado persistente da sessão).

## Estado (2026-11-21)
- Bloqueio confirmado: o PAT Supabase disponível na sessão serve para a Management API
  (query SQL via REST), não para conexão Postgres do snapshot. Sem `SUPABASE_DB_URL` o job
  `banco` de `contexto.yml` roda só a suíte offline e sai verde com aviso.
- Enquanto isso, as pendências de banco (P-07/08/09) foram validadas **manualmente via
  Management API query** (search_path 47/47, policies geo_blocks, enums de status) e marcadas
  obsoletas — ver `_ordem.md`.
