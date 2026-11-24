/**
 * Avisos automaticos que nao nascem de um webhook da Lalamove:
 *
 * - M6 (etapa 106 do plano de mensageria): proxima parada depois de concluir
 *   uma parada num pedido multi-parada (3+ paradas). No fluxo de 2 paradas o
 *   M5 (pos-coleta) ja entrega o endereco da entrega, entao o M6 nao entra.
 * - M11 (etapa 111): lembrete do pedido agendado, 30 min antes da coleta.
 *
 * Ficam aqui, e nao dentro dos handlers, porque `serve()` roda no import e
 * impediria o teste. Ver auto-notices.test.ts.
 */

type MessagingClient = { from: (table: string) => any };

export const MULTI_STOP_MIN = 3;
export const SCHEDULED_REMINDER_WINDOW_MIN = 30;

/**
 * M6: `true` quando a parada recem-concluida deixa outra em aberto e o pedido
 * tem 3+ paradas.
 */
export async function shouldSendNextStop(
  supabase: MessagingClient,
  orderId: string,
): Promise<boolean> {
  const { count: total } = await supabase
    .from("lalamove_stops")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId);
  if ((total ?? 0) < MULTI_STOP_MIN) return false;

  const { count: open } = await supabase
    .from("lalamove_stops")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .is("completed_at", null);
  return (open ?? 0) > 0;
}

interface ScheduledOrderRow {
  id: string;
  driver_id: string | null;
  scheduled_at: string | null;
  status: string | null;
}

export interface ScheduledReminderResult {
  checked: number;
  sent: number;
}

/** Status em que a coleta ja aconteceu ou o pedido morreu: lembrete nao vale. */
const REMINDER_BLOCKED_STATUS = ["CANCELLED", "CANCELED", "COMPLETED", "PICKED_UP", "ON_GOING"];

/**
 * M11: um lembrete por pedido. O cron de `check-driver-alerts` roda a cada
 * 2 min; o ledger (`notification_messages`) e a trava — na segunda passada o
 * evento ja existe e o motor responderia `duplicate` de qualquer jeito.
 */
export async function sendScheduledReminders(
  supabase: MessagingClient,
  now: Date,
  avisar: (event: string, driverId: string, orderId: string) => Promise<void>,
): Promise<ScheduledReminderResult> {
  const windowEnd = new Date(now.getTime() + SCHEDULED_REMINDER_WINDOW_MIN * 60_000);

  const { data } = await supabase
    .from("lalamove_orders")
    .select("id, driver_id, scheduled_at, status")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd.toISOString())
    .not("driver_id", "is", null)
    .limit(50);

  const rows = ((data ?? []) as ScheduledOrderRow[]).filter((row) => {
    if (!row.driver_id || !row.scheduled_at) return false;
    return !REMINDER_BLOCKED_STATUS.includes(String(row.status ?? "").toUpperCase());
  });

  let sent = 0;
  for (const row of rows) {
    const { data: already } = await supabase
      .from("notification_messages")
      .select("id")
      .eq("order_id", row.id)
      .eq("event", "ORDER_SCHEDULED_REMINDER")
      .eq("direction", "outbound")
      .limit(1)
      .maybeSingle();
    if (already) continue;
    await avisar("ORDER_SCHEDULED_REMINDER", row.driver_id as string, row.id);
    sent++;
  }

  return { checked: rows.length, sent };
}