// ============================================================================
// Schemas de Contrato — Fonte única de verdade para os payloads de TODOS os
// webhooks e Edge Functions. Versionados (v1/v2) para permitir evolução com
// compatibilidade retroativa.
//
// Convenção de versionamento:
//  - v1: contrato original, mantido por retrocompatibilidade.
//  - v2: contrato evoluído. Campos novos DEVEM ser opcionais ou ter default
//        para que um payload v1 válido continue válido em v2 (superset).
// ============================================================================

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type { ContractVersion } from "./contract.ts";

// ── lalamove-webhook ─────────────────────────────────────────────────────────

const lalamoveWebhookV1 = z.object({
  event: z.string().min(1, "event é obrigatório"),
  orderId: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  data: z.unknown().optional(),
});

// v2: adiciona apiVersion opcional e eventId de idempotência (superset de v1)
const lalamoveWebhookV2 = lalamoveWebhookV1.extend({
  apiVersion: z.string().optional(),
  eventId: z.string().optional(),
});

// ── evaluate-driver ──────────────────────────────────────────────────────────

const evaluateDriverV1 = z.object({
  driverId: z.string().min(1, "driverId é obrigatório"),
  orderId: z.string().uuid().optional().nullable(),
  triggeredBy: z.enum(["WEBHOOK", "MANUAL", "SYSTEM"]).default("WEBHOOK"),
  driverName: z.string().optional().nullable(),
  totalDeliveries: z.number().nonnegative().optional().nullable(),
  completedDeliveries: z.number().nonnegative().optional().nullable(),
  failedDeliveries: z.number().nonnegative().optional().nullable(),
  cancelledDeliveries: z.number().nonnegative().optional().nullable(),
  avgDelayMinutes: z.number().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
});

const evaluateDriverV2 = evaluateDriverV1.extend({
  // v2 aceita janela de análise explícita, mantendo compat com v1
  windowDays: z.number().int().positive().max(365).optional(),
});

// ── send-notification ────────────────────────────────────────────────────────

const sendNotificationV1 = z.object({
  alert_id: z.string().min(1, "alert_id é obrigatório"),
  type: z.string().min(1, "type é obrigatório"),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  title: z.string().min(1, "title é obrigatório"),
  message: z.string().min(1, "message é obrigatório"),
  order_id: z.string().optional().nullable(),
  driver_id: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  // Deduplication & escalation controls (multi-channel alerting)
  dedup_key: z.string().optional().nullable(),
  skip_dedup: z.boolean().optional().nullable(),
  is_escalation: z.boolean().optional().nullable(),
});

