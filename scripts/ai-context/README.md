# ai-context — contexto de código do Lalamove V2 para agentes de IA

**O que faz:** `gerar.mjs` lê o repositório (zero dependências, só APIs nativas do Node 22) e escreve
`docs/contexto/codigo/`: `INDEX.md` + 16 JSONs + `manifest.json`. Cobre o que existe neste repo:

| arquivo | conteúdo |
|---|---|
| `rotas.json` | rotas React Router de `src/App.tsx` (url → componente → arquivo → hooks/tabelas/edges pelo fecho dos imports), `papel_requerido`/`requer_mfa`/`permissao_requerida` do `ProtectedRoute` (herdados do `<Route>` pai), layouts sem path, menu de `sidebar-config.ts`/`MobileBottomNav.tsx` e mapa de `lazy()` |
| `rbac.json` | rotas por papel, rotas com MFA/permissão, hierarquia (`viewer<operator<manager<admin`), guards, enums de papel do banco e divergência **menu × ProtectedRoute** |
| `modulos.json` | módulo (pasta de domínio) → itens de menu → telas → hooks → edges → tabelas → dependências entre módulos |
| `componentes.json`, `hooks.json`, `logica.json` | quem usa, o que toca, cobertura de teste, órfãos, nomes duplicados |
| `edge-functions.json` | 1 entrada por pasta de `supabase/functions/`: `verify_jwt` (de `supabase/config.toml`), serviço (Lalamove/Bitrix24/Mapbox/notificações/…), HMAC, `service_role`, tabelas, nomes de env, `_shared`, quem chama (front, outra edge, SQL/cron), órfãs |
| `banco.json` | reconstrução das 153 migrations em ordem de statement (colunas, RLS, policies — inclusive dentro de `DO $$`, índices, FKs, triggers, enums, extensões, partições, buckets, `pg_cron` → edge) + `drift` contra `src/integrations/supabase/types.ts` |
| `testes.json` | vitest (`src/**/*.{test,spec}.*`), playwright (`e2e/*.e2e.ts`), deno (contratos das edges), guards (`scripts/**/*.unit.mjs`), comandos de verificação e o que não tem teste |
| `ferramentas.json`, `scripts.json` | stack, package, workflows, env (**só nomes**), deploy, integrações, flags, providers, i18n; scripts com dono (npm/workflow) e os soltos na raiz de `scripts/` |
| `grafo.json` + `grafo-arestas.json` | grafo de imports: hubs, ciclos (Tarjan), órfãos, módulos mais acoplados |
| `grafo-graphify.json` | grafo por AST do graphify quando `graphify-out/graph.json` existe; **sem ele o gerador segue normalmente** (`presente: false`) |
| `convencoes.json` | onde fica cada coisa, nomenclatura, aliases, tipos de commit aceitos (lidos de `scripts/ci/commit-msg-lint.mjs`), instruções de agente do repo |
| `baseline.json` | contagens, hotspots de git, TODOs, qualidade (`any`, `console.log`, `@ts-ignore`) e **alertas**; `erros_do_gerador` lista qualquer seção que falhou |
| `manifest.json` | commit, branch, Node, hash de cada arquivo, contagens e erros — **único arquivo com data/hora** (o resto é determinístico) |

## Como rodar

```bash
node scripts/ai-context/gerar.mjs --out docs/contexto/codigo   # geração normal
node scripts/ai-context/gerar.mjs [--root <dir>] [--quiet]     # padrão já é docs/contexto/codigo
node --test scripts/ai-context/gerar.unit.mjs                  # 14 testes (repo sintético no formato deste repo)
node scripts/ai-context/cenarios.mjs [--only <trecho>] [--keep] # 202 cenários + fuzz (~40s)
```

Não há npm script para isso ainda (`package.json` não foi alterado). Sugestões, se o dono quiser:
`"ctx": "node scripts/ai-context/gerar.mjs --out docs/contexto/codigo"`,
`"ctx:test": "node --test scripts/ai-context/gerar.unit.mjs"`,
`"ctx:cenarios": "node scripts/ai-context/cenarios.mjs"`.

**Config opcional** (`ai-context.config.json` na raiz): `out`, `skipDirs`, `srcDirs`, `menuFiles`,
`routeFiles`, `aliases`, `typesFile`, `maxFileMB`, `graphifyDir`, `publicacao` (rodapé do `INDEX.md`;
env `AI_CONTEXT_PUBLICACAO` e `AI_CONTEXT_DIR` têm precedência).

## Secrets

**Nenhum.** O gerador só lê arquivos do repo e `git log`; não acessa rede, Supabase, Vercel nem GitHub.
O contexto gerado registra **nomes** de variáveis de ambiente (`LALAMOVE_API_KEY`, `MAPBOX_ACCESS_TOKEN`, …),
nunca valores — inclusive as comentadas no `.env.example`, que neste repo documentam segredos que só existem
nas edges (`supabase secrets set`). `baseline.json → alertas.possiveis_segredos_no_codigo` aponta
`arquivo:linha` de padrões de segredo (JWT, `sk_live_`, `sbp_`, `ghp_`, chave privada) **sem copiar o valor** —
é o que detecta os segredos já commitados em `scripts/*.ts` (ver `AGENTS.md` > Postura e
`docs/agentes/banco.md` > "Segredos commitados"). Teste `contexto gerado não contém valor de variável de
ambiente nem segredo` em `gerar.unit.mjs` trava essa regra.

## Alcance e limites

- `supabase/migrations/_superseded/`, `_foreign/` e `_archive/` são histórico: ficam fora da reconstrução.
- DDL dinâmico (`EXECUTE format(...)`) não é modelado — aparece em `banco.json → avisos`.
- `banco.json` é a visão do **código**, não do banco vivo: nenhum MCP desta sessão aponta para
  `iecgydonctmabiijadsf` (`docs/agentes/banco.md`).
- Alertas de tabela/RPC/edge inexistente e o mapa de chamadores excluem testes, stories e raízes de
  ferramentas/documentação (`scripts/`, `bin/`, `tools/`, `.github/`, `docs/`, `e2e/`, `public/`); esses
  arquivos continuam nos inventários próprios. Uma raiz dessas que contenha aplicação vai em `srcDirs`.
- Tudo é extraído estaticamente: referência encontrada não prova execução, e ausência de chamador não prova
  que uma edge não tenha consumidor externo (webhook da Lalamove, n8n, Bitrix24).
- Não cobre (não existe neste repo): ViewRouter/vistas por id, roteadores de file-system
  (Next/Nuxt/Remix/Astro), backends HTTP (Express/Hono/Nest), ORMs (Prisma/Drizzle/TypeORM), monorepo e
  análise de Python — os 3 `.py` soltos aparecem apenas em `scripts.json`.
