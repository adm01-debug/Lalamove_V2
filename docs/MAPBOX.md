# MAPBOX — Inventário e Referência (21/11/2026)

> Fonte canônica sobre a integração Mapbox no Lalamove V2.
> Plano detalhado: `docs/planos/PLANO_MAPBOX_100_ETAPAS.md`

## Runbook operacional

Incidentes (token vazado, 429, Mapbox fora, cobertura BR, fatura): `docs/RUNBOOK_MAPBOX.md`.
Terceiro provedor (HERE/TomTom): `docs/GEO_PROVIDERS.md`.

## Conta

- **Username:** `promobrindes`
- **Plano / cartão / limite:** NÃO VERIFICADO — acessar mapbox.com/account
- **Tokens existentes:** NÃO VERIFICADO — acessar mapbox.com/account/access-tokens
  (valores nunca neste arquivo; registrar apenas nome, prefixo, scopes e allowedUrls)

## Tokens a criar (etapas 2–3 do plano)

| Nome | Tipo | Scopes mínimos | Uso |
|---|---|---|---|
| `lalamove-v2-web` | `pk.` | `styles:read`, `fonts:read`, `styles:tiles` | Front-end via edge `get-mapbox-token` |
| `lalamove-v2-server` | `sk.` | Geocoding, Search Box, Directions, Matrix, Map Matching, Static Images, Isochrone | Edge `geo-gateway` (`MAPBOX_SERVER_TOKEN`) |
| `lalamove-v2-rotation` | `sk.` | `tokens:write`, `tokens:read` | Rotação automática (edge `geo-admin`, etapa 9) |

**`allowedUrls` do `pk.`:** `https://lalamove-v2.vercel.app`, `https://lalamove-v2-*.vercel.app`, domínio de produção, `http://localhost:*`.

## Secrets (etapa 4)

```
MAPBOX_ACCESS_TOKEN       # pk. — front-end via get-mapbox-token  (já existe)
MAPBOX_SERVER_TOKEN       # sk. — geo-gateway server-side          (a criar)
MAPBOX_TOKENS_API_TOKEN   # sk. com tokens:write — rotação         (a criar)
MAPBOX_USERNAME           # promobrindes                           (a criar)
```

Setar via: `supabase secrets set MAPBOX_SERVER_TOKEN=<valor> --project-ref iecgydonctmabiijadsf`

## O que pode e não pode (Termos de Uso — etapa 8)

- **Geocoding temporário** (`permanent=false`): **não pode ser retido**; só pode ser exibido junto com um mapa Mapbox na mesma sessão. Nunca salvar em `lalamove_orders` ou `lalamove_stops`.
- **Geocoding permanente** (`permanent=true`): pode ser persistido (US$ 5/1k, sem faixa grátis). Usar **somente** quando a Lalamove não retornar coordenadas na cotação.
- **Fonte da verdade de coordenadas:** `stops[].coordinates` da resposta da cotação Lalamove (`geocode_provider='lalamove'`). Mapbox temporário é só para sugestão visual.
- **Atribuição obrigatória:** "© Mapbox © OpenStreetMap" visível no mapa e em qualquer imagem estática exportada.
- **Search Box:** resultados válidos apenas dentro da sessão (`session_token`); proibido fora de um mapa Mapbox.

## Estado do código (21/11/2026)

