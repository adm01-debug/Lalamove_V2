// Normalizacao do payload v3 da Lalamove para o contrato interno do webhook.
//
// A Lalamove v3 envia:
//   { apiKey, timestamp (epoch em SEGUNDOS), signature, eventId, eventType,
//     eventVersion, data: { order?, driver?, location?, balance?, updatedAt } }
// Exemplos oficiais: v3_Webhook_v1.5.pdf p.14 (ORDER_STATUS_CHANGED),
// p.18 (CANCELED, com cancelReason/cancelParty no order), p.22 (DRIVER_ASSIGNED,
// driver com driverId/name/phone/photo/plateNumber), p.24 (ORDER_AMOUNT_CHANGED,
// order.price com totalPrice/priorityFee/currency/subTotal) e
// p.26 (WALLET_BALANCE_CHANGED, balance com amount/currency).
//
// O contrato interno (schemas.ts "lalamove-webhook" v1/v2) e o processamento do
// index.ts esperam { event, orderId, timestamp ISO, data plano }. Esta funcao e
// pura e unit-testavel; um corpo que ja esta no formato interno (tem "event")
// ou que nao e um objeto v3 passa intacto.
export function normalizeLalamoveV3Payload(
  parsed: unknown,
  rawBody: string,
): string {
  if (!parsed || typeof parsed !== 'object') return rawBody;
  const p = parsed as Record<string, unknown>;
  if ('event' in p || typeof p.eventType !== 'string') return rawBody;

  const d = (typeof p.data === 'object' && p.data !== null ? p.data : {}) as Record<string, unknown>;
  const order = (typeof d.order === 'object' && d.order !== null ? d.order : {}) as Record<string, unknown>;
  const driver = (typeof d.driver === 'object' && d.driver !== null ? d.driver : {}) as Record<string, unknown>;
  const balance = (typeof d.balance === 'object' && d.balance !== null ? d.balance : null) as Record<string, unknown> | null;
  const price = (typeof order.price === 'object' && order.price !== null ? order.price : null) as Record<string, unknown> | null;

  // timestamp do topo e epoch em SEGUNDOS (ex.: 1775027436); data.updatedAt ja e ISO.
  const timestamp = typeof d.updatedAt === 'string'
    ? d.updatedAt
    : typeof p.timestamp === 'number'
      ? new Date(p.timestamp * 1000).toISOString()
      : null;

  // "data" plano: campos do order sobem um nivel (status, previousStatus,
  // market, scheduleAt, shareLink...), mantendo o resto de d.
  const data: Record<string, unknown> = { ...d, ...order };
  if (driver.driverId !== undefined) {
    data.driverId = driver.driverId;
    data.driverName = driver.name;
    data.driverPhone = driver.phone;
    data.driverPlate = driver.plateNumber;
    data.driverPhoto = driver.photo;
  }
  if (balance) {
    data.balance = balance.amount;   // o handler espera escalar
    data.currency = balance.currency;
  }
  if (price) {
    data.priceBreakdown = {
      total: price.totalPrice,
      currency: price.currency,
      subTotal: price.subTotal,
    };
    if (price.priorityFee !== undefined) data.priorityFee = price.priorityFee;
  }
  if (order.cancelReason !== undefined && data.reason === undefined) {
    data.reason = order.cancelReason;  // o handler de cancelamento le data.reason
  }

  return JSON.stringify({
    event: p.eventType,
    ...(typeof p.eventId === 'string' ? { eventId: p.eventId } : {}),
    ...(typeof p.eventVersion === 'string' ? { apiVersion: p.eventVersion } : {}),
    orderId: typeof order.orderId === 'string' ? order.orderId : null,
    timestamp,
    data,
  });
}
