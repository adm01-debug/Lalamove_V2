import { evaluateSnapshotHealth } from "./snapshot-watchdog.ts";

// Assertivas locais: `deno lint` proíbe import inline de std nesta base.
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg} — esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  }
}

const NOW = Date.parse("2026-11-25T12:00:00.000Z");
const STALE = 120;
const minutesAgo = (min: number) => new Date(NOW - min * 60_000).toISOString();

Deno.test("[watchdog] coleta recente mantém o painel servido e sem alerta", () => {
  const health = evaluateSnapshotHealth(minutesAgo(30), NOW, STALE);
  assertEq(health.healthy, true, "30 min é fresco");
  assertEq(health.reason, "fresh", "motivo");
  assertEq(health.ageMinutes, 30, "idade em minutos");
});

Deno.test("[watchdog] fronteira de 120 min ainda é considerada saudável", () => {
  assertEq(evaluateSnapshotHealth(minutesAgo(STALE), NOW, STALE).healthy, true, "120 min = limite");
});

Deno.test("[watchdog] 121 min já alerta: é o que evita carteira congelada em silêncio", () => {
  const health = evaluateSnapshotHealth(minutesAgo(STALE + 1), NOW, STALE);
  assertEq(health.healthy, false, "121 min é stale");
  assertEq(health.reason, "stale", "motivo");
  assertEq(health.ageMinutes, STALE + 1, "idade em minutos");
});

Deno.test("[watchdog] snapshot vazio alerta mesmo sem data", () => {
  const health = evaluateSnapshotHealth(null, NOW, STALE);
  assertEq(health.healthy, false, "sem coleta não é saudável");
  assertEq(health.reason, "empty", "motivo");
  assertEq(health.ageMinutes, null, "sem idade");
});

Deno.test("[watchdog] data inválida não gera idade negativa nem passa como fresco", () => {
  const health = evaluateSnapshotHealth("nao-e-data", NOW, STALE);
  assertEq(health.healthy, false, "data inválida alerta");
  assertEq(health.reason, "empty", "motivo");
});

Deno.test("[watchdog] coleta no futuro (relógio adiantado) não dispara alerta", () => {
  const health = evaluateSnapshotHealth(minutesAgo(-5), NOW, STALE);
  assertEq(health.healthy, true, "idade negativa continua fresca");
  assert(health.ageMinutes !== null && (health.ageMinutes as number) < 0, "idade negativa");
});