| Componente | Arquivo | Estado |
|---|---|---|
| Token front | `supabase/functions/get-mapbox-token/index.ts` | ✅ `verify_jwt=true` declarado no `config.toml` |
| Proxy legado | ~~`supabase/functions/mapbox-proxy/index.ts`~~ | ✅ **removida na etapa 61** — todo o tráfego passa pelo `geo-gateway` |
| Gateway novo | `supabase/functions/geo-gateway/` | ✅ implementado em `main` (`index.ts`, `resolver.ts`, `polyline.ts`, `metering.ts`, `providers/mapbox.ts`, testes) |
| Hook front | `src/hooks/useGeo.ts` (`useMapbox.ts` é barrel `@deprecated`) | ✅ fala com o `geo-gateway` (etapa 60) |
| Health check | `supabase/functions/check-external-api/index.ts` | ✅ testa Mapbox v6 (`permanent=false`) e Google v4, devolve latência/SKU/req-min (etapa 67) |
| Seletor visual | `src/pages/MapsSettingsPage.tsx` | ✅ lê e grava `geo_settings`; modo `auto`, painel de uso, matriz de paridade, escrita só admin |
| Seletor do usuário | `src/hooks/useMapSettings.ts` + `useMapProviderPolicy.ts` | ✅ preferência visual em localStorage, **filtrada** por `geo_settings.tiles` (etapa 66) |
| Sessão do Search Box | `src/hooks/useGeoSearch.ts` | ✅ token renovado aos **170 s** (janela de 180 s do Mapbox) e ao limpar o campo (etapa 37) |
| Falha de busca no formulário | `src/components/orders/AddressAutocomplete.tsx` | ✅ separa **429/orçamento** de **falha de rede**, oferece "usar o endereço como digitado" e sugere número/CEP no vazio (etapa 40) |
| Endereços frequentes | `src/hooks/useGeoSearch.ts` (`useFrequentAddresses`) | ✅ lista endereços já geocodificados em `lalamove_orders` antes de chamar o provedor — custo zero (etapa 41) |

## Estilo do mapa (etapa 59)

**Decisão: manter `dark-v11` (painel) e `satellite-streets-v12` (rastreio). Não migrar para o Mapbox Standard.**

Motivo: o Standard é o mesmo SKU (`map_load`) — o custo por carregamento não muda, então a troca não paga o risco de reescrever camadas customizadas (`mapLayers.ts`, `markerFactories.ts`), que hoje dependem dos estilos fixos. Reavaliar só se houver demanda visual explícita; ver também a etapa 100 (itens "para depois").

## Drill de troca Google→Mapbox (etapa 72)

Roteiro e o que está realmente verificado. **Estado: passos 1 e 4–6 EXECUTADOS em produção (2026-11-22); passos 2, 3 e 7 dependem de sessão de usuário real; troca Google→Mapbox segue bloqueada** — ver pré-condição.

**Pré-condição real:** o gateway **só tem o provedor Mapbox implementado**. `geo-gateway/index.ts:95-98` — `getProvider()` lança `GEO_NOT_CONFIGURED` para `google`, e `provider-status` devolve `implemented: false` para Google (`index.ts:124`). Portanto o sentido literal do drill (Google→Mapbox com pedido ativo) **não é executável** até o Bloco 2 do plano Google. O roteiro abaixo é o que será rodado quando o Google existir; os passos 1–3 e 7 já são verificáveis hoje.

| Passo | O que fazer | Esperado | Status |
|---|---|---|---|
| 1 | `geo-gateway` action `provider-status` | `mapbox.configured=true`, `google.implemented=false` | ✅ verificado no código (`index.ts:118-127`) |
| 2 | `/settings/maps` com usuário `manager` | troca desabilitada + aviso "modo leitura" | ✅ implementado (etapa 71); NÃO VERIFICADO em execução |
| 3 | `/settings/maps` com usuário `admin` | troca habilitada | ✅ implementado (etapa 71); NÃO VERIFICADO em execução |
| 4 | Trocar `route` para `off` **e anular `fallback_provider`** e salvar | `resolve()` lança 503 "Função route está desligada" | ✅ EXECUTADO em produção 2026-11-22 01:15 UTC: job `route_plan` voltou `skipped` com `GEO_UNAVAILABLE` / "Função route está desligada em geo_settings" |
| 4b | Trocar `route` para `off` mantendo `fallback_provider='mapbox'` | rota continua sendo calculada pelo fallback | ✅ EXECUTADO: 2 jobs `COMPLETED` com rota — **não é bug**, `tryOne(primary) ?? tryOne(fallback)` (`resolver.ts:120`). `off` só desliga de fato com o fallback nulo |
| 5 | Voltar `route` para `mapbox` | ETA/traçado voltam em ≤ 60 s (TTL do `resolver`) | ✅ EXECUTADO: após restaurar, `route_plan` voltou `planned` com 205 pontos, 5563 m, 817 s; `geo_usage` de `route/directions` incrementou 45→46 (chamada real cobrada) |
| 6 | Conferir `audit_log` | linha `resource_type='geo_settings'` com antes/depois | ✅ EXECUTADO: 3 linhas `UPDATE` registradas com `before`/`after` completos (`provider` e `fallback_provider`) |
| 7 | Escolher `google` em qualquer função | seleção bloqueada na UI ("em implementação") | ✅ implementado (etapa 71/paridade); NÃO VERIFICADO em execução |

