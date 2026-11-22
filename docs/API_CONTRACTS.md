# 📑 Contratos de API — Webhooks & Edge Functions

**Versão:** 1.0.0 · Camada de validação de schema + formato único de erro + versionamento.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/_shared/contract.ts` | Helpers puros: `validateContract`, `parseJsonBody`, `parseJsonText` (corpo já lido, para proxies que repassam bytes crus), `errorResponse`, `resolveContractVersion`, formato único de erro. |
| `supabase/functions/_shared/schemas.ts` | Registro central de schemas Zod versionados (`CONTRACT_REGISTRY`, `getSchema`). |
| `supabase/functions/_shared/contract.test.ts` | Testes de contrato (184 casos, gerados por contrato a partir das fixtures `VALID_PAYLOADS`, `WRONG_TYPE` e `EMPTY_VALUE`). |

## Formato único de erro (HTTP 422)

Toda falha de validação retorna **sempre** a mesma estrutura:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "A validação do payload falhou. Verifique os campos informados.",
    "fields": [
      { "field": "event", "message": "event é obrigatório", "code": "too_small" }
    ]
  },
  "meta": { "contractVersion": "v1", "timestamp": "2026-07-12T00:00:00.000Z" }
}
```

Códigos: `VALIDATION_FAILED`, `INVALID_JSON`, `UNSUPPORTED_VERSION`, `UNAUTHORIZED`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Versionamento (v1/v2)

- Resolução por precedência: header `x-contract-version` → query `?v=`/`?version=` → default `v1`.
- Regra de compatibilidade: **v2 é superset de v1** (campos novos opcionais/com default). Um payload v1 válido é sempre válido em v2 — garantido por teste.
- **Versão recomendada:** `v2` (`RECOMMENDED_VERSION`). Novas integrações devem enviar `x-contract-version: v2`.

### Estratégia de deprecação

Ciclo de vida de cada versão:

1. **Ativa** — suportada, sem avisos.
2. **Descontinuada (deprecated)** — listada em `DEPRECATED_VERSIONS`. Continua **aceita e processada normalmente**, mas toda resposta (incluindo o **erro 422**) sinaliza a deprecação:
   - **Corpo:** `meta.deprecation` com `message`, `sunsetDate`, `recommendedVersion` e `migrationGuide`.
   - **Headers (best-effort):** `Warning: 299`, `Sunset` (RFC 8594), `Deprecation: true` e `Link; rel="deprecation"`.
3. **Removida** — retirada de `SUPPORTED_VERSIONS` após a data de sunset; passa a resolver como `UNSUPPORTED_VERSION`.

**Estado atual:** `v1` está **descontinuada** (`DEPRECATION_SCHEDULE.v1.sunsetDate = 2026-12-31`) e permanece como default por retrocompatibilidade — logo, chamadas sem header explícito recebem o aviso, acelerando a migração para `v2`.

Exemplo de `meta.deprecation` num 422 sob `v1`:

```json
{
  "error": { "code": "VALIDATION_FAILED", "message": "...", "fields": [] },
  "meta": {
    "contractVersion": "v1",
    "timestamp": "2026-07-12T00:00:00.000Z",
    "deprecation": {
      "version": "v1",
      "deprecated": true,
      "message": "A versão de contrato 'v1' está descontinuada e será removida em 2026-12-31. Migre para 'v2' ...",
      "sunsetDate": "2026-12-31",
      "recommendedVersion": "v2",
      "migrationGuide": "docs/API_CONTRACTS.md#versionamento-v1v2"
    }
  }
}
```

**Como remover `v1` no sunset:** retirar `"v1"` de `SUPPORTED_VERSIONS` e `DEPRECATED_VERSIONS`, mudar `DEFAULT_VERSION` para `v2`, promover os schemas `v2` e atualizar os testes.

### Telemetria de uso (rastreamento de integradores pendentes)

Toda requisição às Edge Functions registra a versão de contrato utilizada, permitindo medir a **proporção de chamadas em `v1`** antes de definir a data efetiva de remoção.

