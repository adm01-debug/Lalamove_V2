import { describe, it, expect } from 'vitest';
import {
  epochFromUapiDateTime,
  formatBRLFromFen,
  parseServiceAreas,
  parseSnapshotMeta,
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

describe('compatibilidade com o proxy legado', () => {
  it('lê o extrato também de data.list', () => {
    const flow = parseWalletFlow({
      ok: true,
      body: { data: { list: [{ name: 'Pedidos', amount: -5092, date_time: '2026-04-01 16:05:27' }] } },
    });
    expect(flow.items).toHaveLength(1);
    expect(flow.items[0].amount_fen).toBe(-5092);
  });

  it('lê veículos e áreas quando data é a coleção direta', () => {
    const legacy = {
      ok: true,
      body: {
        data: [{ name: 'São Paulo', city_id: 21001, vehicle_item: [{ name: 'Moto', vehicle_desc: 'Motoca' }] }],
      },
    };
    expect(parseServiceAreas(legacy)).toEqual([{ id: '21001', name: 'São Paulo' }]);
    expect(parseVehicles(legacy)).toEqual([{ id: 'Moto', name: 'Moto', description: 'Motoca' }]);
  });
});

describe('epochFromUapiDateTime', () => {
  it('converte o texto da UAPI (hora local de São Paulo) em epoch de segundos', () => {
    // 16:05:27 em UTC-3 equivale a 19:05:27Z, independente do fuso do navegador.
    expect(epochFromUapiDateTime('2026-04-01 16:05:27')).toBe(Date.UTC(2026, 3, 1, 19, 5, 27) / 1000);
  });

  it('aceita o formato curto "YY-MM-DD HH:mm" dos pedidos', () => {
    expect(epochFromUapiDateTime('01-04-01 16:05')).toBe(Date.UTC(2001, 3, 1, 19, 5, 0) / 1000);
  });

  it('não depende do fuso do navegador', () => {
    const sp = epochFromUapiDateTime('2026-03-09 16:03:16');
    const asSp = new Date(sp! * 1000).toLocaleString('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour12: false,
    });
    expect(asSp).toContain('16:03:16');
  });

  it('devolve undefined sem data válida', () => {
    expect(epochFromUapiDateTime('')).toBeUndefined();
    expect(epochFromUapiDateTime(null)).toBeUndefined();
    expect(epochFromUapiDateTime('sem data')).toBeUndefined();
  });
});

describe('parseWalletFlow — proxy legado', () => {
  it('lê `amount_fen` e `description` quando o proxy antigo responde', () => {
    const flow = parseWalletFlow({
      ret: 0,
      data: {
        list: [{ amount_fen: -5_092, description: 'Reembolso', balance_fen: 12_000, date_time: '2026-03-09 16:03:16' }],
      },
    });
    expect(flow.items[0]).toMatchObject({
      description: 'Reembolso',
      amount_fen: -5_092,
      balance_fen: 12_000,
      create_time: Date.UTC(2026, 2, 9, 19, 3, 16) / 1000,
    });
  });

  it('omite o saldo quando a movimentação não traz `balance_fen`', () => {
    const flow = parseWalletFlow({ ret: 0, data: { flow_item_arr: [{ name: 'Débito', amount: -5_092 }] } });
    expect(flow.items[0]).not.toHaveProperty('balance_fen');
  });
});

describe('parseSnapshotMeta', () => {
  it('reporta quando o dado veio da cópia do robô', () => {
    const meta = parseSnapshotMeta({
      ret: 0,
      data: {},
      _meta: { servedFromSnapshot: true, snapshotCollectedAt: '2026-11-26T10:56:00Z' },
    });
    expect(meta).toEqual({
      servedFromSnapshot: true,
      snapshotCollectedAt: '2026-11-26T10:56:00Z',
      endOfHistory: false,
    });
  });

  it('trata resposta ao vivo como não-snapshot', () => {
    expect(parseSnapshotMeta({ ret: 0, data: {} })).toEqual({
      servedFromSnapshot: false,
      snapshotCollectedAt: null,
      endOfHistory: false,
    });
  });

  it('reconhece a página depois do fim do histórico', () => {
    expect(parseSnapshotMeta({ ret: 0, data: {}, _meta: { endOfHistory: true } })).toEqual({
      servedFromSnapshot: false,
      snapshotCollectedAt: null,
      endOfHistory: true,
    });
  });
});