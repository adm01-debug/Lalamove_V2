# scripts/geo — ferramentas da camada de mapas (Google / Mapbox)

| Arquivo | O que faz | Comando |
|---|---|---|
| `searchbox-coverage.ts` | Etapa 36 do plano Mapbox: mede a cobertura BR do Search Box (suggest+retrieve) contra Geocoding v6 e, se houver chave, Google Geocoding v4. Imprime tabela Markdown e o veredito (≥ 90 % = Search Box aprovado). Nada é gravado; consome 1 sessão Search Box por endereço. | `MAPBOX_SERVER_TOKEN=sk... deno run --allow-net --allow-env --allow-read scripts/geo/searchbox-coverage.ts scripts/geo/enderecos.sample.csv` |
| `eta-parity.ts` | Etapa 51 do plano Mapbox: mede o ETA do Directions `driving-traffic` do Mapbox × Routes API do Google para 20 pares origem/destino reais de Curitiba (ou um CSV próprio) e imprime o Δ em segundos/% com o veredito. Critério M4: ≥ 80 % dos pares dentro de 20 %. Sem `GOOGLE_MAPS_SERVER_KEY` mede só o Mapbox e o veredito fica indefinido. | `MAPBOX_SERVER_TOKEN=sk... [GOOGLE_MAPS_SERVER_KEY=...] deno run --allow-net --allow-env --allow-read scripts/geo/eta-parity.ts [pares.csv]` |
| `enderecos.sample.csv` | 50 endereços públicos (Curitiba/RMC, SP, GO) — **substituir pela lista real de fornecedores/clientes** antes de decidir. | — |

Formato do CSV de `eta-parity.ts`: `origem_lat;origem_lng;destino_lat;destino_lng;rotulo` (uma linha por par, `#` comenta).

Segredos só por variável de ambiente; nunca no CSV nem no código.
