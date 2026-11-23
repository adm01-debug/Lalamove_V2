/**
 * Etapa 88 do plano de mensageria: rotas, textos e configuracao deixam de ser
 * constante de codigo e passam a vir das tabelas do Bloco 6
 * (`notification_routes`, `message_templates`, `messaging_settings`, migration
 * 20261126120000_messaging_foundation).
 *
 * Toda leitura aqui tem fallback explicito: tabela ausente (banco antigo), RLS
 * ou erro de rede devolvem o catalogo do `router.ts` e a configuracao
 * conservadora. O motor de mensagem nao pode derrubar o webhook porque uma
 * consulta falhou.
 */

import {
  DEFAULT_ROUTES,
  type MessageChannel,
  type MessageRole,
  type RouteRule,
} from "./router.ts";

/** Cliente minimo de leitura. O fake dos testes implementa apenas isto. */
export interface ReadClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

export const MESSAGE_CHANNELS: readonly MessageChannel[] = [
  "whatsapp",
  "sms",
  "email",
  "slack",
  "n8n",
];

export const MESSAGE_ROLES: readonly MessageRole[] = [
  "driver",
  "pickup_contact",
  "delivery_contact",
  "internal",
];

export type QuietWindow = { start: number; end: number };

export interface MessagingSettings {
  whatsappProvider: "zapp" | "evolution" | "off";
  smsProvider: "none" | "zenvia" | "comtele" | "twilio";
  smsFallbackAfterMin: number;
  monthlyBudgetCents: number;
  quietHoursByRole: Record<string, QuietWindow | null>;
  pilotMode: boolean;
  shadowMode: boolean;
}

/**
 * Configuracao para quando a tabela nao responde: nenhum provedor ligado e modo
 * sombra. Ou seja, decide e registra sem gastar. Erro de leitura nunca pode
 * virar mensagem enviada.
 */
export const SAFE_SETTINGS: MessagingSettings = {
  whatsappProvider: "off",
  smsProvider: "none",
  smsFallbackAfterMin: 10,
  monthlyBudgetCents: 0,
  quietHoursByRole: {},
  pilotMode: false,
  shadowMode: true,
};

export interface MessageTemplate {
  key: string;
  event: string;
  role: MessageRole;
  channel: MessageChannel;
  version: number;
  body: string;
  variables: string[];
  maxLength: number | null;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function parseQuietHours(
  raw: unknown,
): Record<string, QuietWindow | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, QuietWindow | null> = {};
  for (const [role, window] of Object.entries(raw as Record<string, unknown>)) {
    if (!window || typeof window !== "object") {
      out[role] = null;
      continue;
    }
    const start = Number((window as { start?: unknown }).start);
    const end = Number((window as { end?: unknown }).end);
    out[role] = Number.isFinite(start) && Number.isFinite(end)
      ? { start, end }
      : null;
  }
  return out;
}

/** Linha de `messaging_settings` (etapa 75) com os defaults seguros por cima. */
export function settingsFromRow(row: unknown): MessagingSettings {
  if (!row || typeof row !== "object") return { ...SAFE_SETTINGS };
  const data = row as Record<string, unknown>;
  return {
    whatsappProvider: oneOf(
      data.whatsapp_provider,
      ["zapp", "evolution", "off"] as const,
      SAFE_SETTINGS.whatsappProvider,
    ),
    smsProvider: oneOf(
      data.sms_provider,
      ["none", "zenvia", "comtele", "twilio"] as const,
      SAFE_SETTINGS.smsProvider,
    ),
    smsFallbackAfterMin: toPositiveInt(
      data.sms_fallback_after_min,
      SAFE_SETTINGS.smsFallbackAfterMin,
    ),
    monthlyBudgetCents: toPositiveInt(
      data.monthly_budget_cents,
      SAFE_SETTINGS.monthlyBudgetCents,
    ),
    quietHoursByRole: parseQuietHours(data.quiet_hours_by_role),
    pilotMode: data.pilot_mode === true,
    shadowMode: data.shadow_mode !== false,
  };
}

