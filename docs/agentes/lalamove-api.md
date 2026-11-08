# API Lalamove (v3 + UAPI) — referência para agentes

Ler quando mexer em cotação, pedido, rastreamento, POD, token de sessão ou webhook. Detalhe de contrato em
`docs/LALAMOVE_API_V3.md`, `docs/API_CONTRACTS.md` e `docs/WEBHOOK_HANDLER.md`; operação em
`docs/RUNBOOK_LALAMOVE.md` e `docs/LALAMOVE_FAILURE_SIMULATION.md`.

## As cinco edges e o que cada uma faz

| Edge | Papel | `verify_jwt` |
|---|---|---|
| `lalamove-api` (1026 linhas) | BFF principal da **API v3 oficial**: cria pedido, cancela, troca motorista, define webhook. Assina com `LALAMOVE_API_KEY`/`LALAMOVE_API_SECRET` e usa `LALAMOVE_BASE_URL` (default `https://rest…/v3`) | `true` (`supabase/config.toml`) |
| `lalamove-gateway` (369 linhas) | Gateway único para os **proxies** (`target: 'unified' \| 'uapi'`): exige JWT, injeta as chaves do backend (`LALAMOVE_UNIFIED_PROXY_URL/KEY`, `LALAMOVE_UAPI_PROXY_URL/KEY`), propaga `x-request-id` e lê o rate limit da resposta. Existe justamente para **nenhuma chave de proxy ir para o bundle** | default (`true`) |
| `lalamove-uapi` (792 linhas) | Proxy da **UAPI** (API de sessão do portal): `list-orders`, `order-detail`, `order-status`, `search-orders`, `cancel-order`, `cancel-eligibility`, `rate-driver`, `favorite-driver`, `block-driver`, `fleet-favorites`, `fleet-blocked`, `coupons`, `exchange-coupon`, `download-receipt`, `city-info`, `corporate-info`, `user-info`, `last-order`, `bulk-import`, `refresh-token` | `true` (declarado: a action `set-token` aceita token externo) |
| `lalamove-token-refresh` (192 linhas) | Worker de `pg_cron` (de hora em hora): o token UAPI vive ~24 h e o refresh é **de uso único** — renova após 20 h, usa claim de deduplicação (janela de 30 min) para não queimar o refresh em corrida e alerta `CRITICAL` se perder a janela | — |
| `lalamove-webhook` (899 linhas) | Recebe os eventos da Lalamove: valida HMAC `x-lalamove-signature` (SHA-256 com `LALAMOVE_API_SECRET`), rejeita payload fora da janela de **5 minutos** (replay) e deduplica por chave de idempotência derivada do corpo; falha de assinatura é registrada como `SIGNATURE_INVALID` | ver `supabase/config.toml` |

`check-external-api` usa `LALAMOVE_API_URL`/chaves só para health check. `src/lib/lalamove-api.ts`,
`lalamoveValidation.ts`, `lalamoveGuards.ts`, `lalamoveTimeline.ts` e `uapi-proxy.ts` são o lado do front
(nenhum segredo lá).

## Regras

1. **Segredo nenhum no front.** `LALAMOVE_API_KEY`, `LALAMOVE_API_SECRET`, `LALAMOVE_*_PROXY_KEY`,
   `MAPBOX_ACCESS_TOKEN`, `BITRIX24_*`, `LOVABLE_API_KEY`, `RESEND_API_KEY`, `EVOLUTION_API_*` e
   `SLACK_WEBHOOK_URL` vivem **só** nos secrets das edge functions (`supabase secrets set …` ou painel).
   Variável com prefixo `VITE_` vai para o bundle — nunca segredo ali. Duas edges leem
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (sobra de script de teste): não copie esse padrão.
2. **Chamada nova da Lalamove passa pelo `lalamove-gateway`**, não direto do front e não com chave nova no
   bundle. Pedido/cancelamento pela v3 oficial → `lalamove-api`; dado de portal/sessão → `lalamove-uapi`.
3. **Não invoque em massa para "testar".** Criar pedido na v3 é **operação paga e real**; `route-analyzer`
   gasta `LOVABLE_API_KEY` por token. Teste com payload inócuo (validação/dry-run) e registre o que rodou.
4. **Não mexa na janela de replay nem na validação de HMAC** do webhook sem rodar os testes que já existem:
   `deno test --allow-net --allow-env supabase/functions/lalamove-webhook/security.test.ts` (e o
   `_shared/contract.test.ts`), que é o que o job `contract-tests` do CI roda.
5. **Token UAPI é recurso de uso único:** nunca chame `refresh-token` à mão "para ver se funciona" — você
   queima o refresh do worker e derruba a sessão até a próxima janela.
6. Rate limit da Lalamove: o gateway já lê e devolve o snapshot (`limitTotal`, `limitRemaining`,
   `limitResetAt`, `usageRatio`); a tela `/lalamove-quota` consome isso. Antes de aumentar polling, olhe o
   consumo em vez de "só subir o intervalo".

## Fora do front: token manager + n8n

`lalamove_token_manager.py` (raiz) é um **servidor HTTP local** que entrega token válido ao n8n em cache
(`GET /token`, renovação com ~4 h de margem antes das 20 h) — `lalamove_n8n_integration.md`.
`lalamove_cron_setup.sh` e os `lalamove_f0*.json` / `lalamove_bundle_import.json` são os workflows do n8n
(bootstrap, cotação, pedido, rastreamento, POD). Nada disso entra no build do front; mexer lá é mexer na
automação do n8n, não no app — e as chaves usadas lá são as mesmas da conta Lalamove.