const sendNotificationV2 = sendNotificationV1.extend({
  channels: z
    .array(z.enum(["whatsapp", "email", "slack", "bitrix24", "n8n"]))
    .optional(),
  // Etapa 66: destinatários do pedido no corpo (o v1 só aceitava via
  // `metadata.recipients`). São **unidos** aos de `alert_configurations`,
  // nunca substitutos — ver `send-notification/recipients.ts`.
  recipients: z
    .array(
      z.object({
        channel: z.enum(["whatsapp", "email", "sms", "slack", "n8n"]),
        to: z.string().min(1),
        role: z.enum(["pickup_contact", "delivery_contact", "internal"]).optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
});

// ── new-device-alert ─────────────────────────────────────────────────────────

const newDeviceAlertV1 = z.object({
  userId: z.string().min(1, "userId é obrigatório"),
  userEmail: z.string().email("userEmail inválido"),
  deviceFingerprint: z.string().min(1, "deviceFingerprint é obrigatório"),
  ipAddress: z.string().min(1, "ipAddress é obrigatório"),
  userAgent: z.string().min(1, "userAgent é obrigatório"),
  browser: z.string().optional().nullable(),
  os: z.string().optional().nullable(),
  locationCity: z.string().optional().nullable(),
  locationCountry: z.string().optional().nullable(),
});

const newDeviceAlertV2 = newDeviceAlertV1; // sem mudanças estruturais em v2

// ── route-analyzer ───────────────────────────────────────────────────────────

const routeAnalyzerV1 = z.object({
  action: z.enum([
    "analyze-routes",
    "analyze-order",
    "analyze-drivers",
    "analyze-alerts",
  ]),
  message: z.string().optional(),
  orderId: z.string().uuid().optional(),
});

const routeAnalyzerV2 = routeAnalyzerV1;

// ── check-external-api ───────────────────────────────────────────────────────

const checkExternalApiV1 = z.object({
  service: z.string().min(1, "service é obrigatório"),
});

const checkExternalApiV2 = checkExternalApiV1;

// ── test-notification ────────────────────────────────────────────────────────

const testNotificationV1 = z.object({
  channel: z.enum(["whatsapp", "email", "slack", "bitrix24", "n8n"]),
  alertType: z.string().min(1, "alertType é obrigatório"),
  recipients: z.array(z.string()).optional(),
  webhookUrl: z.string().url().optional(),
});

const testNotificationV2 = testNotificationV1;

// ── geo-gateway (camada de provedor de mapas: Google / Mapbox) ──────────────

const geoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const geoProvider = z.enum(["google", "mapbox"]).optional(); // força um provedor (admin/testes)
const geoBias = geoPoint.extend({ radius_m: z.number().int().positive().max(200_000).optional() }).optional();

const geoGatewayV1 = z.discriminatedUnion("action", [
  z.object({ action: z.literal("provider-status"), provider: geoProvider }),
  z.object({ action: z.literal("count-map-load"), provider: z.enum(["google", "mapbox"]) }),
  z.object({
    action: z.literal("autocomplete"),
    input: z.string().min(1).max(256),
    session_token: z.string().min(8).max(64).optional(),
    bias: geoBias,
    country: z.string().length(2).optional(),
    language: z.string().min(2).max(5).optional(),
    limit: z.number().int().min(1).max(10).optional(),
    // Etapa 22: troca o Search Box pelo Geocoding v6 `autocomplete=true`.
    mode: z.enum(["searchbox", "geocoding"]).optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("place-details"),
    // Os `mapbox_id` do Search Box/Geocoding v6 são base64url opacos e variam com o
    // tamanho do endereço: 70 chars em SP (rodovia/POI) e até 574 em Curitiba/Goiânia
    // (endereço completo com distrito e CEP), medido em produção em 2026-11-22. Com
    // max(200) o retrieve de endereço fora de SP falhava em 422 e a seleção no
    // autocomplete nunca gravava coordenada.
    place_id: z.string().min(3).max(1024),
    session_token: z.string().min(8).max(64).optional(),
    // Etapa 22: no modo geocoding o v6 não tem retrieve por id — o detalhe vem de `address`.
    mode: z.enum(["searchbox", "geocoding"]).optional(),
    address: z.string().min(3).max(300).optional(),
    country: z.string().length(2).optional(),
    language: z.string().min(2).max(5).optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("geocode"),
    address: z.string().min(3).max(300).optional(),
    structured: z.object({
      address_line1: z.string().max(200).optional(),
      postal_code: z.string().max(20).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      country: z.string().length(2).optional(),
    }).optional(),
    bias: geoBias,
    country: z.string().length(2).optional(),
    language: z.string().min(2).max(5).optional(),
    limit: z.number().int().min(1).max(10).optional(),
    persist: z.boolean().optional(),
    provider: geoProvider,
  }), // address OU structured: o provedor devolve GEO_INVALID_INPUT quando ambos faltam
  z.object({
    // Etapa 25: lote de até 50 consultas por chamada. Cada item aceita o mesmo formato do
    // `geocode` unitário; o retorno preserva a ordem e cada item falha sozinho.
    action: z.literal("geocode-batch"),
    queries: z.array(z.object({
      address: z.string().min(3).max(300).optional(),
      structured: z.object({
        address_line1: z.string().max(200).optional(),
        postal_code: z.string().max(20).optional(),
        city: z.string().max(100).optional(),
        state: z.string().max(100).optional(),
        country: z.string().length(2).optional(),
      }).optional(),
      bias: geoBias,
      country: z.string().length(2).optional(),
      language: z.string().min(2).max(5).optional(),
      limit: z.number().int().min(1).max(10).optional(),
    })).min(1).max(50),
    persist: z.boolean().optional(), // default true: o caso de uso é backfill
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("reverse"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    language: z.string().min(2).max(5).optional(),
    persist: z.boolean().optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("route"),
    origin: geoPoint,
    destination: geoPoint,
    waypoints: z.array(geoPoint).max(23).optional(),
    profile: z.enum(["driving-traffic", "driving", "walking", "cycling"]).optional(),
    traffic: z.boolean().optional(),
    alternatives: z.boolean().optional(),
    language: z.string().min(2).max(5).optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("matrix"),
    origins: z.array(geoPoint).min(1).max(25),
    destinations: z.array(geoPoint).min(1).max(25),
    profile: z.enum(["driving-traffic", "driving", "walking", "cycling"]).optional(),
    traffic: z.boolean().optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("static"),
    width: z.number().int().min(100).max(1280).optional(),
    height: z.number().int().min(100).max(1280).optional(),
    markers: z.array(geoPoint.extend({ color: z.string().max(7).optional(), label: z.string().max(10).optional() })).max(10).optional(),
    path: z.array(geoPoint).max(2000).optional(),
    center: geoPoint.optional(),
    zoom: z.number().min(1).max(20).optional(),
    style: z.string().max(60).optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("snap"),
    points: z.array(geoPoint).min(2).max(100),
    timestamps: z.array(z.number().int()).max(100).optional(),
    radius_m: z.number().int().min(1).max(50).optional(),
    provider: geoProvider,
  }),
  // Etapa 38: Address Validation. Google-only (o Mapbox não tem equivalente; o gateway
  // devolve 501 quando o provedor ativo é o Mapbox).
  z.object({
    action: z.literal("validate"),
    address: z.string().min(3).max(300),
    region: z.string().length(2).optional(),
    language: z.string().min(2).max(5).optional(),
    provider: geoProvider,
  }),
  // Mapbox-only: pass-through validado só no essencial (a tela /map-tools já monta o body)
  z.object({ action: z.literal("isochrone"), lat: z.number(), lng: z.number() }).passthrough(),
  z.object({ action: z.literal("optimization"), coordinates: z.array(z.array(z.number()).length(2)).min(2).max(12) }).passthrough(),
  z.object({ action: z.literal("tilequery"), lat: z.number(), lng: z.number() }).passthrough(),
]);

const geoGatewayV2 = geoGatewayV1;

// ── Edge Functions que NÃO leem o corpo (workers de cron, health check) ──────
//
// Antes desta camada, um corpo inesperado nessas funções passava adiante sem
// validação (ou derrubava a função em 500, quando `req.json()` falhava). O
// contrato aqui é "objeto JSON, ou corpo vazio": `{}` é válido e um corpo que
// não seja objeto (array, string, número) devolve 422 no formato único.
// `time` é o campo que o pg_cron envia em `jsonb_build_object('time', now())`
// (supabase/migrations/20261122140000_fix_crons_dispatcher.sql).
const cronWorkerBody = z
  .object({
    time: z.string().optional().nullable(),
  })
  .passthrough();

// apply-fixes — `action` é o único campo lido (index.ts:19) e só aceita uma ação.
const applyFixesV1 = z.object({
  action: z.literal("fix_dashboard"),
});
const applyFixesV2 = applyFixesV1;

// bitrix24-process-queue — processa a fila; o corpo é ignorado (index.ts:17-29).
const bitrix24ProcessQueueV1 = cronWorkerBody;
const bitrix24ProcessQueueV2 = bitrix24ProcessQueueV1;

// check-driver-alerts — cron a cada 2 min; o corpo é ignorado.
const checkDriverAlertsV1 = cronWorkerBody;
const checkDriverAlertsV2 = checkDriverAlertsV1;

// escalate-alerts — cron a cada 5 min; o corpo é ignorado.
const escalateAlertsV1 = cronWorkerBody;
const escalateAlertsV2 = escalateAlertsV1;

// lalamove-token-refresh — cron horário; o corpo é ignorado.
const lalamoveTokenRefreshV1 = cronWorkerBody;
const lalamoveTokenRefreshV2 = lalamoveTokenRefreshV1;

// rotate-tokens — rotação agendada; o corpo é ignorado.
const rotateTokensV1 = cronWorkerBody.extend({
  source: z.string().optional(),
});
const rotateTokensV2 = rotateTokensV1;

// seed-fix-rls — script legado; o corpo é ignorado (index.ts:8-120).
const seedFixRlsV1 = cronWorkerBody;
const seedFixRlsV2 = seedFixRlsV1;

// get-mapbox-token — devolve o token; `healthCheck` é o único campo que algum
// chamador envia hoje (src/hooks/healthChecks.ts:49) e a edge não o lê.
const getMapboxTokenV1 = cronWorkerBody.extend({
  healthCheck: z.boolean().optional(),
});
const getMapboxTokenV2 = getMapboxTokenV1;

// simulate-driver-movement — só em ambiente de desenvolvimento. O corpo é lido
// desde o replay determinístico de trajeto (index.ts:39-43, 106-116): com
// `replay: true` a fixture é obrigatória, como o próprio handler exige (:109).
const simulateReplayPoint = z
  .object({
    seq: z.number(),
    lat: z.number(),
    lng: z.number(),
    speed_kmh: z.number().optional(),
    heading: z.number().optional(),
    elapsed_s: z.number().optional(),
  })
  .passthrough();

const simulateReplayFixture = z
  .object({
    name: z.string().min(1, "fixture.name é obrigatório"),
    vehicle_type: z.string().optional(),
    total_distance_m: z.number().optional(),
    points: z.array(simulateReplayPoint).min(1, "fixture.points não pode ser vazio"),
  })
  .passthrough();

const simulateDriverMovementV1 = cronWorkerBody
  .extend({
    replay: z.boolean().optional(),
    fixture: simulateReplayFixture.optional().nullable(),
    cursor: z.number().int().nonnegative().optional(),
    steps: z.number().int().positive().optional(),
  })
  .refine((v) => !v.replay || Boolean(v.fixture), {
    message: "replay:true exige `fixture` no corpo (route_curitiba.json)",
    path: ["fixture"],
  });
const simulateDriverMovementV2 = simulateDriverMovementV1;

// ── bitrix24-sync ────────────────────────────────────────────────────────────
//
// `action` é o discriminador (index.ts:44). `oauth_callback` recebe `code` e
// `domain` pela QUERY (index.ts:71-72), por isso a edge mescla os parâmetros no
// input antes de validar.
const bitrix24SyncV1 = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("get_auth_url"),
    domain: z.string().optional(),
  }),
  z.object({
    action: z.literal("oauth_callback"),
    code: z.string().min(1, "code é obrigatório"),
    domain: z.string().optional(),
  }),
  z.object({ action: z.literal("refresh_token") }),
  // Espelha o z.object inline que já existia em index.ts:159-162.
  z.object({
    action: z.literal("sync_order"),
    orderId: z.string().uuid("orderId deve ser um UUID"),
    dealId: z.union([z.string().min(1, "dealId é obrigatório"), z.number()]),
  }),
  z.object({ action: z.literal("get_connection_status") }),
  z.object({ action: z.literal("get_deals") }),
  z.object({ action: z.literal("disconnect") }),
]);
const bitrix24SyncV2 = bitrix24SyncV1;

