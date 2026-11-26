import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EMPTY_STATEMENT_PAGE,
  isBeyondHistory,
  statementItems,
} from "./statement-history.ts";

Deno.test("pagina anterior incompleta prova o fim do historico", () => {
  assertEquals(isBeyondHistory(19, 20), true);
  assertEquals(isBeyondHistory(1, 20), true);
  assertEquals(isBeyondHistory(0, 20), true);
});

Deno.test("pagina anterior cheia nao prova nada", () => {
  assertEquals(isBeyondHistory(20, 20), false);
  assertEquals(isBeyondHistory(50, 20), false);
});

Deno.test("sem pagina anterior no snapshot nao ha prova", () => {
  assertEquals(isBeyondHistory(null, 20), false);
  assertEquals(isBeyondHistory(undefined, 20), false);
});

Deno.test("pagina vazia mantem o formato da UAPI", () => {
  assertEquals(EMPTY_STATEMENT_PAGE.ret, 0);
  assertEquals(EMPTY_STATEMENT_PAGE.data.flow_item_arr, []);
  assertEquals(EMPTY_STATEMENT_PAGE.data.total, 0);
});

Deno.test("statementItems le flow_item_arr do snapshot", () => {
  assertEquals(statementItems({ data: { flow_item_arr: [1, 2, 3] } }), 3);
  assertEquals(statementItems({ data: { flow_item_arr: [] } }), 0);
  assertEquals(statementItems({ data: {} }), null);
  assertEquals(statementItems({ data: { flow_item_arr: "x" } }), null);
  assertEquals(statementItems(null), null);
});
