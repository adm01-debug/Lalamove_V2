---
name: lalamove-v2
description: Convenções de código e commit do Lalamove V2 (TypeScript, Conventional Commits). Use ao alterar código, criar testes ou escrever mensagem de commit neste repositório; as regras operacionais ficam em AGENTS.md.
---

# Lalamove V2 — convenções

As regras de trabalho (banco, fluxo Git, PR, comunicação) estão em `AGENTS.md` na raiz — este skill só
resume convenções de código e commit.

## Commits

Padrão Conventional Commits, conferido por `scripts/ci/commit-msg-lint.mjs`:
`<tipo>(<escopo>): <descrição>` — escopo opcional e minúsculo; assunto com pelo menos 10 caracteres,
sem ponto final; tipos: `feat fix docs style refactor perf test build ci chore security revert`.
Mensagem em PT-BR, modo imperativo, primeira linha curta. **Não há hook de git instalado** (sem husky):
rode `node scripts/ci/commit-msg-lint.mjs .git/COMMIT_EDITMSG` quando quiser a conferência.

Exemplo: `fix(lalamove): valida assinatura do webhook antes de gravar evento`

## Código

- Linguagem: TypeScript (front Vite + React em `src/`, edge functions Deno em `supabase/functions/`).
- Funções `camelCase`, componentes/classes `PascalCase`, constantes `SCREAMING_SNAKE_CASE`.
  Arquivo de página: `NomePage.tsx`; hook: `useNome.ts`.
- Import de módulo do projeto pelo alias `@/` (`vite.config.ts`, `tsconfig.app.json`); exports nomeados;
  siga o padrão de import do arquivo vizinho.
- `src/integrations/supabase/types.ts` é **gerado** — não editar à mão.
- Formatação: `.prettierrc` (ponto e vírgula, aspas simples, 2 espaços, `printWidth` 100).
- Testes unitários ao lado do módulo (`__tests__/`) ou `*.test.ts(x)`; rode só o que tocou:
  `npx vitest run <caminho>`. E2E em `e2e/*.e2e.ts` (Playwright); contratos de edge em Deno
  (`supabase/functions/**/*.test.ts`).
- `tsconfig` é `strict` com `noImplicitAny`: não introduza `any` nem `@ts-ignore` para passar o typecheck.
- Siga os padrões já existentes no módulo; não desvie sem motivo registrado na PR.
