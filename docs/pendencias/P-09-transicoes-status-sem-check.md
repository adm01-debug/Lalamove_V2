# P-09 · Validação de transições de status ausente no schema

**Status:** Pendente (consistência de dados)
**Origem:** docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md (seção lacunas)

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
