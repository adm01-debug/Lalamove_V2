// ============================================================================
// Testes de INTEGRAÇÃO I/O REAIS — chamam as Edge Functions IMPLANTADAS via
// HTTP e validam, contra o runtime real:
//
//   1. 422  → payload sem campo obrigatório retorna o formato único de erro.
//   2. Tipos → payload com tipo/enum incorreto retorna 422 nomeando o campo.
//   3. Compatibilidade retroativa → o mesmo payload inválido é rejeitado de
//      forma IDÊNTICA sob os headers v1 e v2 (v2 é superset estrito de v1, não
//      afrouxa validação); e, para funções sem efeitos colaterais, um payload
//      v1 válido continua aceito sob o header v2.
//
// Diferença para contract.test.ts: aquele valida a camada de contrato em
// memória (sem I/O). Este exercita o endpoint REAL implantado.
//
// Segurança de execução: para as funções que disparam efeitos colaterais
// (e-mail, IA, notificações) SÓ enviamos payloads INVÁLIDOS — que falham na
// validação ANTES de qualquer efeito. A aceitação de payload válido só é
// exercida em funções idempotentes/read-only (evaluate-driver, check-external-api).
//
// Executar:
//   deno test --allow-net --allow-env supabase/functions/_shared/contract.integration.test.ts
// ============================================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ERROR_CODES } from "./contract.ts";
import type { ContractName } from "./schemas.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

assertExists(SUPABASE_URL, "VITE_SUPABASE_URL ausente no .env");
assertExists(ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY ausente no .env");

// ── Cliente HTTP ──────────────────────────────────────────────────────────────

interface InvokeResult {
  status: number;
  body: Record<string, unknown>;
}

async function invoke(
  fn: ContractName,
  payload: unknown,
  opts: { version?: "v1" | "v2"; headers?: Record<string, string> } = {},
): Promise<InvokeResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
    ...opts.headers,
  };
  if (opts.version) headers["x-contract-version"] = opts.version;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text(); // sempre consumir o corpo (evita leak no Deno)
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

/** Extrai o objeto de erro no formato único, se presente. */
function errorEnvelope(
  body: Record<string, unknown>,
): { code?: string; message?: string; fields?: Array<{ field?: string }> } | null {
  const err = body["error"];
  if (err && typeof err === "object") {
    return err as { code?: string; message?: string; fields?: Array<{ field?: string }> };
  }
  return null;
}

// ── Matriz de casos por função ────────────────────────────────────────────────
// - missing:   payload sem campo obrigatório (deve → 422)
// - wrongType: payload com tipo/enum incorreto (deve → 422), + campo esperado
// - validSafe: payload v1 válido SEM efeitos colaterais (só p/ funções seguras)

interface FnCase {
  fn: ContractName;
  missing: unknown;
  wrongType: unknown;
  wrongTypeField: string;
  /** payload válido idempotente/read-only; ausente = não testar aceitação I/O */
  validSafe?: unknown;
}

const CASES: FnCase[] = [
  {
    fn: "evaluate-driver",
    missing: {},
    wrongType: { driverId: "d1", rating: "cinco" },
    wrongTypeField: "rating",
    validSafe: { driverId: "__inexistente_integration_test__" },
  },
  {
    fn: "check-external-api",
    missing: {},
    wrongType: { service: 12345 },
    wrongTypeField: "service",
    validSafe: { service: "mapbox" },
  },
  {
    fn: "send-notification",
    missing: {},
    wrongType: {
      alert_id: "a1",
      type: "STOP",
      severity: "FATAL", // enum inválido
      title: "t",
      message: "m",
    },
    wrongTypeField: "severity",
  },
  {
    fn: "new-device-alert",
    missing: {},
    wrongType: {
      userId: "u1",
      userEmail: "nao-e-email",
      deviceFingerprint: "fp",
      ipAddress: "1.2.3.4",
      userAgent: "UA",
    },
    wrongTypeField: "userEmail",
  },
  {
    fn: "route-analyzer",
    missing: {},
    wrongType: { action: "acao-inexistente" },
    wrongTypeField: "action",
    needsLovableKey: true, // LOVABLE_API_KEY precisa estar configurada na Edge Function
  },
  {
    fn: "test-notification",
    missing: {},
    wrongType: { channel: "sms", alertType: "STOP" }, // canal fora do enum
    wrongTypeField: "channel",
  },
];

// ── 1. Campo ausente → 422 no formato único ───────────────────────────────────

