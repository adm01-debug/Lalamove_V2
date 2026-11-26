import { describe, it, expect } from 'vitest';
import {
  formatBRLFromFen,
  parseServiceAreas,
  parseVehicles,
  parseWallet,
  parseWalletFlow,
  uapiData,
} from '@/lib/lalamoveUapiPayload';

/** `toLocaleString('pt-BR')` usa espaço não separável entre símbolo e valor. */
const plain = (s: string) => s.replace(/\u00a0/g, ' ');

// Respostas reais do robô (tabela lalamove_uapi_snapshot, 26/11/2026).
const walletBalance = {
  msg: 'Sucesso',
  ret: 0,
  data: { icon_text: '', balance_fen: 45217 },
  _meta: { tokenRefreshed: false, servedFromSnapshot: true, snapshotCollectedAt: '2026-11-26T10:56:42Z' },
};

const walletFlow = {
  msg: 'Sucesso',
  ret: 0,
  data: {
    total: 99999,
    flow_item_arr: [
      {
        name: 'Pedidos',
        amount: -5092,
        city_id: 1,
        sub_name: '',
        user_fid: 'qDdE35mo',
        date_time: '2026-04-01 16:05:27',
        user_name: 'Andressa',
        amount_desc: '-R$50,92',
      },
      {
        name: 'Reembolso',
        amount: 5772,
        city_id: 21001,
        sub_name: '',
        timezone: 'America/Sao_Paulo',
        user_fid: 'qDdE35mo',
        date_time: '2026-03-09 16:03:16',
        user_name: 'Andressa',
      },
    ],
  },
};

const cityInfo = {
  msg: 'Sucesso',
  ret: 0,
  data: {
    city_info_item: [
      {
        name: 'Goiânia',
        city_id: 21007,
        timezone: 'America/Sao_Paulo',
        vehicle_item: [
          { name: 'LalaGo', vehicle_desc: 'Entregas com menor custo e bolso térmica.', plan_type: 2 },
          { name: 'Moto', vehicle_desc: 'Entregas rápidas.', plan_type: 1 },
        ],
      },
      {
        name: 'Goiânia',
        city_id: 21007,
        vehicle_item: [{ name: 'LalaGo', vehicle_desc: 'Entregas com menor custo e bolso térmica.' }],
      },
    ],
  },
};

describe('uapiData', () => {
  it('desembrulha o payload cru da UAPI', () => {
    expect(uapiData<{ balance_fen: number }>(walletBalance)).toEqual({ icon_text: '', balance_fen: 45217 });
  });

  it('continua aceitando o envelope do proxy externo legado', () => {
    expect(uapiData<{ balance_fen: number }>({ ok: true, body: { data: { balance_fen: 1 } } })).toEqual({ balance_fen: 1 });
  });

  it('devolve undefined quando a UAPI recusa a chamada', () => {
    expect(uapiData(undefined)).toBeUndefined();
    expect(uapiData({ ret: 10010, msg: 'Gateway signature error' })).toBeUndefined();
  });
});

describe('parseWallet', () => {
  it('mostra o saldo real da coleta (45217 centavos) em vez de zero', () => {
    const wallet = parseWallet(walletBalance);
    expect(wallet.cents).toBe(45217);
    expect(plain(wallet.formatted)).toBe('R$ 452,17');
  });

  it('respeita o texto formatado do envelope legado quando existir', () => {
    expect(parseWallet({ ok: true, body: { data: { balance_fen: 100 } }, formatted: 'R$ 1,00' }).formatted).toBe('R$ 1,00');
  });

  it('zera o saldo sem dado e sem quebrar com valor inválido', () => {
    expect(parseWallet({ ret: 10010, msg: 'erro' }).cents).toBe(0);
    expect(parseWallet({ ret: 0, data: { balance_fen: null } }).cents).toBe(0);
  });
});

describe('parseWalletFlow', () => {
  it('lê data.flow_item_arr (a UAPI não devolve o campo list)', () => {
    const flow = parseWalletFlow(walletFlow);
    expect(flow.items).toHaveLength(2);
    expect(flow.items[0]).toMatchObject({
      description: 'Pedidos',
      remark: 'Andressa',
      created_at: '2026-04-01 16:05:27',
      amount_fen: -5092,
    });
    expect(flow.items[1].amount_fen).toBe(5772);
    expect(flow.items[0].id).not.toBe(flow.items[1].id);
    expect(flow.total).toBe(99999);
  });

  it('devolve lista vazia sem extrato', () => {
    expect(parseWalletFlow({ ret: 10010, msg: 'erro' })).toEqual({ items: [], total: 0 });
  });
});

describe('parseVehicles', () => {
  it('extrai veículos de data.city_info_item[].vehicle_item[]', () => {
    const vehicles = parseVehicles(cityInfo);
    expect(vehicles.map((v) => v.name)).toEqual(['LalaGo', 'Moto']);
    expect(vehicles[0].description).toBe('Entregas com menor custo e bolso térmica.');
  });

  it('ignora duplicatas entre cidades e devolve vazio sem cidade', () => {
    expect(parseVehicles(cityInfo)).toHaveLength(2);
    expect(parseVehicles({ ret: 0, data: {} })).toEqual([]);
  });
});

describe('parseServiceAreas', () => {
  it('extrai as cidades atendidas de data.city_info_item[]', () => {
    expect(parseServiceAreas(cityInfo)).toEqual([{ id: '21007', name: 'Goiânia' }]);
  });

  it('devolve vazio quando a UAPI recusa a chamada', () => {
    expect(parseServiceAreas({ ret: 10010, msg: 'erro' })).toEqual([]);
  });
});

describe('formatBRLFromFen', () => {
  it('converte centavos em reais', () => {
    expect(plain(formatBRLFromFen(0))).toBe('R$ 0,00');
    expect(plain(formatBRLFromFen(123456))).toBe('R$ 1.234,56');
  });
});