// ── external-companies ───────────────────────────────────────────────────────
//
// `table` tem allowlist no próprio handler (index.ts:29) e `get` exige `id`
// (index.ts:74-76). `id: 0` é rejeitado porque o handler trata falsy como ausente.
const externalCompaniesTable = z
  .enum(["companies", "customers", "suppliers", "carriers", "contacts", "supplier_branches"])
  .default("companies");

const externalCompaniesV1 = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    table: externalCompaniesTable,
    search: z.string().optional().nullable(),
    limit: z.number().int().positive().max(200).default(50),
    offset: z.number().int().nonnegative().default(0),
  }),
  z.object({
    action: z.literal("get"),
    table: externalCompaniesTable,
    id: z.union([
      z.string().min(1, "id é obrigatório"),
      z.number().refine((n) => n !== 0, "id é obrigatório"),
    ]),
  }),
  z.object({
    action: z.literal("search_address"),
    search: z.string().optional().nullable(),
    limit: z.number().int().positive().max(200).default(20),
  }),
  z.object({
    action: z.literal("schema"),
    table: externalCompaniesTable,
  }),
  z.object({ action: z.literal("stats") }),
]);
const externalCompaniesV2 = externalCompaniesV1;

// ── external-db-bridge ───────────────────────────────────────────────────────
//
// `operation` é o discriminador (index.ts:245-248). Os campos opcionais usam
// `.nullish()` porque o handler trata `null` como ausente (index.ts:138-153), e
// `update`/`delete` exigem `filters` não vazio para não varrer a tabela inteira.
const externalDbBridgeRow = z.record(z.unknown());
const externalDbBridgeFilters = z.record(z.unknown());
const externalDbBridgeRequiredFilters = externalDbBridgeFilters.refine(
  (f) => Object.keys(f).length > 0,
  "filters é obrigatório e não pode ser vazio",
);

