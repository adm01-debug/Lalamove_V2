import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateSessionHealth, VERIFICATION_WINDOW_MS } from "./session-health.ts";

const NOW = Date.parse("2026-11-26T13:00:00.000Z");
const iso = (hoursAgo: number) => new Date(NOW - hoursAgo * 3600_000).toISOString();

Deno.test("token expirado mas verificado agora continua ativo", () => {
  const health = evaluateSessionHealth(
    { token_obtained_at: iso(48), last_refreshed_at: iso(1) },
    NOW,
  );
  assertEquals(health.recentlyVerified, true);
  assertEquals(health.lastVerifiedAt, iso(1));
});

Deno.test("sem verificação recente fica inativo", () => {
  const health = evaluateSessionHealth({ last_refreshed_at: iso(5) }, NOW);
  assertEquals(health.recentlyVerified, false);
});

Deno.test("sem last_refreshed_at cai para token_obtained_at", () => {
  const health = evaluateSessionHealth({ token_obtained_at: iso(1) }, NOW);
  assertEquals(health.recentlyVerified, true);
  assertEquals(health.lastVerifiedAt, iso(1));
});

Deno.test("sessão vazia não é ativa nem renovável", () => {
  assertEquals(evaluateSessionHealth(null, NOW), {
    lastVerifiedAt: null,
    recentlyVerified: false,
    autoRenewal: false,
  });
});

Deno.test("refresh_token curto não habilita renovação automática", () => {
  assertEquals(evaluateSessionHealth({ last_refreshed_at: iso(1), refresh_token: "abc" }, NOW).autoRenewal, false);
  assertEquals(
    evaluateSessionHealth({ last_refreshed_at: iso(1), refresh_token: "r".repeat(16) }, NOW).autoRenewal,
    true,
  );
});

Deno.test("limite da janela de verificação", () => {
  const inside = new Date(NOW - VERIFICATION_WINDOW_MS + 1000).toISOString();
  const outside = new Date(NOW - VERIFICATION_WINDOW_MS - 1000).toISOString();
  assertEquals(evaluateSessionHealth({ last_refreshed_at: inside }, NOW).recentlyVerified, true);
  assertEquals(evaluateSessionHealth({ last_refreshed_at: outside }, NOW).recentlyVerified, false);
});