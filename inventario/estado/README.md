# Estado real do projeto — inventário gerado

Pasta de **dados gerados por script**, não de relatórios escritos à mão. É a fonte de consulta dos
agentes para "o que existe hoje" no código e no banco. Se um número aqui divergir do que você
mediu, regere o arquivo (comandos abaixo) em vez de corrigir à mão. Os scripts e as regras de quem
mexe neles: `scripts/inventario/README.md`.

| Arquivo | Como gerar | O que tem |
|---|---|---|
| `rotas.json` | `node scripts/inventario/gerar-rotas.mjs` (`--check` só confere se está em dia) | as rotas de `src/App.tsx` (caminho, componente, arquivo, layout, `requiredRole`, `requireMFA`, redirecionamento), o item do menu lateral de cada uma (`src/components/layout/sidebar-config.ts`: categoria, rótulo, badge, papel do item e da categoria) e, por rota, os hooks, tabelas, RPCs, buckets e edge functions alcançados pelos imports da página — mais a lista `problemas` |
| `edges.json` | `node scripts/inventario/gerar-repo.mjs < /dev/null` | as 26 edge functions de `supabase/functions/`: linhas, segredos lidos (`Deno.env.get`), `verify_jwt` declarado em `supabase/config.toml` e quem invoca cada uma (src, migrations, outras edges, e2e, CI) |
| `banco.json` | **ainda não gerado — ver "Banco: NÃO VERIFICADO"** | banco oficial, só leitura: cada tabela (RLS, policies, triggers, linhas, bytes, se é citada em função/view e quantos `.from()` tem no código), partições de `tracking_events`, cron jobs, agregados do domínio Lalamove, edges publicadas × pastas do repo e a lista `alertas` |
| `tabelas-uso.json` (não versionado) | `printf 'drivers\nlalamove_orders\n' \| node scripts/inventario/gerar-repo.mjs` | quantos `.from('tabela')` cada tabela tem em `src/` e em `supabase/functions/` — com `banco.json` isso também sai em `tabelas[].uso_no_codigo` |

## Banco: NÃO VERIFICADO

`banco.json` **não existe ainda**: o projeto oficial é `iecgydonctmabiijadsf`
(`supabase/config.toml:1`), e hoje não há `SUPABASE_ACCESS_TOKEN` dele no repo nem MCP Supabase
apontando para ele nesta sessão (os MCPs carregados são de outros projetos — AGENTS.md > Banco).
Então **qualquer afirmação sobre o estado da produção é NÃO VERIFICADO até o dono liberar acesso**.
`scripts/inventario/gerar-banco.mjs` e `scripts/inventario/banco.sql` estão portados e o caminho
`--entrada` foi exercitado contra um Postgres descartável, mas nenhum número saiu da produção.

Para gerar quando houver acesso:

- com token: `SUPABASE_ACCESS_TOKEN=… node scripts/inventario/gerar-banco.mjs`
  (Management API: `POST /database/query/read-only` + `GET /functions`, só leitura);
- com MCP do projeto oficial: rodar `scripts/inventario/banco.sql`, salvar a resposta e
  `node scripts/inventario/gerar-banco.mjs --entrada <arquivo.json>` (sem token as edges
  publicadas ficam `publicadas: null`).

O script **se recusa a gravar** se o ledger (`supabase_migrations.schema_migrations`) não bater com
`supabase/migrations/` (maior versão entre as 20 mais recentes do repo, ou à frente, e contagem a
até 10 % da de arquivos): resposta vinda de outro banco não entra.

## Como ler `rotas.json`

- **`problemas`** é o que importa primeiro:
  - `menu_sem_rota` — item do menu aponta para caminho que não existe em `src/App.tsx` (cai no `NotFound`);
  - `rota_sem_menu` — página dentro do `AppLayout` sem item no menu: só por URL ou pela command palette (inclui apelidos como `/dashboard` e `/live-map`, que repetem a página de outra rota);
  - `rota_sem_arquivo` — componente da rota não resolve para arquivo;
  - `menu_mais_permissivo_que_rota` — o item aparece no menu para quem o `ProtectedRoute` manda para `/unauthorized` (compara `requiredRole` do item/categoria com o da rota; só reclama quando a rota exige `manager`/`admin`);
  - `import_quebrado` — import local que não resolve a partir da página.
- **`rotas[].edges`/`tabelas`/`rpcs`/`hooks`** vêm de seguir os imports a partir do arquivo da
  página: `src/hooks/`, `src/lib/`, `src/services/`, `src/integrations/` e `src/utils/` sem limite;
  `src/components/` (fora de `ui/`) e outras páginas até 2 saltos. Limite conhecido:
  `.from(variável)` não é resolvido (ex.: `supabase/functions/external-companies`, que recebe o
  nome da tabela por parâmetro) e `requiredRole` só é lido quando é literal.
- `rotas[].papel` é o do `ProtectedRoute`; `null` = só exige sessão. Hierarquia em
  `sidebar-config.ts` (`admin` 4 > `manager` 3 > `operator` 2 > `viewer` 1).

