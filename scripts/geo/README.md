# scripts/geo — ferramentas da camada de mapas (Google / Mapbox)

| Arquivo | O que faz | Comando |
|---|---|---|
| `searchbox-coverage.ts` | Etapa 36 do plano Mapbox: mede a cobertura BR do Search Box (suggest+retrieve) contra Geocoding v6 e, se houver chave, Google Geocoding v4. Imprime tabela Markdown e o veredito (≥ 90 % = Search Box aprovado). Nada é gravado; consome 1 sessão Search Box por endereço. | `MAPBOX_SERVER_TOKEN=sk... deno run --allow-net --allow-env --allow-read scripts/geo/searchbox-coverage.ts scripts/geo/enderecos.sample.csv` |
| `enderecos.sample.csv` | 50 endereços públicos (Curitiba/RMC, SP, GO) — **substituir pela lista real de fornecedores/clientes** antes de decidir. | — |

Segredos só por variável de ambiente; nunca no CSV nem no código.
