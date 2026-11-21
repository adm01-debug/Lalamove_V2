# docs/planos — camada de mapas (Google Maps Platform × Mapbox)

| Arquivo | Conteúdo |
|---|---|
| `ANALISE_GOOGLE_MAPS_X_LALAMOVE_V2.md` | Análise exaustiva (21/11/2026): o que Google e Mapbox oferecem, o que a Lalamove fornece, estado real do repo na data, equivalência entre provedores, arquitetura adotada |
| `PLANO_GOOGLE_MAPS_100_ETAPAS.md` | 100 etapas com checklists para incorporar o Google Maps Platform (conta/chaves, banco, `geo-gateway`, endereço no pedido, rota/ETA, geofence→mensagem ao responsável pela coleta, notificações, front, admin, operação) + decisões D1–D12 |
| `PLANO_MAPBOX_100_ETAPAS.md` | 100 etapas espelho para a Mapbox (tokens, conformidade de retenção, provedor Mapbox no `geo-gateway`, Search Box/Geocoding v6, Directions/Matrix/Map Matching, GL JS, seletor Google↔Mapbox por função no admin, custo) + decisões M1–M10 |

Regras: o seletor de provedor é **por função** (`geo_settings`), com `fallback_provider` e modo `auto` (quem tem cota grátis). Cada etapa tem checklist e "Evidência" (o que prova que está pronta). 🔒 = PR fica aberta para o dono (DDL, segredos, CI, custo). Ao concluir uma etapa, marque o status no cabeçalho do plano na mesma PR.

Operação da Mapbox (conta, tokens, termos): `docs/MAPBOX.md`. Edge: `supabase/functions/geo-gateway/`. Banco: `supabase/migrations/20261122130000_geo_alert_types.sql`, `20261122130100_geo_foundation.sql`. Script de cobertura: `scripts/geo/`.
