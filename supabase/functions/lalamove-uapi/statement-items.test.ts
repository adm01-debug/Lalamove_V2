import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildStatementPage, statementPageRange } from './statement-items.ts';

Deno.test('faixa da página segue a regra do range', () => {
  assertEquals(statementPageRange(1, 20), { from: 0, to: 19 });
  assertEquals(statementPageRange(580, 20), { from: 11580, to: 11599 });
  assertEquals(statementPageRange(0, 0), { from: 0, to: 19 });
});

Deno.test('página montada mantém o formato da UAPI', () => {
  const page = buildStatementPage([{ name: 'Pedidos', amount: -5092 }]);
  assertEquals(page.ret, 0);
  assertEquals(page.data.flow_item_arr.length, 1);
  assertEquals(buildStatementPage([]).data.flow_item_arr.length, 0);
});
