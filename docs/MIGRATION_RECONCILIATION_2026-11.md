# Reconciliação ledger × schema × repo — 2026-11-21

> Verificado via Management API (read-only) no projeto `iecgydonctmabiijadsf` e
> na árvore do repo em `main`. Base da migration de baseline
> `20261122120000..120200`.

## Números

| Fonte | Quantidade |
|---|---|
| Versões no ledger (`supabase_migrations.schema_migrations`) | 164 |
| Arquivos `.sql` em `supabase/migrations/` | 160 |
| Arquivos do repo ausentes no ledger | 0 |
| Versões no ledger sem arquivo no repo | 4 |
| Tabelas reais em `public` | 64 (+ partições de `tracking_events`) |

## 4 versões no ledger sem arquivo (entradas de reparo, `statements = NULL`)

`20260712195203`, `20260723174708`, `20260821130000`, `20260831204251` — marcadas
aplicadas sem DDL (reparo de ledger via CLI/Lovable). Não reproduzíveis em
`db reset`. Ação: aceitar como histórico; não recriar.

## DDL no ledger como aplicado, mas AUSENTE na produção

Estas migrations estão no ledger **e** no repo, porém os objetos que criam não
existem no banco (marcadas aplicadas sem rodar — padrão de sync Lovable):

| Objeto | Migration de origem | Existe na produção? |
|---|---|---|
| `job_queue` + `add_job`/`get_next_jobs`/`mark_job_*`/`cancel_job`/`cleanup_old_jobs`/`get_queue_stats` | `20251226010000_create_job_queue_system` | **não** |
| `system_logs` | `20251226000001_create_system_logs` | **não** |
| `audit_log` | `20251226000002_create_audit_log` | **não** |
| `cache_views` | `20251226000004_create_cache_views` | **não** |
| `saved_filters` | `20241231000000` / `20250102000001` | **não** |
| `entity_versions` | `20241231000001` | **não** |

Consequência: `db reset` local **cria** esses objetos (os arquivos existem), mas a
produção **não os tem**. Qualquer código que dependa deles (`job-worker`,
`useJobQueue`, `JobQueuePage`, `docs/JOB_QUEUE_SYSTEM.md`) está quebrado em
produção. O ledger **não** é um proxy confiável do schema.

## Decisão

1. **A fonte de verdade é o schema real, não o ledger.** Toda migration nova
   usa `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS` para ser
   idempotente nos dois mundos.
2. O baseline recria `job_queue` (parte 3/3) para valer em produção.
3. `system_logs`, `audit_log`, `cache_views`, `saved_filters`, `entity_versions`:
   avaliar se são realmente usados antes de recriar — vários parecem artefatos
   Lovable não consumidos pelo código atual. **Pendência do dono**: decidir
   recriar ou remover os arquivos e registrar reparo no ledger.
4. Sem `supabase migration repair` na produção sem o dono — pode mascarar mais
   drift.

## Como foi medido (reproduzível)

```sql
-- objetos reivindicados vs reais
select to_regclass('public.job_queue');          -- null
select count(*) from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace
  where n.nspname='public' and pr.proname='mark_job_completed';  -- 0
-- ledger
select version from supabase_migrations.schema_migrations order by version;  -- 164
```