const externalDbBridgeV1 = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("select"),
    table: z.string().min(1, "table é obrigatório"),
    select: z.string().nullish(),
    filters: externalDbBridgeFilters.nullish(),
    order: z
      .object({
        column: z.string().min(1, "order.column é obrigatório"),
        ascending: z.boolean().optional(),
      })
      .nullish(),
    limit: z.number().int().nonnegative().nullish(),
    offset: z.number().int().nonnegative().nullish(),
    count_mode: z.enum(["exact", "planned", "estimated"]).nullish(),
  }),
  z.object({
    operation: z.literal("insert"),
    table: z.string().min(1, "table é obrigatório"),
    body: z.union([externalDbBridgeRow, z.array(externalDbBridgeRow)]).optional(),
  }),
  z.object({
    operation: z.literal("update"),
    table: z.string().min(1, "table é obrigatório"),
    filters: externalDbBridgeRequiredFilters,
    body: externalDbBridgeRow.optional(),
  }),
  z.object({
    operation: z.literal("delete"),
    table: z.string().min(1, "table é obrigatório"),
    filters: externalDbBridgeRequiredFilters,
  }),
  z.object({
    operation: z.literal("rpc"),
    rpc_name: z.string().min(1, "rpc_name é obrigatório"),
    body: externalDbBridgeRow.nullish(),
    table: z.string().nullish(),
  }),
]);
const externalDbBridgeV2 = externalDbBridgeV1;

// ── mcp-query ────────────────────────────────────────────────────────────────
//
// `operation` espelha a allowlist de `mcp_introspect` (index.ts:20-45);
// `params` é saneado depois (index.ts:84-110), por isso sem `.passthrough()`.
const mcpQueryV1 = z.object({
  operation: z.enum([
    "connection_info",
    "list_tables",
    "list_columns",
    "list_views",
    "list_enums",
    "list_extensions",
    "list_indexes",
    "list_functions",
    "list_triggers",
    "list_policies",
    "constraints",
    "relationships",
    "sequences",
    "migrations",
    "db_stats",
    "active_queries",
    "slow_queries",
    "locks",
    "disk_usage",
    "table_bloat",
    "index_usage",
    "seq_scans",
    "duplicate_indexes",
    "column_stats",
    "pg_settings",
  ]),
  params: z
    .object({
      schema: z.string().max(128).optional(),
      table: z.string().max(128).optional(),
      column: z.string().max(128).optional(),
      filter: z.string().max(128).optional(),
      // index.ts:104 usa Number(src.limit): string numérica é aceita e o clamp
      // 1..200 continua no handler.
      limit: z.union([z.number(), z.string()]).optional(),
    })
    .optional()
    .nullable(),
});
const mcpQueryV2 = mcpQueryV1;

// ── lalamove-gateway ─────────────────────────────────────────────────────────
//
// Espelha a interface GatewayRequest (index.ts:24-30). `action` fica string
// livre (≤64) porque o roteamento é feito por `route.ts` e pelos proxies.
const lalamoveGatewayV1 = z.object({
  action: z
    .string()
    .trim()
    .min(1, "action é obrigatório")
    .max(64, "action deve ter no máximo 64 caracteres"),
  target: z.enum(["unified", "uapi"]).optional(),
  params: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  method: z.enum(["GET", "POST"]).optional(),
});
const lalamoveGatewayV2 = lalamoveGatewayV1;

// ── llm-wh ───────────────────────────────────────────────────────────────────
//
// Proxy do webhook da Lalamove: repassa o corpo CRU (o HMAC é calculado sobre os
// bytes originais), então o contrato só garante "objeto JSON" — nenhum campo é
// lido aqui. A validação roda sobre o texto já lido, sem reconsumir o stream.
const llmWhV1 = z
  .object({
    apiKey: z.string().optional(),
    timestamp: z.union([z.number(), z.string()]).optional().nullable(),
    signature: z.string().optional(),
    eventId: z.string().optional(),
    eventType: z.string().optional(),
    eventVersion: z.string().optional(),
    event: z.string().min(1, "event não pode ser vazio").optional(),
    orderId: z.string().optional().nullable(),
    data: z.unknown().optional(),
  })
  .passthrough();
