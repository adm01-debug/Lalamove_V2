// ============================================================================
// ROTATE-TOKENS EDGE FUNCTION
// ============================================================================
// Rotaciona tokens Bitrix24 que estão próximos de expirar
// Deve ser chamada periodicamente (ex: a cada hora via cron job externo)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../_shared/logger.ts';
import {
  errorResponse,
  parseJsonBody,
  resolveContractVersion,
  validateContract,
} from "../_shared/contract.ts";
import { getSchema } from "../_shared/schemas.ts";
import { trackContractUsage } from "../_shared/telemetry.ts";

const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0],
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

async function recordRotationFailure(
  supabase: ReturnType<typeof createClient>,
  failures: Array<{ domain: string; error?: string }>,
): Promise<void> {
  if (failures.length === 0) return;

  const title = failures.length === 1
    ? 'Falha na rotação de token Bitrix24'
    : 'Falhas na rotação de tokens Bitrix24';

  const message = failures
    .map(failure => `${failure.domain}: ${failure.error ?? 'erro desconhecido'}`)
    .join('\n');

  const { error } = await supabase.from('alerts').insert({
    type: 'INTEGRATION_FAILURE',
    severity: 'CRITICAL',
    title,
    message,
    metadata: {
      source: 'rotate-tokens',
      failure_count: failures.length,
      failures,
    },
  });

  if (error) {
    logger.error('[rotate-tokens] Failed to persist rotation alert:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  logger.log('[rotate-tokens] Starting token rotation check');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // Contrato de entrada (formato único de erro 422 + versão v1/v2):
    // supabase/functions/_shared/contract.ts e _shared/schemas.ts.
    const contractVersion = resolveContractVersion(req);
    trackContractUsage("rotate-tokens", contractVersion);
    const parsedBody = await parseJsonBody(req, contractVersion);
    if (!parsedBody.ok) return errorResponse(parsedBody, corsHeaders);
    const contract = validateContract(
      getSchema("rotate-tokens", contractVersion),
      parsedBody.value,
      contractVersion,
    );
    if (!contract.ok) return errorResponse(contract, corsHeaders);
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
      logger.error('[rotate-tokens] Error fetching tokens:', fetchError);
      throw fetchError;
    }

    if (!tokens || tokens.length === 0) {
      logger.log('[rotate-tokens] No tokens need rotation');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No tokens need rotation',
          rotated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.log(`[rotate-tokens] Found ${tokens.length} tokens to rotate`);

    const results: { domain: string; success: boolean; error?: string }[] = [];

    for (const token of tokens as BitrixToken[]) {
      try {
        logger.log(`[rotate-tokens] Rotating token for domain: ${token.domain}`);

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
          logger.error(`[rotate-tokens] Refresh failed for ${token.domain}:`, errorText);
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
          .eq('id', token.id)
          .eq('refresh_token', token.refresh_token);

        if (updateError) {
          logger.error(`[rotate-tokens] Update failed for ${token.domain}:`, updateError);
          results.push({ domain: token.domain, success: false, error: updateError.message });
          continue;
        }

        logger.log(`[rotate-tokens] Successfully rotated token for ${token.domain}`);
        results.push({ domain: token.domain, success: true });

      } catch (tokenError) {
        const errorMessage = tokenError instanceof Error ? tokenError.message : 'Unknown error';
        logger.error(`[rotate-tokens] Error processing ${token.domain}:`, tokenError);
        results.push({ domain: token.domain, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    await recordRotationFailure(
      supabase,
      results
        .filter((result): result is { domain: string; success: false; error?: string } => !result.success)
        .map(result => ({ domain: result.domain, error: result.error })),
    );

    logger.log(`[rotate-tokens] Rotation complete. Success: ${successCount}, Failed: ${failureCount}`);

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
    logger.error('[rotate-tokens] Fatal error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
