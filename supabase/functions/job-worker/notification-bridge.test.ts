import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { geoAlertDriverEvent } from "./index.ts";

/** M4 — chegada na coleta vinda do trigger geo_evaluate_tracking. */

const ORDER = "608ae635-f86b-4aff-abfd-0fc89e1e71b3";
const DRIVER = "0e0f111c-a609-4101-8162-9e84f1a44639";

Deno.test("M4: chegada na coleta avisa o motorista", () => {
  assertEquals(
    geoAlertDriverEvent({
      type: "DRIVER_ARRIVED_PICKUP",
      driver_id: DRIVER,
      order_id: ORDER,
    }),
    { event: "DRIVER_ARRIVED_PICKUP", driverId: DRIVER, orderId: ORDER },
  );
});

Deno.test("M4: sem motorista nao ha aviso", () => {
  assertEquals(
    geoAlertDriverEvent({ type: "DRIVER_ARRIVED_PICKUP", driver_id: null, order_id: ORDER }),
    null,
  );
});

Deno.test("M4: sem pedido nao ha aviso", () => {
  assertEquals(geoAlertDriverEvent({ type: "DRIVER_ARRIVED_PICKUP", driver_id: DRIVER }), null);
});

Deno.test("M4: evento que fala com o contato da coleta nao vira aviso ao motorista", () => {
  assertEquals(
    geoAlertDriverEvent({ type: "DRIVER_APPROACHING_PICKUP", driver_id: DRIVER, order_id: ORDER }),
    null,
  );
  assertEquals(
    geoAlertDriverEvent({ type: "DRIVER_ARRIVED_DELIVERY", driver_id: DRIVER, order_id: ORDER }),
    null,
  );
});

Deno.test("M4: payload sem type ou nulo nao quebra", () => {
  assertEquals(geoAlertDriverEvent({ driver_id: DRIVER, order_id: ORDER }), null);
  assertEquals(geoAlertDriverEvent(null), null);
  assertEquals(geoAlertDriverEvent(undefined), null);
});