const llmWhV2 = llmWhV1;

// ── job-worker ───────────────────────────────────────────────────────────────
// Envelope montado por process_job_queue() (pg_cron, 1 min) a partir de job_queue:
// { jobId, type, payload, metadata } — migration 20261123160000_job_queue_processing_log.sql:111-125.
//
// Por que o contrato valida SÓ o envelope e não o shape por tipo:
// `mark_job_processing` não incrementa `attempts` (20261122120200_job_queue_system.sql:105-111) e o
// requeue de PROCESSING>10min só marca FAILED quando `attempts >= max_attempts`
// (20261123160000_job_queue_processing_log.sql:87-96). Logo um 422 devolvido ANTES de processJob()
// nunca passa por `mark_job_failed` (job-worker/index.ts:1116, só alcançado pelo catch de processJob)
// e deixa o job em loop PROCESSING→PENDING→PROCESSING para sempre. Toda regra de negócio
// (pod_fetch exige orderId — index.ts:215; geo_backfill exige addresses[] — index.ts:276; tipo
// desconhecido — index.ts:1078) tem de continuar sendo `throw` DENTRO de processJob, que grava
// error_message e termina em FAILED após max_attempts.
// Os 12 tipos aceitos ficam no CHECK job_queue_type_check (20261122130100_geo_foundation.sql:270-272)
// e no switch de index.ts:1027-1079: webhook, notification, evaluation, bitrix_sync, email, whatsapp,
// slack, lalamove_sync, pod_fetch, geo_backfill, route_plan, eta_refresh.

// `job_queue.payload` é jsonb NOT NULL sem checagem de tipo (20261122120200:20); o handler só exige
// a chave presente (index.ts:1158). Qualquer valor JSON é aceito: um payload absurdo falha dentro de
// processJob (→ mark_job_failed → FAILED), nunca em 422.
const jobWorkerPayload = z.union(
  [
    z.object({}).passthrough(),
    z.array(z.unknown()),
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
  ],
  // o invalid_union do zod viraria "Invalid input" no 422; a fila precisa do motivo legível.
  { errorMap: () => ({ message: "payload é obrigatório (qualquer valor JSON)" }) },
);

const jobWorkerV1 = z
  .object({
    // uuid de job_queue.id: exigido pelas rpc mark_job_completed/mark_job_failed (p_job_id uuid),
    // não pelo contrato — `.uuid()` aqui recusaria enfileiramento manual de teste.
    jobId: z.string().min(1, "jobId é obrigatório"),
    // Discriminador do switch; mantido aberto de propósito (ver nota acima).
    type: z.string().min(1, "type é obrigatório"),
    payload: jobWorkerPayload,
    // jsonb NOT NULL DEFAULT '{}' no banco; a edge nunca lê (única menção: index.ts:28).
    metadata: z.unknown().optional(),
  })
  .passthrough(); // o dispatcher legado manda `attempts` (20251226000003_create_job_queue.sql:272-284)
const jobWorkerV2 = jobWorkerV1; // envelope fixado por process_job_queue() no banco

// ── lalamove-uapi ────────────────────────────────────────────────────────────
//
// Discriminador: `action` — a edge resolve `url.searchParams.get('action') ||
// rawBody.action` (index.ts:493) e remove `action` do corpo (index.ts:495)
// ANTES de validar; o input validado é `{ action, ...body }`.
//
// Fidelidade ao handler (index.ts:491-792, lido em 2026-11-22):
//  - ids da UAPI (`order_uuid`, `last_id`) aceitam string OU número: o guard é
//    falsy (`!body.order_uuid` em :589/:599/:613/:623/:676/:700) e o valor vem
//    cru da resposta do portal (useLalamoveUapi.ts:102 → :95). Sem amostra de
//    `order_list_new` no repo, o tipo do portal é NÃO VERIFICADO — a união
//    evita 422 em payload que hoje funciona.
//  - paginação sem `.positive()`/`.int()`: o handler trata 0 como "use o
//    default" (`|| 20`, `|| 50`, `|| 10` em :229/:273-274/:288-289/:398-399) e
//    repassa float sem inspecionar.
//  - `rating` só precisa não ser `undefined` (:676), logo aceita null/string.
//  - `fleet_type_code` é declarado porque `{ fleet_type_code: N, ...body }`
//    (:647/:651) deixa o corpo sobrescrever o tipo de frota.
//  - `search-orders` repassa o corpo inteiro para `order_search` (:609 → :258),
//    sem ler campo algum → só discriminador + passthrough.
//  - `favorite-driver`/`block-driver`: o discriminador do contrato é `action` e
//    o corpo sempre perde esse campo; a sub-ação (add/remove/block/unblock) vem
//    em `driver_action`, obrigatório aqui e enviado por useLalamoveUapi.ts:271.
//    Antes o handler lia `body.action` — campo inexistente no corpo — e as duas
//    ações devolviam 400 em qualquer payload. Os ramos de compatibilidade
//    'add'/'remove'/'block'/'unblock' foram removidos no mesmo fix.
const uapiId = z.union(
  [z.string().min(1, "order_uuid é obrigatório"), z.number()],
  { errorMap: () => ({ message: "order_uuid é obrigatório" }) },
);
const uapiCursor = z.union([z.string(), z.number()]).optional();
const uapiFid = z.string().min(1, "driver_fid é obrigatório");
const uapiPage = {
  page_no: z.number().optional(),
  page_size: z.number().optional(),
};

