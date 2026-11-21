# P-13 · Documentar tabelas sem COMMENT ON TABLE

**Status:** CONCLUÍDO (2026-11-21) — migration `20261121100000_add_table_comments.sql` mergeada (PR #103, squash `a614869`) e aplicada em produção via Management API; 55/55 `COMMENT ON TABLE` confirmados no banco vivo.
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

## Resultado (2026-11-21, após merge + apply)
- Migration `supabase/migrations/20261121100000_add_table_comments.sql` (56 statements, 55 tabelas únicas), aditiva — sem DROP/REVOKE/ALTER (pré-checagem com regex).
- PR #103 mergeada (squash `a614869`, branch apagada). CI 9/9 verde (run 44909438449); Vercel produção READY em `a614869`.
- Aplicada em produção via Management API (query direta). Verificação ao vivo: **0 tabelas `public` restantes sem comment** — apenas as 9 partitions mensais `tracking_events_y2026m05..y2027m01` (herdam o comment do parente) e 3 views seguras (`drivers_safe_view`, `orders_operator_view`, `orders_safe_view`), fora do escopo de tabelas.
- O snapshot `docs/contexto/` (regenerado após o apply) passa a documentar o significado de 100% das tabelas; o glossário de IA não fica mais vazio.

## Observação de protocolo
O ledger `supabase_migrations.schema_migrations` está congelado em `20260902000000`: as migrações recentes (P-11 `20261109004100`, telemetria `20261120180500` e P-13 `20261121100000`) foram aplicadas por SQL direto via Management API, não por sync do Lovable. O protocolo "merge = apply" descrito em `docs/agentes/banco.md` não está funcionando via Lovable — vale revisar.
