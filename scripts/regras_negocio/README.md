# regras_negocio — regras de negócio para agentes de IA

Produtor da fonte **regras de negócio** do contexto para agentes. Lê o repositório (código, as 153
migrations de `supabase/migrations/`, `src/integrations/supabase/types.ts`) e
`docs/contexto/regras/manual/` (texto humano), e publica na branch derivada `contexto`:

| Arquivo | Conteúdo |
|---|---|
| `docs/contexto/regras/07-REGRAS-DE-NEGOCIO.md` | regras manuais · RLS por operação · constraints/CHECK/FK/colunas calculadas · triggers + `RAISE EXCEPTION` · máquinas de estado (status de cotação/pedido/rastreamento/incidente/aprovação, mapas de transição, valores usados no código) · validações (Zod + refine, react-hook-form, inputs) · fórmulas (score de risco, preço/frete) · parâmetros e prazos · mensagens de erro · testes como especificação · eventos de webhook (Lalamove, Bitrix24) · efeitos colaterais (notificações, fila de jobs) |
| `docs/contexto/regras/10-ACESSO-E-SEGURANCA.md` | perfis e MFA, matriz tabela × operação → quem pode, onde o RLS é ignorado (`service_role`, SECURITY DEFINER), edge functions públicas (`verify_jwt = false`), rotas protegidas (`<ProtectedRoute requiredRole= requireMFA>` em `src/App.tsx`), multi-tenancy, soft delete, PII, colunas de dinheiro |
| `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md` | glossário, seed, inconsistências código × schema (NÃO VERIFICADO) e lacunas que só o dono do negócio responde |
| `docs/contexto/regras/manifest.json` | `gerado_em`, `commit`, `entrada`, `arquivos`, `inconsistencias`, `lacunas` — lido pelo `indice.py` |
| `docs/contexto/00-INDEX.md` | índice único das três fontes (banco real, código, regras), gerado por `indice.py` |

O que **não** é daqui (cada fato tem um dono): schema real em produção → snapshot do banco
(`docs/contexto/supabase/`, `scripts/supabase_snapshot/`); rotas/módulos/hooks/edges/grafo →
`docs/contexto/codigo/` (`scripts/ai-context/gerar.mjs`). Tudo na branch `contexto`, job a job em
`.github/workflows/contexto.yml`.

Regras operacionais do repo continuam em `AGENTS.md` e `docs/agentes/` — em especial
`docs/agentes/regras-dominio.md` (papéis/MFA, aprovações, score de risco, fila de jobs, cache, partições
de `tracking_events`), que é escrito à mão e **não** é gerado por aqui.

## Arquivos

- `generate.py` — gerador (stdlib, ~3,4 s neste repo). `--profile regras` escreve só 07/10/11;
  `--schema-snapshot` faz o 06 apontar para o snapshot em vez de reconstruir das migrations.
- `indice.py` — monta `00-INDEX.md` lendo o `manifest.json` de cada fonte
  (`--fonte "NOME=CAMINHO[@BRANCH]"`); fonte que vive em outra branch entra como "como ler"
  (git show / raw), sem inventar conteúdo.
- `publish.sh` — publicação genérica (push / PR / branch derivada) para uso standalone em outros repos;
  **neste repo não é usado**: o job `publicar` do `contexto.yml` monta a branch `contexto` e o índice.
- `test_generate.py` — regressão offline (8 testes, fixtures locais; sem banco e sem API de LLM).
- Workflow: job `regras` (+ `publicar`, que monta o índice) em `.github/workflows/contexto.yml`.

O índice distingue `ok`, `parcial` (falha de coleta ou reaproveitamento), `não verificável`
(manifest/relatório ilegível), `desatualizado` e fonte ausente. Código/regras com commit igual ao HEAD
continuam atuais apesar da idade da coleta; banco real e fontes sem commit confirmado seguem o limite de
idade configurado (`--stale-min`).

## Secrets

**Nenhum.** `generate.py` e `indice.py` leem apenas o checkout; no workflow o job `regras` roda com
`permissions: contents: read`. Quem precisa de secret é o job do banco (`SUPABASE_DB_URL`, ver
`scripts/supabase_snapshot/README.md`) e o job `publicar`, que usa o `GITHUB_TOKEN` do próprio run para
empurrar a branch `contexto`. Todo valor que pareça segredo encontrado no código é substituído por
`[REDACTED]` antes de entrar na saída.

## Fontes SQL

Arquivos `.sql` em diretórios chamados exatamente `_foreign` ou `_superseded` são históricos: continuam
no inventário de arquivos, mas não entram na reconstrução do schema nem na extração de regras. Outras
pastas de migrations e fontes SQL, Prisma e tipos gerados mantêm a seleção existente. A reconstrução é
estática: **só o snapshot descreve o banco em produção** — as migrations deste repo são histórico.

## Regras humanas

`docs/contexto/regras/manual/*.md` (exceto `README.md` e `TEMPLATE-regras-de-negocio.md`) entram na
seção A do 07 com prioridade máxima e nunca são sobrescritos. Comece copiando
`TEMPLATE-regras-de-negocio.md` (criado na 1ª execução) para `regras.md`. Editar `manual/` na `main`
dispara o workflow.

## Rodar local

```bash
python3 scripts/regras_negocio/generate.py --repo . --out docs/contexto/regras \
  --profile regras --schema-snapshot docs/contexto/supabase \
  --index-path docs/contexto/00-INDEX.md --no-pointer
python3 scripts/regras_negocio/indice.py --repo . --out docs/contexto/00-INDEX.md \
  --fonte "banco real=docs/contexto/supabase" \
  --fonte "código=docs/contexto/codigo" \
  --fonte "regras de negócio=docs/contexto/regras"
```

Ler o resultado publicado: `git fetch origin contexto && git show origin/contexto:docs/contexto/00-INDEX.md`.
O repo é **privado**: `raw.githubusercontent.com` exige token; pelo MCP use
`github_get_content` com `ref=contexto`.

## Testes de regressão

```bash
python3 scripts/regras_negocio/test_generate.py -v
```

A suíte usa fixtures locais e cobre SQL ativo versus histórico, objetos do schema, fontes Prisma/tipos e
a saída do perfil `regras`. **8 testes, todos passando neste repo** (`Ran 8 tests … OK`). Nenhum teste
acessa banco, rede ou API de LLM. O job `regras` do workflow roda essa suíte antes de gerar, porque este
repo não tem adaptador Node em `scripts/ci/` para ela.

## Custo

O cron de 10 min do `contexto.yml` ⇒ **~144 runs/dia**. Os jobs `regras` e `codigo` saem em segundos
quando a `main` não mudou (gate por commit), mas o job `banco` coleta sempre. Decisão do dono.
