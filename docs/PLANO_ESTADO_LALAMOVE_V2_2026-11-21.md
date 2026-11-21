# Lalamove V2 — estado da sessão de 21/11/2026 (continuidade)

Este arquivo existe para não perder o trabalho desta sessão caso ela termine por limite de
tokens antes do dono agir nos 3 bloqueios abaixo. É a cópia, no próprio repo, do que estava
registrado no projeto claude.ai. Dev: Claude (sessão `session_01RfQzo9ifW2adtxtPAUgPPG`).
Aprovação de escopo: Joaquim (`/goal` de recuperação exaustiva de branches + "Aprovado").

## 🔴 Achado de segurança (ação do dono, ainda pendente)

O repo estava **público** com credenciais em texto puro no histórico. Foi tornado **privado**
às 17:58 UTC de 21/11. **Às 19:14 UTC do mesmo dia, ao reconferir para este documento, o repo
estava de volta a `public`** (`private:false`) — revertido por alguém/algo entre as duas
horas, fora desta sessão. Reaplicado `private:true` imediatamente às 19:14:54 UTC. Isso
significa que o repo ficou exposto de novo por uma janela de ~1h16 nesta mesma data — **mais
um motivo para a rotação das credenciais abaixo não esperar**. O `AGENTS.md` já documentava
que o repo devia ser privado.

O commit `63987c9` limpou o código do repo, mas em `63987c9^` e ancestrais ainda se lê:
- JWT **`service_role`** do banco de produção (15+ arquivos de `scripts/`)
- **PAT `sbp_…`** da Management API (7 ocorrências)
- senha do usuário de seed `ti@promobrindes.com.br`

Secret scanning **não está disponível neste plano** (GitHub recusa com 422 em repo privado
fora do Advanced Security).

**Só o dono resolve:** rotacionar as 3 credenciais no painel Supabase (API / Access Tokens).
Tornar o repo privado só impede exposição *enquanto permanecer privado* — já reverteu uma
vez sem ação desta sessão; a rotação é o que resolve de verdade quem já clonou/copiou antes.
Depois da rotação, a sessão atualiza os secrets do GitHub Actions e das edge functions.

Confirmado que tornar o repo privado não quebra o deploy: o Vercel seguiu buildando depois da
primeira mudança às 17:58 — deployment de Produção do `a081063` às 18:19:57, `state: success`.

## Recuperação do trabalho de outros agentes — prova byte a byte

Para cada branch apagada, foram conferidos **todos** os arquivos que o commit tocou (não uma
amostra), por SHA-256:

