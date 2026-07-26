# Simulação exaustiva de cenários de falha — Lalamove (v3 + UAPI)

> Fase 0 do roteiro de 30 etapas (`docs/LALAMOVE_MASTER_ANALYSIS.md`).
> Cada cenário: **gatilho** → **comportamento atual** → **esperado** → **gap** → **etapa que cobre**.
> Legenda de severidade: 🔴 crítico · 🟡 importante · 🔵 informativo.

---

## A. Autenticação e credenciais

| # | Cenário | Gatilho | Comportamento atual | Esperado | Gap | Etapa |
|---|---------|---------|---------------------|----------|-----|-------|
| A1 🔴 | Chave de proxy exposta no bundle | Qualquer visitante lê `promo-llm-unified-2026` no JS publicado | Chave literal em `src/lib/lalamove-api.ts` e `src/lib/uapi-proxy.ts` | Nenhuma chave em `src/`; tráfego via Edge Function autenticada | Chaves públicas | **19** |
| A2 🔴 | HMAC com clock skew | Relógio do runtime > ±30 s | Assinatura recusada, erro genérico | Detectar skew e reportar como erro de credencial/relógio | Sem diagnóstico | 15, 28 |
| A3 🔴 | Chave v3 revogada | Credencial inválida devolve **502**, não 401 | Interpretado como indisponibilidade da Lalamove | Classificar 502 de auth como `AUTH_FAILED` e alertar CRITICAL | Sem classificação | 15, 28 |
| A4 🔴 | Token UAPI expirado (24 h) | Cron parado ou janela perdida | Chamadas UAPI falham em massa (`ret=10007`) | Refresh em 20 h + alerta + runbook | Sem auto-refresh confiável | **24**, 28, 29 |
| A5 🟡 | Refresh de uso único consumido | Duas execuções simultâneas do refresh | Corrida pode invalidar sessão | Lock/claim antes de renovar | Sem lock | 24 |
| A6 🟡 | WAF Argus bloqueia (`ret=10010`) | Padrão de tráfego suspeito | Erro cru na UI | Mensagem específica + backoff longo | Sem mapeamento | 5, 15 |
| A7 🔵 | `GET /v3/webhook` = 405 | Auditoria da URL registrada | Não auditável | Fonte de verdade local | Documentado | 29 |

## B. Cotação

| # | Cenário | Gatilho | Comportamento atual | Esperado | Gap | Etapa |
|---|---------|---------|---------------------|----------|-----|-------|
| B1 🔴 | `quotationId` expirado (>5 min) | Usuário demora entre cotar e confirmar | Pedido falha na criação | Revalidar/refazer cotação automaticamente | Sem TTL ativo | **10** |
| B2 🟡 | Cidade sem o serviço escolhido | `VAN` em cidade que não oferece | Erro só no servidor | Bloquear na UI com base em `/v3/cities` cacheado | Sem validação cidade×serviço | 7 |
| B3 🟡 | SR incompatível com veículo | `THERMAL_BAG_1` em `TRUCK330` | Validado por `lalamoveValidation.ts` | Lista de SRs muda ao trocar veículo | UI ainda estática | 8 |
| B4 🟡 | `deliveryItemSpecification` ausente | `TRUCK330`/`VAN`/`UV_FIORINO` | Campo não enviado | Enviar quando exigido | Campo inexistente | 9 |
| B5 🔵 | SR duplicado | Clique duplo | Detectado (`duplicates`) | Manter | — | ok |
| B6 🟡 | Preço muda entre cotação e pedido | Surge/priority | Sem re-exibição | Confirmar novo valor ao usuário | Sem diffing | 10 |

## C. Pedido

| # | Cenário | Gatilho | Comportamento atual | Esperado | Gap | Etapa |
|---|---------|---------|---------------------|----------|-----|-------|
| C1 🟡 | Telefone reprovado | E.164 inválido | `parseOrderError` traduz e destaca campo | Manter e ampliar para todos `ERR_*` | Cobertura parcial | 5 |
| C2 🟡 | Agendamento fora de 30 min–30 dias | Data inválida | `validateScheduleAt` bloqueia | Manter | — | ok |
| C3 🟡 | `ORDER_REPLACED` | Motorista trocado | Tabela `lalamove_order_replacements` registra | Refletir na timeline | UI parcial | 17 |
| C4 🟡 | Cancelamento após atribuição | Motorista já a caminho | Erro cru | Aviso de taxa + motivo local | Sem motivo persistido | 12 |
| C5 🟡 | `PATCH` em `ASSIGNING_DRIVER` | Edição durante atribuição | Não suportado | Bloquear com aviso | Endpoint não usado | 11 |
| C6 🔴 | Duplo clique cria dois pedidos | Latência alta | Sem idempotência no create | Chave de idempotência por cotação | Gap real | 15 |

## D. Rastreio e webhooks

| # | Cenário | Gatilho | Comportamento atual | Esperado | Gap | Etapa |
|---|---------|---------|---------------------|----------|-----|-------|
| D1 🔴 | `driverId === ""` | Pedido sem motorista | Alguns pontos tratam como `null` | Guard `hasDriver(order)` único | Errata não centralizada | **3** |
| D2 🟡 | Webhook duplicado | Reentrega do provedor | Idempotência SHA-256 ativa | Manter | — | ok |
| D3 🟡 | Webhook fora de ordem | `COMPLETED` antes de `PICKED_UP` | Sobrescreve status | Ignorar retrocesso de estado | Gap real | 17 |
| D4 🔴 | Replay / assinatura inválida | Ataque | HMAC timing-safe + janela ±5 min + alerta | Manter | — | ok |
| D5 🔵 | Campo `services` vs `serviceTypes` | Regressão de código | Nada impede reintrodução | Teste que quebra o build | Gap | 26 |

## E. Infraestrutura e rede

| # | Cenário | Gatilho | Comportamento atual | Esperado | Gap | Etapa |
|---|---------|---------|---------------------|----------|-----|-------|
| E1 🔴 | 429 / `ratelimits-*` esgotado | Rajada de cotações | Sem controle de taxa | Token bucket respeitando headers | Gap | 14 |
| E2 🟡 | 5xx transitório | Instabilidade | Sem retry | Backoff exponencial + jitter; 4xx nunca retenta | Gap | 15 |
| E3 🟡 | Timeout / resposta truncada | Rede lenta | `fetch` sem timeout | `AbortController` com deadline | Gap | 15 |
| E4 🟡 | Proxy indisponível | Deploy externo caiu | Erro genérico `Proxy error: 5xx` | Estado degradado no painel de saúde | Parcial | 18 |
| E5 🟡 | Falta de correlação de logs | Investigação de incidente | Sem `x-request-id` | ID ponta a ponta persistido | Gap | 13 |
| E6 🔵 | Custo/latência por endpoint | Otimização | Não medido | `query_telemetry` por ação | Gap | 27 |

---

## Consolidação

- **Gaps críticos (🔴):** A1, A2, A3, A4, B1, C6, D1, E1 → tratados nas etapas 19, 24, 10, 3, 14, 15.
- **Ordem de ataque:** segurança (19) → resiliência de credencial (24) → integridade transacional (10, 15) → fundação de tipos (2–6) → demais blocos.
