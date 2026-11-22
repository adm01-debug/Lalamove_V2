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
  OPTIONAL_BODY_CONTRACTS,
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
  "geo-gateway": { action: "provider-status" },
  "apply-fixes": { action: "fix_dashboard" },
  // Contratos de corpo opcional: a Edge Function não lê a entrada, então `{}`
  // é o payload mínimo válido (ver OPTIONAL_BODY_CONTRACTS em schemas.ts).
  "bitrix24-process-queue": {},
  "check-driver-alerts": {},
  "escalate-alerts": {},
  "get-mapbox-token": {},
  "lalamove-token-refresh": {},
  "rotate-tokens": {},
  "seed-fix-rls": {},
  "simulate-driver-movement": {},
  "llm-wh": {
    eventType: "ORDER_STATUS_CHANGED",
    eventId: "evt-1",
    data: { order: { orderId: "ORD-1", status: "ON_GOING" } },
  },
  "bitrix24-sync": { action: "get_connection_status" },
  "external-companies": { action: "stats" },
  "external-db-bridge": { operation: "select", table: "drivers" },
  "lalamove-gateway": { action: "cities" },
  "mcp-query": { operation: "list_tables" },
  "job-worker": {
    jobId: "9c1f6e2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    type: "lalamove_sync",
    payload: {},
  },
  // `action` pode chegar pela query: o payload validado é o input MESCLADO.
  "lalamove-api": { action: "fetch-order", orderId: "1234567890" },
  "lalamove-uapi": { action: "list-orders", limit: 20, last_id: "" },
};

/** Caso de falha por contrato: payload + campo que deve aparecer em `error.fields`. */
interface FieldCase {
  payload: unknown;
  field: string;
}

/** TIPO INCORRETO (número onde se espera string, enum inválido, etc.). */
const WRONG_TYPE: Record<ContractName, FieldCase> = {
  "lalamove-webhook": { payload: { event: 123 }, field: "event" },
  "evaluate-driver": { payload: { driverId: "d1", rating: "cinco" }, field: "rating" },
  "send-notification": {
    payload: { ...VALID_PAYLOADS["send-notification"], severity: "FATAL" },
    field: "severity",
  },
  "new-device-alert": {
    payload: { ...VALID_PAYLOADS["new-device-alert"], userEmail: 42 },
    field: "userEmail",
  },
  "route-analyzer": { payload: { action: 123 }, field: "action" },
  "check-external-api": { payload: { service: 123 }, field: "service" },
  "test-notification": {
    payload: { channel: "pombo-correio", alertType: "STOP" },
    field: "channel",
  },
  "geo-gateway": { payload: { action: "place-details", place_id: 123 }, field: "place_id" },
  "apply-fixes": { payload: { action: 123 }, field: "action" },
  "bitrix24-process-queue": { payload: { time: 123 }, field: "time" },
  "check-driver-alerts": { payload: { time: 123 }, field: "time" },
  "escalate-alerts": { payload: { time: 123 }, field: "time" },
  "get-mapbox-token": { payload: { healthCheck: "true" }, field: "healthCheck" },
  "lalamove-token-refresh": { payload: { time: 123 }, field: "time" },
  "rotate-tokens": { payload: { source: 123 }, field: "source" },
  "seed-fix-rls": { payload: { time: 123 }, field: "time" },
  "simulate-driver-movement": { payload: { cursor: "1" }, field: "cursor" },
  "llm-wh": { payload: { event: 123 }, field: "event" },
  "bitrix24-sync": {
    payload: { action: "sync_order", orderId: 123, dealId: 42 },
    field: "orderId",
  },
  "external-companies": {
    payload: { action: "list", table: "companies", limit: "cinquenta" },
    field: "limit",
  },
  "external-db-bridge": {
    payload: { operation: "select", table: "drivers", limit: "50" },
    field: "limit",
  },
  "lalamove-gateway": { payload: { action: 123 }, field: "action" },
  "mcp-query": { payload: { operation: 123 }, field: "operation" },
  "job-worker": {
    payload: { jobId: 123, type: "webhook", payload: {} },
    field: "jobId",
  },
  "lalamove-api": {
    payload: { action: "fetch-orders-bulk", orderIds: "1234567890" },
    field: "orderIds",
  },
  "lalamove-uapi": {
    payload: { action: "list-orders", limit: "20" },
    field: "limit",
  },
};

