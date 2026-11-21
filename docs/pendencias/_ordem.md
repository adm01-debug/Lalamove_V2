# Ordem de execução do backlog

> Ordenado por impacto no negócio e dependência. Executar 1->N em fatia vertical (Fase 2 do goal).

## Fila atual

| # | Item | Por quê | Bloqueado por |
|---|---|---|---|
| 1 | P-04 Rotacionar JWT_SECRET no painel | único resíduo ativo da era pré-rotação; sem isso o gate 401 e login não se revalidam | ação do dono (sem MCP) |
| 2 | P-05 Snapshot banco real | destrava validações de todas as pendências de banco | credencial (SUPABASE_DB_URL, só o dono) |
| 3 | P-02 App mobile motoristas | auditoria 5.1 — feature nova, escopo médio | decisão do dono (requisito atual?) |
| 4 | P-03 Chat cliente-motorista | auditoria 5.2 — feature nova, escopo médio | decisão do dono (requisito atual?) |
| 5 | P-10 Scripts chaves legacy | decidido: manter; nada a executar | — |

## Itens concluídos
- **P-01** (2026-11-21): RLS de `query_telemetry` grant-only — PR #92 mergeada (squash `41ba75b`), CI 9/9 verde no push pós-merge, deploy de produção READY. Ver `P-01-rls-query-telemetria-grant-only.md`.
- **P-06** (2026-11-21): vulns npm restantes — PR #99 mergeada (squash `f1218b2`), bump react-router-dom 6→7.18.6 + override postcss-selector-parser 6.1.5; `npm audit` 0 vulns, build/lint/CI 9/9 verdes, deploy READY/PROMOTED. Ver `P-06-vulns-npm-restantes.md`.

## Itens descartados
- **P-11** (2026-11-21): MFA/WebAuthn (auditoria 1.2) — já implementado de ponta a ponta (hooks useMFA/useWebAuthn, componentes MFAEnroll/MFASettings/MFAVerify/Passkey*, rota `/mfa-verify`, guards `requireMFA` em rotas sensíveis). Auditoria de 14/05/2026 desatualizada. Ver `P-11-mfa-webauthn.md`.

## Itens obsoletos (2026-11-20)
- **P-07, P-08, P-09**: marcados OBSOLETOS após verificação no banco de produção (2026-11-20). As lacunas listadas no `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md` já estavam resolvidas no schema real (search_path 47/47, RLS de geo_blocks com 5 policies, enums de status). Os arquivos individuais guardam a evidência da verificação.

## Regras da Fase 2
- Migrations aditivas (IF NOT EXISTS, OR REPLACE) podem ir sem aprovação; destrutivas (DROP, REVOKE, rename, mudança de contrato) exigem ok do dono.
- Nada que funciona pode quebrar (protocolo anti-regressão: rodar a linha de base de _linha-de-base.md antes e depois de cada fatia).
- Uma tarefa por vez, branch própria por item.
