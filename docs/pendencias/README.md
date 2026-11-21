# Backlog de pendências — Lalamove V2

> Estrutura da Fase 1 do goal "Concluir funcionalidades pendentes". Um arquivo por item; _linha-de-base.md = regressão; _ordem.md = sequência; _regras-de-negocio.md = regras ao executar.

## Itens

| ID | Título | Status |
|---|---|---|
| P-01 | RLS de query_telemetry grant-only (PR #92) | CONCLUÍDO (2026-11-21, merge 41ba75b) |
| P-02 | App Mobile para Motoristas (auditoria 5.1) | ADIADO PARA V3 (decisão dono 2026-11-21) |
| P-03 | Chat em tempo real Cliente-Motorista (auditoria 5.2) | ADIADO PARA V3 (decisão dono 2026-11-21) |
| P-04 | Rotacionar JWT_SECRET no painel Supabase | AGUARDANDO HUMANO (ação do dono) |
| P-05 | Snapshot do banco real (docs/contexto/supabase/) | CONCLUÍDO (2026-11-21, publicado na branch contexto) |
| P-06 | Vulns npm restantes (4 moderate, fix = bump major) | CONCLUÍDO (2026-11-21, PR #99) |
| P-07 | SECURITY DEFINER sem set search_path | OBSOLETO (verificado: 47/47 têm search_path) |
| P-08 | geo_blocks sem RLS | OBSOLETO (verificado: 5 policies ativas) |
| P-09 | Transições de status sem CHECK no schema | OBSOLETO (enums já validam) |
| P-10 | Scripts com chaves legacy hardcoded | decidido: manter |
| P-11 | MFA/WebAuthn (auditoria 1.2) | DESCARTADO (já implementado, evidência no código) |

## Trabalho de agentes JÁ incorporado a main (não perder, não reexecutar)

Verificado byte a byte nesta sessão / sessões anteriores (evidência em _linha-de-base.md):

- PR #88: edge mcp-query + migrations recuperadas — mergeada, deployada (edge v2 no ar, 401-gate validado).
- PR #80/#81: remoção de segredos hardcoded + guards de CI — no main (8832302, 63987c9).
- PR #90: fix CI pin ubuntu-24.04 — no main (c86f279).
- PR #91: fix 14 vulns npm (zod, undici, brace-expansion) — no main (1ef5f30).
- PR #99: fix 4 vulns npm restantes (react-router-dom 6→7.18.6 + override postcss-selector-parser 6.1.5) — no main (f1218b2), 0 vulns, deploy READY/PROMOTED.
- PR #93: seed via env vars — no main (4767a5e), branch deletada.
- Dependabot merges (#68-#77 faixa): vite, input-otp, papaparse, recharts, web-vitals, radix, postcss, eslint-plugin-react-refresh — no main.

## Obsoleto / descartado (com motivo)

- Branches lovable-sync-* : único trabalho de agente nelas (fonte da edge mcp-query) já está na main e no ar; confirmar que não há PR aberta antes de apagar.
- mcp-query-test-5888@ (usuário teste): artefato de sessão, nunca logou — deleção aprovada pelo dono (regra 8, aguardando execução).

## Adiados para a V3 (decisão do dono, 2026-11-21)

A **V3 será concorrente do Lalamove** (plataforma própria de motoristas); a **V2 atual é parceira** (opera via operador/parceiros). Sem escopo V2:
- **P-02** App Mobile para Motoristas (auditoria 5.1) — ver `P-02-app-mobile-motoristas.md`.
- **P-03** Chat em tempo real Cliente-Motorista (auditoria 5.2) — ver `P-03-chat-cliente-motorista.md`.
