# P-04 · Roque de JWT_SECRET no painel Supabase (rotação)

**Status:** Ação do dono (sem MCP disponível para o painel)
**Origem:** sessões anteriores — JWT_SECRET legacy ainda válida assinando service_role via HS256

## Contexto
- As chaves anon/service_role legacy foram desabilitadas (401) na rotação de 2026-11-20 17:25Z.
- Resíduo ativo: JWT_SECRET do painel (era pré-rotação) ainda assina JWT com claim service_role — risco real enquanto válida.
- Confirmação: assinatura HS256 com o JWT_SECRET gera token com role service_role aceito pelo PostgREST.

## Impacto no negócio
- Quem tiver o JWT_SECRET antigo (vazou em b4d7a5d no git, 2026-11) acessa o banco com privilégio total.

## Decisão pendente
- Rotacionar JWT_SECRET no painel Supabase (ação manual do dono). Sem o novo valor, o gate 401 e o login não podem ser revalidados de ponta a ponta.

## Relacionado
- P-05 (revalidar mcp-query após rotação); PR #80/#81 (remover segredos do código, já no main).