- **Log estruturado (sempre emitido):** cada chamada emite `{"tag":"contract_usage",...}` nos logs da função. Chamadas em versão descontinuada usam o prefixo `[DEPRECATED_CONTRACT_USAGE]` (`console.warn`) para filtragem imediata.
- **Persistência agregada (best-effort):** `trackContractUsage()` (`_shared/telemetry.ts`) chama a RPC atômica `increment_contract_usage`, que faz upsert diário na tabela `public.contract_version_usage` por `(contract_name, contract_version, usage_date)`. É *fire-and-forget*: nunca bloqueia nem quebra a resposta ao cliente.
- **Consulta (apenas admins):** `contract_version_usage` tem RLS restrito a `admin`. Exemplo — proporção de `v1` nos últimos 30 dias:

```sql
SELECT
  usage_date,
  SUM(request_count) FILTER (WHERE contract_version = 'v1')::numeric
    / NULLIF(SUM(request_count), 0) AS v1_ratio
FROM public.contract_version_usage
WHERE usage_date >= current_date - INTERVAL '30 days'
GROUP BY usage_date
ORDER BY usage_date DESC;
```

- **Builder puro/testável:** `buildContractUsageEvent(name, version)` (em `contract.ts`) monta o evento sem I/O e é coberto por testes de contrato.




## Contratos cobertos

`lalamove-webhook`, `evaluate-driver`, `send-notification`, `new-device-alert`, `route-analyzer`, `check-external-api`, `test-notification`.

## Integração numa Edge Function

```ts
import { resolveContractVersion, parseJsonBody, validateContract, errorResponse } from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";

const version = resolveContractVersion(req);
const parsed = await parseJsonBody(req, version);
if (!parsed.ok) return errorResponse(parsed, corsHeaders);

const contract = validateContract(getSchema("evaluate-driver", version), parsed.value, version);
if (!contract.ok) return errorResponse(contract, corsHeaders);
// contract.data está tipado e validado
```

## Testes

### 1. Contrato (em memória, sem I/O)

```bash
deno test --allow-net supabase/functions/_shared/contract.test.ts
```

Cobertura, gerada em laço para **todos** os contratos do registro: payload válido; campo obrigatório
ausente (ou, nos contratos de corpo opcional, corpo que não é objeto: `[]`, `"x"`, `42`, `true`); tipo
incorreto nomeando o campo; valor vazio nomeando o campo; mesmo payload inválido rejeitado com os mesmos
campos em v1 e v2; JSON malformado; compat retroativa v1→v2; resolução de versão; headers e `meta.deprecation`.
**184/184 passando** (`deno test --allow-net --allow-env supabase/functions/_shared/contract.test.ts`).

Adicionar um contrato ao registro sem fixture é **erro de tipo**: `VALID_PAYLOADS`, `WRONG_TYPE` e
`EMPTY_VALUE` são `Record<ContractName, …>`, então o TypeScript cobra o caso novo.

### 2. Integração I/O real (chama as Edge Functions IMPLANTADAS)

```bash
deno test --allow-net --allow-env --allow-read \
  supabase/functions/_shared/contract.integration.test.ts
```

Exercita cada função via HTTP contra o runtime real, validando:
- **422** — campo obrigatório ausente retorna o formato único de erro;
- **Tipos** — tipo/enum incorreto retorna 422 nomeando o campo;
- **Compat retroativa** — o mesmo payload inválido é rejeitado de forma idêntica sob os headers `v1` e `v2` (superset estrito), e um payload v1 válido continua aceito sob `v2` (funções idempotentes/read-only);
- **Segurança** — o gate de IP do `lalamove-webhook` precede o contrato (403 para origem não confiável);
- **CORS** — preflight `OPTIONS` responde em todas as funções.

Efeitos colaterais são evitados: funções que disparam e-mail/IA/notificações recebem **apenas** payloads inválidos (falham antes do efeito). **27/27 passando.**

> No CI, roda no job `edge-integration-tests` (push na `main`), lendo `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` dos secrets do repositório.


## Status de integração

