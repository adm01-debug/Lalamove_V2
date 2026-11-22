# Testes SQL das funções geo

`supabase/tests/run.sh` valida o trigger `geo_evaluate_tracking` — o código que calcula
distância até a próxima parada, `is_on_route`, avança `next_stop_index` (etapa 46) e emite
os eventos de geofence e `ETA_DELAY` (etapa 50).

**Por que existe:** nenhum job de CI sobe Postgres (`ci.yml` roda Deno, Vitest e
`node --test`), então o SQL dessas funções nunca é executado em lugar nenhum antes de ir
para produção. Este harness é a única forma de exercitá-las sem tocar o banco real.

```bash
bash supabase/tests/run.sh
```

Sobe um `postgres:16-alpine` descartável, carrega os stubs e roda os cenários. Nada é
gravado no banco de produção e o container é removido ao final.

## Como funciona

| Arquivo | Papel |
| --- | --- |
| `run.sh` | Sobe o container e orquestra. Regenera `01_functions.sql` e `03_fixture.sql` a cada execução. |
| `00_stubs.sql` | DDL mínimo das tabelas reais (`lalamove_orders`, `active_tracking`, `order_geo_events`, `job_queue`, …) com os tipos de produção. Não é migration. |
| `01_functions.sql` | **Gerado.** Cópia literal das funções reais extraídas das migrations — garante que o teste exercita o código que vai para produção. |
| `03_fixture.sql` | **Gerado.** Converte `fixtures/route_curitiba.json` em tabela. |
| `02_scenarios.sql` | Os 11 cenários (27 asserções). Falha = `RAISE EXCEPTION` + `ON_ERROR_STOP`. |

Porta padrão `55433`; use `PG_TEST_PORT` para trocar.

## Cenários cobertos

1. `ETA_DELAY` emitido com atraso real (`late_minutes = 90`) e idempotente no 2º UPDATE.
2. Pedido no prazo não gera `ETA_DELAY`.
3. Pedido sem `scheduled_at` não gera evento e não levanta exceção.
4. Avanço de parada após 2 ciclos no raio: `next_stop_index` 0→1, `arrived_at` preenchido, `near_stop_cycles` zerado, distância recalculada para a entrega.
5. `PICKED_UP` avança a parada já no primeiro ciclo.
6. `tracking_status` diferente de `ACTIVE` não avalia nada.
7. O trigger **não** enfileira `route_plan` — quem faz isso é o cron `refresh_geo_jobs` (evita job duplicado = chamada paga duplicada).
8. Os 40 pontos de `fixtures/route_curitiba.json` mantêm `is_on_route = true`.
9. Desvio de 500 m marca `is_on_route = false` e acumula `off_route_cycles`.
10. Voltar para a rota zera `off_route_cycles`.
11. Alerta da entrega carrega destinatário de `lalamove_stops.contact_name`/`contact_phone` (`role`, `name`, `to`) — sem esses campos o WhatsApp sai sem destinatário e falha sem erro.
