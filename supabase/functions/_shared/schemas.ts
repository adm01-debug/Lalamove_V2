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
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("place-details"),
    place_id: z.string().min(3).max(200),
    session_token: z.string().min(8).max(64).optional(),
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
    traffic: z.boolean().optional(),
    alternatives: z.boolean().optional(),
    language: z.string().min(2).max(5).optional(),
    provider: geoProvider,
  }),
  z.object({
    action: z.literal("matrix"),
    origins: z.array(geoPoint).min(1).max(25),
    destinations: z.array(geoPoint).min(1).max(25),
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
  // Mapbox-only: pass-through validado só no essencial (a tela /map-tools já monta o body)
  z.object({ action: z.literal("isochrone"), lat: z.number(), lng: z.number() }).passthrough(),
  z.object({ action: z.literal("optimization"), coordinates: z.array(z.array(z.number()).length(2)).min(2).max(12) }).passthrough(),
  z.object({ action: z.literal("tilequery"), lat: z.number(), lng: z.number() }).passthrough(),
]);

const geoGatewayV2 = geoGatewayV1;

// ── Registro central de contratos ────────────────────────────────────────────

export type ContractName =
  | "lalamove-webhook"
  | "evaluate-driver"
  | "send-notification"
  | "new-device-alert"
  | "route-analyzer"
  | "check-external-api"
  | "test-notification"
  | "geo-gateway";

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
};

/**
 * Retorna o schema de um contrato para uma versão específica.
 */
export function getSchema(
  name: ContractName,
  version: ContractVersion,
): z.ZodTypeAny {
  return CONTRACT_REGISTRY[name][version];
}
