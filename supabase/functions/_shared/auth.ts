import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Returns a 401 response when the Authorization header is missing/invalid. */
function unauthorized(msg = "Unauthorized", extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...extra, "Content-Type": "application/json" },
  });
}

/** Returns a 403 response when the caller lacks the required role. */
function forbidden(requiredRoles: string[], extra: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: `Forbidden: one of [${requiredRoles.join(", ")}] role required` }),
    { status: 403, headers: { ...extra, "Content-Type": "application/json" } },
  );
}

/**
 * Verifica se o caller tem ao menos um dos roles informados.
 *
 * O role é resolvido em duas etapas, para não bloquear quem tem permissão:
 *  1. claim do JWT `app_metadata.role` — só o `service_role` escreve ali; o
 *     `user_metadata.role` é editável pelo próprio usuário
 *     (`auth.updateUser({ data: { role: "admin" } })`) e por isso NÃO é aceito,
 *     sob pena de autopromoção;
 *  2. fonte canônica `public.user_roles`, lida com `service_role` porque
 *     `public.has_role` teve o EXECUTE revogado de `authenticated` na migration
 *     20260715164406.
 *
 * Retorna `{ error: Response }` se não autorizado, `{ error: null }` se OK:
 *
 * ```ts
 * const { error } = await requireRole(req, ["admin", "manager"]);
 * if (error) return error;
 * ```
 */
export async function requireRole(
  req: Request,
  roles: string[],
  extraHeaders: Record<string, string> = {},
): Promise<{ error: Response | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: unauthorized("Unauthorized", extraHeaders) };
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return { error: unauthorized("Unauthorized", extraHeaders) };
  }

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const claimRole = appMetadata.role as string | undefined;
  if (claimRole && roles.includes(claimRole)) {
    return { error: null };
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: rows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const dbRoles = new Set((rows ?? []).map((row) => (row as { role: string }).role));
  if (roles.some((role) => dbRoles.has(role))) {
    return { error: null };
  }

  return { error: forbidden(roles, extraHeaders) };
}

/** Convenience wrapper — requires role "admin". */
export function requireAdmin(
  req: Request,
  extraHeaders: Record<string, string> = {},
): Promise<{ error: Response | null }> {
  return requireRole(req, ["admin"], extraHeaders);
}
