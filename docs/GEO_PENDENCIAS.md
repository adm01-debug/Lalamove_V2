# O que ficou desligado ou para depois

Levantamento do estado final da camada geo. Cada item diz **por que** ficou de fora e **o que
destrava** — para não virar dívida invisível.

## Funções com `provider: 'off'`

| Função | Estado | Motivo | Destrava |
|---|---|---|---|
| `validate` | desligada | só o Google tem o Address Validation API; sem `GOOGLE_MAPS_SERVER_KEY` não há o que chamar | Bloco 2 (etapas 24–29) + chave do Google |
| `snap` | ligada só no Mapbox | Map Matching é Mapbox-only | provedor Google não tem equivalente direto |
| `isochrone`, `optimization`, `tilequery` | ligadas só no Mapbox | `provider.raw` — APIs sem par no Google | — |

## Provedores

- **Google inteiro**: nunca ativado em produção. Falta `GOOGLE_MAPS_SERVER_KEY`. O código já
  suporta (`resolver.ts` escolhe por `geo_settings` + orçamento), então é só cadastrar a chave.
- **3º provedor (etapa 82)**: a interface `GeoProvider` está pronta para receber outro provedor,
  mas nenhum foi implementado. Sem demanda de negócio no momento.

## Recursos do Mapbox não usados

| Recurso | Etapa | Motivo |
|---|---|---|
| `tk` temporário | 10 | o `pk.` público funciona e o `sk.` de servidor não existe; o `tk` exigiria rotina de renovação |
| `depart_at` (tráfego futuro) | 50 | exige plano com histórico de tráfego; ganho marginal no volume atual |
| Mapbox Standard (`style`) | 59 | o estilo atual (`streets-v12`) atende; Standard muda o contrato de camadas do front |

## Dependências do dono (sem rota MCP)

1. `MAPBOX_SERVER_TOKEN` (`sk.` com scopes mínimos, nenhum `*:write`) — habilita Search Box e
   Geocoding v6 no servidor, além de tirar o `pk.` do backend.
2. Restringir `allowedUrls` do `pk.` no painel Mapbox — hoje o token público aceita qualquer origem.
3. `GOOGLE_MAPS_SERVER_KEY` — liga o provedor Google e o `validate`.
4. Remover a edge `mapbox-proxy` em produção — o front não a chama mais (etapa 60/61 concluída).

## Bloqueios de infraestrutura

- **GitHub Actions com budget esgotado**: todo job falha em ~2 s. Nenhuma PR consegue rodar CI
  até o limite ser elevado — isso segura merge e deploy, não o código.
