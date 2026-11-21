# P-13 · Documentar tabelas sem COMMENT ON TABLE

**Status:** ABERTO (descoberto em 2026-11-21, análise P-12) — não é funcionalidade, é documentação de schema
**Origem:** `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md` (auto-gerado): ~40 das 65 tabelas sem `COMMENT ON TABLE` ("sem COMMENT ON TABLE — significado não documentado").

## O que é
O schema real do banco (65 tabelas, snapshot `docs/contexto/supabase/tables.md`) tem a maioria das tabelas sem comentário descritivo. Sem `COMMENT ON TABLE`, o glossário auto-gerado não consegue documentar o significado de entidades centrais como `drivers`, `lalamove_orders`, `alerts`, `driver_evaluations` etc.

## Impacto no negócio
- Manutenção e auditoria: o próximo agente/humano não descobre o que cada tabela significa olhando o schema.
- O glossário `11-GLOSSARIO-E-LACUNAS.md` (usado por agentes de IA) fica com ~60% das entradas vazias.

## O que fazer
Migration aditiva criando `COMMENT ON TABLE` para as tabelas sem comentário (ex.: `COMMENT ON TABLE public.drivers IS 'Cadastro de motoristas com métricas e score de risco';`). Aditivo, sem DROP/REVOKE — pode ir sem regra 8, mas por ser migration em produção, seguir o protocolo da Fase 2 (rodar baseline antes/depois).

## Status atual (verificado 2026-11-21)
Tabelas com comentário hoje: `audit_log`, `cron_job_logs`, `driver_locations`, `job_queue`, `risk_rules`, `saved_filters`, `system_logs`, `webhook_events` (+ `tracking_events` parcial). O restante aguarda.
