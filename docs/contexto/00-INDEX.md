# CONTEXTO PARA AGENTES DE IA — ÍNDICE ÚNICO

> Gerado automaticamente por indice.py · 2026-11-24 02:32 UTC · HEAD `e01dfaa269` · Não edite à mão.

Um sistema, três fontes de verdade, três produtores independentes. **Leia este arquivo e vá direto à fonte certa.** Cada fato tem um dono: se duas fontes discordarem, vale o dono.

## Onde está cada coisa

| Preciso de… | Fonte (dona do fato) | Onde ler | Estado |
|---|---|---|---|
| Regras que não podem ser quebradas: RLS por operação, estados e transições, validações, fórmulas, prazos, erros de negócio, testes como especificação, inconsistências código×schema (NÃO VERIFICADO) e regras humanas (`manual/`) | **regras de negócio** | `docs/contexto/regras/07-REGRAS-DE-NEGOCIO.md` | ok · 1 min atrás |
| Tabelas, colunas, RLS/políticas, funções, triggers, cron, storage, lints — **como está em produção agora** | **banco real** | `docs/contexto/supabase/README.md` | ok · 12 min atrás |
| Rotas, telas, módulos, hooks, edge functions, grafo de dependências, testes, scripts, convenções | **código** | `docs/contexto/codigo/INDEX.md` | ok · 0 min atrás |

## Ordem de leitura antes de qualquer tarefa ou planejamento

1. **regras de negócio** — Qualquer mudança de comportamento · Antes de criar status/valor/validação · Antes de planejar.
2. **banco real** — Vou tocar tabela/coluna/política/função SQL · Quero saber se algo existe de verdade no banco.
3. **código** — Vou mexer em tela/rota/hook/edge · Preciso saber onde uma coisa vive e quem a usa.

## Regras do protocolo

- Tabela/coluna/política existe? → **banco real**. Migrations do repo são histórico, não estado.
- Onde fica, quem chama, o que importa o quê? → **código**.
- Pode fazer isso? Qual estado vem depois? Qual o limite? → **regras de negócio** (inclui `manual/`, escrito por humanos, prioridade máxima).
- Item listado como **NÃO VERIFICADO** ou **inconsistência** em qualquer fonte: confirme na fonte dona antes de assumir.
- Nada aqui é editado à mão. Para registrar uma regra que só o negócio sabe, escreva em `manual/` da fonte de regras.

<details><summary>Arquivos de <b>banco real</b> (`docs/contexto/supabase/`)</summary>