for (const c of CASES) {
  if (c.needsLovableKey && !Deno.env.get("LOVABLE_API_KEY")) {
    console.log(`[skip] ${c.fn}: LOVABLE_API_KEY não configurada no ambiente da Edge Function`);
    return;
  }
  Deno.test(`[I/O][${c.fn}] campo ausente → 422 formato único`, async () => {
    const { status, body } = await invoke(c.fn, c.missing);
    assertEquals(status, 422, `esperado 422, recebido ${status} (${JSON.stringify(body)})`);
    const err = errorEnvelope(body);
    assertExists(err, "resposta deve conter objeto error");
    assertEquals(err!.code, ERROR_CODES.VALIDATION_FAILED);
    assert(Array.isArray(err!.fields) && err!.fields!.length > 0, "deve listar campos inválidos");
  });
}

// ── 2. Tipo/enum incorreto → 422 nomeando o campo ─────────────────────────────

for (const c of CASES) {
  if (c.needsLovableKey && !Deno.env.get("LOVABLE_API_KEY")) {
    console.log(`[skip] ${c.fn}: LOVABLE_API_KEY não configurada`);
    return;
  }
  Deno.test(`[I/O][${c.fn}] tipo incorreto → 422 no campo ${c.wrongTypeField}`, async () => {
    const { status, body } = await invoke(c.fn, c.wrongType);
    assertEquals(status, 422, `esperado 422, recebido ${status} (${JSON.stringify(body)})`);
    const err = errorEnvelope(body);
    assertExists(err);
    assertEquals(err!.code, ERROR_CODES.VALIDATION_FAILED);
    assert(
      err!.fields!.some((f) => f.field === c.wrongTypeField),
      `esperado erro no campo '${c.wrongTypeField}', campos: ${JSON.stringify(err!.fields)}`,
    );
  });
}

// ── 3a. Compat retroativa: v2 NÃO afrouxa (mesmo inválido → 422 idêntico) ──────

for (const c of CASES) {
  if (c.needsLovableKey && !Deno.env.get("LOVABLE_API_KEY")) {
    console.log(`[skip] ${c.fn}: LOVABLE_API_KEY não configurada`);
    return;
  }
  Deno.test(`[I/O][${c.fn}] compat: v1 e v2 rejeitam o inválido identicamente`, async () => {
    const v1 = await invoke(c.fn, c.missing, { version: "v1" });
    const v2 = await invoke(c.fn, c.missing, { version: "v2" });

    assertEquals(v1.status, 422);
    assertEquals(v2.status, 422);

    const e1 = errorEnvelope(v1.body);
    const e2 = errorEnvelope(v2.body);
    assertExists(e1);
    assertExists(e2);
    // v2 é superset estrito: o mesmo conjunto de campos obrigatórios continua exigido.
    assertEquals(e1!.code, e2!.code);
    const f1 = (e1!.fields ?? []).map((f) => f.field).sort();
    const f2 = (e2!.fields ?? []).map((f) => f.field).sort();
    assertEquals(f1, f2, "v2 não deve alterar os campos obrigatórios de v1");
  });
}

// ── 3b. Compat retroativa: payload v1 válido continua aceito sob v2 ────────────
//        (apenas funções idempotentes/read-only, sem efeitos colaterais)

for (const c of CASES) {
  if (c.validSafe === undefined) continue;
  Deno.test(`[I/O][${c.fn}] compat: payload v1 válido é aceito sob header v2 (não-422)`, async () => {
    const { status, body } = await invoke(c.fn, c.validSafe, { version: "v2" });
    // Pode retornar 200 ou um erro de domínio (ex.: recurso inexistente),
    // mas JAMAIS 422 de validação de contrato.
    assert(status !== 422, `payload válido não deveria gerar 422 (body: ${JSON.stringify(body)})`);
    const err = errorEnvelope(body);
    if (err) {
      assert(
        err.code !== ERROR_CODES.VALIDATION_FAILED,
        `payload válido não deveria falhar validação de contrato (${JSON.stringify(err)})`,
      );
    }
  });
}

// ── 4. lalamove-webhook: gate de segurança precede o contrato ─────────────────
//        O IP do runner não é confiável → 403 antes da validação de payload.
//        A cobertura de 422/tipos/compat do webhook vive em contract.test.ts
//        (validação em memória), pois o gate impede o I/O real de alcançá-la.

Deno.test("[I/O][lalamove-webhook] gate de IP rejeita origem não confiável (403)", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/lalamove-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      "x-forwarded-for": "203.0.113.7", // IP público não presente na allowlist
    },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  assert(
    [401, 403].includes(res.status),
    `esperado gate de segurança (401/403), recebido ${res.status}: ${text}`,
  );
});

// ── 5. CORS preflight responde em todas as funções ────────────────────────────

for (const c of CASES) {
  Deno.test(`[I/O][${c.fn}] preflight OPTIONS responde com CORS`, async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${c.fn}`, { method: "OPTIONS" });
    await res.text();
    assert(res.status >= 200 && res.status < 300, `preflight status ${res.status}`);
    assertExists(res.headers.get("access-control-allow-origin"));
  });
}