/**
 * VALOR VAZIO (string vazia, `null` em campo não-nulável, zero onde se exige
 * positivo). `null` quando o contrato não tem campo cujo vazio seja inválido.
 */
const EMPTY_VALUE: Record<ContractName, FieldCase | null> = {
  "lalamove-webhook": { payload: { event: "" }, field: "event" },
  "evaluate-driver": { payload: { driverId: "" }, field: "driverId" },
  "send-notification": {
    payload: { ...VALID_PAYLOADS["send-notification"], title: "" },
    field: "title",
  },
  "new-device-alert": {
    payload: { ...VALID_PAYLOADS["new-device-alert"], userEmail: "" },
    field: "userEmail",
  },
  "route-analyzer": { payload: { action: "" }, field: "action" },
  "check-external-api": { payload: { service: "" }, field: "service" },
  "test-notification": { payload: { channel: "", alertType: "STOP" }, field: "channel" },
  "geo-gateway": { payload: { action: "place-details", place_id: "" }, field: "place_id" },
  "apply-fixes": { payload: { action: "" }, field: "action" },
  // Contratos de corpo opcional não leem campo nenhum: `null` em campo tipado
  // é o único "vazio" que o contrato rejeita.
  "bitrix24-process-queue": { payload: { time: 123 }, field: "time" },
  "check-driver-alerts": { payload: { time: 123 }, field: "time" },
  "escalate-alerts": { payload: { time: 123 }, field: "time" },
  "get-mapbox-token": { payload: { healthCheck: null }, field: "healthCheck" },
  "lalamove-token-refresh": { payload: { time: 123 }, field: "time" },
  "rotate-tokens": { payload: { source: 123 }, field: "source" },
  "seed-fix-rls": { payload: { time: 123 }, field: "time" },
  "simulate-driver-movement": { payload: { steps: 0 }, field: "steps" },
  "llm-wh": { payload: { event: "" }, field: "event" },
  "bitrix24-sync": {
    payload: { action: "sync_order", orderId: "", dealId: 42 },
    field: "orderId",
  },
  "external-companies": { payload: { action: "get", table: "companies", id: "" }, field: "id" },
  "external-db-bridge": { payload: { operation: "select", table: "" }, field: "table" },
  "lalamove-gateway": { payload: { action: "   " }, field: "action" },
  "mcp-query": { payload: { operation: "" }, field: "operation" },
  "job-worker": {
    payload: { jobId: "", type: "webhook", payload: {} },
    field: "jobId",
  },
  "lalamove-api": { payload: { action: "fetch-order", orderId: "" }, field: "orderId" },
  "lalamove-uapi": {
    payload: { action: "order-detail", order_uuid: "" },
    field: "order_uuid",
  },
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

// Contratos de corpo OPCIONAL (workers de cron, health check: a Edge Function
// não lê a entrada) aceitam `{}` por definição. Para eles, o caso equivalente a
// "campo obrigatório ausente" é um corpo que NÃO é objeto — array, string ou
// número —, que antes passava adiante sem validação alguma.
const OPTIONAL_BODY = new Set<ContractName>(OPTIONAL_BODY_CONTRACTS);
const NON_OBJECT_BODIES: readonly unknown[] = [[], "x", 42, true];

for (const name of ALL_CONTRACTS) {
  if (OPTIONAL_BODY.has(name)) {
    Deno.test(`[${name}] corpo vazio é aceito (contrato de corpo opcional)`, () => {
      const result = validateContract(getSchema(name, "v1"), {}, "v1");
      assert(result.ok, `esperado ok=true para ${name} com {}`);
    });

    Deno.test(`[${name}] corpo que não é objeto retorna 422 no formato único`, () => {
      for (const body of NON_OBJECT_BODIES) {
        const result = validateContract(getSchema(name, "v1"), body, "v1");
        assert(!result.ok, `esperado 422 para ${name} com ${JSON.stringify(body)}`);
        if (!result.ok) {
          assertEquals(result.status, 422);
          assertEquals(result.body.error.code, ERROR_CODES.VALIDATION_FAILED);
          assert(result.body.error.fields.length > 0);
        }
      }
    });
    continue;
  }

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

// ── Tipos incorretos → 422 nomeando o campo (TODOS os contratos) ─────────────
for (const name of ALL_CONTRACTS) {
  Deno.test(`[${name}] tipo incorreto retorna 422 nomeando o campo`, () => {
    const { payload, field } = WRONG_TYPE[name];
    const result = validateContract(getSchema(name, "v1"), payload, "v1");
    assert(!result.ok, `esperado 422 para ${name} com tipo incorreto`);
    if (!result.ok) {
      assertEquals(result.status, 422);
      assertEquals(result.body.error.code, ERROR_CODES.VALIDATION_FAILED);
      assert(
        result.body.error.fields.some((f) => f.field === field),
        `esperado campo '${field}' em ${name}, veio: ${
          result.body.error.fields.map((f) => f.field).join(", ")
        }`,
      );
    }
  });
}

// ── Valores vazios → 422 nomeando o campo (TODOS os contratos) ───────────────
for (const name of ALL_CONTRACTS) {
  const empty = EMPTY_VALUE[name];
  if (!empty) continue;
  Deno.test(`[${name}] valor vazio retorna 422 nomeando o campo`, () => {
    const result = validateContract(getSchema(name, "v1"), empty.payload, "v1");
    assert(!result.ok, `esperado 422 para ${name} com valor vazio`);
    if (!result.ok) {
      assertEquals(result.status, 422);
      assert(
        result.body.error.fields.some((f) => f.field === empty.field),
        `esperado campo '${empty.field}' em ${name}, veio: ${
          result.body.error.fields.map((f) => f.field).join(", ")
        }`,
      );
    }
  });
}

// ── Mesmo payload inválido → MESMOS campos em v1 e v2 ────────────────────────
for (const name of ALL_CONTRACTS) {
  Deno.test(`[${name}] payload inválido é rejeitado de forma idêntica em v1 e v2`, () => {
    const { payload } = WRONG_TYPE[name];
    const v1 = validateContract(getSchema(name, "v1"), payload, "v1");
    const v2 = validateContract(getSchema(name, "v2"), payload, "v2");
    assert(!v1.ok && !v2.ok, `esperado 422 nas duas versões para ${name}`);
    if (!v1.ok && !v2.ok) {
      assertEquals(v1.status, v2.status);
      assertEquals(v1.body.error.code, v2.body.error.code);
      assertEquals(
        v1.body.error.fields.map((f) => f.field).sort(),
        v2.body.error.fields.map((f) => f.field).sort(),
      );
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

// ── geo-gateway place-details: aceita `mapbox_id` real ───────────────────────
// Os IDs do Search Box e do Geocoding v6 são base64url opacos: 292 caracteres em
// sugestão de rua e ~370 em endereço (medido em produção em 2026-11-22). Com
// max(200) toda seleção de endereço no autocomplete falhava em 422 e nenhuma
// coordenada era gravada.
Deno.test("geo-gateway place-details aceita mapbox_id de 370 caracteres", () => {
  const mapboxId = `mapbox:${"dXJuOm1ieGFkci1pdHA6".repeat(18)}`;
  assert(mapboxId.length > 300);
  const result = validateContract(
    getSchema("geo-gateway", "v1"),
    { action: "place-details", place_id: mapboxId },
    "v1",
  );
  assert(result.ok, `payload com mapbox_id real foi rejeitado: ${JSON.stringify(result)}`);
});

Deno.test("geo-gateway place-details rejeita place_id acima de 1024", () => {
  const result = validateContract(
    getSchema("geo-gateway", "v1"),
    { action: "place-details", place_id: "x".repeat(1025) },
    "v1",
  );
  assert(!result.ok);
});
// ── Casos específicos das Edge Functions recém-cobertas ──────────────────────

Deno.test("[simulate-driver-movement] replay:true sem fixture retorna 422", () => {
  const result = validateContract(
    getSchema("simulate-driver-movement", "v1"),
    { replay: true },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assert(result.body.error.fields.some((f) => f.field === "fixture"));
  }
});

Deno.test("[simulate-driver-movement] replay com fixture válida é aceito", () => {
  const result = validateContract(
    getSchema("simulate-driver-movement", "v1"),
    {
      replay: true,
      fixture: { name: "route_curitiba", points: [{ seq: 0, lat: -25.43, lng: -49.27 }] },
      cursor: 0,
      steps: 1,
    },
    "v1",
  );
  assert(result.ok, JSON.stringify(result));
});

Deno.test("[external-db-bridge] update/delete sem filters retorna 422", () => {
  for (const operation of ["update", "delete"]) {
    const result = validateContract(
      getSchema("external-db-bridge", "v1"),
      { operation, table: "drivers", filters: {} },
      "v1",
    );
    assert(!result.ok, `esperado 422 para ${operation} sem filtros`);
    if (!result.ok) {
      assert(result.body.error.fields.some((f) => f.field === "filters"));
    }
  }
});

Deno.test("[external-db-bridge] null em campo opcional é aceito (handler trata como ausente)", () => {
  const result = validateContract(
    getSchema("external-db-bridge", "v1"),
    {
      operation: "select",
      table: "drivers",
      select: null,
      filters: null,
      order: null,
      limit: null,
      offset: null,
      count_mode: null,
    },
    "v1",
  );
  assert(result.ok, JSON.stringify(result));
});

Deno.test("[mcp-query] operação fora da allowlist retorna 422", () => {
  const result = validateContract(getSchema("mcp-query", "v1"), { operation: "drop_table" }, "v1");
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "operation"));
  }
});

Deno.test("[lalamove-gateway] action acima de 64 caracteres retorna 422", () => {
  const result = validateContract(
    getSchema("lalamove-gateway", "v1"),
    { action: "a".repeat(65) },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "action"));
  }
});

Deno.test("[bitrix24-sync] oauth_callback sem code retorna 422", () => {
  const result = validateContract(
    getSchema("bitrix24-sync", "v1"),
    { action: "oauth_callback" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "code"));
  }
});