- `docs/contexto/supabase/CHANGELOG.md`
- `docs/contexto/supabase/README.md`
- `docs/contexto/supabase/auth.md`
- `docs/contexto/supabase/cron-runs.md`
- `docs/contexto/supabase/cron.md`
- `docs/contexto/supabase/edge-functions.md`
- `docs/contexto/supabase/errors.md`
- `docs/contexto/supabase/extensions.md`
- `docs/contexto/supabase/foreign-servers.md`
- `docs/contexto/supabase/functions.md`
- `docs/contexto/supabase/grants.md`
- `docs/contexto/supabase/indexes.md`
- `docs/contexto/supabase/lints.md`
- `docs/contexto/supabase/manifest.json`
- `docs/contexto/supabase/migrations.md`
- `docs/contexto/supabase/policies.md`
- `docs/contexto/supabase/project-config.md`
- `docs/contexto/supabase/queues.md`
- `docs/contexto/supabase/realtime.md`
- `docs/contexto/supabase/relationships.md`
- `docs/contexto/supabase/roles.md`
- `docs/contexto/supabase/schemas.md`
- `docs/contexto/supabase/sequences.md`
- `docs/contexto/supabase/snapshot.json`
- `docs/contexto/supabase/stats.json`
- `docs/contexto/supabase/stats.md`
- `docs/contexto/supabase/storage.md`
- `docs/contexto/supabase/tables.md`
- `docs/contexto/supabase/tables/_supabase_internal_triggers.md`
- `docs/contexto/supabase/tables/public/active_tracking.md`
- `docs/contexto/supabase/tables/public/alert_configurations.md`
- `docs/contexto/supabase/tables/public/alert_dedup.md`
- `docs/contexto/supabase/tables/public/alerts.md`
- `docs/contexto/supabase/tables/public/alerts_sent.md`
- `docs/contexto/supabase/tables/public/audit_log.md`
- `docs/contexto/supabase/tables/public/auth_logs.md`
- `docs/contexto/supabase/tables/public/bitrix24_activities.md`
- `docs/contexto/supabase/tables/public/bitrix24_spa_sync.md`
- `docs/contexto/supabase/tables/public/bitrix24_stage_mappings.md`
- `docs/contexto/supabase/tables/public/bitrix24_sync.md`
- `docs/contexto/supabase/tables/public/bitrix24_tokens.md`
- `docs/contexto/supabase/tables/public/blocked_ips.md`
- `docs/contexto/supabase/tables/public/cache_refresh_log.md`
- `docs/contexto/supabase/tables/public/contacts.md`
- `docs/contexto/supabase/tables/public/contract_version_usage.md`
- `docs/contexto/supabase/tables/public/contract_version_usage_monthly.md`
- `docs/contexto/supabase/tables/public/cron_job_logs.md`
- `docs/contexto/supabase/tables/public/driver_approval_queue.md`
- `docs/contexto/supabase/tables/public/driver_evaluations.md`
- `docs/contexto/supabase/tables/public/driver_incidents.md`
- `docs/contexto/supabase/tables/public/driver_locations.md`
- `docs/contexto/supabase/tables/public/drivers.md`
- `docs/contexto/supabase/tables/public/email_verifications.md`
- `docs/contexto/supabase/tables/public/feature_flags.md`
- `docs/contexto/supabase/tables/public/geo_blocks.md`
- `docs/contexto/supabase/tables/public/geo_budget.md`
- `docs/contexto/supabase/tables/public/geo_cache.md`
- `docs/contexto/supabase/tables/public/geo_defaults.md`
- `docs/contexto/supabase/tables/public/geo_price_list.md`
- `docs/contexto/supabase/tables/public/geo_settings.md`
- `docs/contexto/supabase/tables/public/geo_usage.md`
- `docs/contexto/supabase/tables/public/ip_whitelist.md`
- `docs/contexto/supabase/tables/public/job_queue.md`
- `docs/contexto/supabase/tables/public/job_queue_processing_log.md`
- `docs/contexto/supabase/tables/public/lalamove_order_replacements.md`
- `docs/contexto/supabase/tables/public/lalamove_orders.md`
- `docs/contexto/supabase/tables/public/lalamove_priority_fee_history.md`
- `docs/contexto/supabase/tables/public/lalamove_rate_limits.md`
- `docs/contexto/supabase/tables/public/lalamove_status_history.md`
- `docs/contexto/supabase/tables/public/lalamove_stop_proofs.md`
- `docs/contexto/supabase/tables/public/lalamove_stops.md`
- `docs/contexto/supabase/tables/public/lalamove_uapi_sessions.md`
- `docs/contexto/supabase/tables/public/lalamove_webhook_config.md`
- `docs/contexto/supabase/tables/public/login_attempts.md`
- `docs/contexto/supabase/tables/public/map_settings_overrides.md`
- `docs/contexto/supabase/tables/public/mcp_diagnostics_grants.md`
- `docs/contexto/supabase/tables/public/message_templates.md`
- `docs/contexto/supabase/tables/public/messaging_settings.md`
- `docs/contexto/supabase/tables/public/messaging_usage.md`
- `docs/contexto/supabase/tables/public/mfa_sessions.md`
- … +37

</details>

<details><summary>Arquivos de <b>código</b> (`docs/contexto/codigo/`)</summary>

- `docs/contexto/codigo/GRAPH_REPORT.md`
- `docs/contexto/codigo/INDEX.md`
- `docs/contexto/codigo/banco.json`
- `docs/contexto/codigo/baseline.json`
- `docs/contexto/codigo/componentes.json`
- `docs/contexto/codigo/convencoes.json`
- `docs/contexto/codigo/edge-functions.json`
- `docs/contexto/codigo/ferramentas.json`
- `docs/contexto/codigo/grafo-arestas.json`
- `docs/contexto/codigo/grafo-graphify.json`
- `docs/contexto/codigo/grafo.json`
- `docs/contexto/codigo/hooks.json`
- `docs/contexto/codigo/logica.json`
- `docs/contexto/codigo/manifest.json`
- `docs/contexto/codigo/modulos.json`
- `docs/contexto/codigo/rbac.json`
- `docs/contexto/codigo/rotas.json`
- `docs/contexto/codigo/scripts.json`
- `docs/contexto/codigo/testes.json`

</details>

<details><summary>Arquivos de <b>regras de negócio</b> (`docs/contexto/regras/`)</summary>

- `docs/contexto/regras/07-REGRAS-DE-NEGOCIO.md`
- `docs/contexto/regras/10-ACESSO-E-SEGURANCA.md`
- `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md`
- `docs/contexto/regras/context.json`
- `docs/contexto/regras/manifest.json`
- `docs/contexto/regras/manual/README.md`
- `docs/contexto/regras/manual/TEMPLATE-regras-de-negocio.md`

</details>
