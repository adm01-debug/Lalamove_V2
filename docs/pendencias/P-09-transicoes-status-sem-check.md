# P-09 · Validação de transições de status ausente no schema

**Status:** PARCIAL → OBSOLETO — verificado no banco real (2026-11-20, via PAT/PostgREST)
**Origem:** docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md (seção lacunas)

> **Verificação real:** `lalamove_orders.status` é um **enum `order_status`** com 8 valores (PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED) — o Postgres já rejeita valores inválidos, não é coluna text. O mesmo para `drivers.status` (`driver_status`: APPROVED/BLOCKED/PENDING_APPROVAL) e `driver_approval_queue.status` (`approval_status`). Colunas text sem CHECK restantes (`internal_status`, `alerts_sent`, bitrix24) estão **100% não-usadas** (todos os valores NULL/vazios nas ~50 ordens de produção) — sem dado inválido possível hoje. Nada a corrigir; transições são regra de aplicação (código), não de schema.

## Problema
Vários status têm valores conhecidos mas NENHUM mapa de transições (CHECK/enum) no banco. Exemplos:
- lalamove_orders.status (PENDING, MATCHED, ON_GOING, PICKED_UP, COMPLETED, CANCELLED, REJECTED, EXPIRED) — sem transição declarada.
- lalamove_orders.internal_status, lalamove_stops.pod_status, active_tracking.tracking_status, job_queue.status, driver_approval_queue.status e mais (lista completa no doc gerado, ~20 colunas).

## Impacto no negócio
- Sem CHECK, estados inválidos entram; relatórios e regras de negócio podem ler valores impossíveis (ex.: COMPLETED -> PENDING).
- Onde fica a regra? O código define as transições hoje — docs/contexto não encontrou mapa.

## Ação
- Para cada status crítico (lalamove_orders primeiro), documentar o mapa de transições (manual/ ou CODE) e, se o dono aprovar, adicionar CHECK constraint em migration aditiva (regra 8: DDL).
- Cuidado: adicionar CHECK pode quebrar INSERTs legados — validar distribuição de valores antes (P-05).