| branch | arquivos no commit | resultado |
|---|---|---|
| `chore-google-maps-env-example` (#124) | 1 | `.env.example` — hash divergiu porque a **#135 adicionou Mapbox depois**; as 2 linhas da #124 conferidas linha por linha, presentes na `main` |
| `chore-integridade-constraints` (#116) | 2 | ambos byte-idênticos |
| `fix-escalonamento-alertas` (#119) | 3 | todos os 3 byte-idênticos |
| `feat-geo-foundation` (#118) | 2 | ambos byte-idênticos (mergeada por outra sessão) |

Total: **8 de 8 arquivos** das 4 branches apagadas, 100% do conteúdo tocado verificado. Para
as PRs que seguem abertas foi lido o **diff completo** (não só o diffstat), com revisão
registrada no próprio PR.

| origem | destino | o quê |
|---|---|---|
| PR #116 | incorporada na #126 (`bc334c1`, cherry-pick) | `VALIDATE CONSTRAINT` + import estático no ErrorBoundary |
| PR #119 | incorporada na #126 (`a21977a`) | pipeline de escalonamento + CRUD de configurações de alerta |
| PR #124 | incorporada na #126 (`c94f22b`) | `GOOGLE_MAPS_API_KEY` no `.env.example` |
| PR #118 | mergeada por outra sessão (`37588af`) | fundação geo: 7 tabelas, orçamento, geofence, trigger |
| PR #131 | mergeada por esta sessão (`04fe256`) | cobertura BR do Search Box; branch já removida |
| PR #127 | **aberta — revisada byte a byte** | plano Mapbox: 1 arquivo, 490 inserções, 0 deleções, nenhum código tocado |
| PR #132 | **aberta — revisada byte a byte, aprovada** | fecha a etapa 66; contrato `metadata.recipients` confere com a trigger geo; `to` nulo coberto; dedup de 300 s dá `return` antes do loop ad-hoc |
| branch `contexto` | **mantida de propósito** | 356 arquivos gerados a cada 10 min pelo `contexto.yml` (que vive na `main`); sem merge-base com a `main`; o header do workflow diz "nunca abra PR dela" e "a branch contexto é a prova". Não há trabalho humano/agente nela para recuperar, e apagá-la destruiria a saída de uma automação ativa |

**#127 e #132 não foram mergeadas por esta sessão:** a regra 7 do `AGENTS.md` autoriza merge
só das PRs que a própria sessão criou ou corrigiu, e ambas pertencem a sessões ativas de
outros agentes. Decisão de uma palavra do dono resolve ("merge" nas duas).

## Dois defeitos encontrados rodando as migrations, não lendo

Foi usado um **Postgres 16 descartável** para replicar as 167 migrations do repo.

1. **`20261122120200_job_queue_system.sql` (desta sessão) quebrava em `supabase db reset`.**
   A `20251226000003` cria `job_queue` antes, sem `dedup_key`/`started_at`/`metadata`/
   `created_by`; o `CREATE TABLE IF NOT EXISTS` virava no-op e o índice de dedup falhava com
   `column "dedup_key" does not exist`. O CHECK antigo ainda recusava `'bitrix_sync'` (nome
   que as edges usam) e o status `'CANCELLED'` (usado por `cancel_job`). Corrigido com
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + drop/recreate dos 2 CHECKs antes do índice.
2. **A migration da #116 estava fora de ordem** (`20261121190000`, antes do `20261122120100`
   que cria o constraint que ela valida) → `constraint ... does not exist` em banco limpo.
   Renomeada para `20261122120300_validate_service_type_constraint.sql`, conteúdo idêntico.

Replay: **30 falhas → 29**, nenhuma nova introduzida. As 29 restantes são drift histórico
pré-existente (fora do escopo desta sessão).

## PRs desta sessão

| # | estado | o quê |
|---|---|---|
| 126 | **mergeada** `0047f99` | recupera #116/#119/#124 + os 2 defeitos acima |
| 130 | **mergeada** `2f7add2` · edge `ACTIVE v8` em produção | gateway religado |
| 133 | **mergeada** `a081063` · **código provado no bundle de produção** | filtro de veículo por praça |
| 134 | **aberta, aguardando o dono** | 1 linha no `ci.yml` cobrindo os 9 testes do gateway (regra 8 — mudança de CI/workflow) |
| 145 | **esta PR** — este próprio arquivo de continuidade | docs, sem código tocado |

### #130 — telas de Configurações estavam mortas
`lalamove-gateway` exigia 4 secrets `LALAMOVE_*_PROXY_*` que **nunca existiram** na produção
→ HTTP 500 em toda chamada. Agora as 19 ações são atendidas por `lalamove-api` e
`lalamove-uapi`, com o JWT do chamador repassado. Passagem genérica e escrita de credencial
respondem 501 com motivo; ação desconhecida, 400. 9 testes novos (`route.test.ts`).

**Em produção:** log do deploy run #8 → `Deploying Function: lalamove-gateway (script size:
782 kB)` e, na listagem final, `lalamove-gateway | ACTIVE | versão 8 | 18:10:19`.

**Limite honesto, documentado e não contornado:** o `verify_jwt = true` da edge rejeita antes
de chegar no código roteador, então não existe caminho sem autenticação real para exercitar o
roteamento — nem com a chave publicável, que não é um JWT válido para `auth.getClaims`. A
confirmação final é abrir a tela de Configurações logado. O roteamento está coberto por 9
testes unitários e a tabela de ações foi conferida contra os nomes de ação reais lidos no
fonte das duas edges de destino.

### #133 — pedido falhava no envio
O seletor oferecia os 14 serviços em qualquer praça; a Lalamove recusa com 422 o que a cidade
não atende (Curitiba tem 6). Agora tem campo "Cidade da coleta" com nome legível, lista
filtrada com contador, e troca automática para um serviço válido ao mudar de praça.

**Provado no artefato servido ao usuário**, não só "o deploy passou": baixado o `index.html`
de `https://lalamove-v2.vercel.app` (200), extraído o mapa de 183 chunks do bundle principal
e localizado o código em `/assets/OrdersPage-BPmLuNSz.js` (string "Cidade da coleta", contador
ligado ao estado da cidade, e os labels novos do `CITY_LABELS`: Brasília, Florianópolis,
Goiânia, Ribeirão Preto).

Correção de uma suposição desta sessão: supunha-se que `LALAGO` não atendia alguma praça —
atende as 16. O teste foi reescrito, não o código.

## ⚠️ 3 migrations na `main` que NÃO estão na produção — bloqueio de plataforma, pendente do dono

Aplicar DDL em produção foi **negado pelo classificador de segurança** desta sessão, duas
vezes, com o motivo "[Destructive or Unwanted Actions]". **Não foi contornado e não será** —
é um controle da plataforma de execução, não uma regra de negócio que o dono possa dispensar,
nem com a autorização ampla do `/goal`.

- `20261121193000_fix_escalation_pipeline.sql` — até aplicar, o escalonamento continua sem
  seed (a #119 mediu 1.318 alertas e 2.016 execuções do cron sem escalar nada)
- `20261122130000_geo_alert_types.sql`
- `20261122130100_geo_foundation.sql` — as 7 tabelas geo não existem no banco; isso trava os
  blocos 2–4 do plano de 100 etapas do Mapbox **e** o efeito prático da #132 (os avisos de
  aproximação do motorista dependem dessas tabelas)

As três foram validadas no Postgres descartável, na ordem real, sem erro. A matemática do
geofence foi conferida por conta própria: `geo_haversine_m` dá 1001 m para 0,009° de latitude;
`geo_point_to_polyline_m` dá 1001 m perpendicular e 1004 m antes do início do segmento.

**Como destravar:** o dono roda `supabase db push` (ou aprova o prompt de permissão quando
ele aparecer na sessão). Script de apoio, com dry-run em `BEGIN`/`ROLLBACK` antes do commit,
em `/home/claude/apply_geo.py` (ambiente efêmero desta sessão — não está no repo).

## Qualidade medida nesta sessão

`tsc` app+node **0 erros** · `eslint` 0 erros · `vitest` **908/908** · `deno test` **72/72**
(3 arquivos) · guards (`check-agents-md-integrity.mjs`, `commit-msg-lint.mjs`) OK.

## Plano de fundo (fases 0–7) — continua válido como roteiro

Documento completo da análise exaustiva original (artefato claude.ai):
https://claude.ai/artifact/UwpRyTnTXcLPs5wnsHdXW6

Fase 0 risco+contrato (rotacionar chaves, repo privado — **ambos em andamento, ver acima,
com o repo já tendo revertido para público uma vez** — deploy das edges do main +
`verify_jwt`, pipeline de deploy, capturar fixtures reais de webhook no sandbox, pausar cron
UAPI) → Fase 1 migration (enum ampliado, `service_type`, `stop_id`, POP, `webhook_config`,
`bitrix24_spa_sync`) → Fase 2 `lalamove-api` correto (catálogo BR, QUOTED/TTL, erro de INSERT
verificado, cancel 5 min, change-driver 4 motivos, POD/POP, sandbox por ambiente) → Fase 3
`lalamove-webhook` oficial (assinatura no corpo, sem IP allowlist, parser `eventType/
data.order`, 200 imediato + `job_queue`, idempotência por `eventId`, janela 24 h) → Fase 4
UAPI com um único dono de token → Fase 5 front sem gateway fantasma (**#130 acima resolveu a
parte "gateway fantasma"**) → Fase 6 Bitrix24 SPA 1690 + n8n como chamadas finas ao Supabase
→ Fase 7 reconciliação por cron, alertas, limpar seed, docs verdadeiras.

### Fatos de produção que motivaram o plano (medidos antes das correções acima)
- A integração Lalamove nunca operou de ponta a ponta: `lalamove_orders` = 50 linhas, todas
  `seed_script`; `webhook_events` = 0; `lalamove_uapi_sessions` = 0; `lalamove_rate_limits` = 3
  chamadas v3 em 31/08/2026; `bitrix24_tokens/sync/stage_mappings` = 0.
- Webhook oficial: assinatura **no corpo** (HMAC-SHA256), `eventType` + `data.order.orderId`;
  o handler histórico do repo (header `x-lalamove-signature`, corpo inteiro, allowlist IP
  Singapura) e o fluxo F03 do n8n (`x-llm-signature`) rejeitavam 100% dos eventos reais —
  ainda não corrigido nesta sessão, fica para a Fase 3.
- Enum `order_status` do banco não cobre `ASSIGNING_DRIVER`/`CANCELED` que `lalamove-api`
  grava → INSERT pós-criação falha em silêncio (pedido pago sem registro) — ainda não
  corrigido, fica para a Fase 1.
- `SPECIAL_REQUESTS_BY_SERVICE` em `lalamove-api` usa códigos de outro mercado e descarta SRs
  válidos BR — ainda não corrigido, fica para a Fase 2.
- n8n: só F01 importado (inativo); F02–F04 nunca entraram; 5 fluxos Lalamove de mar/2026
  ativos fora do repo, sem acesso MCP desta sessão.

### Decisões pendentes do dono (plano de fundo, além dos 3 bloqueios imediatos acima)
URL de webhook a registrar no Partner Portal · validade do sandbox · token UAPI inicial ·
fonte da verdade (Supabase vs Bitrix24) · mapa veículo Bitrix24→`serviceType` · seed em
produção (limpar as 50 linhas `seed_script`?) · acesso MCP aos 5 fluxos n8n de março/2026.

## Resumo do que destrava o resto (3 ações do dono)

1. **Autorizar as 3 migrations** — sem isso o escalonamento de alertas e as 7 tabelas de
   mapas não existem no banco, e a #132 não tem efeito prático · `supabase/migrations/`
2. **Rotacionar `service_role`, PAT e a senha de seed** — o repo já reverteu para público uma
   vez sem ação desta sessão; quem clonou em qualquer janela de exposição tem acesso total ao
   banco de produção · Supabase → API / Access Tokens
3. **Dizer "merge" para #134 e #132** — a #134 faz a CI cobrir os 9 testes do gateway; a #132
   é o que entrega os avisos de aproximação do motorista ao contato do pedido ·
   `.github/workflows/ci.yml` e `supabase/functions/send-notification/`
