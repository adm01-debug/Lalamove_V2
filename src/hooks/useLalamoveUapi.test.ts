import { describe, it, expect } from 'vitest';
import { extractOrderPage, fleetDriverMatches } from '@/hooks/useLalamoveUapi';

// Pedido real do snapshot do robô (order_list_new, 26/11/2026).
const payload = {
  is_end: 0,
  last_id: '{"app":{"date":"2026-03-10 01:29:14","_id":"91931477","recursion":1}}',
  order_base_info: [
    {
      order_uuid: 'a1',
      order_display_id: 3464272547095462400,
      order_status: '2',
      order_time: '1775070925',
      final_price_fen: '5092',
      price_total_fen: '5092',
      addr_info: [{ addr: 'Av. Otaviano Alves de Lima, 6800' }, { addr: 'Rua B, 100' }],
    },
    {
      order_uuid: 'a2',
      order_status: 3,
      order_datetime_hts: '1775050908000',
      price_total_fen: '1096',
      addr_info: [{ name: 'Coleta' }, { name: 'Entrega' }],
    },
    { order_display_id: 'sem-uuid' },
  ],
};

describe('extractOrderPage', () => {
  it('lê data.order_base_info com valor, data e endereços reais', () => {
    const { orders } = extractOrderPage(payload);
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      order_uuid: 'a1',
      order_display_id: '3464272547095462400',
      order_status: 2,
      create_time: 1775070925,
      total_fee_fen: 5092,
      from_address: 'Av. Otaviano Alves de Lima, 6800',
      to_address: 'Rua B, 100',
    });
  });

  it('usa order_datetime_hts quando falta order_time e ignora item sem uuid', () => {
    const { orders } = extractOrderPage(payload);
    expect(orders[1].create_time).toBe(1775050908);
    expect(orders.map((o) => o.order_uuid)).toEqual(['a1', 'a2']);
  });

  it('devolve o cursor opaco last_id, não o uuid do último item', () => {
    expect(extractOrderPage(payload).nextCursor).toBe(
      '{"app":{"date":"2026-03-10 01:29:14","_id":"91931477","recursion":1}}',
    );
  });

  it('encerra a paginação quando is_end está ligado ou não há last_id', () => {
    expect(extractOrderPage({ ...payload, is_end: 1 }).nextCursor).toBeNull();
    expect(extractOrderPage({ is_end: 0, order_base_info: [] }).nextCursor).toBeNull();
  });

  it('aceita o formato de lista legado e resposta inválida', () => {
    expect(extractOrderPage({ list: [{ order_uuid: 'b1' }] }).orders[0].order_uuid).toBe('b1');
    expect(extractOrderPage(null)).toEqual({ orders: [], nextCursor: null });
    expect(extractOrderPage({ ret: 10010, msg: 'erro' })).toEqual({ orders: [], nextCursor: null });
  });
});

describe('fleetDriverMatches', () => {
  const ana = { driver_fid: 'f1', name: 'Ana Souza', physics_vehicle_name: 'Fiorino' };
  const bruno = { driver_fid: 'f2', name: 'Bruno Lima', brand_series: 'HR' };

  it('filtra pelo nome, placa-modelo e identificador', () => {
    expect(fleetDriverMatches(ana, 'bruno')).toBe(false);
    expect(fleetDriverMatches(bruno, 'bruno')).toBe(true);
    expect(fleetDriverMatches(ana, 'fiorino')).toBe(true);
    expect(fleetDriverMatches(bruno, 'f2')).toBe(true);
  });

  it('termo vazio ou sem correspondência', () => {
    expect(fleetDriverMatches(ana, '')).toBe(true);
    expect(fleetDriverMatches(ana, 'carlos')).toBe(false);
  });
});