Deno.test("[bitrix24-sync] ação desconhecida retorna 422 nomeando action", () => {
  const result = validateContract(
    getSchema("bitrix24-sync", "v1"),
    { action: "drop_everything" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "action"));
  }
});

Deno.test("[external-companies] tabela fora da allowlist retorna 422", () => {
  const result = validateContract(
    getSchema("external-companies", "v1"),
    { action: "list", table: "pg_shadow" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "table"));
  }
});

Deno.test("[external-companies] defaults do contrato (table/limit/offset) são aplicados", () => {
  const result = validateContract(getSchema("external-companies", "v1"), { action: "list" }, "v1");
  assert(result.ok);
  if (result.ok) {
    assertEquals((result.data as Record<string, unknown>).table, "companies");
    assertEquals((result.data as Record<string, unknown>).limit, 50);
    assertEquals((result.data as Record<string, unknown>).offset, 0);
  }
});

Deno.test("[llm-wh] envelope cru da Lalamove passa sem perder campos", () => {
  const envelope = {
    apiKey: "k",
    timestamp: 1775027436,
    signature: "sig",
    eventId: "evt-1",
    eventType: "ORDER_STATUS_CHANGED",
    eventVersion: "v3",
    data: { order: { orderId: "ORD-1" } },
  };
  const result = validateContract(getSchema("llm-wh", "v1"), envelope, "v1");
  assert(result.ok);
  if (result.ok) {
    // passthrough: o proxy repassa o corpo cru, nada é descartado na validação.
    assertEquals(result.data, envelope);
  }
});

