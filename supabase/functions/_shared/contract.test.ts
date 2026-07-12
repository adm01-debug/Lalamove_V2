// ============================================================================
// Testes de Contrato — Validam que payloads válidos e inválidos produzem
// respostas CONSISTENTES em todos os webhooks e Edge Functions.
//
// Cobertura:
//  - Payload válido → ok:true
//  - Campos ausentes → 422 + formato único
//  - Tipos incorretos → 422 + formato único
//  - Valores vazios → 422 + formato único
//  - Formato de erro idêntico entre contratos
//  - Compatibilidade retroativa v1 → v2 (superset)
//  - Resolução/normalização de versão
//
// Executar: deno test supabase/functions/_shared/contract.test.ts
// ============================================================================

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildContractUsageEvent,
  buildErrorBody,
  DEFAULT_VERSION,
  DEPRECATED_VERSIONS,
  DEPRECATION_SCHEDULE,
  deprecationNotice,
  ERROR_CODES,
  isDeprecated,
  normalizeVersion,
  parseJsonBody,
  RECOMMENDED_VERSION,
  resolveContractVersion,
  SUPPORTED_VERSIONS,
  validateContract,
  type ContractVersion,
} from "./contract.ts";

import {
  CONTRACT_REGISTRY,
  type ContractName,
  getSchema,
} from "./schemas.ts";

// ── Fixtures: payloads válidos mínimos por contrato ───────────────────────────

const VALID_PAYLOADS: Record<ContractName, Record<string, unknown>> = {
  "lalamove-webhook": { event: "ORDER_STATUS_CHANGED", orderId: "ORD-1" },
  "evaluate-driver": { driverId: "DRV-1" },
  "send-notification": {
    alert_id: "a1",
    type: "STOP",
    severity: "WARNING",
    title: "t",
    message: "m",
  },
  "new-device-alert": {
    userId: "u1",
    userEmail: "user@example.com",
    deviceFingerprint: "fp",
    ipAddress: "1.2.3.4",
    userAgent: "UA",
  },
  "route-analyzer": { action: "analyze-routes" },
  "check-external-api": { service: "lalamove" },
  "test-notification": { channel: "email", alertType: "STOP" },
};

const ALL_CONTRACTS = Object.keys(CONTRACT_REGISTRY) as ContractName[];

// ── Formato único de erro ─────────────────────────────────────────────────────

Deno.test("formato único de erro: estrutura consistente", () => {
  const body = buildErrorBody(
    ERROR_CODES.VALIDATION_FAILED,
    "msg",
    [{ field: "x", message: "obrigatório", code: "invalid_type" }],
    "v1",
  );
  assertEquals(body.error.code, ERROR_CODES.VALIDATION_FAILED);
  assertEquals(typeof body.error.message, "string");
  assert(Array.isArray(body.error.fields));
  assertEquals(body.error.fields[0].field, "x");
  assertEquals(body.meta.contractVersion, "v1");
  assertExists(body.meta.timestamp);
});

// ── Payload válido → ok ───────────────────────────────────────────────────────

for (const name of ALL_CONTRACTS) {
  Deno.test(`[${name}] payload válido é aceito (v1)`, () => {
    const result = validateContract(getSchema(name, "v1"), VALID_PAYLOADS[name], "v1");
    assert(result.ok, `esperado ok=true para ${name}`);
  });
}

// ── Campos ausentes → 422 + formato único ─────────────────────────────────────

for (const name of ALL_CONTRACTS) {
  Deno.test(`[${name}] campo ausente retorna 422 no formato único`, () => {
    const result = validateContract(getSchema(name, "v1"), {}, "v1");
    assert(!result.ok, `esperado falha para ${name} com payload vazio`);
    if (!result.ok) {
      assertEquals(result.status, 422);
      assertEquals(result.body.error.code, ERROR_CODES.VALIDATION_FAILED);
      assert(result.body.error.fields.length > 0);
      for (const f of result.body.error.fields) {
        assertExists(f.field);
        assertExists(f.message);
        assertExists(f.code);
      }
    }
  });
}

// ── Tipos incorretos → 422 ────────────────────────────────────────────────────

Deno.test("[evaluate-driver] tipo incorreto (rating string) retorna 422", () => {
  const result = validateContract(
    getSchema("evaluate-driver", "v1"),
    { driverId: "d1", rating: "cinco" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assert(result.body.error.fields.some((f) => f.field === "rating"));
  }
});

Deno.test("[send-notification] enum inválido (severity) retorna 422", () => {
  const result = validateContract(
    getSchema("send-notification", "v1"),
    { ...VALID_PAYLOADS["send-notification"], severity: "FATAL" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "severity"));
  }
});

// ── Valores vazios → 422 ──────────────────────────────────────────────────────

Deno.test("[lalamove-webhook] event vazio retorna 422", () => {
  const result = validateContract(
    getSchema("lalamove-webhook", "v1"),
    { event: "" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "event"));
  }
});

Deno.test("[new-device-alert] email vazio/ inválido retorna 422", () => {
  const result = validateContract(
    getSchema("new-device-alert", "v1"),
    { ...VALID_PAYLOADS["new-device-alert"], userEmail: "" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "userEmail"));
  }
});

// ── Compatibilidade retroativa v1 → v2 ────────────────────────────────────────

for (const name of ALL_CONTRACTS) {
  Deno.test(`[${name}] payload v1 válido continua válido em v2 (superset)`, () => {
    const v2 = validateContract(getSchema(name, "v2"), VALID_PAYLOADS[name], "v2");
    assert(v2.ok, `payload v1 deveria ser aceito em v2 para ${name}`);
  });
}

