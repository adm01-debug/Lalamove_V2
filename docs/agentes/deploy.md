# Deploy (Vercel + Lovable) — referência para agentes

Ler quando for confirmar um deploy, mexer em env var, domínio ou deploy de edge function.
Tudo abaixo foi lido em 2026-11-08 (HEAD `924454e`) pelo MCP `Vercel` e pelo MCP `GITHUB - MCP - FOREVER`.

## Front

| O que | Valor |
|---|---|
| Projeto Vercel | `lalamove-v2` · `prj_RNi6mWRC2uXguu4HqiWhliR9Xhzv` |
| Team | `juca1` · `team_QyN41X0q8hrqhW80AwokbFLv` |
| Framework / Node / região | `vite` · **24.x** · `iad1` |
| Domínios de produção | `lalamove-v2.vercel.app`, `lalamove-v2-juca1.vercel.app` e `lalamove-v2-git-main-juca1.vercel.app` — os três são alias do **mesmo** deploy de produção (`dpl_5Rh9kCvk2tPjqBsf46xt1c5fxuWx`) |
| Proteção | `ssoProtection = all_except_custom_domains` (todo `*.vercel.app` pede login no Vercel) · sem password protection |
| Origem dos deploys | Git (integração GitHub): `source: "git"` com `githubOrg/githubRepo = adm01-debug/Lalamove_V2`; environments `Preview` e `Production` existem no GitHub |
| Produção servindo hoje | `dpl_5Rh9kCvk2tPjqBsf46xt1c5fxuWx` · `target: production` · `readyState: READY` · `main` no commit **`9e04fd9`** ("Merge PR #58"), de meados de setembro/2026 |
| Builds depois disso | **falham todas**: `errorCode: module_not_found`, `Command "npm install" exited with 1`, `errorStep: buildStep` — visto em `dpl_Edp7k3SL8Xrn5Vq6RWbYWJzpPz4M` (preview do Dependabot `vite` 8.3.2, `45ef819`, 2026-10-08) e nos previews de branch de agente. O projeto está com `live: false`. **A produção está congelada em `9e04fd9`**: merge em `main` dispara build, o build quebra no `npm install` e o alias continua no deploy antigo |
| `homepage` no GitHub | `https://lalamove-v2.vercel.app` — confere: é alias do deploy de produção acima |

**Limite de evidência (não é configuração errada):** com o token desta sessão,
`mcp__Vercel__list_deployments` responde **403**, `get_project` com `teamId` explícito responde **404**
(sem `teamId` funciona) e `list_deployment_events` (log de build) responde **404**. O proxy de saída da
sessão também **bloqueia** `https://lalamove-v2*.vercel.app` e `https://lalamove-guardian.lovable.app`
(`connect_rejected`). Então: o deploy de produção e o erro de build acima vêm de `get_deployment`
(por id e por hostname), mas **o log de build e o histórico completo de deploys ficam `NÃO VERIFICADO`** —
a causa exata do `npm install` falhando só sai no painel do Vercel ou por `npx vercel inspect <dpl> --logs`.
Para confirmar um deploy, use `get_deployment` com o hostname de produção.

## Lovable

O repo nasceu na Lovable e ainda carrega a dependência (`lovable-tagger` em `vite.config.ts`,
`@lovable.dev/cloud-auth-js` e `src/integrations/lovable/index.ts`, branches `lovable-sync-*` no remoto).
`docs/DEPLOYMENT.md` descreve a produção como `https://lalamove-guardian.lovable.app` com auto-deploy e
migrations aplicadas pela Lovable, e o job `deploy` do `.github/workflows/ci.yml` só imprime
`"Deploy automático via Lovable"`. **Os dois caminhos coexistem no papel** (Lovable publicando e Vercel
construindo a partir do GitHub) e o doc antigo nunca foi retificado. Antes de afirmar onde um merge sobe,
confirme no painel — não repita o doc.

## Edge functions

- **Não existe automação de deploy de edge function neste repo**: o único workflow é o `ci.yml`, que roda
  testes e um `echo` no job `deploy`. Nada chama `supabase functions deploy`.
- Logo, o deploy das 27 funções em `supabase/functions/` é manual (CLI/painel) ou vem pela sincronização
  da Lovable. **Merge em `main` não garante edge nova em produção** — confirme pelo painel do Supabase ou
  por `functions_ping`/chamada inócua antes de dizer "pronto".
- O job `edge-integration-tests` (só em `refs/heads/main`) chama as funções **implantadas**: se a função
  do repo não foi implantada, ele testa a versão antiga e passa — "verde" ali não prova deploy.

## Regras de env var no Vercel

- **Nunca** chave de servidor: este front é SPA estático, não há serverless neste projeto.
- **Nunca** `POSTGRES_*`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` ou `SUPABASE_JWT_SECRET`.
- Vars `VITE_*` entram no bundle e são **públicas** — nunca segredo com prefixo `VITE_`.
- Só duas vars são lidas pelo build: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
  (`src/integrations/supabase/client.ts:6-7`), ambas presentes em `production` + `preview`.

### Pendências de Vercel (ação no dashboard, com o dono)

Estado atual: **19 env vars em `production`**, 17 delas criadas pela integração Supabase
(`configurationId: icfg_l6F3AhnOcvXqyj1eMSD7Jpxb`) e **nenhuma lida pelo código**:

1. Segredos de servidor que não têm uso aqui e viram superfície de vazamento:
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_URL`,
   `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PASSWORD`, `POSTGRES_USER`,
   `POSTGRES_HOST`, `POSTGRES_DATABASE`.
2. Vars de framework errado (sobra de template Next.js): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, além de `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`.
3. **Build do Vercel quebrado desde `9e04fd9`** (`npm install` exit 1 em toda branch, incluindo previews
   que nada têm a ver com dependência): sem isso resolvido, nenhum merge em `main` chega à produção. É a
   mesma causa do `npm ci` com `ERESOLVE` que deixa o CI do GitHub vermelho desde 2026-10-03
   (`docs/agentes/github-ci.md`).
   Precisa do log de build (painel ou `npx vercel inspect <dpl> --logs`) para nomear o módulo que falta.
4. Alinhar o Node do CI (22) com o do Vercel (24.x) e corrigir `docs/DEPLOYMENT.md`, que ainda aponta a
   produção para a Lovable.