Deno.test("[apply-fixes] única ação aceita é fix_dashboard", () => {
  assert(validateContract(getSchema("apply-fixes", "v1"), { action: "fix_dashboard" }, "v1").ok);
  const bad = validateContract(getSchema("apply-fixes", "v1"), { action: "fix_rls" }, "v1");
  assert(!bad.ok);
  if (!bad.ok) assert(bad.body.error.fields.some((f) => f.field === "action"));
});

Deno.test("cobertura: todas as Edge Functions com entrada estão no registro", () => {
  // Guarda contra regressão: as 26 Edge Functions com entrada estão cobertas.
  // Uma função nova sem contrato tem de falhar aqui (e nas fixtures tipadas).
  assertEquals(Object.keys(CONTRACT_REGISTRY).length, 26);
});

// ── lalamove-api: o input validado é query + corpo (a query vence) ───────────
//
// Todo o tráfego vindo da `lalamove-gateway` é GET sem corpo, com `action` e ids
// só na query. Estes casos travam o contrato no formato que a edge monta ANTES
// de validar; sem eles, o teste genérico de "corpo vazio → 422" canonizaria
// justamente o payload que funciona em produção.
Deno.test("[lalamove-api] action vinda apenas da query é aceita", () => {
  for (const action of ["cities", "sync"]) {
    const merged = { ...{}, action }; // corpo {} + query ?action=
    const result = validateContract(getSchema("lalamove-api", "v1"), merged, "v1");
    assert(result.ok, `esperado ok para action=${action}: ${JSON.stringify(result)}`);
  }
});

