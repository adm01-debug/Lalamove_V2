# scripts/inventario — inventário do estado real

Scripts que **medem** o Lalamove V2 (código e banco) e gravam JSON em `inventario/estado/`.
São a fonte de consulta dos agentes para "o que existe hoje": leia o JSON antes de abrir `grep` no
repo. Nada aqui escreve no banco nem na aplicação — só lê.

Portado do Zapp Web V2 (`scripts/inventario/`) e adaptado a este repo: rotas em `src/App.tsx` com
`ProtectedRoute`, menu em `src/components/layout/sidebar-config.ts`, projeto Supabase
`iecgydonctmabiijadsf` e domínio Lalamove (pedidos, motoristas, rastreamento, fila de jobs,
partições de `tracking_events`).

| Script | O que audita | Como rodar |
|---|---|---|
| `gerar-rotas.mjs` | rotas de `src/App.tsx` (papel do `ProtectedRoute`, MFA, layout), itens do menu lateral e, por rota, hooks/tabelas/RPCs/edges alcançados pelos imports | `node scripts/inventario/gerar-rotas.mjs` (`--check` só confere se o JSON commitado está em dia) |
| `gerar-repo.mjs` | edge functions: linhas, segredos lidos (`Deno.env.get`), `verify_jwt` declarado em `supabase/config.toml` e quem invoca cada uma | `node scripts/inventario/gerar-repo.mjs < /dev/null` |
| `gerar-repo.mjs` (com stdin) | `.from('tabela')` por tabela em `src/` e `supabase/functions/` → `tabelas-uso.json` (não versionado) | `printf 'drivers\nlalamove_orders\n' \| node scripts/inventario/gerar-repo.mjs` |
| `banco.sql` | SQL de leitura do banco oficial: tabelas (RLS/policies/linhas/bytes), partições, pg_cron e os agregados do domínio Lalamove | rodar no MCP do projeto oficial ou via Management API pelo `gerar-banco.mjs` |
| `gerar-banco.mjs` | junta `banco.sql` + edges publicadas + uso das tabelas no código e calcula órfãs e `alertas` | `SUPABASE_ACCESS_TOKEN=... node scripts/inventario/gerar-banco.mjs` **ou** `node scripts/inventario/gerar-banco.mjs --entrada <resposta.json>` |
| `mudou-conteudo.mjs` | compara `inventario/estado/*.json` com o HEAD ignorando carimbo de data e telemetria de janela rolante; imprime `true`/`false` | `node scripts/inventario/mudou-conteudo.mjs` (usa `git show HEAD:<arquivo>`) |

## Secrets

- **`SUPABASE_ACCESS_TOKEN`** — token de uso pessoal da Management API, usado **só** pelo
  `gerar-banco.mjs` (`POST /database/query/read-only`, que roda em transação somente leitura, e
  `GET /functions`). **Hoje não existe neste repo nem nesta sessão de agente**, e nenhum MCP
  Supabase carregado aponta para `iecgydonctmabiijadsf` — por isso `banco.json` ainda não foi
  gerado (ver `inventario/estado/README.md`). O workflow semanal pula o passo do banco com aviso
  quando o secret falta, em vez de ficar vermelho.
- Nenhum outro script usa segredo. `gerar-rotas.mjs`, `gerar-repo.mjs` e `mudou-conteudo.mjs`
  rodam offline, só com `node` e `rg` (ripgrep).

## Regras ao mexer aqui

- Saída **determinística**: `rotas.json` não tem data nenhuma; `banco.json`/`edges.json` só o
  carimbo (`medido_em`/`gerado_em`). Chaves ordenadas. Sem isso o PR semanal vira ruído.
- Texto de `alertas[].detalhe` **não** leva número de janela rolante (taxa, contagem, horas): só
  nome e limiar fixo. O `mudou-conteudo.mjs` compara o JSON inteiro; número que anda sozinho
  abriria PR toda semana sem mudança real.
- `banco.sql` é só `SELECT` de catálogo e agregado (`count`/`max`). Nunca selecione texto livre:
  de `cron.job` sai apenas o nome das funções chamadas (o `command` pode ter URL, cabeçalho ou
  chave); de `lalamove_orders` não sai nome, telefone nem endereço de cliente; de
  `lalamove_uapi_sessions` não sai token. O `gerar-banco.mjs` se recusa a gravar saída com cara de
  credencial (`Bearer …`, JWT `eyJ…`, `sb_secret_`).
- `gerar-banco.mjs` só grava se o ledger (`supabase_migrations.schema_migrations`) bater com
  `supabase/migrations/`: assim uma resposta colada de outro banco (MCP errado) não entra.
- Node 22, só API nativa — nenhuma dependência nova no `package.json`.