const lalamoveUapiV1 = z.discriminatedUnion("action", [
  // ── sessão (exigem role admin no handler, :500/:544) ──
  z.object({
    action: z.literal("set-token"),
    access_token: z.string().min(1, "access_token é obrigatório"),
    refresh_token: z.string().min(1, "refresh_token é obrigatório"),
    // colunas: user_fid text, ep_role integer, city_id integer
    // (20260315165451_...sql:7-9); o handler usa `||` (:520-522) e CITY_ID é
    // string (:13), então "21001" e 123456 funcionam hoje.
    user_fid: z.union([z.string(), z.number()]).optional().nullable(),
    ep_role: z.coerce.number().int().optional(),
    city_id: z.coerce.number().int().optional(),
  }),
  z.object({ action: z.literal("token-status") }),
  z.object({ action: z.literal("refresh-token") }),
  // ── pedidos ──
  z.object({
    action: z.literal("list-orders"),
    limit: z.number().optional(),
    last_id: uapiCursor,
    order_statuses: z.array(z.number()).optional(),
  }),
  z.object({ action: z.literal("order-detail"), order_uuid: uapiId }),
  z.object({ action: z.literal("order-status"), order_uuid: uapiId }),
  z.object({ action: z.literal("search-orders") }).passthrough(),
  z.object({
    action: z.literal("cancel-order"),
    order_uuid: uapiId,
    reason: z.string().optional(),
    reason_id: z.number().optional(),
  }),
  z.object({ action: z.literal("cancel-eligibility"), order_uuid: uapiId }),
  z.object({ action: z.literal("last-order") }),
  // ── carteira ──
  z.object({ action: z.literal("wallet-balance") }),
  z.object({
    action: z.literal("wallet-transactions"),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    ...uapiPage,
  }),
  // ── frota ──
  z.object({
    action: z.literal("fleet-favorites"),
    search: z.string().optional(),
    fleet_type_code: z.number().optional(),
    ...uapiPage,
  }),
  z.object({
    action: z.literal("fleet-blocked"),
    search: z.string().optional(),
    fleet_type_code: z.number().optional(),
    ...uapiPage,
  }),
  z.object({
    action: z.literal("favorite-driver"),
    driver_fid: uapiFid,
    driver_action: z.string().min(1, "driver_action é obrigatório"),
  }).passthrough(),
  z.object({
    action: z.literal("block-driver"),
    driver_fid: uapiFid,
    driver_action: z.string().min(1, "driver_action é obrigatório"),
  }).passthrough(),
  z.object({
    action: z.literal("rate-driver"),
    order_uuid: uapiId,
    driver_fid: uapiFid,
    // :676 só rejeita `undefined`; null/string chegam crus à UAPI (:313)
    rating: z.union([z.number(), z.string(), z.null()]),
    comment_ids: z.array(z.number()).optional(),
    custom_comment: z.string().optional(),
  }),
  // ── conta ──
  z.object({ action: z.literal("user-info") }),
  z.object({ action: z.literal("corporate-info") }),
  z.object({ action: z.literal("city-info") }),
  // ── recibos / cupons ──
  z.object({ action: z.literal("download-receipt"), order_uuid: uapiId }),
  z.object({
    action: z.literal("coupons"),
    search: z.array(z.string()).optional(),
    ...uapiPage,
  }),
  z.object({ action: z.literal("exchange-coupon"), code: z.string().min(1, "code é obrigatório") }),
  // ── importação em massa ──
  z.object({
    action: z.literal("bulk-import"),
    maxPages: z.number().optional(),
    pageSize: z.number().optional(),
  }),
]);
const lalamoveUapiV2 = lalamoveUapiV1; // sem evolução: v2 === v1

// ── lalamove-api ─────────────────────────────────────────────────────────────
// ATENÇÃO: este contrato é validado sobre o input MESCLADO (query + corpo), não
// sobre o corpo cru. Todo o tráfego vindo da lalamove-gateway é GET sem corpo,
// com `action` e ids só na query (lalamove-gateway/index.ts:295,306,322). Sem o
// merge do passo 4 das notas de integração, 100% desse tráfego vira 422.

const lalamoveApiE164 = /^\+[1-9]\d{7,14}$/;
const lalamoveApiAmount = z.union([z.string().min(1), z.number()]);

