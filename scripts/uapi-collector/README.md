# `scripts/uapi-collector/` — coletor do snapshot UAPI da Lalamove

O painel não fala com o gateway da Lalamove direto: ele lê o snapshot que este script grava em
`public.lalamove_uapi_snapshot` (uma linha por recurso/página, com `expires_at`), e a edge
`lalamove-uapi` só serve linha válida. Sem coleta fresca, carteira, extrato, cupons e frota param —
por isso o script também abre alerta CRITICAL quando não grava nada.

**Leia este arquivo antes de alterar qualquer coisa aqui.** Fonte única: `collect.mjs` deste diretório
na `main`; a cópia de produção é materializada a cada execução (ver `run.sh`).

## Arquivos

| arquivo | papel |
| --- | --- |
| `collect.mjs` | o coletor (Playwright + REST do Supabase). Roda um ciclo e sai |
| `run.sh` | runtime no WSL: busca `collect.mjs` de `origin/main`, valida com `node --check` e executa |
| `run.cmd` | wrapper do Task Scheduler do Windows chamando o `run.sh` pelo `wsl.exe` |

## Como roda em produção

```
Tarefa agendada \LalamoveUapiCollector (Windows)
  -> C:\ProgramData\lalamove-uapi-collectorun.cmd
     -> wsl -d Ubuntu-24.04 -- bash -lc "bash ~/.local/share/lalamove-uapi-collector/run.sh >> .../collector.log 2>&1"
        -> node collect.mjs   (cópia da main, renovada a cada execução)
```

- Cadência: `TimeTrigger` de **30 min**, sem `Duration` (repete indefinidamente), `MultipleInstancesPolicy=IgnoreNew`.
- **A tarefa precisa rodar na bateria**: `DisallowStartIfOnBatteries=false`, `StopIfGoingOnBatteries=false`,
  `StartWhenAvailable=true` e `ExecutionTimeLimit=PT1H`. Com os padrões do Windows a coleta fica parada
  em silêncio no notebook e o painel envelhece sem avisar.
- Log: `~/.local/share/lalamove-uapi-collector/collector.log`. Cada ciclo imprime `gravados (N): ...`,
  `falhas (...)` quando algo falha, e a fronteira do extrato (abaixo).
- `.env` (fora do repo, contém segredo): `~/.config/lalamove/uapi-collector.env`.

## Variáveis de ambiente

Obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

| variável | default | para que serve |
| --- | --- | --- |
| `UAPI_CITY_ID` | `city_id` da sessão ativa, senão `21007` | cidade das consultas |
| `UAPI_DEVICE_ID` | UUID novo por execução | `device_id` enviado ao gateway |
| `UAPI_PROFILE_DIR` | `~/.local/share/lalamove-uapi-collector/profile` | perfil Chromium persistente (é o que guarda o login) |
| `SNAPSHOT_TTL_HOURS` | `6` | validade do snapshot comum |
| `UAPI_STATEMENT_MAX_PAGES` | `700` | teto de páginas do extrato na varredura profunda |
| `UAPI_STATEMENT_RECENT_PAGES` | `30` | páginas recentes do extrato coletadas em todo ciclo |
| `UAPI_STATEMENT_SWEEP_HOURS` | `24` | intervalo mínimo entre varreduras profundas (`0` força) |
| `UAPI_STATEMENT_DEEP_TTL_HOURS` | `168` | validade das páginas antigas do extrato |
| `UAPI_SWEEP_STATE` | `~/.local/share/lalamove-uapi-collector/last-sweep.json` | resultado da última varredura profunda |
| `UAPI_COUPON_MAX_PAGES` | `5` | teto de páginas de cupons |
| `UAPI_ORDER_PAGES` / `UAPI_RECEIPTS` | `3` / `10` | páginas de pedidos por cursor / comprovantes baixados |
| `CHROMIUM_PATH`, `PLAYWRIGHT_ROOT` | Playwright resolve | quando o script roda fora da raiz do projeto |
| `UAPI_LOGIN_WAIT_MS` | `900000` | espera do `--login` |

## Extrato em duas faixas

O histórico do extrato tem hoje **580 páginas** (de 01/04/2026 até 10/09/2024) e o gateway não informa
o fim: a única regra confiável é parar quando a página vem incompleta. Como cada página custa ~0,4 s
(580 ≈ 4 min), a coleta é dividida:

| faixa | páginas | quando | TTL |
| --- | --- | --- | --- |
| recente | 1..`RECENT_PAGES` (30) | todo ciclo de 30 min | `SNAPSHOT_TTL_HOURS` (6 h) |
| profunda | 31..`MAX_PAGES` (700) | páginas ausentes/vencidas, varredura anterior interrompida, teto diferente do usado antes, ou mais de `SWEEP_HOURS` (24 h) | `DEEP_TTL_HOURS` (168 h) |

O estado da última varredura fica em `UAPI_SWEEP_STATE` (arquivo local, não é segredo). Se ele for
apagado, o pior caso é uma varredura profunda a mais.

**Lançamentos por identidade:** além do snapshot por página, cada página do extrato é gravada em
`lalamove_uapi_statement_item`, uma linha por lançamento com chave de conteúdo
(`cidade|data|valor|pedido|nome|usuário|recarga`). A edge `lalamove-uapi` monta a página a partir dessa
tabela quando o gateway recusa a chamada de servidor, então a borda 30/31 deixa de existir. A tabela
não tem TTL próprio: ela só é servida quando a página 1 do extrato está fresca (`SNAPSHOT_TTL_HOURS`),
e páginas ainda não cobertas pela coleta continuam vindo do snapshot. Dois lançamentos idênticos no
mesmo segundo (sem pedido e sem recarga) viram uma linha só — o gateway não manda id para separá-los.

## Token

Este script é o **único** caminho de renovação: o gateway recusa chamada server-side
(`ret 10010 "Gateway signature error"`), então renovar depende de rodar dentro de uma página de
`web.lalamove.com`. A cada coleta ele tenta, nesta ordem: o token que o site usa no perfil persistente e
`_m=refresh_token` com o refresh gravado em `lalamove_uapi_sessions`. Sem `refresh_token` válido
(a sessão de produção está com ele vazio), a renovação automática não existe:

```bash
node scripts/uapi-collector/collect.mjs --login   # abre a janela, SMS é humano, grava access + refresh
```

## Verificação

```bash
node --check scripts/uapi-collector/collect.mjs           # sintaxe (a extensão .mjs é obrigatória)
node scripts/uapi-collector/collect.mjs                   # um ciclo real (usa o .env)
```

Espere no log a linha do ciclo (`wallet_flow_list: ciclo coletou 30 pagina(s) ate <data>`) e, quando
couber varredura, `wallet_flow_list: varredura profunda coletou <N> pagina(s) ate <data> (end|cap|failure)`.
Depois de uma varredura, todo ciclo também imprime a cobertura apenas para leitura:
`wallet_flow_list: cobertura de <N> pagina(s) ate <data> (varredura de <quando>)`.

Depois de um ciclo, os lançamentos guardados por identidade aparecem em
`select count(*), max(occurred_at_local) from lalamove_uapi_statement_item;` — a contagem deve chegar
perto de `páginas coletadas × 20` e o maior `occurred_at_local` deve ser o lançamento mais novo.
