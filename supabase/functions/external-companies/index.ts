import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Ordem de precedência: admin > manager > operator > viewer. ">= operator"
// significa que admin, manager e operator passam; apenas viewer é negado.
const ROLE_PRIORITY: Record<string, number> = {
  admin: 4,
  manager: 3,
  operator: 2,
  viewer: 1,
};

// Exige JWT válido e papel >= operator (admin/manager/operator).
// Retorna { error } se não autorizado, { error: null } se OK.
async function requireOperator(req: Request): Promise<{ error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims();
  if (claimsError || !claimsData?.claims) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  const role = claimsData.claims.app_metadata?.role ?? claimsData.claims.user_metadata?.role;
  const level = ROLE_PRIORITY[role] ?? 0;
  if (level < ROLE_PRIORITY.operator) {
    return { error: new Response(JSON.stringify({ error: 'Forbidden: operator role required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) };
  }
  return { error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authCheck = await requireOperator(req);
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

        let query = externalClient
          .from(table)
          .select('*', { count: 'exact' })
          .range(offset, offset + limit - 1)
          .order('id', { ascending: true });

        if (search) {
          // Build search filter based on table type
          const searchFilters = buildSearchFilter(table, search);
          query = query.or(searchFilters);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ data, count, table }), {
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
        // Unified address search across all tables
        const { search, limit = 20 } = params;
        
        if (!search || search.length < 2) {
          return new Response(JSON.stringify({ results: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const results: any[] = [];
        const term = `%${escapeIlike(search)}%`;

        // Search companies
        const { data: companies } = await externalClient
          .from('companies')
          .select('id, name, address, city, state, zip_code, phone, email, type')
          .or(`name.ilike.${term},address.ilike.${term}`)
          .limit(limit);
        
        if (companies) {
          results.push(...companies.map(c => ({
            ...c,
            source_table: 'companies',
            display_name: c.name,
            full_address: formatAddress(c),
          })));
        }

        // Search customers
        const { data: customers } = await externalClient
          .from('customers')
          .select('id, name, address, city, state, zip_code, phone, email')
          .or(`name.ilike.${term},address.ilike.${term}`)
          .limit(limit);
        
        if (customers) {
          results.push(...customers.map(c => ({
            ...c,
            source_table: 'customers',
            display_name: c.name,
            full_address: formatAddress(c),
          })));
        }

        // Search suppliers
        const { data: suppliers } = await externalClient
          .from('suppliers')
          .select('id, name, address, city, state, zip_code, phone, email')
          .or(`name.ilike.${term},address.ilike.${term}`)
          .limit(limit);
        
        if (suppliers) {
          results.push(...suppliers.map(c => ({
            ...c,
            source_table: 'suppliers',
            display_name: c.name,
            full_address: formatAddress(c),
          })));
        }

        // Search carriers
        const { data: carriers } = await externalClient
          .from('carriers')
          .select('id, name, address, city, state, zip_code, phone, email')
          .or(`name.ilike.${term},address.ilike.${term}`)
          .limit(limit);
        
        if (carriers) {
          results.push(...carriers.map(c => ({
            ...c,
            source_table: 'carriers',
            display_name: c.name,
            full_address: formatAddress(c),
          })));
        }

        // Search contacts
        const { data: contacts } = await externalClient
          .from('contacts')
          .select('id, name, address, city, state, zip_code, phone, email')
          .or(`name.ilike.${term},address.ilike.${term}`)
          .limit(limit);
        
        if (contacts) {
          results.push(...contacts.map(c => ({
            ...c,
            source_table: 'contacts',
            display_name: c.name,
            full_address: formatAddress(c),
          })));
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

function buildSearchFilter(table: string, search: string): string {
  // Common fields across all tables
  const term = `%${escapeIlike(search)}%`;
  return `name.ilike.${term},address.ilike.${term}`;
}

function formatAddress(record: any): string {
  const parts = [
    record.address,
    record.city,
    record.state,
    record.zip_code,
  ].filter(Boolean);
  return parts.join(', ');
}
