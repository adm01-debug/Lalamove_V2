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

```bash
deno test --allow-net supabase/functions/_shared/contract.test.ts
```

Cobertura: payload válido, campo ausente, tipo incorreto, valor vazio, JSON malformado, compat retroativa v1→v2, resolução de versão. **34/34 passando.**

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
