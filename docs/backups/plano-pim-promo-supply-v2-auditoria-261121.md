# Auditoria de validação — 21/11/2026

Após o merge das PRs 2.1 (`Promo_Supply_V2#248`) e 4.1 (`Promo_Supply_V2#244`), 5 agentes especializados auditaram, em paralelo, o que foi implementado. Resultado consolidado:

## 1. Lógica do allowlist (`external-bridge-allowlist.ts`)
- Sem brecha de segurança. `ALLOWED_TABLES` só tem as 2 views do PIM; `ALLOWED_RPCS` vazio; qualquer operação fora de `["select"]` retorna 403.
- 1 dead code inofensivo: o ramo `if (operation === "rpc")` é inalcançável, pois o guard de `ALLOWED_OPERATIONS` já rejeita antes. Não é bypass — só lógica morta.
- 8 gaps de cobertura de teste identificados (não testados): `select` sem `table`, `countMode` inválido, `limit` exatamente igual a `MAX_SELECT_LIMIT` (boundary), `filters` com operator fora da allowlist, `filters` aninhado sem campo `operator`, múltiplos filtros simultâneos, `operation="update"`/`"delete"` explícitos, caminho `rpc` (hoje inalcançável).

## 2. Execução real dos testes em CI
- Confirmado com log real (job `Run Deno Tests (Edge Functions)`, run 44939354300, `main.yml`): `running 4 tests from ./supabase/functions/_shared/external-bridge-allowlist.test.ts`, os 4 testes com `ok`. Os testes RODARAM e PASSARAM de verdade antes do merge da PR #248.
- Nota: o check "Contratos da automação local" (obrigatório via branch protection) NÃO cobre esses testes — ele roda só `scripts/automation.mjs`/`*.unit.mjs`. Quem valida os testes Deno de edge functions é o job "Unit & Integration Tests (Frontend + Edge)" do workflow `main.yml` (não obrigatório via branch protection, mas rodou e passou).

## 3. Script da PR 4.1 (`scripts/migracao/reconcilia-produtos-pim.mjs`)
- Confirmado read-only (nenhuma escrita em banco).
- Cascata de matching (sku → sku_promo → supplier_reference → nome normalizado) validada com execução real contra mocks, inclusive caso adversarial (produto sem sku mas com nome ambíguo resolvido corretamente por supplier_reference antes de cair no nome).
- Sem bugs encontrados. Observação operacional (não bug): cada execução gera um CSV novo em `docs/migracao/` sem limpar os anteriores.
- Execução contra dados reais do PIM/Promo Supply continua NÃO VERIFICADA — nenhum MCP desta sessão tem acesso SQL aos dois bancos.

## 4. Checklist (`docs/pendencias/integracao-pim-promo-supply.md`)
- Auditado item a item contra a API do GitHub (shas de squash, estado `merged`). Nenhuma inflação de status encontrada — os únicos `[x]` (PR 2.1 e PR 4.1) têm evidência real, e ambos já carregavam a ressalva de não-execução real no próprio texto.

## 5. CI quebrada na PR #151 deste repo
- Causa raiz: instabilidade pontual do scheduler do GitHub Actions (`startup_failure` com 0 jobs alocados), não erro de sintaxe no workflow nem runner self-hosted offline. Não relacionada ao arquivo de backup adicionado.
- `main` teve runs com sucesso e com falha (jobs reais, não startup_failure) nas horas anteriores — padrão de instabilidade transitória, não quebra sistêmica.