**Tempo esperado do ciclo de troca:** ≤ 60 s, sem deploy (TTL do `resolver`).
**Incidentes:** nenhum. O drill deixou `geo_settings.route` em `off` por ~4 min e foi restaurado para `mapbox`/`mapbox`; nenhuma rota foi perdida (os jobs do período rodaram pelo fallback).

**Para fechar a etapa 72:** (a) implementar o provedor Google no `geo-gateway` (Bloco 2 do plano Google); (b) rodar os passos 2, 3 e 7 com um usuário real e preencher a coluna de resultado.

## Cobertura BR do Search Box (etapa 36) — MEDIDO em 2026-11-22

Critério de aceite: ≥ 90 % dos endereços com `accuracy ∈ {rooftop, parcel, point}` e distância ≤ 50 m do controle.

**Resultado: REPROVADO.** 30/50 endereços (60 %) em Curitiba, São Paulo e Goiânia
(`scripts/geo/enderecos.sample.csv`, 50 sessões Search Box consumidas, custo US$ 0,00).

| Cidade | Aprovação | Padrão observado |
|---|---|---|
| São Paulo | 11/11 (100 %) | `rooftop`/`point`, desvio 0 m |
| Curitiba | ~40 % | misto `point`/`interpolated` |
| Goiânia | ~20 % | quase tudo `interpolated` |

### Etapa 22 (fallback Geocoding v6) — DESCARTADA por medição

O script mede **os dois modos no mesmo dataset**, colunas `Search Box accuracy` e `Geocoding v6 accuracy`:

| Modo | Aprovação | d(SB, v6) |
|---|---|---|
| Search Box (`searchbox/v1/suggest` + `retrieve`) | 30/50 (60 %) | — |
| Geocoding v6 (`geocode/v6/forward?autocomplete=true`) | 30/50 (60 %) | **0 m em 50/50** |

Conclusão: **implementar `mapbox_mode='geocoding'` não muda nada** — os dois modos devolvem
exatamente as mesmas coordenadas com a mesma classe de acurácia. A flag `mapbox_mode` nunca foi
implementada no `geo-gateway` e **não deve ser**: não há ganho a capturar.

### Risco adicional não capturado pela métrica de accuracy

Reexecução independente em 2026-11-22 via `geo-gateway` (não o script direto — mesmo dataset,
`invoke_edge_function` nas actions `autocomplete`/`place-details`/`geocode`) deu 26/50 (52 %), perto
do 60 % acima; a diferença é esperada (caminho diferente: edge function com cache/rate-guard vs
chamada direta à API). Mais importante que o número: ao conferir manualmente endereço por endereço
(não só a classe de `accuracy`), **6 dos 50 vieram com rua ou cidade totalmente diferente da
pedida**, com confiança `high`/`medium` — não é imprecisão, é resposta errada, e o Geocoding v6
concordou com o mesmo erro nos casos reconferidos (os dois caem na mesma armadilha, não é só
cobertura esparsa):

| # | Endereço pedido | Resposta devolvida |
|---|---|---|
| 21 | Rua Carlos de Carvalho, Curitiba/PR | Rua em Cascavel/PR (~340 km) |
| 26 | Rua Rocha Pombo, Colombo/PR | Rua em Campo Mourão/PR (~350 km) |
| 28 | Rua Doutor Pedrosa, Pinhais/PR | "Avenida Pinhais" em Vitorino/PR (rua E cidade erradas) |
| 29 | Avenida das Américas, Araucária/PR | Fazenda Rio Grande/PR |
| 30 | Rua Benjamin Constant, Campo Largo/PR | Siqueira Campos/PR |
| 50 | Rua 7, Aparecida de Goiânia/GO | POI (nome de empresa), rua errada |

Implicação operacional: se a seleção do autocomplete for aceita sem conferência visual no mapa (ou
sem o motorista notar), o pedido grava coordenada de outra cidade. Qualquer decisão de M1 que só
olhe para a % de `accuracy` aceitável subestima o risco real — vale manter confirmação visual no
mapa antes de salvar o endereço enquanto a cobertura ficar abaixo de 90 %, mesmo depois de enriquecer
a base com CEP real do Bitrix24.

