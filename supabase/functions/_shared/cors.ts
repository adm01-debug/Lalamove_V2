// Shared CORS headers for Edge Functions
// In production, you should ideally restrict 'Access-Control-Allow-Origin' 
// to your specific frontend domain(s).
const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || ['*'];

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0], // For multiple origins, you'd need to check req.headers.get('origin')
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-lalamove-signature, x-request-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Max-Age': '86400',
};
