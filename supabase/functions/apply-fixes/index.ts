import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { action } = await req.json()

    if (action === 'fix_dashboard') {
      const statements = [
        `DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles`,
        `DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles`,

        `CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true)`,
        `CREATE POLICY "Authenticated users can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true)`,
        `CREATE POLICY "Authenticated users can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (true)`,
        `CREATE POLICY "Service role full access user_roles" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true)`,
      ]

      const results: string[] = []
      for (const sql of statements) {
        try {
          const { error } = await supabase.rpc('exec', { query: sql })
          if (error) throw error
          results.push(`OK: ${sql.substring(0, 50)}`)
        } catch (err) {
          results.push(`ERR: ${err.message}`)
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})