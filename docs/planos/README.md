# docs/planos — planos de execução (mapas, mensageria, front/contratos)

| Arquivo | Conteúdo |
|---|---|
| `ANALISE_GOOGLE_MAPS_X_LALAMOVE_V2.md` | Análise exaustiva (21/11/2026): o que Google e Mapbox oferecem, o que a Lalamove fornece, estado real do repo na data, equivalência entre provedores, arquitetura adotada |
| `PLANO_GOOGLE_MAPS_100_ETAPAS.md` | 100 etapas com checklists para incorporar o Google Maps Platform (conta/chaves, banco, `geo-gateway`, endereço no pedido, rota/ETA, geofence→mensagem ao responsável pela coleta, notificações, front, admin, operação) + decisões D1–D12 |
| `PLANO_MENSAGERIA_MOTORISTAS_ZAPP_SMS_150_ETAPAS.md` | 150 etapas para o Lalamove falar com o motorista (e fornecedor/cliente) pelo WhatsApp do Zapp Web V2 com SMS de contingência: estado real (A1–A14), arquitetura, decisões Z1–Z12, catálogo M1–M12, API máquina-a-máquina no Zapp, callbacks, ledger, roteador, SMS, telas, piloto |
| `PLANO_MAPBOX_100_ETAPAS.md` | 100 etapas espelho para a Mapbox (tokens, conformidade de retenção, provedor Mapbox no `geo-gateway`, Search Box/Geocoding v6, Directions/Matrix/Map Matching, GL JS, seletor Google↔Mapbox por função no admin, custo) + decisões M1–M10 |
| `PLANO_FRONTEND_190_ETAPAS.md` | 190 etapas (22/11/2026) de correção e melhoria do front (`src/`) e das 26 Edge Functions a partir de auditoria exaustiva (104 achados no front + inventário das 18 edges sem camada de contrato): segurança (XSS no mapa, bypass de MFA, CSP), contratos Zod v1/v2 com erro 422 único e testes de contrato para todas as edges, RBAC × menu, dados/erros, performance/bundle, acessibilidade, UX/formulários, PWA/SEO, arquitetura e testes + decisões D1–D8 |

Regras: o seletor de provedor é **por função** (`geo_settings`), com `fallback_provider` e modo `auto` (quem tem cota grátis). Cada etapa tem checklist e "Evidência" (o que prova que está pronta). 🔒 = PR fica aberta para o dono (DDL, segredos, CI, custo). Ao concluir uma etapa, marque o status no cabeçalho do plano na mesma PR.

Operação da Mapbox (conta, tokens, termos): `docs/MAPBOX.md`. Edge: `supabase/functions/geo-gateway/`. Banco: `supabase/migrations/20261122130000_geo_alert_types.sql`, `20261122130100_geo_foundation.sql`. Script de cobertura: `scripts/geo/`.
