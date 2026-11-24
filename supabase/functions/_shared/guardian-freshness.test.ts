import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  MAX_TRACKING_AGE_MIN,
  POD_ALERT_LOOKBACK_HOURS,
  isTrackingFresh,
  isWithinLookbackHours,
  trackingAgeMinutes,
} from "./guardian-freshness.ts";

const NOW = new Date("2026-11-24T12:00:00.000Z");

Deno.test("tracking atualizado agora conta como fresco", () => {
  assertEquals(isTrackingFresh(NOW.toISOString(), NOW), true);
});

Deno.test("tracking dentro da janela conta como fresco (limite inclusive)", () => {
  const limite = new Date(NOW.getTime() - MAX_TRACKING_AGE_MIN * 60000).toISOString();
  assertEquals(isTrackingFresh(limite, NOW), true);
});

Deno.test("tracking orfao de meses e recusado", () => {
  assertEquals(isTrackingFresh("2026-08-31T16:11:53.151Z", NOW), false);
});

Deno.test("um minuto alem da janela recusa", () => {
  const velho = new Date(NOW.getTime() - (MAX_TRACKING_AGE_MIN + 1) * 60000).toISOString();
  assertEquals(isTrackingFresh(velho, NOW), false);
});

Deno.test("data ausente ou invalida recusa", () => {
  assertEquals(isTrackingFresh(null, NOW), false);
  assertEquals(isTrackingFresh(undefined, NOW), false);
  assertEquals(isTrackingFresh("", NOW), false);
  assertEquals(isTrackingFresh("nao-e-data", NOW), false);
});

Deno.test("relogio adiantado (data no futuro) nao vira alerta", () => {
  const futuro = new Date(NOW.getTime() + 5 * 60000).toISOString();
  assertEquals(isTrackingFresh(futuro, NOW), true);
});

Deno.test("trackingAgeMinutes devolve a idade em minutos", () => {
  const dezMin = new Date(NOW.getTime() - 10 * 60000).toISOString();
  assertEquals(trackingAgeMinutes(dezMin, NOW), 10);
  assertEquals(trackingAgeMinutes(null, NOW), null);
});
Deno.test("pedido entregue ha 1h continua dentro da janela de POD", () => {
  const umaHora = new Date(NOW.getTime() - 60 * 60000).toISOString();
  assertEquals(isWithinLookbackHours(umaHora, NOW), true);
});

Deno.test("pedido entregue em agosto fica fora da janela de POD", () => {
  assertEquals(isWithinLookbackHours("2026-08-22T18:27:26.837Z", NOW), false);
});

Deno.test("janela de POD aceita valor de horas customizado", () => {
  const trintaHoras = new Date(NOW.getTime() - 30 * 3600000).toISOString();
  assertEquals(isWithinLookbackHours(trintaHoras, NOW, 48), true);
  assertEquals(isWithinLookbackHours(trintaHoras, NOW, 24), false);
});
