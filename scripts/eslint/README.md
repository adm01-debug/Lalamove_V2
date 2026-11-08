# scripts/eslint — regra local de lint

| Arquivo | O que faz |
|---|---|
| `no-secret-compare.js` | Proíbe `===`/`!==` em identificador que aluda a credencial (`secret`, `token`, `key`, `password`, `senha`, `segredo`, `assinatura`, `signature`), inclusive em `objeto.apiKey`. Exige comparação em tempo constante. |

O equivalente real neste repo é `timingSafeEqual` em
`supabase/functions/lalamove-webhook/security.ts:8`, usado pela validação de HMAC em `security.ts:38`.
(No Zapp a mensagem apontava para `_shared/cron-secret-auth.ts`, que não existe aqui.)

**Secrets: nenhum.** A regra é análise estática; nunca lê valor de env.

## Como rodar — NÃO está ligada

`eslint.config.js` começa com `{ ignores: ["dist", "supabase/functions/**"] }`, e é exatamente em
`supabase/functions/**` que vivem as comparações de segredo. Ligar exige um bloco de override no flat
config, o que muda o lint de todo o repo — decisão do dono, não aplicada nesta porta:

```js
import noSecretCompare from "./scripts/eslint/no-secret-compare.js";
// ...
{
  files: ["supabase/functions/**/*.ts"],
  plugins: { local: { rules: { "no-secret-compare": noSecretCompare } } },
  rules: { "local/no-secret-compare": "error" },
}
```

Enquanto isso, a regra roda via API do ESLint em um script avulso (foi assim que ela foi provada: pega
`token !== expected`, `o.apiKey === "z"` e `"fixo" === assinatura`; ignora `nome === "y"`).

**Aviso de ambiente:** hoje `npx eslint` falha neste repo antes de carregar qualquer regra —
`TypeError: Class extends value undefined` em `typescript-eslint/.../FlatESLint.js` (ESLint 10.10.0 com
`typescript-eslint` que espera a API do ESLint 9). É quebra herdada da `main`, não desta pasta.
