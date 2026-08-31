/**
 * Aplica UPDATE direto via Management API para corrigir is_active
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const ACCESS_TOKEN = 'sbp_b7e6f411bde011e801924e1113cf4e26d5d57938';

async function applyFix() {
  const sql = `
-- Garante que o usuário ti@promobrindes tem role admin ATIVO
UPDATE public.user_roles
SET is_active = true, updated_at = now()
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'ti@promobrindes.com.br')
  AND role = 'admin';

-- Verifica quantas permissões existem para role admin
SELECT COUNT(*) as admin_perms
FROM public.role_permissions
WHERE role = 'admin';

-- Mostra o user_role atualizado
SELECT u.email, ur.role, ur.is_active, ur.expires_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'ti@promobrindes.com.br';
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