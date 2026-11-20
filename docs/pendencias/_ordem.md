# Ordem de execução do backlog

> Ordenado por impacto no negócio e dependência. Executar 1->N em fatia vertical (Fase 2 do goal).

## Fila atual

| # | Item | Por quê | Bloqueado por |
|---|---|---|---|
| 1 | P-04 Rotacionar JWT_SECRET no painel | único resíduo ativo da era pré-rotação; sem isso o gate 401 e login não se revalidam | ação do dono (sem MCP) |
| 2 | P-01 Merge PR #92 (RLS query_telemetry) | CI verde; fecha lacuna de auditoria do mcp-query | ok do dono (DDL, regra 8) |
| 3 | ~~P-07 SECURITY DEFINER sem search_path~~ **OBSOLETO** | verificado no banco real: 47/47 funções com search_path fixado | — |
| 4 | ~~P-08 geo_blocks sem RLS~~ **OBSOLETO** | verificado no banco real: 5 policies ativas (admin ALL, manager SELECT) | — |
| 5 | ~~P-09 Transições de status sem CHECK~~ **OBSOLETO** | verificado no banco real: enums já validam as colunas críticas; text restantes 100% não-usadas | — |
| 6 | P-06 Vulns npm restantes | dependabot; precisa CI do GitHub ceder (startup_failure) | infra GitHub |
| 7 | P-05 Snapshot banco real | destrava validações de todas as pendências de banco | credencial (SUPABASE_ACCESS_TOKEN) |
| 8 | P-02 App mobile motoristas | auditoria 5.1 — feature nova, escopo médio | decisão do dono (requisito atual?) |
| 9 | P-03 Chat cliente-motorista | auditoria 5.2 — feature nova, escopo médio | decisão do dono (requisito atual?) |
| 10 | P-10 Scripts chaves legacy | decidido: manter; nada a executar | — |

## Itens obsoletos (2026-11-20)
- **P-07, P-08, P-09**: marcados OBSOLETOS após verificação no banco de produção (2026-11-20). As lacunas listadas no `docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md` já estavam resolvidas no schema real (search_path 47/47, RLS de geo_blocks com 5 policies, enums de status). Os arquivos individuais guardam a evidência da verificação.

## Regras da Fase 2
- Migrations aditivas (IF NOT EXISTS, OR REPLACE) podem ir sem aprovação; destrutivas (DROP, REVOKE, rename, mudança de contrato) exigem ok do dono.
- Nada que funciona pode quebrar (protocolo anti-regressão: rodar a linha de base de _linha-de-base.md antes e depois de cada fatia).
- Uma tarefa por vez, branch própria por item.
