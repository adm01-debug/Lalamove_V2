import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { GEO_POSITION_MAX_AGE_MIN, staleGpsReason } from "./index.ts";

/**
 * Rota/ETA (etapas 45-48) so pode gastar chamada paga com posicao viva.
 *
 * `refresh_geo_jobs` enfileira `route_plan`/`eta_refresh` para todo tracking
 * ACTIVE, sem olhar a idade do GPS. Em producao isso manteve 20 trackings
 * orfaos (GPS congelado) gerando ~822 jobs de rota por dia — Directions pago
 * recalculado a cada 30 min com a mesma posicao de agosto, e
 * `route_computed_at` reescrito para "agora" (rota que parece recem medida).
 */
const now = Date.UTC(2026, 10, 24, 12, 0, 0);
const minutesAgo = (min: number) => new Date(now - min * 60_000).toISOString();

Deno.test("posicao dentro da janela nao bloqueia rota/ETA", () => {
  assertEquals(staleGpsReason(minutesAgo(0), now), null);
  assertEquals(staleGpsReason(minutesAgo(GEO_POSITION_MAX_AGE_MIN), now), null);
});

Deno.test("posicao velha e barrada com o motivo e a idade", () => {
  const reason = staleGpsReason(minutesAgo(GEO_POSITION_MAX_AGE_MIN + 1), now);
  assertEquals(reason, "posicao do motorista com 121 min (limite 120 min)");
});

Deno.test("tracking orfao (GPS de meses atras) nunca recalcula", () => {
  const reason = staleGpsReason("2026-08-31T16:11:53.151+00:00", now);
  assertEquals(reason, "posicao do motorista com 122148 min (limite 120 min)");
});

Deno.test("sem data de atualizacao tambem bloqueia", () => {
  assertEquals(staleGpsReason(null, now), "posicao do motorista sem data de atualizacao");
  assertEquals(staleGpsReason(undefined, now), "posicao do motorista sem data de atualizacao");
  assertEquals(staleGpsReason("nao-e-data", now), "posicao do motorista sem data de atualizacao");
});
