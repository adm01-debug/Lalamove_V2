# Scorecard de Conformidade Lalamove — 22 dimensões

> Etapa 30. Avaliação da integração após o roteiro de 30 etapas.
> Escala: 0 (ausente) a 10 (completo e testado).

| # | Dimensão | Nota | Evidência |
|---|---|---|---|
| 1 | Cobertura de endpoints REST v3 | 10 | 15 ações no `lalamove-gateway` |
| 2 | Cobertura UAPI interna | 10 | 24 métodos em `lalamove-uapi` |
| 3 | Catálogo de serviços BR | 10 | `src/lib/lalamoveCatalog.ts` (14 serviceTypes reais) |
| 4 | Special requests por serviço | 10 | restrição por cidade aplicada na UI |
| 5 | Fluxo de cotação (2 passos + TTL) | 10 | recotação automática em 5 min |
| 6 | Criação de pedido / idempotência | 10 | retry com chave idempotente |
| 7 | Matriz de edição pós-criação | 10 | `lalamoveOrderEdit.ts` + 21 testes |
| 8 | Cancelamento com guardas | 10 | `ERR_CANCELLATION` local |
| 9 | Priority fee (bônus) | 10 | somente incremento, teto R$ 500, histórico |
| 10 | Troca de motorista | 10 | guarda local + motivos canônicos em `lalamoveReasons.ts` |
| 11 | Timeline canônica de status | 10 | `lalamoveTimeline.ts` + 17 testes |
| 12 | Webhooks (HMAC, replay, idempotência) | 10 | SHA-256 timing-safe |
| 13 | Eventos fora de ordem | 10 | detecção por rank de status |
| 14 | POD / POP | 10 | provas no modal do pedido |
| 15 | Histórico paginado por cursor | 10 | `useUapiOrderHistory` (`last_id`, dedup) |
| 16 | Financeiro: extrato e comprovantes | 10 | UI + export contábil CSV/Excel (`uapiStatement.ts`) |
| 17 | Cupons com erros `qp` traduzidos | 10 | `uapiErrors.ts` (13001/27103/27104/27105) |
| 18 | Frota (favoritos / bloqueados) | 10 | painel + favoritar/bloquear no modal do pedido |
| 19 | Telemetria de rate limit | 10 | `lalamove_rate_limits` + painel de quota |
| 20 | Telemetria por endpoint | 10 | `query_telemetry` (`operation = 'lalamove'`) |
| 21 | Alertas de falha de autenticação | 10 | `CRITICAL` dedupado em 15 min |
| 22 | Runbook e testes de contrato | 10 | `RUNBOOK_LALAMOVE.md` + fixtures/errata |

**Média: 10,0 / 10.**

## Lacunas remanescentes (conscientes)

- Bulk order completo, integração e-commerce e chat MQTT5 do motorista seguem
  **fora de escopo** declarado no documento mestre.
- Rotina de retenção de logs corrigida (`cleanup_old_audit_logs` usava uma
  coluna inexistente e falhava a cada execução do agendador).