## Como ler `edges.json`

- `sem_chamador_no_repo`: nenhuma referência em `src/`, `supabase/migrations/` nem em outra edge —
  candidata a ser chamada só por cron, n8n, webhook externo ou a estar morta. Não é prova de que
  pode apagar.
- `verify_jwt_nao_declarado`: a edge não tem bloco `[functions.<slug>]` em `supabase/config.toml`,
  então vale o padrão da plataforma (JWT exigido). Repare em `lalamove-webhook`, que autentica por
  HMAC (`supabase/functions/lalamove-webhook/security.ts`) e não por JWT: se o deploy em produção
  estiver com `verify_jwt` ligado, a Lalamove não consegue entregar o evento. O arquivo diz o que
  está **declarado no repo**; o que está publicado só sai de `banco.json` (`edge_functions.publicadas`).
- `segredos_lidos` são **nomes** de variável, nunca valor.

## Como ler `banco.json` (quando existir)

- **`alertas`** é o que um agente precisa saber antes de mexer: `tabela_sem_rls`, `rls_sem_policy`
  (RLS ligado sem nenhuma policy nega tudo para `authenticated`/`anon`), `cron_falhando`
  (taxa ≥ 5 % em 7 dias), `cron_sem_execucao` (job ativo que roda todo dia sem execução em 24 h — o
  cron 100 % parado não grava falha, então só aparece aqui), `cron_parado` (hora com mais da metade
  das execuções falhando), `historico_cron_sem_limpeza` (> 50 mil linhas com mais de 7 dias),
  `particao_sem_cobertura` e `particao_sem_proximo_mes` (nenhuma partição de `tracking_events` cobre
  hoje / o mês que vem: o `INSERT` cai na partição `DEFAULT`, sem poda, ou falha se não houver),
  `rastreamento_parado` (nenhum `tracking_events` novo em 24 h), `fila_de_jobs_com_falhas` e
  `fila_de_jobs_acumulando` (`job_queue` com `FAILED`/`PENDING` acima do limiar), `edge_sem_deploy`
  e `edge_publicada_sem_codigo`. Os limiares estão em `LIMIARES`, em
  `scripts/inventario/gerar-banco.mjs`.
- **`tabelas_orfas`**: 0 linhas + não citada em função/view do banco + nenhum `.from()` nem
  `/rest/v1/` no código. Candidata a limpeza, não prova de que pode apagar (pode ser usada por RPC
  com outro nome, por `.from(variável)` ou por sistema externo).
- **`linhas`** é `count(*)` exato quando a tabela tem menos de 200 mil linhas
  (`linhas_exatas: true`); acima disso, a estimativa do planner. Em tabela particionada a
  estimativa é a soma das partições. Não confie em `pg_stat_user_tables.n_live_tup`: zera quando o
  banco reinicia.
- **`particoes`** traz, por tabela-pai, a faixa coberta, se há partição `DEFAULT` e quantas linhas
  caíram nela. As migrations só criam partições até `2026-07-01`
  (`supabase/migrations/20260516114956_*.sql`), então espere `particao_sem_cobertura` enquanto
  ninguém criar as próximas.
- **`lalamove.grupos`** é volume por status (pedidos, motoristas, aprovações, incidentes, fila de
  jobs, webhooks) e **`lalamove.frescor`** é o carimbo do último registro de cada fluxo — é com ele
  que se vê pipeline parado.
- Contagens rodam com o papel da conexão. Nos dois caminhos o RLS não filtra: `service_role` (MCP) e
  `supabase_read_only_user` (endpoint read-only da Management API) têm `rolbypassrls = true`; com
  outro papel, tabelas com RLS e `cron.job` podem vir incompletas.
- Nada de segredo nem dado pessoal sai do banco: de `cron.job` só o nome das funções chamadas (nunca
  o comando, que pode ter URL/cabeçalho), de `lalamove_orders` nem nome, telefone ou endereço, de
  `lalamove_uapi_sessions` nenhum token. O script se recusa a gravar saída com cara de credencial.

## PR semanal

`.github/workflows/inventario-estado-semanal.yml` roda toda segunda 09:37 UTC, regera o inventário e
abre PR em `automation/inventario-estado` — **nunca push em `main`**. A PR só abre quando algo mudou
de verdade: `medido_em`/`gerado_em` sozinhos não abrem, e nem a telemetria de janela rolante
(`execucoes_24h`, `taxa_falha_7d_pct`, `horas_paradas_7d`, `cron.historico.linhas/bytes`,
`lalamove.frescor` e as **contagens** de `lalamove.grupos` — status novo abre, contagem não).
Crescimento real de `tabelas[].linhas`/`bytes` **abre** PR, de propósito: é o estado da produção.
Quem quiser esses campos frescos regenera à mão (comandos acima); enquanto nada estrutural mudar, o
valor commitado pode ficar atrasado.
