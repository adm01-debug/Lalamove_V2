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

// ── Registro central de contratos ────────────────────────────────────────────

export type ContractName =
  | "lalamove-webhook"
  | "evaluate-driver"
  | "send-notification"
  | "new-device-alert"
  | "route-analyzer"
  | "check-external-api"
  | "test-notification";

type VersionedSchema = Record<ContractVersion, z.ZodTypeAny>;

export const CONTRACT_REGISTRY: Record<ContractName, VersionedSchema> = {
  "lalamove-webhook": { v1: lalamoveWebhookV1, v2: lalamoveWebhookV2 },
  "evaluate-driver": { v1: evaluateDriverV1, v2: evaluateDriverV2 },
  "send-notification": { v1: sendNotificationV1, v2: sendNotificationV2 },
  "new-device-alert": { v1: newDeviceAlertV1, v2: newDeviceAlertV2 },
  "route-analyzer": { v1: routeAnalyzerV1, v2: routeAnalyzerV2 },
  "check-external-api": { v1: checkExternalApiV1, v2: checkExternalApiV2 },
  "test-notification": { v1: testNotificationV1, v2: testNotificationV2 },
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
