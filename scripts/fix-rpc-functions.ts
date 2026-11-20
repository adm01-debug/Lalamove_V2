/**
 * Sobrescreve a função get_user_permissions para funcionar corretamente
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
async function applyFix() {
  const sql = `
-- Recriar função get_user_permissions SEM a restrição auth.uid() = _user_id
-- (que exige contexto auth, mas estamos chamando via service role)
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission_name text, module text, action text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.name, p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  JOIN public.permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = _user_id
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
$function$;

-- Recriar função get_user_roles também
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
$function$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated, anon, service_role;
`;

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        query: sql,
        read_only: false,
      }),
    }
  );

  const result = await response.text();
  console.log('Status:', response.status);
  console.log('Resposta:', result);
}

applyFix().catch(console.error);