O gap de cobertura é de **dados** (a malha de numeração da Mapbox para Goiânia e parte de Curitiba é
interpolada), não de endpoint. Caminhos efetivos, em ordem de custo:

1. Enriquecer a base de entrada (o CSV é amostra genérica; a lista real vem do Bitrix24 com CEP).
   Com CEP, o `structured` do Geocoding v6 sobe de `interpolated` para `rooftop`.
2. Google Geocoding v4 (etapa 94) como `fallback_provider` para `autocomplete` — **já ativo**:
   `GOOGLE_MAPS_SERVER_KEY` está configurado e `provider-status` mostra `google configured=true`.
   O caminho existe (`resolver.failoverFor`) e foi exercitado em produção (geocode Google devolvendo
   `precision=exact`). O que falta não é a chave e sim medir se o Google erra nos mesmos 6 casos que
   a Mapbox erra — o doc registra que nos casos reconferidos ele erra igual.
3. Pedir correção da malha à Mapbox para os eixos críticos.

Regenerar a medição: `MAPBOX_SERVER_TOKEN=<pk|sk> deno run --allow-net --allow-env --allow-read scripts/geo/searchbox-coverage.ts scripts/geo/enderecos.sample.csv`

## Estado real da camada geo (medido em 2026-11-22)

| Item | Valor observado |
|---|---|
| Conta Mapbox | `promobrindes` (token `pk.` público do front, sem restrição de URL) |
| `MAPBOX_SERVER_TOKEN` (`sk.`) | **ausente** — `provider-status` sinaliza, e toda chamada de servidor usa o `pk.` de `MAPBOX_ACCESS_TOKEN` |
| Provedor padrão por função | `mapbox` em todas; `fallback_provider = google` |
| Google | sem `GOOGLE_MAPS_SERVER_KEY` — nunca ativado em produção |
| Único caminho de código do front | `geo-gateway` (o `mapbox-proxy` ficou sem chamador após a etapa 60/61) |

### Custo real × estimativa (30 dias até 2026-11-22, `geo_usage`)

| Provedor | Função | SKU | Chamadas | US$ |
|---|---|---|---|---|
| mapbox | route | directions | 64 | 0,000000 |
| mapbox | tiles | map_load | 35 | 0,000000 |
| mapbox | matrix | matrix | 4 | 0,000000 |
| mapbox | geocode | geocoding_temporary | 3 | 0,000000 |
| mapbox | geocode | geocoding_permanent | 2 | 0,000000 |
| mapbox | autocomplete | searchbox_session | 2 | 0,000000 |
| google | tiles | dynamic_maps | 1 | 0,000000 |
| mapbox | reverse | geocoding_temporary | 1 | 0,000000 |
| mapbox | static | static_image | 1 | 0,000000 |
| **Total** | | | **113** | **0,000000** |

Todas as funções estão dentro da cota gratuita. A tabela de custo estimado abaixo segue
válida como projeção para o regime de 30 pedidos/dia.

### Retenção de coordenada (verificado)

`SELECT count(*) FROM lalamove_orders WHERE geocode_provider = 'mapbox'` → **0**.
Nenhuma coordenada temporária do Mapbox foi persistida — a coordenada gravada vem da
cotação Lalamove (`geocode_provider='lalamove'`), como exige o termo de uso do Mapbox.

## Custo estimado em regime (30 pedidos/dia ≈ 900/mês)

| SKU | Est./mês | Grátis | Custo |
|---|---|---|---|
| Map loads | ≤ 1.800 | 50.000 | US$ 0 |
| Directions | ≤ 900 | 100.000 | US$ 0 |
| Matrix elements | ≤ 63.000 | 100.000 | US$ 0 |
| Map Matching | ≤ 9.000 | 100.000 | US$ 0 |
| Static Images | ≤ 900 | 50.000 | US$ 0 |
| Search Box sessions | ≤ 900 | 2.500 | US$ 0 |
| **Total** | | | **US$ 0** |

