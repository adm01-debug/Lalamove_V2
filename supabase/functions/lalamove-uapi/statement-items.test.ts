import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildStatementPage,
  isBeyondItemCount,
  parseOccurredAtLocal,
  statementItemKey,
  statementPageRange,
} from './statement-items.ts';

const item = {
  name: 'Pedidos',
  amount: -5092,
  city_id: 1,
  sub_name: '',
  user_fid: 'qDdE35mo',
  date_time: '2026-04-01 16:05:27',
  user_name: 'Andressa',
  order_display_id: '3464272547095462300',
  topup_tx_no: '',
};

Deno.test('chave do lançamento é estável e ignorante à ordem das chaves', () => {
  const reordered = { ...item, name: item.name };
  assertEquals(statementItemKey(item, 1), statementItemKey(reordered, 1));
  assertEquals(
    statementItemKey(item, 1),
    '1|2026-04-01 16:05:27|-5092|3464272547095462300|Pedidos||qDdE35mo|',
  );
});

Deno.test('lançamentos diferentes geram chaves diferentes', () => {
  const outroValor = { ...item, amount: -1000 };
  const outroSegundo = { ...item, date_time: '2026-04-01 16:05:28' };
  const outraCidade = statementItemKey(item, 2);
  assertEquals(statementItemKey(item, 1) === statementItemKey(outroValor, 1), false);
  assertEquals(statementItemKey(item, 1) === statementItemKey(outroSegundo, 1), false);
  assertEquals(statementItemKey(item, 1) === outraCidade, false);
});

Deno.test('lançamento sem data não tem identidade estável', () => {
  assertEquals(statementItemKey({ ...item, date_time: '' }, 1), null);
  assertEquals(statementItemKey({ ...item, date_time: undefined }, 1), null);
});

Deno.test('data do gateway é normalizada e data inválida é recusada', () => {
  assertEquals(parseOccurredAtLocal('2026-04-01 16:05:27'), '2026-04-01 16:05:27');
  assertEquals(parseOccurredAtLocal('2026-04-01T16:05:27'), '2026-04-01 16:05:27');
  assertEquals(parseOccurredAtLocal('01/04/2026 16:05'), null);
  assertEquals(parseOccurredAtLocal(null), null);
});

Deno.test('faixa da página segue a regra do range', () => {
  assertEquals(statementPageRange(1, 20), { from: 0, to: 19 });
  assertEquals(statementPageRange(580, 20), { from: 11580, to: 11599 });
  assertEquals(statementPageRange(0, 0), { from: 0, to: 19 });
});

Deno.test('página depois do último lançamento é fim do histórico', () => {
  assertEquals(isBeyondItemCount(11589, 11589), true);
  assertEquals(isBeyondItemCount(11560, 11589), false);
  assertEquals(isBeyondItemCount(11580, 11589), false);
  assertEquals(isBeyondItemCount(0, 0), false);
});

Deno.test('página montada mantém o formato da UAPI', () => {
  assertEquals(buildStatementPage([item]).data.flow_item_arr.length, 1);
  assertEquals(buildStatementPage([]).ret, 0);
});
