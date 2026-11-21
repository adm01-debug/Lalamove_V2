# P-14 · Análise exaustiva: funcionalidades e correções planejadas vs. implementadas

**Status:** CONCLUÍDO (2026-11-21) — veredito: **100% do planejado V2 implementado; 2 correções de processo pendentes (branch protection e Sentry)**
**Origem:** pedido do dono "todas as funcionalidades planejadas para o sistema foram implementadas? faça uma analise exaustiva, vasculhe todos os docs de planos e tb de correções"
**Escopo:** V2 (parceira do Lalamove). Complementa a P-12 (que cruzou os docs de plano); esta cruza os **docs de correções/auditoria** contra o código real.

## Fontes das correções cruzadas com o real
- `docs/AUDITORIA_TECNICA_2026-09.md` — nota 7,2/10; Top 10 Ações por ROI + Roadmap 3 ondas.
- `docs/LALAMOVE_MASTER_ANALYSIS.md` — Roteiro de 30 etapas (Blocos A–E), seção 3 (errata), seção 9 (matriz cobertura), seção 11 (riscos).
- `docs/LALAMOVE_SCORECARD.md` — 22 dimensões (etapa 30), média 10/10 + lacunas conscientes.
- `docs/pendencias/_ordem.md` + P-01..P-13 — backlog oficial.
- `docs/SECURITY_CHECKLIST.md` e `docs/SECURITY.md` — checklists (template sem marcação de status).
- Real (código): árvore do main `a614869`.
- Real (banco): query ao vivo no Supabase produção (2026-11-21, pós P-13).

## Top 10 Ações por ROI (AUDITORIA) — verificação

| # | Ação | Estado | Evidência |
|---|------|--------|-----------|
| 1 | Webhook fail-closed | ✅ | `supabase/functions/lalamove-webhook/security.ts:25` rejeita sem `LALAMOVE_API_SECRET` |
| 2 | `.env` fora do git + project_id certo | ✅ | `supabase/config.toml` = `iecgydonctmabiijadsf`; sem `.env` na árvore |
| 3 | `REVOKE` grants `anon` | ✅ | migration `20260902000000_harden_revoke_anon_grants.sql` (tables+sequences+default privileges) |
| 4 | Deletar `exec-sql` | ✅ | ausente da árvore |
| 5 | `mcp-query` com auth | ✅ | `supabase/functions/mcp-query/index.ts` valida `Authorization: Bearer <JWT>` |
| 6 | Limpar build (`audit_report.pdf`) | ✅ | `package.json` build = `vite build` limpo |
| 7 | Migration `20260828000003` duplicada | ✅ | 1 único arquivo |
| 8 | Consolidar lockfiles / JSON 21MB / `.gitignore.new` | ✅ | único `package-lock.json`; sem `.gitignore.new` |
| 9 | Branch protection em `main` | ❌ | API: 404 "Branch not protected"; rulesets = `[]` |
| 10 | Sentry (front + edge) | ❌ | 0 ocorrências em `src/` e `supabase/functions/` |

## Roteiro de 30 etapas (MASTER_ANALYSIS) — verificação