Break-even: ~80 pedidos/dia → Search Box ultrapassa 2.500 sessões/mês (US$ 11,50/1k adicional).
Acima desse volume o modo `auto` deve desviar autocomplete para Google (US$ 2,83/1k) ou Geocoding v6 (100k grátis).

## Paridade ETA Google × Mapbox (etapa 51)

NÃO VERIFICADO — executar `scripts/geo/eta-parity.ts` após criar `MAPBOX_SERVER_TOKEN`.

> Nota (2026-11-22): o token que está em produção é um `pk.` (público) — ver "Estado real". Enquanto
> não existir `sk.`, todo tráfego de servidor sai com o token público, que não tem escopo de servidor.

## Decisões de arquitetura (M1–M10)

Ver `claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md` seção "Decisões embutidas".

## Decisões registradas (sem implementação — etapas 10, 50, 59, 79)

- **Etapa 10 — token temporário (`tk.`):** não implementar agora. `get-mapbox-token` continua devolvendo o `pk.` fixo. Um `tk.` (Tokens API, expira em 1h) reduziria exposição, mas custaria 1 chamada à Tokens API por renovação por usuário contra um limite de 100 req/min — com o volume atual (uso interno, poucos usuários simultâneos) o ganho de segurança não paga a complexidade/latência extra. Reavaliar se o `pk.` vazar de novo.
- **Etapa 50 — trânsito futuro (`depart_at`, BETA):** não usar. Exige cadastro especial na Mapbox sem data de GA garantida. O ETA já é coberto em tempo real pela Matrix `driving-traffic` (etapa 46); não há hoje caso de uso para prever ETA de uma partida futura.
- **Etapa 59 — estilo do mapa:** manter `dark-v11` (`LiveMap`) e `streets-v12`/`satellite-streets-v12` (demais telas) como estão. Mapbox Standard usa o mesmo SKU de map load — trocar não mudaria custo —, mas exigiria revalidar a legibilidade dos overlays customizados (`mapLayers.ts`: rota, geofence, marcadores) no estilo novo. Fica para quando houver demanda visual explícita.
- **Etapa 79 — dependências:** confirmado em `package.json` — só `mapbox-gl` e `@types/mapbox-gl`, nenhum `@mapbox/search-js-*` ou `@mapbox/mapbox-sdk`. Toda chamada de API passa pelo `geo-gateway` no servidor, então o SDK JS da Mapbox (que embutiria o token no bundle do front) não é necessário.
- **Etapa 18 — trigger de geofence agnóstico de provedor:** confirmado lendo `public.geo_evaluate_tracking()` (`supabase/migrations/20261122130100_geo_foundation.sql:389-531`) — a função só lê `active_tracking`, `lalamove_orders`, `lalamove_stops` e `geo_defaults`, e só calcula distância/ETA (`geo_haversine_m`, `geo_point_to_polyline_m`); nenhuma referência a `provider`, `geocode_provider`, `eta_provider` ou `route_provider` em toda a função. Trocar o provedor Mapbox↔Google não exige mudança no trigger.
- **Etapa 71 — permissões e auditoria da tela "Mapas & Custos":** já cobertas pela PR #118, sem código adicional necessário. Confirmado em `supabase/migrations/20261122130100_geo_foundation.sql:568-575`: a policy `geo_settings_admin_all` restringe `INSERT/UPDATE/DELETE` em `geo_settings` a `public.has_role(auth.uid(), 'admin')` (leitura liberada a qualquer autenticado via `geo_settings_read_authenticated`); e `geo_audit_config()` (mesmo arquivo, logo abaixo) grava antes/depois em `audit_log`. A tela `/settings/maps` da etapa 63 só precisa chamar `update` normal — a 403 para não-admin e a auditoria já vêm do banco.

## Rotação de token (Runbook — etapa 9)

1. Edge `geo-admin` action `rotate-mapbox-token` cria novo `sk.` com mesmos scopes via `POST /tokens/v2/promobrindes`
2. `supabase secrets set MAPBOX_SERVER_TOKEN=<novo>` via Management API
3. `DELETE /tokens/v2/promobrindes/<id-antigo>` após 10 minutos
4. Registrar em `audit_log`

Em emergência (token vazado): acessar mapbox.com/account/access-tokens → revogar imediatamente → executar rotação manual → atualizar secret no Supabase.
