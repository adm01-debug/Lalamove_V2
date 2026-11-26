import {
  baseResource,
  CRITICAL_SNAPSHOT_RESOURCES,
  evaluateResourceFreshness,
  evaluateSnapshotHealth,
} from "./snapshot-watchdog.ts";

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
// ── Frescor por recurso ──────────────────────────────────────────────────────
// O snapshot global (`max(updated_at)`) fica saudável enquanto qualquer recurso
// for gravado; um recurso parado congelava a tela em silêncio.
const RES_NOW = Date.parse("2026-11-26T13:00:00.000Z");
const resMinsAgo = (min: number) => new Date(RES_NOW - min * 60_000).toISOString();
const ALL_CRITICAL = [
  "wallet_balance",
  "wallet_flow_list",
  "coupon_list_web",
  "order_list_new",
  "get_fleet",
];

Deno.test("[watchdog] recurso parado é nomeado mesmo com snapshot global fresco", () => {
  const result = evaluateResourceFreshness(
    [
      { resource: "wallet_balance", updated_at: resMinsAgo(1) },
      { resource: "order_list_new", updated_at: resMinsAgo(1) },
      { resource: "coupon_list_web", updated_at: resMinsAgo(300) },
      { resource: "coupon_list_web:p2", updated_at: resMinsAgo(290) },
    ],
    RES_NOW,
    STALE,
  );
  assertEq(result.missing.join(","), "wallet_flow_list,get_fleet", "recursos nunca coletados");
  assertEq(result.stale.length, 1, "um recurso parado");
  assertEq(result.stale[0].resource, "coupon_list_web", "recurso parado");
  assertEq(result.stale[0].ageMinutes, 290, "idade do recurso parado");
});

Deno.test("[watchdog] página mais nova do recurso define a idade", () => {
  const result = evaluateResourceFreshness(
    [
      { resource: "wallet_flow_list", updated_at: resMinsAgo(5) },
      { resource: "wallet_flow_list:p2", updated_at: resMinsAgo(2) },
      { resource: "wallet_balance", updated_at: resMinsAgo(3) },
      { resource: "coupon_list_web", updated_at: resMinsAgo(3) },
      { resource: "order_list_new", updated_at: resMinsAgo(3) },
      { resource: "get_fleet:1", updated_at: resMinsAgo(4) },
      { resource: "get_fleet:2", updated_at: resMinsAgo(4) },
    ],
    RES_NOW,
    STALE,
  );
  assertEq(result.stale.length, 0, "nada parado");
  assertEq(result.missing.length, 0, "nada faltando");
});

Deno.test("[watchdog] idade mais antiga considera só recursos críticos", () => {
  const result = evaluateResourceFreshness(
    [
      { resource: "download_pdf_receipt:abc", updated_at: resMinsAgo(500) },
      { resource: "wallet_balance", updated_at: resMinsAgo(10) },
      { resource: "wallet_flow_list", updated_at: resMinsAgo(20) },
      { resource: "coupon_list_web", updated_at: resMinsAgo(30) },
      { resource: "order_list_new", updated_at: resMinsAgo(40) },
      { resource: "get_fleet", updated_at: resMinsAgo(50) },
    ],
    RES_NOW,
    STALE,
  );
  assertEq(result.oldestAgeMinutes, 50, "recibo fora do conjunto crítico");
});

Deno.test("[watchdog] linha com data inválida conta como ausente", () => {
  const result = evaluateResourceFreshness(
    [{ resource: "wallet_balance", updated_at: "não é data" }],
    RES_NOW,
    STALE,
    ["wallet_balance"],
  );
  assertEq(result.missing.join(","), "wallet_balance", "data inválida não conta como coleta");
});

Deno.test("[watchdog] baseResource remove página e cursor", () => {
  assertEq(baseResource("wallet_flow_list:p2"), "wallet_flow_list", "página");
  assertEq(baseResource('order_list_new:{"app":{}}'), "order_list_new", "cursor");
  assertEq(baseResource("wallet_balance"), "wallet_balance", "sem sufixo");
});

Deno.test("[watchdog] todos os recursos críticos estão na lista padrão", () => {
  assertEq(CRITICAL_SNAPSHOT_RESOURCES.join(","), ALL_CRITICAL.join(","), "lista padrão");
});