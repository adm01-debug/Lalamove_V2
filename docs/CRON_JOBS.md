# ⏱️ Cron Jobs & Rotinas de Manutenção

Documentação viva dos jobs `pg_cron` e das rotinas de manutenção do banco de dados.
Fonte de verdade: `cron.job` / `cron.job_run_details`. Última auditoria: 12/07/2026.

---

## Jobs ativos (`pg_cron`)

| Job ID | Nome | Schedule (cron) | Frequência | Função executada |
|--------|------|-----------------|------------|------------------|
| 1 | `provision-tracking-partitions` | `5 0 1 * *` | Dia 1 de cada mês, 00:05 | `public.provision_tracking_partitions()` |
| 2 | `prune-tracking-partitions` | `20 0 2 * *` | Dia 2 de cada mês, 00:20 | `public.prune_tracking_events_partitions(6)` |

> Observação: no momento da auditoria não há histórico em `cron.job_run_details`
> (jobs recém-registrados ou ainda sem execução no ciclo mensal).

---

## Detalhamento das rotinas

### 1. `provision_tracking_partitions()`
Cria antecipadamente as partições mensais de `tracking_events` para o mês atual
e os 2 meses seguintes (via `ensure_tracking_events_partition`). Idempotente:
partições já existentes são ignoradas. Migra linhas presas na partição DEFAULT
quando necessário e aplica RLS + política de SELECT espelhando a tabela-pai.

### 2. `prune_tracking_events_partitions(p_retention_months integer DEFAULT 6)`
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

O agendamento contém segredos (URL/anon key) e deve ser feito via ferramenta de
inserção — **não** via migração — para não vazar em remixes:

```sql
select cron.schedule(
  'daily-cleanup',
  '0 3 * * *', -- todo dia às 03:00
  $$ select public.run_daily_cleanup_with_logging(); $$
);
```

---

## Observabilidade

- Health por job: RPC `get_cron_jobs_health(p_runs_window integer DEFAULT 20)`
  (apenas admins) retorna último status, duração, taxa de falha e execuções
  consideradas por job.
- Painel: **System Health** consome essa RPC para exibir status e alertas de falha.
- Logs de execução das rotinas com logging: tabela `cron_job_logs`.

---

**Versão:** 1.0.0 · **Mantido por:** Engenharia de Dados
