// Implementação única dos hooks de mapa. `useMapbox.ts` é o módulo que fala com o
// geo-gateway (camada única de provedores: cache, orçamento e `geo_settings`), e este
// arquivo existe para que consumidores novos importem de `@/hooks/useGeo`.
// Ver docs/planos/PLANO_MAPBOX_100_ETAPAS.md, etapas 60 e 83.
export * from "./useMapbox";
