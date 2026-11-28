# Workflows n8n — Lalamove × Bitrix24

Exports JSON dos workflows n8n que operam a integração Lalamove ↔ Bitrix24 (cotação, pedido,
rastreamento e POD). Ficam versionados aqui porque são parte da operação e não existiam em
nenhum outro lugar do repositório — só na instância n8n e em branches de trabalho já encerradas.

Ver `lalamove_n8n_integration.md` (arquitetura) e `lalamove_token_manager.py` (emissão de
assinatura HMAC usada pelo n8n) na raiz do repositório.

## Conteúdo

| Arquivo | Workflow | Nós | Ativo no export |
| --- | --- | --- | --- |
| `workflows/f00-bootstrap.json` | ⚙️ LLM-BOOTSTRAP — Deploy Lalamove | 3 | não (manual) |
| `workflows/f01-cotacao.json` | 🚚 LLM-F01 — Cotação Lalamove | 12 | sim |
| `workflows/f02-pedido.json` | 📦 LLM-F02 — Pedido Lalamove | 11 | sim |
| `workflows/f03-rastreamento.json` | 📡 LLM-F03 — Rastreamento Lalamove | 12 | sim |
| `workflows/f04-pop-pod.json` | 🖼️ LLM-F04 — POP+POD Lalamove | 9 | sim |
| `workflows/bundle-import.json` | os 5 acima em um único arquivo de importação | — | — |

O `bundle-import.json` é o artefato canônico: é a geração mais recente e a única em que o bootstrap
carrega, embutido no próprio nó, o código dos fluxos que ele cria. O `f00-bootstrap.json` foi extraído
desse bundle por isso — usar uma cópia anterior do bootstrap recriaria os fluxos em versão antiga.

Fluxo funcional:

- **F01 Cotação** — webhook do Bitrix24 → geocodifica coleta e entrega (`geo-gateway`) → monta o
  payload → assina HMAC → `POST /v3/quotations` na Lalamove → devolve a cotação ao Bitrix24.
- **F02 Pedido** — webhook → lê a SPA → monta o pedido → HMAC → `POST /v3/orders` → grava o id da
  Lalamove e o estado no Bitrix24.
- **F03 Rastreamento** — webhook de eventos da Lalamove → valida HMAC (401 se inválido) → traduz o
  status → atualiza o item no Bitrix24.
- **F04 POP+POD** — webhook de POD → `GET /v3/orders/{id}` → extrai POP/POD → move o negócio para
  WON e registra comentário na timeline.
- **F00 Bootstrap** — execução manual que provisiona/valida a configuração dos demais.

## Como importar

No n8n: **Workflows → Import from File**. Use `bundle-import.json` para recriar os cinco de uma vez,
ou os arquivos de `workflows/` individualmente para atualizar só um fluxo.

Depois de importar, revise:

1. **Credenciais** — os nós referenciam credenciais por nome/id da instância de origem
   (Bitrix24, HTTP). Recrie-as na instância de destino e religue nos nós.
2. **Variáveis de ambiente** — `LALAMOVE_*` (chave/segredo HMAC, base URL), token do webhook do
   Bitrix24 e o endereço do serviço de token usado pelos nós de assinatura.
3. **Webhooks** — as URLs de produção são geradas pela instância; reconfigure o webhook no Bitrix24
   e na Lalamove após importar.
4. **Ativação** — o campo `active` do export é ignorado no import; ative manualmente os fluxos que
   devem rodar.

## Segredos

Os exports originais traziam a **API key e o segredo HMAC de produção da Lalamove em texto puro**
dentro dos nós `Crypto`/`Set`. Foram substituídos por expressões n8n:

| Expressão usada agora | Variável n8n a criar | Onde aparecia |
| --- | --- | --- |
| `{{ $env.LALAMOVE_API_KEY }}` | `LALAMOVE_API_KEY` | header `Authorization` (`hmac <chave>:<ts>:<sig>`) |
| `{{ $env.LALAMOVE_HMAC_SECRET }}` | `LALAMOVE_HMAC_SECRET` | chave do `crypto.createHmac('sha256', …)` |

Configure em **Settings → Variables** do n8n (ou por variável de ambiente da instância).

Como esses valores ficaram públicos no GitHub (commit `abd4a28` e os commits locais de 22–23/11),
eles precisam ser **rotacionados** no painel da Lalamove antes de voltar a valer, e o mesmo par deve
ser atualizado nos secrets das edges (`supabase secrets set LALAMOVE_API_KEY=… LALAMOVE_API_SECRET=…`).

Nunca versione chave, token ou URL privada de webhook neste diretório. Guarda automática:
`node scripts/ci/check-repo-secrets.mjs`.

## Origem

Recuperados na auditoria de branches de 26/11/2026 a partir das branches locais de trabalho de
22–23/11/2026 (versão mais recente de cada arquivo). Nenhuma versão existia em `main`.