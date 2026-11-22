import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CACHE_TTL_S, resolveTtl } from "./metering.ts";

// Etapa 15/211 do plano Mapbox: o TTL de cache por (provedor, função) precisa ser
// ajustável por `geo_settings.config.retention` — mas retenção é restritiva.

Deno.test("resolveTtl sem config usa o TTL de codigo", () => {
  assertEquals(resolveTtl("google", "geocode"), 30 * 86400);
  assertEquals(resolveTtl("mapbox", "route"), 600);
  assertEquals(resolveTtl("mapbox", "matrix"), 0);
});

Deno.test("geocode Mapbox temporario nunca cacheia (termos Mapbox)", () => {
  // A prova que a etapa 15 pede: o TTL de `mapbox.geocode` e 0 e nem um config
  // explicito consegue faze-lo cachear.
  assertEquals(CACHE_TTL_S.mapbox.geocode, undefined);
  assertEquals(resolveTtl("mapbox", "geocode"), 0);
  assertEquals(resolveTtl("mapbox", "geocode", { geocode: 86400 }), 0);
  assertEquals(resolveTtl("mapbox", "geocode", { mapbox: { geocode: 86400 } }), 0);
});

Deno.test("config.retention reduz o TTL de codigo", () => {
  assertEquals(resolveTtl("google", "geocode", { geocode: 3600 }), 3600);
  assertEquals(resolveTtl("google", "geocode", { google: { geocode: 7200 } }), 7200);
});

Deno.test("config.retention nao aumenta o TTL acima do padrao", () => {
  // Tentar reter 90 dias um limite de 30 dias e recusado: vale o de codigo.
  assertEquals(resolveTtl("google", "geocode", { geocode: 90 * 86400 }), 30 * 86400);
  assertEquals(resolveTtl("mapbox", "route", { mapbox: { route: 999999 } }), 600);
});

Deno.test("config.retention invalido cai no TTL de codigo", () => {
  assertEquals(resolveTtl("google", "route", { route: -5 }), 600);
  assertEquals(resolveTtl("google", "route", { route: "3600" }), 600);
  assertEquals(resolveTtl("google", "route", { route: Number.NaN }), 600);
  assertEquals(resolveTtl("google", "route", null), 600);
});

Deno.test("retention por provedor vence a chave plana", () => {
  assertEquals(resolveTtl("mapbox", "route", { route: 60, mapbox: { route: 120 } }), 120);
});
