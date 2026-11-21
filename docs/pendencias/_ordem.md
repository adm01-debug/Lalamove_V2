# Ordem de execução do backlog

> Ordenado por impacto no negócio e dependência. Executar 1->N em fatia vertical (Fase 2 do goal).

## Fila atual

| # | Item | Por quê | Bloqueado por |
|---|---|---|---|
| 1 | P-04 Rotacionar JWT_SECRET no painel | único resíduo ativo da era pré-rotação; sem isso o gate 401 e login não se revalidam | ação do dono (sem MCP) |
| 2 | P-10 Scripts chaves legacy | decidido: manter; nada a executar | — |
| 3 | P-13 COMMENT ON TABLE das tabelas sem comentário | ~40 tabelas sem significado documentado no schema; glossário de IA fica com ~60% vazio | migration aditiva em produção (protocolo Fase 2) |

## Itens concluídos
- **P-01** (2026-11-21): RLS de `query_telemetry` grant-only — PR #92 mergeada (squash `41ba75b`), CI 9/9 verde no push pós-merge, deploy de produção READY. Ver `P-01-rls-query-telemetria-grant-only.md`.
- **P-06** (2026-11-21): vulns npm restantes — PR #99 mergeada (squash `f1218b2`), bump react-router-dom 6→7.18.6 + override postcss-selector-parser 6.1.5; `npm audit` 0 vulns, build/lint/CI 9/9 verdes, deploy READY/PROMOTED. Ver `P-06-vulns-npm-restantes.md`.
- **P-05** (2026-11-21): snapshot do banco real — secret `SUPABASE_DB_URL` criado no repo (dono forneceu a senha) e workflow `contexto.yml` publicado na branch `contexto` (commit 4a63893, run 44905377723, 5/5 jobs, `erros: []`). O `docs/contexto/supabase/` agora espelha o banco de produção ao vivo e segue atualizando sozinho (schedule 10 min + push em main).

- **P-12** (2026-11-21): análise exaustiva planejado vs. implementado — 100% do planejado V2 implementado (ver `P-12-analise-funcionalidades-planejadas.md`). Deixou `audit_report.md` corrigido (MFA ✅, 5.1/5.2 ⏸️ V3, conclusão atualizada) e abriu P-13.
- **P-11** (2026-11-21): MFA/WebAuthn (auditoria 1.2) — já implementado de ponta a ponta (hooks useMFA/useWebAuthn, componentes MFAEnroll/MFASettings/MFAVerify/Passkey*, rota `/mfa-verify`, guards `requireMFA` em rotas sensíveis). Auditoria de 14/05/2026 desatualizada. Ver `P-11-mfa-webauthn.md`.

## Itens obsoletos (2026-11-20)
- **P-07, P-08, P-09**: marcados OBSOLETOS após verificação no banco de produção (2026-11-20). As lacunas listadas no `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md` já estavam resolvidas no schema real (search_path 47/47, RLS de geo_blocks com 5 policies, enums de status). Os arquivos individuais guardam a evidência da verificação.

## Adiados para a V3 (decisão do dono, 2026-11-21)
A **V3 será concorrente do Lalamove** (plataforma própria de motoristas); a **V2 atual é parceira** (opera via operador/parceiros). P-02 e P-03 NÃO são executados no escopo V2:
- **P-02** App Mobile para Motoristas — app do motorista (login de motorista, entregas atribuídas, aceite/recusa, coletada/entregue, rastreamento próprio); PWA, sem app nativo de loja, reaproveitando cadastro/aprovação existentes. Ver `P-02-app-mobile-motoristas.md`.
- **P-03** Chat Cliente-Motorista — comunicação em tempo real via Supabase Realtime; **depende do P-02**. Ver `P-03-chat-cliente-motorista.md`.

## Regras da Fase 2
- Migrations aditivas (IF NOT EXISTS, OR REPLACE) podem ir sem aprovação; destrutivas (DROP, REVOKE, rename, mudança de contrato) exigem ok do dono.
- Nada que funciona pode quebrar (protocolo anti-regressão: rodar a linha de base de _linha-de-base.md antes e depois de cada fatia).
- Uma tarefa por vez, branch própria por item.
