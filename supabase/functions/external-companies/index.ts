import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireRole } from "../_shared/auth.ts";
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Tabelas que existem no banco externo de produto (projeto doufsxqlfjyuvxuezpln)
 * e as colunas reais de cada uma.
 *
 * O endpoint foi escrito contra um schema genérico (address/city/state/zip_code
 * em todas as tabelas). O PostgREST devolve erro para coluna inexistente, então
 * cada `select`/filtro com esse schema derrubava a ação inteira em 500 e a busca
 * de endereço nunca devolvia nada. No banco real `customers`, `carriers` e
 * `contacts` não existem, `companies` só tem marca e nome, e endereço existe
 * apenas em `suppliers` (sede) e `supplier_branches` (filial/CD).
 */
interface ExternalTableConfig {
  /** Colunas reais da tabela, usadas em `select` e nos filtros `ilike`. */
  fields: string[];
  /** Colunas de texto pesquisáveis. */
  searchFields: string[];
  /** Campos que compõem o endereço completo, na ordem de exibição. */
  addressFields: string[];
}

const EXTERNAL_TABLES: Record<string, ExternalTableConfig | undefined> = {
  companies: {
    fields: ['id', 'name'],
    searchFields: ['name'],
    addressFields: [],
  },
  suppliers: {
    fields: ['id', 'name', 'trading_name', 'address', 'state_uf', 'phone', 'email'],
    searchFields: ['name', 'trading_name', 'address'],
    // `address` já vem com cidade/UF/CEP ("... - São Paulo/SP - 04551-080");
    // somar cidade e UF aqui duplicaria o final do endereço exibido.
    addressFields: ['address'],
  },
  supplier_branches: {
    fields: ['id', 'branch_name', 'address', 'city', 'state_uf'],
    searchFields: ['branch_name', 'address'],
    addressFields: ['address'],
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authCheck = await requireRole(req, ['admin', 'manager', 'operator']);
  if (authCheck.error) return authCheck.error;

  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');

  if (!externalUrl || !externalKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error: Missing external database credentials' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const externalClient = createClient(externalUrl, externalKey);
    // Contrato de entrada (422 no formato único + versão v1/v2).
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("external-companies", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("external-companies", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);

    const { action, ...params } = contract.data as { action: string } & Record<string, any>;

    // Supported tables
    const ALLOWED_TABLES = ['companies', 'customers', 'suppliers', 'carriers', 'contacts'] as const;
    type AllowedTable = typeof ALLOWED_TABLES[number];

    switch (action) {
      case 'list': {
        const { table = 'companies', search, limit = 50, offset = 0 } = params;
        
        if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
          return new Response(
            JSON.stringify({ error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const listConfig = EXTERNAL_TABLES[table];
        // Tabela prevista no contrato mas inexistente no banco de produto: lista
        // vazia em vez de 500 — a página mostra "sem registros" e o operador segue.
        if (!listConfig) {
          return new Response(JSON.stringify({ data: [], count: 0, table, unavailable: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let query = externalClient
          .from(table)
          .select('*', { count: 'exact' })
          .range(offset, offset + limit - 1)
          .order('id', { ascending: true });

        if (search) {
          query = query.or(buildSearchFilter(listConfig, search));
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ data: (data ?? []).map(normalizeRow), count, table }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get': {
        const { table = 'companies', id } = params;
        
        if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
          return new Response(
            JSON.stringify({ error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!id) {
          return new Response(
            JSON.stringify({ error: 'Missing required parameter: id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!EXTERNAL_TABLES[table]) {
          return new Response(JSON.stringify({ data: null, unavailable: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await externalClient
          .from(table)
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'search_address': {
        // Busca unificada nos cadastros externos que têm endereço: sede do
        // fornecedor e suas filiais (o CD é o ponto de coleta real do pedido).
        const { search, limit = 20 } = params;
        
        if (!search || search.length < 2) {
          return new Response(JSON.stringify({ results: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const results: any[] = [];
        const supplierConfig = EXTERNAL_TABLES.suppliers!;

        // `select` montado em runtime perde a inferência do supabase-js (o retorno
        // vira GenericStringError); as colunas vêm de EXTERNAL_TABLES.
        const { data: suppliers } = (await externalClient
          .from('suppliers')
          .select(supplierConfig.fields.join(', '))
          .or(buildSearchFilter(supplierConfig, search))
          .limit(limit)) as { data: any[] | null };

        for (const supplier of suppliers ?? []) {
          const fullAddress = formatAddress(supplier, supplierConfig.addressFields);
          // Registro sem endereço não serve para uma busca de endereço.
          if (!fullAddress) continue;
          results.push({
            ...normalizeRow(supplier),
            source_table: 'suppliers',
            display_name: supplier.name,
            full_address: fullAddress,
          });
        }

        const branchConfig = EXTERNAL_TABLES.supplier_branches!;
        const supplierNames = new Map<string, string>(
          (suppliers ?? []).map((s: any) => [s.id, s.name] as [string, string]),
        );
        const { data: branches } = (await externalClient
          .from('supplier_branches')
          .select([...branchConfig.fields, 'supplier_id'].join(', '))
          .or(buildSearchFilter(branchConfig, search))
          .limit(limit)) as { data: any[] | null };

        // `suppliers` só trouxe quem casou com o termo buscado; a filial pode
        // pertencer a um fornecedor que não casou. Sem isso o resultado aparece
        // como "Matriz SP" e o operador não sabe de quem é o ponto de coleta.
        const missingOwnerIds = [...new Set(
          (branches ?? []).map((b: any) => b.supplier_id).filter((id: unknown): id is string => !!id && !supplierNames.has(id as string)),
        )];
        if (missingOwnerIds.length) {
          const { data: owners } = (await externalClient
            .from('suppliers')
            .select('id, name')
            .in('id', missingOwnerIds)) as { data: any[] | null };
          for (const owner of owners ?? []) supplierNames.set(owner.id, owner.name);
        }

        for (const branch of branches ?? []) {
          const fullAddress = formatAddress(branch, branchConfig.addressFields);
          if (!fullAddress) continue;
          const owner = branch.supplier_id ? supplierNames.get(branch.supplier_id) : undefined;
          results.push({
            ...normalizeRow(branch),
            source_table: 'suppliers',
            display_name: owner ? `${owner} — ${branch.branch_name}` : branch.branch_name,
            full_address: fullAddress,
          });
        }

        // O filtro acima exige o termo inteiro e com acento ("rua sao tome" nao
        // acha "Rua São Tomé"). Quem digita no painel raramente acentua, entao
        // quando nada casou varre as duas tabelas comparando sem acento e por
        // termos separados. A varredura tambem completa o mapa de donos das
        // filiais, que aqui vem inteiro.
        if (results.length === 0) {
          const terms = tokenizeSearch(search);

          const { data: allSuppliers } = (await externalClient
            .from('suppliers')
            .select(supplierConfig.fields.join(', '))
            .limit(SEARCH_SCAN_LIMIT)) as { data: any[] | null };

          for (const supplier of allSuppliers ?? []) {
            supplierNames.set(supplier.id, supplier.name);
            const fullAddress = formatAddress(supplier, supplierConfig.addressFields);
            if (!fullAddress) continue;
            if (!matchesAllTerms(supplier, supplierConfig.searchFields, terms)) continue;
            results.push({
              ...normalizeRow(supplier),
              source_table: 'suppliers',
              display_name: supplier.name,
              full_address: fullAddress,
            });
          }

          const { data: allBranches } = (await externalClient
            .from('supplier_branches')
            .select([...branchConfig.fields, 'supplier_id'].join(', '))
            .limit(SEARCH_SCAN_LIMIT)) as { data: any[] | null };

          for (const branch of allBranches ?? []) {
            const fullAddress = formatAddress(branch, branchConfig.addressFields);
            if (!fullAddress) continue;
            if (!matchesAllTerms(branch, branchConfig.searchFields, terms)) continue;
            const owner = branch.supplier_id ? supplierNames.get(branch.supplier_id) : undefined;
            results.push({
              ...normalizeRow(branch),
              source_table: 'suppliers',
              display_name: owner ? `${owner} — ${branch.branch_name}` : branch.branch_name,
              full_address: fullAddress,
            });
          }

          if (results.length > limit) results.length = limit;
        }

        return new Response(JSON.stringify({ results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'schema': {
        const { table = 'companies' } = params;
        
        if (!ALLOWED_TABLES.includes(table as AllowedTable)) {
          return new Response(
            JSON.stringify({ error: `Invalid table. Allowed: ${ALLOWED_TABLES.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!EXTERNAL_TABLES[table]) {
          return new Response(JSON.stringify({ columns: [], sample: [], table, unavailable: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data, error } = await externalClient
          .from(table)
          .select('*')
          .limit(3);

        if (error) throw error;

        const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
        return new Response(JSON.stringify({ columns, sample: data, table }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'stats': {
        // Get counts for all tables
        const counts: Record<string, number> = {};
        
        for (const table of ALLOWED_TABLES) {
          // Tabela do contrato sem equivalente no banco de produto: 0 explícito,
          // para a UI mostrar zero em vez de erro.
          if (!EXTERNAL_TABLES[table]) {
            counts[table] = 0;
            continue;
          }

          const { count, error } = await externalClient
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            counts[table] = count ?? 0;
          }
        }

        return new Response(JSON.stringify({ counts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action', available: ['list', 'get', 'search_address', 'schema', 'stats'] }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('External companies error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Escapa um termo de busca para uso em filtros `ilike` do PostgREST.
// PostgREST interpreta `,`, `(`, `)`, `.` e `%` como operadores/estrutura no
// filtro `.or(...)`. Sem escapar, um termo como `a,b)c` quebra o filtro ou
// injeta uma condição arbitrária. Remove os caracteres com significado no DSL.
function escapeIlike(value: string): string {
  return value.replace(/[,().%\\]/g, '');
}

function buildSearchFilter(config: ExternalTableConfig, search: string): string {
  const term = `%${escapeIlike(search)}%`;
  return config.searchFields.map((field) => `${field}.ilike.${term}`).join(',');
}

// Teto da varredura tolerante a acento (ver search_address). As duas tabelas
// com endereco somam poucas dezenas de linhas; o teto so evita surpresa se o
// cadastro crescer muito.
const SEARCH_SCAN_LIMIT = 500;

// `ilike` do Postgres compara bytes, entao "SÃO TOMÉ" nao casa com "sao tome".
// normalizeText derruba acento e caixa para a comparacao em memoria.
function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    : '';
}

function tokenizeSearch(search: string): string[] {
  return normalizeText(search).split(/\s+/).filter((term) => term.length > 0);
}

// Todos os termos precisam aparecer, em qualquer campo e em qualquer ordem:
// "sao tome" acha "Rua Sao Tome, 119 - Vila Olimpia, Sao Paulo/SP".
function matchesAllTerms(
  record: Record<string, unknown>,
  fields: string[],
  terms: string[],
): boolean {
  const haystack = normalizeText(fields.map((field) => record[field]).join(' '));
  return terms.every((term) => haystack.includes(term));
}

// A UI do painel consome `state` (ExternalRecord); o banco de produto chama a
// coluna de `state_uf`, então a UF chegaria vazia e a coluna Cidade/UF ficaria "—".
function normalizeRow(row: any): any {
  if (!row || row.state_uf === undefined || row.state !== undefined) return row;
  return { ...row, state: row.state_uf };
}

function formatAddress(record: Record<string, unknown>, fields: string[]): string {
  return fields
    .map((field) => record[field])
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');
}
