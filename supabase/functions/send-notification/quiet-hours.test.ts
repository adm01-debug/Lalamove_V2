// Testes das funções puras do horário de silêncio (D3). Rodam in-memory (sem rede,
// sem Supabase) — mesmo padrão de lalamove-webhook/security.test.ts. Executados no
// job contract-tests do CI.
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { isWithinQuietHours, nextAllowedTime, type QuietHours } from "./quiet-hours.ts";

// America/Sao_Paulo é UTC-3 fixo (Brasil aboliu o horário de verão em 2019) — facilita
// prever os instantes UTC esperados nos asserts abaixo.
const QH: QuietHours = { start: "07:00", end: "20:00", tz: "America/Sao_Paulo" };

Deno.test("[quiet-hours] dentro da janela (10:00 UTC = 07:00 local, início inclusive)", () => {
  assertEquals(isWithinQuietHours(new Date("2026-11-22T10:00:00Z"), QH), true);
});

Deno.test("[quiet-hours] 1 min antes do início é fora da janela", () => {
  assertEquals(isWithinQuietHours(new Date("2026-11-22T09:59:00Z"), QH), false);
});

Deno.test("[quiet-hours] fim é exclusivo (23:00 UTC = 20:00 local)", () => {
  assertEquals(isWithinQuietHours(new Date("2026-11-22T23:00:00Z"), QH), false);
});

Deno.test("[quiet-hours] madrugada (01:00 UTC = 22:00 local do dia anterior) é fora da janela", () => {
  assertEquals(isWithinQuietHours(new Date("2026-11-23T01:00:00Z"), QH), false);
});

Deno.test("[quiet-hours] meio-dia local está dentro da janela", () => {
  assertEquals(isWithinQuietHours(new Date("2026-11-22T15:00:00Z"), QH), true);
});

Deno.test("[quiet-hours] nextAllowedTime antes da janela de hoje aponta para hoje às 07:00 local", () => {
  // 09:00 UTC = 06:00 local (22/11) -> ainda não abriu hoje.
  const runAt = nextAllowedTime(new Date("2026-11-22T09:00:00Z"), QH);
  assertEquals(runAt.toISOString(), "2026-11-22T10:00:00.000Z");
});

Deno.test("[quiet-hours] nextAllowedTime depois da janela de hoje aponta para amanhã às 07:00 local", () => {
  // 23:30 UTC = 20:30 local (22/11) -> janela de hoje já fechou.
  const runAt = nextAllowedTime(new Date("2026-11-22T23:30:00Z"), QH);
  assertEquals(runAt.toISOString(), "2026-11-23T10:00:00.000Z");
});

Deno.test("[quiet-hours] nextAllowedTime na madrugada aponta para o mesmo dia local às 07:00", () => {
  // 01:00 UTC (23/11) = 22:00 local (22/11) -> janela de "22/11" já fechou; a próxima
  // abertura é no dia local em que `now` cai, ou seja 23/11 às 07:00 local.
  const runAt = nextAllowedTime(new Date("2026-11-23T01:00:00Z"), QH);
  assertEquals(runAt.toISOString(), "2026-11-23T10:00:00.000Z");
});
