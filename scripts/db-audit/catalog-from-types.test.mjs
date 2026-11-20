import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  TYPES_PATH_PADRAO,
  carregarCatalogoDeTypes,
  catalogoDeTypes,
} from './catalog-from-types.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');

// Fixture no formato exato do `supabase gen types typescript` (indentacao de 2
// espacos por nivel), incluindo o bloco `export const Constants` do fim do
// arquivo, que REABRE as secoes Enums e nao pode entrar no catalogo.
const TYPES_FIXTURE = `export type Json = string | number | boolean | null

export type Database = {
  public: {
    Tables: {
      lalamove_orders: {
        Row: {
          id: string
          status: string
        }
      }
      driver_incidents: {
        Row: {
          id: string
        }
      }
    }
    Views: {
      drivers_safe_view: {
        Row: {
          id: string | null
        }
      }
    }
    Functions: {
      has_role: { Args: { _user_id: string }; Returns: boolean }
      check_login_lockout: {
        Args: { p_email: string }
        Returns: {
          attempt_count: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager"
      alert_type:
        | "DRIVER_BLOCKED"
        | "ROUTE_DEVIATION"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const Constants = {
  public: {
    Enums: {
      nao_deve_entrar: ["x"],
    },
  },
} as const
`;

test('catalogoDeTypes le tabelas, views, funcoes e enums do schema public', () => {
  const catalogo = catalogoDeTypes(TYPES_FIXTURE);
  assert.deepEqual(catalogo.tables, ['driver_incidents', 'lalamove_orders']);
  assert.deepEqual(catalogo.views, ['drivers_safe_view']);
  assert.deepEqual(catalogo.functions, ['check_login_lockout', 'has_role']);
  assert.deepEqual(catalogo.enums, ['alert_type', 'app_role']);
});

test('catalogoDeTypes para no export const Constants (nao reabre Enums)', () => {
  const catalogo = catalogoDeTypes(TYPES_FIXTURE);
  assert.equal(catalogo.enums.includes('nao_deve_entrar'), false);
});

test('catalogoDeTypes ignora campos internos (Row/Args/Returns) como objetos', () => {
  const catalogo = catalogoDeTypes(TYPES_FIXTURE);
  for (const interno of ['Row', 'Args', 'Returns', 'id', 'status']) {
    assert.equal(catalogo.tables.includes(interno), false, interno + ' entrou como tabela');
    assert.equal(catalogo.functions.includes(interno), false, interno + ' entrou como funcao');
  }
});

test('catalogoDeTypes devolve a forma esperada pelo supabase-usage-guard', () => {
  const catalogo = catalogoDeTypes(TYPES_FIXTURE);
  assert.equal(catalogo.format_version, 2);
  // Data zero: faz a projecao forward-only percorrer TODAS as migrations.
  assert.equal(catalogo.generated_at, '0000-00-00');
  assert.deepEqual(catalogo.function_signatures, []);
  assert.deepEqual(catalogo.trigger_functions, []);
});

test('carregarCatalogoDeTypes recusa arquivo ausente com mensagem acionavel', () => {
  const ausente = path.join(os.tmpdir(), 'types-que-nao-existe-' + process.pid + '.ts');
  assert.throws(() => carregarCatalogoDeTypes(ausente), /types.ts ausente ou ilegivel/);
});

test('carregarCatalogoDeTypes recusa types.ts sem nenhuma tabela reconhecida', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'types-vazio-'));
  const arquivo = path.join(diretorio, 'types.ts');
  fs.writeFileSync(arquivo, 'export type Database = { public: { Tables: {} } }\n');
  try {
    assert.throws(() => carregarCatalogoDeTypes(arquivo), /nenhuma tabela reconhecida/);
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
});

test('o types.ts real deste repo e legivel e tem objetos do dominio Lalamove', () => {
  const catalogo = carregarCatalogoDeTypes(path.join(RAIZ, TYPES_PATH_PADRAO));
  assert.ok(catalogo.tables.length >= 20, 'poucas tabelas lidas: ' + catalogo.tables.length);
  assert.ok(catalogo.tables.includes('lalamove_orders'), 'lalamove_orders ausente');
  assert.ok(catalogo.functions.includes('has_role'), 'has_role ausente');
});
