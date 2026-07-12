# 📑 Contratos de API — Webhooks & Edge Functions

**Versão:** 1.0.0 · Camada de validação de schema + formato único de erro + versionamento.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `supabase/functions/_shared/contract.ts` | Helpers puros: `validateContract`, `parseJsonBody`, `errorResponse`, `resolveContractVersion`, formato único de erro. |
| `supabase/functions/_shared/schemas.ts` | Registro central de schemas Zod versionados (`CONTRACT_REGISTRY`, `getSchema`). |
| `supabase/functions/_shared/contract.test.ts` | Testes de contrato (34 casos). |

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
- Descontinuação: adicionar a versão em `DEPRECATED_VERSIONS`; respostas passam a incluir header `Warning: 299`.

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

Cobertura: payload válido, campo ausente, tipo incorreto, valor vazio, JSON malformado, compat retroativa v1→v2, resolução de versão. **34/34 passando.**

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


## Status de integração (rollout completo)

Todas as Edge Functions com payload de entrada agora consomem a camada de contrato,
garantindo formato de erro 422 único e versionamento (v1/v2):

| Função              | Integrada | Observação                                    |
| ------------------- | :-------: | --------------------------------------------- |
| lalamove-webhook    |    ✅     | + validação HMAC                              |
| evaluate-driver     |    ✅     | —                                             |
| send-notification   |    ✅     | inclui `metadata` opcional no schema          |
| new-device-alert    |    ✅     | —                                             |
| route-analyzer      |    ✅     | —                                             |
| test-notification   |    ✅     | —                                             |
| check-external-api  |    ✅     | schema registrado                             |

Deploy realizado para: `send-notification`, `new-device-alert`, `route-analyzer`, `test-notification`.
