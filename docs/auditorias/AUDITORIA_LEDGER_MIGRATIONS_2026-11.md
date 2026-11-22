# Auditoria: ledger de migrations × schema real (2026-11-22)

Escopo: verificar par a par as 181 migrations do repo contra as 180 entradas de
`supabase_migrations.schema_migrations` em producao (`iecgydonctmabiijadsf`), e
distinguir *trabalho perdido* de *registro cosmetico*.

## Resultado

### Migrations no repo, ausentes do ledger (9)

| Versao | Arquivo | Efeito em producao |
|---|---|---|
| `20261121201800` | `indices_alert_id_created_by` | **NAO aplicado** — os 2 indices nao existiam em `pg_indexes`. Corrigido em `20261123170000_indices_fk_faltantes.sql`. |
| `20261122013022` | `geo_place_id_provider_prefix` | Aplicado (as 4 constraints `*_place_id_*_check` existem). Reescrito como no-op idempotente na PR #204. |
| `20261122150000` | `fix_alert_configs_anon_insert` | Aplicado — `pg_policies` nao tem nenhuma `Public can%`. |
| `20261122150100` | `fix_public_rls_bypass` | Aplicado — mesma verificacao acima. |
| `20261122160000` | `fix_supplier_notify_disabled` | Aplicado — `alert_configurations` com `SUPPLIER_DELAY_NOTICE`/`DRIVER_ASSIGNED` habilitados. |
| `20261123100000` | `geo_settings_auto_and_mapbox_only` | Aplicado — `geo_settings` com `route`/`tiles` = `mapbox`. |
| `20261123110000` | `cron_refresh_cache_views` | Aplicado — cron `refresh-cache-views` (jobid 26, `3 * * * *`). |
| `20261123150000` | `cache_refresh_log_restaurado` | **Novo** (PR #209) — tabela nunca existiu. |
| `20261123160000` | `job_queue_processing_log` | **Novo** (PR #209) — tabela nunca existiu. |

### Entradas no ledger, sem arquivo no repo (8)

Todas cosmeticas — nao ha trabalho perdido:

- `20241231000001` — `entity_versions`. Removida na PR #209 (codigo morto).
- `20260712195203`, `20260723174708` — `stub_aplicado_diretamente_no_banco(_2)`.
- `20260821130000` — `baseline_migracao_lovable_iecgydon`.
- `20260831204251` — `add_mcp_exec_helpers`.
- `20261121190000` — `validate_service_type_constraint`.
- `20261122005314`, `20261122005320` — as mesmas `fix_alert_configs_anon_insert` /
  `fix_public_rls_bypass` **re-registradas com versao antiga** (as versoes `2026112215*`
  do repo sao as que nao entraram). Mesmo SQL, ledger duplicado.

## Tabelas ausentes do schema real — decididas

| Tabela | Consumo no codigo | Decisao |
|---|---|---|
| `cache_refresh_log` | `refresh_cache_view` (log), `cache_status` (duracao) | **Criada** — `20261123150000`. A `20261122090000` (PR #106) recriou a funcao com `CREATE OR REPLACE` e perdeu o logging da `20250102000002`. |
| `job_queue_processing_log` | `process_job_queue`, `cleanup_processing_logs` | **Criada** — `20261123160000`. A `20251226010001` ficou fora do ledger e so a parte de cron foi aplicada. |
| `entity_versions` | nada no front; so statements mortas em `apply-fixes` | **Removida** — PR #209. |
| `system_logs`, `cache_views`, `saved_filters` | nada | Fora de escopo: nunca referenciadas fora de `apply-fixes` (tambem limpo). |

## Bugs encontrados no caminho

1. **`UNIQUE (view_name, status)`** em `cache_refresh_log` (arquivo original `20250102000002`):
   impedia mais de um `success` por view — o **segundo** refresh bem-sucedido estourava
   `23505`. Trocado por indice **parcial** sobre `running`, que e a intencao real.
2. **`cache_status` devolvia `refresh_duration_ms = NULL::integer` fixo** — a tela
   `/cache-monitoring` renderizava `"nullms"` em toda view (`CacheMonitoringPage.tsx:197`).
   Agora le o ultimo refresh bem-sucedido de `cache_refresh_log`.
3. **`apply-fixes/index.ts:26,34,35`** criava policies em `entity_versions` e
   `saved_filters`, tabelas inexistentes — toda rodada logava `ERR`.

## Verificado em producao

Tudo abaixo rodou de verdade contra `iecgydonctmabiijadsf`, nao em dry-run:

```
refresh: driver_stats_cache success dur=48 rows=20
         delivery_metrics_cache success dur=42 rows=20
         hourly_metrics_cache success dur=12 rows=49
cache_status: todas as 3 com refresh_duration_ms real e status=success
segundo refresh da mesma view: success (sem 23505)
view invalida: failed, sem excecao levantada
process_job_queue: processed=0 requeued=0, rodada registrada (dur=14)
cleanup_processing_logs: 0
indices: idx_order_geo_events_alert_id e idx_job_queue_created_by em pg_indexes
RLS: anon recebe 42501 nas 2 tabelas novas; cache_status (a que a tela usa) responde
```
