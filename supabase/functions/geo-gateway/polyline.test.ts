import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decodePolyline, encodePolyline, simplify } from "./polyline.ts";

Deno.test("polyline: exemplo oficial do Google (precisão 5)", () => {
  const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  assertEquals(pts, [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]);
  assertEquals(encodePolyline(pts, 5), "_p~iF~ps|U_ulLnnqC_mqNvxq`@");
});

Deno.test("polyline6: ida e volta preserva 6 casas", () => {
  const pts = [{ lat: -25.429612, lng: -49.271634 }, { lat: -25.442587, lng: -49.238511 }];
  assertEquals(decodePolyline(encodePolyline(pts, 6), 6), pts);
});

Deno.test("simplify: remove pontos colineares, mantém extremos e curvas", () => {
  const line = Array.from({ length: 50 }, (_, i) => ({ lat: -25.43 + i * 0.0001, lng: -49.27 }));
  const s = simplify(line, 30);
  assertEquals(s.length, 2);
  const bent = [...line, { lat: -25.425, lng: -49.26 }];
  const s2 = simplify(bent, 30);
  assert(s2.length >= 3 && s2[s2.length - 1].lng === -49.26);
});