Deno.test("v2 aceita campos novos sem quebrar (lalamove-webhook.eventId)", () => {
  const result = validateContract(
    getSchema("lalamove-webhook", "v2"),
    { event: "ORDER_STATUS_CHANGED", eventId: "evt-1", apiVersion: "3" },
    "v2",
  );
  assert(result.ok);
});

// ── Resolução / normalização de versão ────────────────────────────────────────

Deno.test("normalizeVersion aceita variações", () => {
  assertEquals(normalizeVersion("v1"), "v1");
  assertEquals(normalizeVersion("1"), "v1");
  assertEquals(normalizeVersion("V2"), "v2");
  assertEquals(normalizeVersion("  v2 "), "v2");
  assertEquals(normalizeVersion("v99"), null);
  assertEquals(normalizeVersion(""), null);
});

Deno.test("resolveContractVersion: header tem precedência", () => {
  const req = new Request("https://x.dev/fn?v=v1", {
    headers: { "x-contract-version": "v2" },
  });
  assertEquals(resolveContractVersion(req), "v2");
});

Deno.test("resolveContractVersion: query param quando sem header", () => {
  const req = new Request("https://x.dev/fn?version=v2");
  assertEquals(resolveContractVersion(req), "v2");
});

Deno.test("resolveContractVersion: default quando ausente/ inválido", () => {
  assertEquals(resolveContractVersion(new Request("https://x.dev/fn")), DEFAULT_VERSION);
  assertEquals(
    resolveContractVersion(new Request("https://x.dev/fn?v=v99")),
    DEFAULT_VERSION,
  );
});

// ── parseJsonBody ─────────────────────────────────────────────────────────────

Deno.test("parseJsonBody: JSON válido", async () => {
  const req = new Request("https://x.dev/fn", {
    method: "POST",
    body: JSON.stringify({ a: 1 }),
  });
  const r = await parseJsonBody(req, "v1");
  assert(r.ok);
  if (r.ok) assertEquals(r.value, { a: 1 });
});

Deno.test("parseJsonBody: JSON malformado retorna 422 no formato único", async () => {
  const req = new Request("https://x.dev/fn", { method: "POST", body: "{bad" });
  const r = await parseJsonBody(req, "v1");
  assert(!r.ok);
  if (!r.ok) {
    assertEquals(r.status, 422);
    assertEquals(r.body.error.code, ERROR_CODES.INVALID_JSON);
  }
});

// ── Invariante: todas as versões suportadas existem em todos os contratos ─────

Deno.test("todos os contratos definem todas as versões suportadas", () => {
  for (const name of ALL_CONTRACTS) {
    for (const v of SUPPORTED_VERSIONS as ContractVersion[]) {
      assertExists(CONTRACT_REGISTRY[name][v], `${name} deve ter schema ${v}`);
    }
  }
});

// ── Estratégia de deprecação ──────────────────────────────────────────────────

Deno.test("v1 está descontinuada e v2 é a recomendada", () => {
  assert(DEPRECATED_VERSIONS.includes("v1"), "v1 deve estar em DEPRECATED_VERSIONS");
  assert(isDeprecated("v1"));
  assert(!isDeprecated("v2"));
  assertEquals(RECOMMENDED_VERSION, "v2");
});

Deno.test("versão descontinuada nunca é a recomendada (invariante)", () => {
  assert(
    !DEPRECATED_VERSIONS.includes(RECOMMENDED_VERSION),
    "RECOMMENDED_VERSION não pode estar descontinuada",
  );
});

Deno.test("deprecationNotice retorna aviso acionável para v1", () => {
  const notice = deprecationNotice("v1");
  assertExists(notice);
  assertEquals(notice!.version, "v1");
  assertEquals(notice!.deprecated, true);
  assertEquals(notice!.recommendedVersion, "v2");
  assertEquals(notice!.sunsetDate, DEPRECATION_SCHEDULE.v1!.sunsetDate);
  assert(notice!.message.includes("v2"), "mensagem deve orientar a migração para v2");
  assert(notice!.message.includes(notice!.sunsetDate), "mensagem deve citar o sunset");
});

Deno.test("deprecationNotice retorna null para versão ativa (v2)", () => {
  assertEquals(deprecationNotice("v2"), null);
});

Deno.test("erro 422 em v1 embute meta.deprecation clara", () => {
  const result = validateContract(getSchema("evaluate-driver", "v1"), {}, "v1");
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assertExists(result.body.meta.deprecation);
    assertEquals(result.body.meta.deprecation!.recommendedVersion, "v2");
    assert(result.body.meta.deprecation!.message.length > 0);
  }
});

Deno.test("erro 422 em v2 NÃO inclui meta.deprecation", () => {
  const result = validateContract(getSchema("evaluate-driver", "v2"), {}, "v2");
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.body.meta.deprecation, undefined);
  }
});


// ── Telemetria de uso de versão (evento puro) ────────────────────────────────

Deno.test("buildContractUsageEvent marca deprecated=true para v1", () => {
  const ev = buildContractUsageEvent("evaluate-driver", "v1");
  assertEquals(ev.contractName, "evaluate-driver");
  assertEquals(ev.contractVersion, "v1");
  assertEquals(ev.deprecated, true);
  assertExists(ev.timestamp);
});

Deno.test("buildContractUsageEvent marca deprecated=false para v2", () => {
  const ev = buildContractUsageEvent("evaluate-driver", "v2");
  assertEquals(ev.deprecated, false);
});

Deno.test("buildContractUsageEvent: deprecated reflete DEPRECATED_VERSIONS", () => {
  for (const name of ALL_CONTRACTS) {
    const ev = buildContractUsageEvent(name, "v1");
    assertEquals(ev.deprecated, DEPRECATED_VERSIONS.includes("v1"));
  }
});