const lalamoveApiV1 = z
  .discriminatedUnion("action", [
    // Corpo ignorado pelo handler (index.ts:678-680, :1146-1149) → passthrough,
    // mesma convenção de cronWorkerBody (schemas.ts:283-288).
    z.object({ action: z.literal("cities") }).passthrough(),
    z.object({ action: z.literal("sync") }).passthrough(),

    // POST /v3/quotations — o case NÃO valida forma: o comentário em
    // index.ts:682-684 delega a validação à Lalamove (422 com o campo exato).
    // serviceType/stops ficam opcionais para não transformar erro upstream em 422 local.
    z.object({
      action: z.literal("quotation"),
      serviceType: z.string().min(1, "serviceType é obrigatório").optional(),
      language: z.string().optional(),
      scheduleAt: z.string().optional(),
      isRouteOptimized: z.boolean().optional(),
      specialRequests: z.array(z.string()).optional(),
      stops: z
        .array(
          z
            .object({
              address: z.string().optional(),
              coordinates: z
                .object({
                  lat: z.union([z.string(), z.number()]),
                  lng: z.union([z.string(), z.number()]),
                })
                .passthrough()
                .optional(),
            })
            .passthrough(),
        )
        .optional(),
      item: z
        .object({
          quantity: z.string().optional(),
          weight: z.string().optional(),
          categories: z.array(z.string()).optional(),
          handlingInstructions: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
    }),

    z.object({
      action: z.literal("get-quotation"),
      quotationId: z.string().min(1, "quotationId é obrigatório"),
    }),

    // POST /v3/orders — createOrder (index.ts:377-391). O único check runtime é
    // assertE164 no telefone; name/stopId/recipients NÃO são exigidos pelo
    // handler (optional chaining em :378-379) → optional aqui também.
    z.object({
      action: z.literal("order"),
      quotationId: z.string().min(1, "quotationId é obrigatório"),
      isPODEnabled: z.boolean().optional(),
      serviceType: z.string().optional(),
      sender: z
        .object({
          stopId: z.string().optional(),
          name: z.string().optional(),
          phone: z
            .string()
            .regex(lalamoveApiE164, "Telefone inválido em sender: esperado formato E.164 (+5511...)"),
        })
        .passthrough(),
      recipients: z
        .array(
          z
            .object({
              stopId: z.string().optional(),
              name: z.string().optional(),
              phone: z
                .string()
                .regex(lalamoveApiE164, "Telefone inválido em recipients: esperado formato E.164 (+5511...)"),
              remarks: z.string().optional(),
            })
            .passthrough(),
        )
        .optional(),
      metadata: z
        .object({
          internalOrderId: z.string().optional(),
          autoNotifySupplier: z.boolean().optional(),
          supplierContact: z.string().optional(),
          stalledThresholdMinutes: z.number().optional(),
          requiresPod: z.boolean().optional(),
          pickupPlaceId: z.string().optional(),
          deliveryPlaceId: z.string().optional(),
          pickupAddressComponents: z.record(z.unknown()).optional(),
          deliveryAddressComponents: z.record(z.unknown()).optional(),
          pickupGeocodePrecision: z.string().optional(),
          deliveryGeocodePrecision: z.string().optional(),
          geocodeProvider: z.string().optional(),
          approachRadiusM: z.number().optional(),
          approachEtaMin: z.number().optional(),
          notifyDeliveryContact: z.boolean().optional(),
        })
        .passthrough()
        .optional(),
    }),

    z.object({
      action: z.literal("get-order"),
      orderId: z.string().min(1, "orderId é obrigatório"),
    }),
    z.object({
      action: z.literal("fetch-order"),
      orderId: z.string().min(1, "orderId é obrigatório"),
    }),
    // O handler trunca silenciosamente em 50 (index.ts:829) → recusar explicitamente.
    z.object({
      action: z.literal("fetch-orders-bulk"),
      orderIds: z
        .array(z.string().min(1))
        .min(1, "orderIds array is required")
        .max(50, "máximo 50 orderIds por chamada"),
    }),

    // PATCH /v3/orders/{id} — editOrder (index.ts:405-407) manda o corpo como `data`.
    // O handler DEVE remover `action`/`orderId` antes de repassar (passo 5 das notas).
    z
      .object({
        action: z.literal("edit-order"),
        orderId: z.string().min(1, "orderId é obrigatório"),
      })
      .passthrough(),

    z.object({
      action: z.literal("cancel"),
      orderId: z.string().min(1, "orderId é obrigatório"),
      // qualquer string: fora de VALID_CANCEL_REASONS vira 'OTHER' (index.ts:867-877)
      reason: z.string().optional(),
      notes: z.string().optional(),
    }),

    // `fee` é o nome que o gateway manda na query (src/lib/lalamove-api.ts:133).
    // Valor > 0, ≤ 500 e aumento monotônico continuam no handler (:924-945).
    z.object({
      action: z.literal("priority-fee"),
      orderId: z.string().min(1, "orderId é obrigatório"),
      amount: lalamoveApiAmount.optional(),
      priorityFee: lalamoveApiAmount.optional(),
      fee: lalamoveApiAmount.optional(),
      reason: z.string().optional(),
    }),

    z.object({
      action: z.literal("get-driver"),
      orderId: z.string().min(1, "orderId é obrigatório"),
      driverId: z.string().min(1, "driverId é obrigatório"),
    }),
    z.object({
      action: z.literal("change-driver"),
      orderId: z.string().min(1, "orderId é obrigatório"),
      driverId: z.string().min(1, "driverId é obrigatório"),
      reason: z.enum([
        "DRIVER_UNRESPONSIVE",
        "DRIVER_LATE",
        "DRIVER_ASKED_CHANGE",
        "DRIVER_RUDE",
        "DRIVER_ASKED_FOR_MORE_MONEY",
      ]),
    }),

    z.object({
      action: z.literal("set-webhook"),
      url: z.string().min(1, "url é obrigatório"),
    }),
    z.object({
      action: z.literal("webhook-selftest"),
      orderId: z.string().startsWith("E2E-SELFTEST-", "orderId deve comecar com E2E-SELFTEST-"),
      eventType: z.string().optional(),
      status: z.string().optional(),
    }),
  ])
  .superRefine((v, ctx) => {
    // "amount OU priorityFee OU fee" — verificado: zod 3.22.4 NÃO aceita
    // ZodEffects como membro de discriminatedUnion, então o refine fica no topo.
    if (v.action === "priority-fee" && (v.amount ?? v.priorityFee ?? v.fee) == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "orderId e amount são obrigatórios",
      });
    }
  });