Deno.test("[lalamove-api] orderId vindo apenas da query é aceito", () => {
  const merged = { action: "cancel", orderId: "LAL-123", reason: "OTHER" };
  const result = validateContract(getSchema("lalamove-api", "v1"), merged, "v1");
  assert(result.ok, JSON.stringify(result));
});

Deno.test("[lalamove-api] priority-fee aceita `fee` (nome usado pelo gateway)", () => {
  const okFee = validateContract(
    getSchema("lalamove-api", "v1"),
    { action: "priority-fee", orderId: "LAL-1", fee: "5" },
    "v1",
  );
  assert(okFee.ok, JSON.stringify(okFee));
  const semValor = validateContract(
    getSchema("lalamove-api", "v1"),
    { action: "priority-fee", orderId: "LAL-1" },
    "v1",
  );
  assert(!semValor.ok);
  if (!semValor.ok) assert(semValor.body.error.fields.some((f) => f.field === "amount"));
});

Deno.test("[lalamove-api] telefone fora de E.164 em `order` retorna 422 nomeando o campo", () => {
  const result = validateContract(
    getSchema("lalamove-api", "v1"),
    {
      action: "order",
      quotationId: "q1",
      sender: { stopId: "s1", name: "Remetente", phone: "11999998888" },
      recipients: [{ stopId: "s2", name: "Destino", phone: "+5511999998888" }],
    },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) {
    assert(result.body.error.fields.some((f) => f.field === "sender.phone"));
  }
});

Deno.test("[lalamove-api] coordenadas em string (como o front envia) são aceitas", () => {
  const result = validateContract(
    getSchema("lalamove-api", "v1"),
    {
      action: "quotation",
      serviceType: "LALAGO",
      stops: [
        { address: "A", coordinates: { lat: "-25.42", lng: "-49.27" } },
        { address: "B", coordinates: { lat: "-25.43", lng: "-49.28" } },
      ],
    },
    "v1",
  );
  assert(result.ok, JSON.stringify(result));
});

// ── job-worker: contrato valida SÓ o envelope ────────────────────────────────
//
// As regras por tipo continuam dentro de processJob: um 422 antes dele não passa
// por `mark_job_failed` e deixaria o job em loop PROCESSING→PENDING.
Deno.test("[job-worker] tipo desconhecido passa o contrato (falha dentro do worker)", () => {
  const result = validateContract(
    getSchema("job-worker", "v1"),
    { jobId: "job-1", type: "tipo_inexistente", payload: {} },
    "v1",
  );
  assert(result.ok, JSON.stringify(result));
});

Deno.test("[job-worker] pod_fetch sem orderId passa o contrato (falha dentro do worker)", () => {
  const result = validateContract(
    getSchema("job-worker", "v1"),
    { jobId: "job-2", type: "pod_fetch", payload: {} },
    "v1",
  );
  assert(result.ok, JSON.stringify(result));
});

Deno.test("[job-worker] payload ausente retorna 422 nomeando o campo", () => {
  const result = validateContract(
    getSchema("job-worker", "v1"),
    { jobId: "job-3", type: "webhook" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) assert(result.body.error.fields.some((f) => f.field === "payload"));
});

// ── lalamove-uapi ────────────────────────────────────────────────────────────
Deno.test("[lalamove-uapi] ids da UAPI aceitam string e número", () => {
  for (const orderUuid of ["abc-123", 987654321]) {
    const result = validateContract(
      getSchema("lalamove-uapi", "v1"),
      { action: "order-detail", order_uuid: orderUuid },
      "v1",
    );
    assert(result.ok, `order_uuid=${orderUuid}: ${JSON.stringify(result)}`);
  }
});

Deno.test("[lalamove-uapi] ação inexistente retorna 422 nomeando action", () => {
  const result = validateContract(
    getSchema("lalamove-uapi", "v1"),
    { action: "drop-table" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) assert(result.body.error.fields.some((f) => f.field === "action"));
});

Deno.test("[lalamove-uapi] set-token exige access_token e refresh_token", () => {
  const result = validateContract(
    getSchema("lalamove-uapi", "v1"),
    { action: "set-token", access_token: "a" },
    "v1",
  );
  assert(!result.ok);
  if (!result.ok) assert(result.body.error.fields.some((f) => f.field === "refresh_token"));
});