export async function loadMessagingSettings(
  supabase: ReadClient,
): Promise<MessagingSettings> {
  try {
    const { data, error } = await supabase
      .from("messaging_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return { ...SAFE_SETTINGS };
    return settingsFromRow(data);
  } catch {
    return { ...SAFE_SETTINGS };
  }
}

function toRoute(row: unknown): RouteRule | null {
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;
  const event = typeof data.event === "string" ? data.event : null;
  const role = data.role;
  if (!event) return null;
  if (!(MESSAGE_ROLES as readonly string[]).includes(String(role))) return null;
  const channels = Array.isArray(data.channels)
    ? (data.channels as unknown[]).filter((c): c is MessageChannel =>
      typeof c === "string" && (MESSAGE_CHANNELS as readonly string[]).includes(c)
    )
    : [];
  return {
    event,
    role: role as MessageRole,
    channels,
    fallback_after_min: toPositiveInt(data.fallback_after_min, 0),
    requires_reply: data.requires_reply === true,
    reply_timeout_min: toPositiveInt(data.reply_timeout_min, 0),
    is_enabled: data.is_enabled !== false,
  };
}

/** Etapa 88: as rotas do banco; sem tabela/linhas cai no catalogo do codigo. */
export async function loadRoutes(supabase: ReadClient): Promise<RouteRule[]> {
  try {
    const { data, error } = await supabase
      .from("notification_routes")
      .select(
        "event, role, channels, fallback_after_min, requires_reply, reply_timeout_min, is_enabled",
      );
    if (error || !Array.isArray(data) || data.length === 0) {
      return DEFAULT_ROUTES;
    }
    const routes = data
      .map(toRoute)
      .filter((r): r is RouteRule => r !== null);
    return routes.length > 0 ? routes : DEFAULT_ROUTES;
  } catch {
    return DEFAULT_ROUTES;
  }
}

function toTemplate(row: unknown): MessageTemplate | null {
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;
  const channel = data.channel;
  if (
    typeof data.body !== "string" || data.body.trim() === "" ||
    typeof data.key !== "string" ||
    !(MESSAGE_CHANNELS as readonly string[]).includes(String(channel))
  ) {
    return null;
  }
  return {
    key: data.key,
    event: typeof data.event === "string" ? data.event : "",
    role: (data.role ?? "driver") as MessageRole,
    channel: channel as MessageChannel,
    version: toPositiveInt(data.version, 1),
    body: data.body,
    variables: Array.isArray(data.variables)
      ? (data.variables as unknown[]).map(String)
      : [],
    maxLength: Number.isFinite(Number(data.max_length))
      ? Number(data.max_length)
      : null,
  };
}

/** Etapas 76/77: os textos ativos do evento, um por canal. */
export async function loadTemplates(
  supabase: ReadClient,
  event: string,
  role: MessageRole,
): Promise<Partial<Record<MessageChannel, MessageTemplate>>> {
  try {
    const { data, error } = await supabase
      .from("message_templates")
      .select("key, event, role, channel, version, body, variables, max_length")
      .eq("event", event)
      .eq("role", role)
      .eq("is_active", true)
      .order("key", { ascending: true });
    if (error || !Array.isArray(data)) return {};
    const out: Partial<Record<MessageChannel, MessageTemplate>> = {};
    // Um aviso por disparo: com dois templates do mesmo evento no mesmo canal
    // (M1 e M3 em DRIVER_ASSIGNED) vence o de menor `key`, de forma
    // deterministica. O segundo template exige um disparo proprio com `seq`
    // diferente (etapas 103/109).
    for (const row of data) {
      const template = toTemplate(row);
      if (template && !out[template.channel]) out[template.channel] = template;
    }
    return out;
  } catch {
    return {};
  }
}