const lalamoveApiV2 = lalamoveApiV1; // sem evolução: v2 === v1 (v1 é ZodEffects, sem .extend())

// ── Registro central de contratos ────────────────────────────────────────────

export type ContractName =
  | "lalamove-webhook"
  | "evaluate-driver"
  | "send-notification"
  | "new-device-alert"
  | "route-analyzer"
  | "check-external-api"
  | "test-notification"
  | "geo-gateway"
  | "apply-fixes"
  | "bitrix24-process-queue"
  | "bitrix24-sync"
  | "check-driver-alerts"
  | "escalate-alerts"
  | "external-companies"
  | "external-db-bridge"
  | "get-mapbox-token"
  | "lalamove-gateway"
  | "lalamove-token-refresh"
  | "llm-wh"
  | "mcp-query"
  | "rotate-tokens"
  | "seed-fix-rls"
  | "simulate-driver-movement"
  | "job-worker"
  | "lalamove-api"
  | "lalamove-uapi";

type VersionedSchema = Record<ContractVersion, z.ZodTypeAny>;

export const CONTRACT_REGISTRY: Record<ContractName, VersionedSchema> = {
  "lalamove-webhook": { v1: lalamoveWebhookV1, v2: lalamoveWebhookV2 },
  "evaluate-driver": { v1: evaluateDriverV1, v2: evaluateDriverV2 },
  "send-notification": { v1: sendNotificationV1, v2: sendNotificationV2 },
  "new-device-alert": { v1: newDeviceAlertV1, v2: newDeviceAlertV2 },
  "route-analyzer": { v1: routeAnalyzerV1, v2: routeAnalyzerV2 },
  "check-external-api": { v1: checkExternalApiV1, v2: checkExternalApiV2 },
  "test-notification": { v1: testNotificationV1, v2: testNotificationV2 },
  "geo-gateway": { v1: geoGatewayV1, v2: geoGatewayV2 },
  "apply-fixes": { v1: applyFixesV1, v2: applyFixesV2 },
  "bitrix24-process-queue": { v1: bitrix24ProcessQueueV1, v2: bitrix24ProcessQueueV2 },
  "bitrix24-sync": { v1: bitrix24SyncV1, v2: bitrix24SyncV2 },
  "check-driver-alerts": { v1: checkDriverAlertsV1, v2: checkDriverAlertsV2 },
  "escalate-alerts": { v1: escalateAlertsV1, v2: escalateAlertsV2 },
  "external-companies": { v1: externalCompaniesV1, v2: externalCompaniesV2 },
  "external-db-bridge": { v1: externalDbBridgeV1, v2: externalDbBridgeV2 },
  "get-mapbox-token": { v1: getMapboxTokenV1, v2: getMapboxTokenV2 },
  "lalamove-gateway": { v1: lalamoveGatewayV1, v2: lalamoveGatewayV2 },
  "lalamove-token-refresh": { v1: lalamoveTokenRefreshV1, v2: lalamoveTokenRefreshV2 },
  "llm-wh": { v1: llmWhV1, v2: llmWhV2 },
  "mcp-query": { v1: mcpQueryV1, v2: mcpQueryV2 },
  "rotate-tokens": { v1: rotateTokensV1, v2: rotateTokensV2 },
  "seed-fix-rls": { v1: seedFixRlsV1, v2: seedFixRlsV2 },
  "simulate-driver-movement": { v1: simulateDriverMovementV1, v2: simulateDriverMovementV2 },
  "job-worker": { v1: jobWorkerV1, v2: jobWorkerV2 },
  "lalamove-api": { v1: lalamoveApiV1, v2: lalamoveApiV2 },
  "lalamove-uapi": { v1: lalamoveUapiV1, v2: lalamoveUapiV2 },
};

/**
 * Contratos cujo CORPO É OPCIONAL: a Edge Function não lê nada da entrada
 * (workers de cron, health check, telas que invocam sem payload), então `{}` é
 * um payload válido. Para esses, o caso de falha equivalente a "campo
 * obrigatório ausente" é um corpo que não seja objeto (array, string, número).
 * Usado pelos testes de contrato para escolher o caso correto por contrato.
 */
export const OPTIONAL_BODY_CONTRACTS: readonly ContractName[] = [
  "bitrix24-process-queue",
  "check-driver-alerts",
  "escalate-alerts",
  "get-mapbox-token",
  "lalamove-token-refresh",
  "llm-wh",
  "rotate-tokens",
  "seed-fix-rls",
  "simulate-driver-movement",
] as const;

/**
 * Retorna o schema de um contrato para uma versão específica.
 */
export function getSchema(
  name: ContractName,
  version: ContractVersion,
): z.ZodTypeAny {
  return CONTRACT_REGISTRY[name][version];
}