| Bloco | Etapas | Estado |
|---|---|---|
| A — Fundação (1-6) | doc mestre, tipos canônicos, guardas errata, catálogo 14 SRs, mapa ERR_*/ret, enums | ✅ todas (guardas: `src/lib/lalamoveGuards.ts`; catálogo: `src/lib/lalamoveCatalog.ts`; errata: `src/lib/lalamoveErrors.ts`, `src/lib/uapiErrors.ts`) |
| B — Cotação/pedido (7-12) | cidade×serviço, SRs dinâmicos, `deliveryItemSpecification`, expiração quotationId, PATCH orders, cancelamento BR | ✅ todas (`lalamoveGuards`, `NewOrderDialog` com SRs dinâmicos, `lalamoveOrderEdit.ts` + 21 testes, `lalamoveReasons.ts`) |
| C — Operação/rastreio (13-18) | x-request-id, token bucket, retry/backoff, detalhe motorista, timeline, painel saúde | ✅ todas (`cors.ts`/`lalamove-gateway` com x-request-id; `lalamove-api` com backoff; `UAPIStatusCards.tsx`; `lalamoveTimeline.ts` + 17 testes) |
| D — UAPI (19-24) | sem chave no bundle, cursor, extratos, cupons, frota, auto-refresh | ✅ todas (0 chaves literais em `src/`; `useUapiOrderHistory` com `last_id`+dedup; `uapiStatement.ts` CSV/Excel; `uapiErrors.ts` 13001/27103/27104/27105; `lalamove-token-refresh`) |
| E — Qualidade (25-30) | suíte contrato, regressão errata, telemetria endpoint, alertas auth, runbook, scorecard | ✅ todas (`lalamoveContract.test.ts` com fixtures reais; `lalamove_rate_limits` + `query_telemetry operation='lalamove'`; `docs/RUNBOOK_LALAMOVE.md`; scorecard 22 dims = 10/10) |

## Errata de produção (MASTER seção 3) — guardas presentes
1. `city.services` (não `serviceTypes`) — ✅ `lalamoveGuards.ts`
2. `driverId` é string, `""` quando ausente — ✅ `normalizeDriverId` em `lalamoveGuards.ts`
3. `cancelParty`/`cancelledReason` não existem no BR — ✅ guarda de regressão em `lalamoveContract.test.ts`

## Riscos conhecidos (MASTER seção 11)
1. Chaves de proxy no bundle — ✅ resolvido (0 ocorrências de `promo-llm-unified-2026`/`promo-lalamove-2026` em `src/`)
2. Token UAPI 24h — ✅ `lalamove-token-refresh` + runbook
3. WAF Argus — ⚠️ risco operacional externo (não é código)
4. Auth v3 502 vs 401 — ✅ alerta `CRITICAL` (etapa 28)
5. `GET /v3/webhook` = 405 — ✅ fonte de verdade mantida no nosso lado (webhook panel)

## Lacunas conscientes (SCORECARD)
- Bulk order / integração e-commerce / chat MQTT5 — ✅ fora de escopo declarado (V3).
- `cleanup_old_audit_logs` (coluna inexistente) — ✅ corrigido: migrações `20260723174804` e `20260726183530` recriam com coluna correta.

## Backlog P-01..P-13 (situação em `_ordem.md`)
- ✅ Concluídos: P-01, P-05, P-06, P-11, P-12, P-13 (este último agora com evidência de aplicação em produção — 55/55 `COMMENT ON TABLE` confirmados no banco vivo).
- ⏸️ Decidido manter: P-10. Adiados p/ V3: P-02, P-03. Obsoletos: P-07, P-08, P-09.
- ⏳ Ação humana: P-04 (rotação `JWT_SECRET` no painel Supabase — sem MCP).

## Pendências reais após a varredura (não-funcionais, de processo)
| Item | Origem | Impacto |
|---|---|---|
| Branch protection em `main` | Top-10 #9 (AUDITORIA) | Qualquer push direto em main não é bloqueado; CI não é gate obrigatório |
| Sentry (front + edge) | Top-10 #10 (AUDITORIA) | Sem error-tracking central; erros em produção só aparecem via logs manuais |

Ambos são correções de processo/infraestrutura — **não** são funcionalidades faltantes. Nenhum trabalho de agente ficou órfão ou perdido.

## Conclusão
Plano e correções estão 100% verificados contra código + banco vivo. As duas pendências reais são baratas e conhecidas (branch protection: ativar na UI do GitHub; Sentry: integração de SDK). Nenhuma funcionalidade planejada ficou sem implementar; nenhuma correção planejada ficou sem aplicar (exceto as 2 de processo acima).

## Verificação
- Todas as evidências acima são `git grep`/`git show` na árvore do main `a614869` + query no Supabase produção (2026-11-21, após aplicar P-13). Nenhum item foi marcado como feito sem evidência de arquivo.
