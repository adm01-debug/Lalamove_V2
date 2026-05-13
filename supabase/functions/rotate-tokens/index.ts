// ============================================================================
// ROTATE-TOKENS EDGE FUNCTION
// ============================================================================
// Rotaciona tokens Bitrix24 que estão próximos de expirar
// Deve ser chamada periodicamente (ex: a cada hora via cron job externo)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BitrixToken {
  id: string;
  domain: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[rotate-tokens] Starting token rotation check');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar tokens que expiram nas próximas 2 horas
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 2);

    const { data: tokens, error: fetchError } = await supabase
      .from('bitrix24_tokens')
      .select('*')
      .lt('expires_at', expirationThreshold.toISOString());

    if (fetchError) {
      console.error('[rotate-tokens] Error fetching tokens:', fetchError);
      throw fetchError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('[rotate-tokens] No tokens need rotation');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No tokens need rotation',
          rotated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[rotate-tokens] Found ${tokens.length} tokens to rotate`);

    const results: { domain: string; success: boolean; error?: string }[] = [];

    for (const token of tokens as BitrixToken[]) {
      try {
        console.log(`[rotate-tokens] Rotating token for domain: ${token.domain}`);

        // Chamar API Bitrix24 para refresh
        const refreshUrl = `https://${token.domain}/oauth/token/`;
        const refreshParams = new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: Deno.env.get('BITRIX24_CLIENT_ID') || '',
          client_secret: Deno.env.get('BITRIX24_CLIENT_SECRET') || '',
          refresh_token: token.refresh_token,
        });

        const refreshResponse = await fetch(refreshUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: refreshParams.toString(),
        });

        if (!refreshResponse.ok) {
          const errorText = await refreshResponse.text();
          console.error(`[rotate-tokens] Refresh failed for ${token.domain}:`, errorText);
          results.push({ domain: token.domain, success: false, error: errorText });
          continue;
        }

        const refreshData: RefreshResponse = await refreshResponse.json();

        // Calcular nova data de expiração
        const newExpiresAt = new Date();
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + refreshData.expires_in);

        // Atualizar token no banco
        const { error: updateError } = await supabase
          .from('bitrix24_tokens')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token,
            expires_at: newExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', token.id);

        if (updateError) {
          console.error(`[rotate-tokens] Update failed for ${token.domain}:`, updateError);
          results.push({ domain: token.domain, success: false, error: updateError.message });
          continue;
        }

        console.log(`[rotate-tokens] Successfully rotated token for ${token.domain}`);
        results.push({ domain: token.domain, success: true });

      } catch (tokenError) {
        const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
        console.error(`[rotate-tokens] Error processing ${token.domain}:`, tokenError);
        results.push({ domain: token.domain, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[rotate-tokens] Rotation complete. Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(
      JSON.stringify({
        success: failureCount === 0,
        message: `Rotated ${successCount} tokens, ${failureCount} failed`,
        rotated: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[rotate-tokens] Fatal error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