| Função | Integrada | Observação |
| ------------------------- | :-------: | --------------------------------------------------------------- |
| lalamove-webhook          |    ✅     | + validação HMAC e gate de IP antes do contrato                  |
| evaluate-driver           |    ✅     | —                                                                |
| send-notification         |    ✅     | inclui `metadata` opcional no schema                             |
| new-device-alert          |    ✅     | —                                                                |
| route-analyzer            |    ✅     | —                                                                |
| test-notification         |    ✅     | —                                                                |
| check-external-api        |    ✅     | —                                                                |
| geo-gateway               |    ✅     | `place_id` aceita `mapbox_id` real (até 1024)                    |
| apply-fixes               |    ✅     | ação única `fix_dashboard` (edge legada, ver `AGENTS.md`)         |
| bitrix24-process-queue    |    ✅     | corpo opcional (fila disparada pela UI)                          |
| bitrix24-sync             |    ✅     | união por `action`; `action`/`code`/`domain` também pela query    |
| check-driver-alerts       |    ✅     | corpo opcional (cron a cada 2 min)                               |
| escalate-alerts           |    ✅     | corpo opcional (cron a cada 5 min)                               |
| external-companies        |    ✅     | união por `action`; `table` com allowlist; `limit` ≤ 200          |
| external-db-bridge        |    ✅     | união por `operation`; `update`/`delete` exigem `filters`         |
| get-mapbox-token          |    ✅     | corpo opcional; `healthCheck` do health check do front            |
| lalamove-gateway          |    ✅     | `action` ≤ 64; `target`/`method` em enum; `x-request-id` no erro  |
| lalamove-token-refresh    |    ✅     | corpo opcional (cron horário)                                    |
| llm-wh                    |    ✅     | valida uma cópia já lida; repassa o corpo **cru** (HMAC)          |
| mcp-query                 |    ✅     | `operation` na allowlist de `mcp_introspect`; 401/403 antes       |
| rotate-tokens             |    ✅     | corpo opcional                                                   |
| seed-fix-rls              |    ✅     | corpo opcional (edge legada, ver `AGENTS.md`)                     |
| simulate-driver-movement  |    ✅     | `replay:true` exige `fixture`; só em desenvolvimento              |
| job-worker                |    ✅     | valida só o envelope `{jobId,type,payload}` — ver nota abaixo     |
| lalamove-api              |    ✅     | união por `action`; input MESCLADO (query + corpo)                |
| lalamove-uapi             |    ✅     | união por `action` (24 ações); input mesclado (query + corpo)      |

**26 de 26** Edge Functions com entrada validada pela camada. `contract.test.ts` tem um teste que falha se o
registro deixar de cobrir 26 contratos, e as fixtures são `Record<ContractName, …>`: uma função nova sem
contrato não compila o job `Deno Contract Tests`.

### Entrada mesclada: query + corpo (`lalamove-api`, `lalamove-uapi`)

Nessas duas funções `action` e os identificadores podem chegar pela **query**, e é assim que todo o tráfego da
`lalamove-gateway` chega: GET sem corpo, com `?action=...` (`lalamove-gateway/index.ts:295,306,322`). Por isso o
contrato é validado sobre o input **mesclado** — `{ ...corpo, ...query }`, com a query vencendo, como já era a
precedência antes da camada. Validar apenas o corpo transformaria 100% desse tráfego em 422, incluindo o cartão
de status do dashboard (consulta a cada 60 s) e o cancelamento de pedido. Há testes que travam esse formato.

### `job-worker`: contrato de envelope, regras de negócio dentro do worker

O contrato valida `{ jobId, type, payload }` e nada além disso. As regras por tipo (`pod_fetch` exige `orderId`,
`geo_backfill` exige endereços, tipo desconhecido) continuam como exceção **dentro** de `processJob`, porque um
422 devolvido antes dele não passa por `mark_job_failed` e `mark_job_processing` não incrementa `attempts`
(`supabase/migrations/20261122120200_job_queue_system.sql:105-111`): o job ficaria em loop PROCESSING→PENDING
para sempre. Quando o envelope é rejeitado e há `jobId`, a função chama `mark_job_failed` antes de responder 422,
para a linha não ficar presa nos 10 minutos de limbo.

### Contratos de corpo opcional

`OPTIONAL_BODY_CONTRACTS` (em `schemas.ts`) lista os contratos cuja Edge Function **não lê a entrada**
(workers de cron, health check, telas que invocam sem payload). Para eles `{}` é válido e o contrato garante
apenas que o corpo seja um objeto JSON: array, string ou número agora devolvem 422 em vez de seguir adiante.

### Onde o contrato roda em relação à autenticação

Nas funções com gate de segurança (`lalamove-webhook` com IP/HMAC, `external-db-bridge` e `mcp-query` com
JWT e papel), o contrato roda **depois** do gate: origem não autorizada continua recebendo 401/403, nunca um
422 que revelaria o formato esperado do payload.
