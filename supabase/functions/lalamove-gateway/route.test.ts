import { assertEquals, assertExists } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isUnsupported, routeAction, translateParams } from './route.ts';

// Toda ação exposta por src/lib/lalamove-api.ts tem que ter destino.
const ACOES_DO_CLIENTE = [
  'status', 'test',
  'cities', 'quote', 'order_create', 'order_get', 'order_cancel', 'order_priority',
  'driver_location', 'v3',
  'user', 'wallet', 'wallet_flow_list', 'vehicles', 'service_areas', 'uapi',
  'refresh_token', 'update_uapi_token', 'update_v3_keys',
];

// Ações expostas por src/lib/uapi-proxy.ts (uapi.getOrders/call/updateToken) —
// caíam em default:null (400 genérico) por não estarem no switch acima.
const ACOES_DO_UAPI_PROXY = ['orders', 'call', 'update_token'];

Deno.test('nenhuma ação do cliente cai em 400 por ser desconhecida', () => {
  for (const action of [...ACOES_DO_CLIENTE, ...ACOES_DO_UAPI_PROXY]) {
    const r = routeAction('unified', action);
    assertExists(r, `ação sem destino: ${action}`);
  }
});

Deno.test('uapi.getStatus ("status") vai para lalamove-uapi status, não para cities', () => {
  const r = routeAction('unified', 'status');
  if (isUnsupported(r) || r === null) throw new Error('status deveria rotear');
  assertEquals(r.fn, 'lalamove-uapi');
  assertEquals(r.action, 'status');
});

Deno.test('testConnection ("test") continua usando cities do lalamove-api', () => {
  const r = routeAction('unified', 'test');
  if (isUnsupported(r) || r === null) throw new Error('test deveria rotear');
  assertEquals(r.fn, 'lalamove-api');
  assertEquals(r.action, 'cities');
});

Deno.test('uapi.getOrders ("orders") vai para lalamove-uapi list-orders', () => {
  const r = routeAction('unified', 'orders');
  if (isUnsupported(r) || r === null) throw new Error('orders deveria rotear');
  assertEquals(r.fn, 'lalamove-uapi');
  assertEquals(r.action, 'list-orders');
});

Deno.test('uapi.call ("call") responde 501 — a edge não tem passagem genérica', () => {
  const r = routeAction('unified', 'call');
  if (!isUnsupported(r)) throw new Error('call deveria ser unsupported');
  assertEquals(r.reason.length > 20, true);
});

Deno.test('uapi.updateToken ("update_token") é bloqueado como escrita de credencial', () => {
  const r = routeAction('unified', 'update_token');
  if (!isUnsupported(r)) throw new Error('update_token deveria ser unsupported');
  assertEquals(/LALAMOVE_API_SECRET|sbp_|service_role/.test(r.reason), false);
});

Deno.test('ações da API v3 vão para lalamove-api', () => {
  const casos: Array<[string, string]> = [
    ['cities', 'cities'],
    ['quote', 'quotation'],
    ['order_create', 'order'],
    ['order_get', 'get-order'],
    ['order_cancel', 'cancel'],
    ['order_priority', 'priority-fee'],
    ['driver_location', 'get-driver'],
  ];
  for (const [entrada, esperado] of casos) {
    const r = routeAction('unified', entrada);
    if (isUnsupported(r) || r === null) throw new Error(`${entrada} deveria rotear`);
    assertEquals(r.fn, 'lalamove-api');
    assertEquals(r.action, esperado);
  }
});

Deno.test('ações da UAPI vão para lalamove-uapi', () => {
  const casos: Array<[string, string]> = [
    ['user', 'user-info'],
    ['wallet', 'wallet-balance'],
    ['wallet_flow_list', 'wallet-transactions'],
    ['vehicles', 'city-info'],
    ['service_areas', 'city-info'],
    ['refresh_token', 'refresh-token'],
  ];
  for (const [entrada, esperado] of casos) {
    const r = routeAction('unified', entrada);
    if (isUnsupported(r) || r === null) throw new Error(`${entrada} deveria rotear`);
    assertEquals(r.fn, 'lalamove-uapi');
    assertEquals(r.action, esperado);
  }
});

Deno.test('passagem genérica e escrita de credencial respondem 501 com motivo', () => {
  for (const action of ['v3', 'uapi', 'update_uapi_token', 'update_v3_keys']) {
    const r = routeAction('unified', action);
    if (!isUnsupported(r)) throw new Error(`${action} deveria ser unsupported`);
    assertEquals(r.reason.length > 20, true);
  }
});

Deno.test('escrita de credencial não vaza nome de secret no motivo', () => {
  for (const action of ['update_uapi_token', 'update_v3_keys']) {
    const r = routeAction('unified', action);
    if (!isUnsupported(r)) throw new Error('deveria ser unsupported');
    assertEquals(/LALAMOVE_API_SECRET|sbp_|service_role/.test(r.reason), false);
  }
});

Deno.test('ação desconhecida devolve null (vira 400, não 500)', () => {
  assertEquals(routeAction('unified', 'nao_existe'), null);
  assertEquals(routeAction('uapi', ''), null);
});

Deno.test('params em snake_case viram camelCase para as edges', () => {
  assertEquals(
    translateParams({ order_id: 'O1', driver_id: 'D2', page: '3' }),
    { orderId: 'O1', driverId: 'D2', page: '3' },
  );
});

Deno.test('translateParams ignora valor não-string e não inventa chave', () => {
  const entrada = { order_id: 'O1', ruim: 42 } as unknown as Record<string, string>;
  assertEquals(translateParams(entrada), { orderId: 'O1' });
  assertEquals(translateParams(), {});
});

Deno.test('target uapi também resolve as ações v3 (o front manda tudo como unified)', () => {
  const r = routeAction('uapi', 'cities');
  if (isUnsupported(r) || r === null) throw new Error('deveria rotear');
  assertEquals(r.fn, 'lalamove-api');
});
