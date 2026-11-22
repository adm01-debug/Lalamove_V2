# ⏱️ Cron Jobs & Rotinas de Manutenção

Documentação viva dos jobs `pg_cron` e das rotinas de manutenção do banco de dados.
Fonte de verdade: `cron.job` / `cron.job_run_details`. Última auditoria: 24/11/2026.

> Para o estado real em produção rode
> `select jobname, schedule, active from cron.job order by jobname;`.
> Este documento reflete o que as migrations do repositório agendam.

---

## Jobs ativos (`pg_cron`)

### Edge functions (via `net.http_post` / dispatcher)

| Job | Schedule | Frequência | Alvo |
|-----|----------|------------|------|
| `process-job-queue` | `* * * * *` | 1 min | `public.process_job_queue(10)` → drena `job_queue` para `job-worker` |
| `check-driver-alerts` | `*/2 * * * *` | 2 min | `/functions/v1/check-driver-alerts` (Guardian System) |
| `escalate-unacknowledged-alerts` | `*/5 * * * *` | 5 min | `/functions/v1/escalate-alerts` |
| `lalamove_uapi_token_refresh_hourly` | `17 * * * *` | 1 h | `/functions/v1/lalamove-token-refresh` |

Migrations: `20261122140000_fix_crons_dispatcher.sql` (`process-job-queue`,
`escalate-unacknowledged-alerts`, `lalamove_uapi_token_refresh_hourly`) e
`20261123190000_cron_check_driver_alerts.sql` (`check-driver-alerts`).

A chave usada no header vem de `vault.decrypted_secrets` (nome `dispatcher_key`),
nunca embutida no SQL. Sem esse secret o agendamento não é criado e a migration
emite `WARNING`.

### Geo / mapas

| Job | Schedule | Frequência | Função executada |
|-----|----------|------------|------------------|
| `geo-jobs-refresh` | `1-59/5 * * * *` | 5 min | `public.refresh_geo_jobs()` — enfileira `eta_refresh` e `route_plan` |
| `geo-cache-prune` | `15 3 * * *` | diário 03:15 | `DELETE FROM public.geo_cache WHERE expires_at < now()` |

Migrations: `20261121194500_geo_jobs_scheduler.sql`, `20261122130100_geo_foundation.sql:200`.

### Cache / materialized views

| Job | Schedule | Frequência | O que atualiza |
|-----|----------|------------|----------------|
| `refresh-cache-views` | `3 * * * *` | 1 h (minuto 3) | `public.refresh_cache_views()` |
| `refresh-driver-stats-cache` | `*/15 * * * *` | 15 min | Estatísticas por motorista |
| `refresh-delivery-hourly-stats` | `5 * * * *` | 1 h | Agregado horário de entregas |
| `refresh-risk-distribution` | `*/30 * * * *` | 30 min | Distribuição de risco |

> `refresh-driver-stats-cache` aparece em duas migrations
> (`20251226000004_create_cache_views.sql` e
> `20251226020000_create_materialized_views_cache.sql`). `cron.schedule` com o
> mesmo `jobname` substitui o agendamento, então não há duplicidade em produção —
> o schedule efetivo é `*/15 * * * *`.

### Limpeza e retenção

| Job | Schedule | Frequência | O que remove |
|-----|----------|------------|--------------|
| `cleanup-old-jobs` | `0 3 * * *` | diário 03:00 | Jobs antigos da fila |
| `daily-cleanup-tokens-and-attempts` | `0 3 * * *` | diário 03:00 | Tokens de reset expirados, tentativas de login antigas |
| `daily-cleanup-with-logging` | `45 3 * * *` | diário 03:45 | Igual acima, com log em `cron_job_logs` |
| `cleanup_audit_logs_daily` | `45 3 * * *` | diário 03:45 | Audit logs fora da janela de retenção |
| `cleanup-old-region-cache` | `50 3 * * *` | diário 03:50 | Cache de região antigo |
| `cleanup-processing-logs` | `0 4 * * *` | diário 04:00 | `job_queue_processing_log` antigo |
| `cleanup-old-cron-logs` | `15 4 * * 0` | domingo 04:15 | `cron_job_logs` com mais de 30 dias |
| `weekly-cleanup-cron-logs` | `0 4 * * 0` | domingo 04:00 | Logs de cron antigos |

### Partições de `tracking_events`

| Job | Schedule | Frequência | Função executada |
|-----|----------|------------|------------------|
| `provision-tracking-partitions` | `5 0 1 * *` | dia 1 de cada mês, 00:05 | `public.provision_tracking_partitions()` |
| `prune-tracking-partitions` | `20 0 2 * *` | dia 2 de cada mês, 00:20 | `public.prune_tracking_events_partitions(6)` |

---

## Detalhamento das rotinas de partição

### `provision_tracking_partitions()`
Cria antecipadamente as partições mensais de `tracking_events` para o mês atual
e os 2 meses seguintes (via `ensure_tracking_events_partition`). Idempotente:
partições já existentes são ignoradas. Migra linhas presas na partição DEFAULT
quando necessário e aplica RLS + política de SELECT espelhando a tabela-pai.

### `prune_tracking_events_partitions(p_retention_months integer DEFAULT 6)`
Remove (DROP) partições de `tracking_events` mais antigas que a janela de
retenção (padrão: 6 meses). Deriva a data de corte a partir do nome da partição
(`tracking_events_yYYYYmMM`). Retorna JSON com as partições removidas.

---

## Rotinas de manutenção disponíveis (sob demanda / a agendar)

Estas funções existem e podem ser agendadas conforme a necessidade operacional:

| Função | Propósito | Retenção |
|--------|-----------|----------|
| `run_daily_cleanup()` | Limpa tokens expirados e tentativas de login antigas | Tokens: expirados; Login: 7 dias |
| `run_daily_cleanup_with_logging()` | Igual acima, registrando em `cron_job_logs` | — |
| `cleanup_expired_tokens()` | Remove tokens de reset expirados/usados | Usados: 7 dias |
| `cleanup_old_login_attempts()` | Remove tentativas de login e IPs bloqueados temporários | Tentativas: 7 dias; IPs temp: 1 dia |
| `cleanup_old_cron_logs()` | Remove logs de cron antigos | 30 dias |

### Como agendar uma rotina diária de limpeza

```sql
select cron.schedule(
  'daily-cleanup',
  '0 3 * * *', -- todo dia às 03:00
  $$ select public.run_daily_cleanup_with_logging(); $$
);
```

`cron.schedule` usa o `jobname` como chave: chamar de novo com o mesmo nome
substitui o agendamento em vez de criar um duplicado. É o que torna as
migrations de cron idempotentes.

---

## Observabilidade

- Health por job: RPC `get_cron_jobs_health(p_runs_window integer DEFAULT 20)`
  (apenas admins) retorna último status, duração, taxa de falha e execuções
  consideradas por job.
- Painel: **System Health** consome essa RPC para exibir status e alertas de falha.
- Logs de execução das rotinas com logging: tabela `cron_job_logs`.

---

**Versão:** 2.0.0 · **Mantido por:** Engenharia de Dados