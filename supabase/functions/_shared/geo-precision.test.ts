import { assertEquals } from "jsr:@std/assert@1";
import { ACCURACY_TO_PRECISION, precisionFromAccuracy } from "./geo-precision.ts";

Deno.test("precisionFromAccuracy: mapeia o vocabulário do Geocoding v6", () => {
  assertEquals(precisionFromAccuracy("rooftop"), "exact");
  assertEquals(precisionFromAccuracy("parcel"), "exact");
  assertEquals(precisionFromAccuracy("point"), "high");
  assertEquals(precisionFromAccuracy("interpolated"), "medium");
  assertEquals(precisionFromAccuracy("intersection"), "medium");
  assertEquals(precisionFromAccuracy("approximate"), "low");
  assertEquals(precisionFromAccuracy("street"), "low");
});

Deno.test("precisionFromAccuracy: ausente ou fora do vocabulário nunca vira exact", () => {
  assertEquals(precisionFromAccuracy(null), "unknown");
  assertEquals(precisionFromAccuracy(undefined), "unknown");
  assertEquals(precisionFromAccuracy(""), "unknown");
  assertEquals(precisionFromAccuracy("ROOFTOP"), "unknown");
  assertEquals(precisionFromAccuracy("geometric_center"), "unknown");
});

Deno.test("ACCURACY_TO_PRECISION: cobre exatamente as 7 chaves do provedor", () => {
  assertEquals(Object.keys(ACCURACY_TO_PRECISION).sort(), [
    "approximate", "interpolated", "intersection", "parcel", "point", "rooftop", "street",
  ]);
});
