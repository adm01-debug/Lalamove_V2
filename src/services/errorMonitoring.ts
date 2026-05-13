import { supabase } from '@/integrations/supabase/client';

interface ErrorPayload {
  errorId: string;
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  componentStack?: string;
  source: 'react-boundary' | 'unhandled-error' | 'unhandled-rejection' | 'network' | 'chunk-load' | 'manual';
  severity: 'warning' | 'error' | 'critical';
  url: string;
  userAgent: string;
  appVersion: string;
  metadata?: Record<string, unknown>;
}

function generateFingerprint(name: string, message: string, stack?: string): string {
  const significantStack = stack?.split('\n').slice(0, 3).join('') ?? '';
  const raw = `${name}::${message}::${significantStack}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

// Deduplication: track recently sent fingerprints
const recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 30_000;

function isDuplicate(fingerprint: string): boolean {
  const lastSent = recentErrors.get(fingerprint);
  if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
    return true;
  }
  recentErrors.set(fingerprint, Date.now());
  if (recentErrors.size > 100) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS;
    for (const [key, time] of recentErrors) {
      if (time < cutoff) recentErrors.delete(key);
    }
  }
  return false;
}

// Use raw REST API to avoid type issues with unregistered table
async function rpcInsertError(payload: ErrorPayload, fingerprint: string, userId: string | null): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  // Check if error already exists by fingerprint
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/runtime_error_logs?fingerprint=eq.${fingerprint}&resolved=eq.false&select=id,occurrence_count&limit=1`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }
  );
  const existing = await checkRes.json();

  if (Array.isArray(existing) && existing.length > 0) {
    // Increment occurrence count
    await fetch(
      `${supabaseUrl}/rest/v1/runtime_error_logs?id=eq.${existing[0].id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          occurrence_count: (existing[0].occurrence_count ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          url: payload.url,
          user_agent: payload.userAgent,
        }),
      }
    );
  } else {
    // Insert new error
    await fetch(
      `${supabaseUrl}/rest/v1/runtime_error_logs`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          error_id: payload.errorId,
          error_name: payload.errorName,
          error_message: payload.errorMessage,
          stack_trace: payload.stackTrace?.substring(0, 4000),
          component_stack: payload.componentStack?.substring(0, 4000),
          source: payload.source,
          severity: payload.severity,
          url: payload.url,
          user_agent: payload.userAgent,
          user_id: userId,
          app_version: payload.appVersion,
          fingerprint,
          metadata: payload.metadata ?? {},
        }),
      }
    );
  }
}

async function sendError(payload: ErrorPayload): Promise<void> {
  const fingerprint = generateFingerprint(payload.errorName, payload.errorMessage, payload.stackTrace);

  if (isDuplicate(fingerprint)) return;

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id ?? null;
    await rpcInsertError(payload, fingerprint, userId);
  } catch (err) {
    console.warn('[ErrorMonitoring] Failed to send error:', err);
  }
}

export function captureError(
  error: Error,
  options?: {
    source?: ErrorPayload['source'];
    severity?: ErrorPayload['severity'];
    componentStack?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const payload: ErrorPayload = {
    errorId: generateErrorId(),
    errorName: error.name,
    errorMessage: error.message,
    stackTrace: error.stack,
    componentStack: options?.componentStack,
    source: options?.source ?? 'manual',
    severity: options?.severity ?? 'error',
    url: window.location.href,
    userAgent: navigator.userAgent,
    appVersion: APP_VERSION,
    metadata: options?.metadata,
  };

  sendError(payload);
}

export function initErrorMonitoring(): () => void {
  const handleError = (event: ErrorEvent) => {
    const isChunkError = event.message?.includes('Loading chunk') ||
      event.message?.includes('Failed to fetch dynamically imported module');

    captureError(
      event.error ?? new Error(event.message),
      {
        source: isChunkError ? 'chunk-load' : 'unhandled-error',
        severity: isChunkError ? 'warning' : 'error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      }
    );
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    captureError(error, {
      source: 'unhandled-rejection',
      severity: 'error',
    });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  console.info('[ErrorMonitoring] Initialized — capturing unhandled errors and rejections');

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
