// @deprecated Mantido apenas como fachada de compatibilidade.
// Toda a implementação vive em `useGeo.ts`, que fala com o geo-gateway (camada única
// de provedores) em vez de chamar `mapbox-proxy` direto. Migração concluída na etapa 60
// do plano (claude/mapbox-x-lalamove-v2-plano-100-etapas-2026-11-21.md).
// Novos consumidores devem importar de '@/hooks/useGeo'.
export * from "./useGeo";
