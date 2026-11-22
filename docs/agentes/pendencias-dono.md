# Pendências do dono — Lalamove V2

Decisões que só o dono pode tomar (regra 8 do Fluxo Git: DDL/migration em produção,
segredos, CI/workflows). Lista viva, levantada em 22/11/2026. Ao decidir uma, apague
a linha daqui — a decisão fica registrada no merge/fechamento da própria PR.

## PRs abertas aguardando decisão

| PR | O que faz | Por que é regra 8 |
| --- | --- | --- |
| [#226](https://github.com/adm01-debug/Lalamove_V2/pull/226) | Corrige `next_stop_index` que nunca avançava (motorista continuava sendo medido contra a parada de coleta mesmo após buscar o pedido), cria o alerta `ETA_DELAY` para atraso, e conserta o destinatário do aviso de coleta que chegava `to: null` quando só havia fornecedor cadastrado (sem contato próprio). 12 cenários / 30 asserções verdes em Postgres 16 descartável; CI verde (run 44981311884). | Migration `20261122131000_geo_eta_delay.sql` reescreve `geo_evaluate_tracking` em produção |
| [#267](https://github.com/adm01-debug/Lalamove_V2/pull/267) | O aviso de "motorista chegando na coleta" hoje só sai no WhatsApp do fornecedor; a PR liga o mesmo aviso também para o canal interno (Slack) da equipe de logística. Migration é 1 UPDATE idempotente, verificado 2x sem efeito colateral e sem sobrescrever webhook já configurado pelo operador. | Migration `20261124120000_internal_alert_channels.sql` |
| [#268](https://github.com/adm01-debug/Lalamove_V2/pull/268) | Duas migrations nasceram com o mesmo timestamp `20261123190000` (PRs #217 e #246, cada uma em sua branch — a colisão só apareceu quando as duas chegaram juntas na `main`). Renomeia um dos dois arquivos para `...190002`; zero mudança de conteúdo (`git diff --stat` confirma). Sem isso o próximo `apply-migrations` quebra com `duplicate migration version` antes de aplicar qualquer coisa. | Rename de arquivo de migration |

Todas as três estão com CI verde e `mergeable_state: clean` — prontas para merge assim que o dono decidir.

## Tabelas de migration sem correspondência em produção

A PR #226 encontrou, ao investigar outra coisa, 3 migrations no repo que criam tabelas
que **não existem hoje em produção**: `cache_refresh_log`, `entity_versions`,
`job_queue_processing_log`. Falta decidir: recriar (se algum código ainda depende
delas) ou apagar o arquivo de migration (se é artefato obsoleto de uma versão
anterior). Mesma categoria do achado sobre `audit_log`, já resolvido na PR #152 —
ver `docs/agentes/banco.md`.
