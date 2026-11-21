# Pipeline de deploy das edge functions — 2026-11

## Como funciona

`.github/workflows/deploy-edges.yml` roda em todo push no `main` que toque
`supabase/functions/**` ou `supabase/config.toml` (e manualmente via
*Run workflow*). Ele instala o Supabase CLI e executa:

```bash
supabase functions deploy --project-ref iecgydonctmabiijadsf
```

Isso implanta **todas** as functions e aplica o `verify_jwt` por function
declarado no `supabase/config.toml` — o `main` passa a ser a fonte de verdade
do que está no ar.

## Pré-requisito (uma vez)

Secret de Actions no repo: `SUPABASE_ACCESS_TOKEN` = Personal Access Token do
Supabase com acesso ao projeto. Sem ele o workflow falha no primeiro passo.
O token nunca entra em código ou log.

## Mapa de verify_jwt (resumo)

| Function | verify_jwt | Por quê |
|---|---|---|
| lalamove-webhook, llm-wh | **false** | Lalamove não envia JWT; assinatura HMAC validada em código |
| mcp-query | **false** | valida JWT em código + RPC de autorização |
| todas as demais | true | callers são frontend autenticado ou Bearer service_role |

⚠️ Jobs de `pg_cron` que invocam functions com `verify_jwt = true` precisam
enviar `Authorization: Bearer <service_role>` — com anon key o cron recebe 401.

## Segredos a rotacionar (ação do dono)

Estas credenciais circularam fora do cofre durante a configuração e devem ser
rotacionadas no dashboard do Supabase (Settings → API / Access Tokens):

1. `sb_secret_...` (secret key do projeto) — revogar e gerar nova; atualizar
   onde for consumida (n8n, scripts).
2. Personal Access Token `sbp_...` — revogar e gerar novo; o novo vira o
   `SUPABASE_ACCESS_TOKEN` do Actions.
3. Credenciais Lalamove (API key/secret e sessão UAPI) — rotacionar no portal
   da Lalamove e atualizar os secrets das edge functions
   (`supabase secrets set`).

Após rotacionar, rodar o workflow manualmente para confirmar que o deploy
continua verde.
