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
| `job_queue` + `add_job`/`get_next_jobs`/`mark_job_*`/`cancel_job`/`cleanup_old_jobs`/`get_queue_stats` | `20251226010000_create_job_queue_system` | **recriada em 21/11** (baseline `20261122120200`, PR #107) |
| `system_logs` | `20251226000001_create_system_logs` | não — decisão: não recriar |
| `audit_log` | `20251226000002_create_audit_log` | não — decisão: não recriar |
| `cache_views` | `20251226000004_create_cache_views` | não — substituída pelo cache da PR #106 |
| `saved_filters` | `20241231000000` / `20250102000001` | não — decisão: não recriar |
| `entity_versions` | `20241231000001` | não — decisão: não recriar |

## Decisão (fechada em 2026-11-21)

1. **A fonte de verdade é o schema real, não o ledger.** Toda migration nova
   usa `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS` para ser
   idempotente nos dois mundos.
2. `job_queue` foi recriada no baseline (`20261122120200`) e **aplicada na
   produção em 21/11** junto com `20261122120000` (enum) e `20261122120100`
   (colunas de integração) — ledger sincronizado.
3. **`system_logs`, `audit_log`, `cache_views`, `saved_filters`,
   `entity_versions`: NÃO recriar.** Verificação por code search no `main`
   (c730393): as únicas referências estão em `supabase/migrations/`, `docs/` e
   scripts one-off de reparo (`scripts/apply-sql-via-management-api.ts`,
   `scripts/fix-dashboard-via-api.ts`, edge `apply-fixes`) — nenhuma em `src/`
   nem nas edge functions de produto. São artefatos Lovable sem consumidor.
   O cache real do sistema é o da PR #106 (MVs + `cache_status` + RPC de
   refresh), confirmado presente na produção em 21/11.
4. **Os arquivos de migration permanecem no repo** como histórico: removê-los
   criaria entradas de ledger sem arquivo (mais drift aparente) e mudaria o
   comportamento do `db reset` local. Num reset local eles criam tabelas
   vazias inócuas.
5. Sem `supabase migration repair` na produção sem o dono — pode mascarar mais
   drift.

## Como foi medido (reproduzível)

```sql
-- objetos reivindicados vs reais
select to_regclass('public.job_queue');          -- agora: job_queue
select count(*) from pg_proc pr join pg_namespace n on n.oid=pr.pronamespace
  where n.nspname='public' and pr.proname='mark_job_completed';  -- agora: 1
-- ledger
select version from supabase_migrations.schema_migrations order by version;  -- 167
```
