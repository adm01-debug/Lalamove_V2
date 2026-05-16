// ============================================================================
// EDGE FUNCTION: Job Worker
// Descrição: Processa jobs da fila de forma assíncrona
// Versão: 1.0.0
// Data: 2025-12-26
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logger } from '../_shared/logger.ts';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ============================================================================
// TIPOS
// ============================================================================

interface JobPayload {
  jobId: string;
  type: 'webhook' | 'notification' | 'evaluation' | 'bitrix_sync' | 'email' | 'whatsapp' | 'slack';
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  stack?: string;
  duration_ms?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

function logger(level: 'info' | 'warn' | 'error', message: string, metadata?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...metadata
  };
  
  logger.log(JSON.stringify(logEntry));
}

// ============================================================================
// PROCESSADORES DE JOBS POR TIPO
// ============================================================================

async function processWebhook(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing webhook job', { payload });
  
  // Chamar Edge Function evaluate-driver
  const { data, error } = await supabase.functions.invoke('evaluate-driver', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processNotification(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing notification job', { payload });
  
  // Chamar Edge Function send-notification
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processEvaluation(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing evaluation job', { payload });
  
  // Chamar Edge Function evaluate-driver
  const { data, error } = await supabase.functions.invoke('evaluate-driver', {
    body: {
      driverId: payload.driverId,
      orderId: payload.orderId,
      ...payload
    }
  });
  
  if (error) throw error;
  
  return data;
}

async function processBitrixSync(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing Bitrix24 sync job', { payload });
  
  // Chamar Edge Function bitrix24-sync
  const { data, error } = await supabase.functions.invoke('bitrix24-sync', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processEmail(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing email job', { payload });
  
  // Chamar Edge Function send-email (se existir)
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processWhatsApp(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing WhatsApp job', { payload });
  
  // Chamar Edge Function send-whatsapp (se existir)
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

async function processSlack(supabase: any, payload: any): Promise<any> {
  logger('info', 'Processing Slack job', { payload });
  
  // Chamar Edge Function send-slack (se existir)
  const { data, error } = await supabase.functions.invoke('send-slack', {
    body: payload
  });
  
  if (error) throw error;
  
  return data;
}

// ============================================================================
// PROCESSADOR PRINCIPAL
// ============================================================================

async function processJob(jobPayload: JobPayload): Promise<JobResult> {
  const startTime = Date.now();
  const supabase = createSupabaseClient();
  
  logger('info', 'Starting job processing', {
    jobId: jobPayload.jobId,
    type: jobPayload.type
  });
  
  try {
    let result: any;
    
    // Processar baseado no tipo
    switch (jobPayload.type) {
      case 'webhook':
        result = await processWebhook(supabase, jobPayload.payload);
        break;
        
      case 'notification':
        result = await processNotification(supabase, jobPayload.payload);
        break;
        
      case 'evaluation':
        result = await processEvaluation(supabase, jobPayload.payload);
        break;
        
      case 'bitrix_sync':
        result = await processBitrixSync(supabase, jobPayload.payload);
        break;
        
      case 'email':
        result = await processEmail(supabase, jobPayload.payload);
        break;
        
      case 'whatsapp':
        result = await processWhatsApp(supabase, jobPayload.payload);
        break;
        
      case 'slack':
        result = await processSlack(supabase, jobPayload.payload);
        break;
        
      default:
        throw new Error(`Unknown job type: ${jobPayload.type}`);
    }
    
    const duration = Date.now() - startTime;
    
    logger('info', 'Job completed successfully', {
      jobId: jobPayload.jobId,
      type: jobPayload.type,
      duration_ms: duration
    });
    
    // Marcar job como completo
    await supabase.rpc('mark_job_completed', {
      p_job_id: jobPayload.jobId,
      p_result: result
    });
    
    return {
      success: true,
      result,
      duration_ms: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger('error', 'Job failed', {
      jobId: jobPayload.jobId,
      type: jobPayload.type,
      error: errorMessage,
      stack: errorStack,
      duration_ms: duration
    });
    
    // Marcar job como falhado (com retry automático)
    await supabase.rpc('mark_job_failed', {
      p_job_id: jobPayload.jobId,
      p_error_message: errorMessage,
      p_error_stack: errorStack
    });
    
    return {
      success: false,
      error: errorMessage,
      stack: errorStack,
      duration_ms: duration
    };
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

Deno.serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
      }
    });
  }
  
  try {
    // Verificar autenticação (apenas service role ou autenticado)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    
    // Parse request body
    const jobPayload: JobPayload = await req.json();
    
    // Validar payload
    if (!jobPayload.jobId || !jobPayload.type || !jobPayload.payload) {
      throw new Error('Invalid job payload: missing required fields');
    }
    
    logger('info', 'Job worker invoked', {
      jobId: jobPayload.jobId,
      type: jobPayload.type
    });
    
    // Processar job
    const result = await processJob(jobPayload);
    
    // Retornar resultado
    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
    
  } catch (error) {
    logger.error('Job worker error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error in job worker'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});

// ============================================================================
// FIM DA EDGE FUNCTION
// ============================================================================
