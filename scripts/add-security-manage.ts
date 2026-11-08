/**
 * Aplica permissão security.manage via Management API
 */

const SUPABASE_PROJECT_REF = 'iecgydonctmabiijadsf';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente antes de rodar este script.');
  process.exit(1);
}
async function applySQL() {
  console.log('🚀 Adicionando permissão security.manage...\n');

  const sql = `
-- Adicionar permissão security.manage
INSERT INTO public.permissions (name, module, action, description)
VALUES ('security.manage', 'security', 'manage', 'Gerenciar configurações de segurança (IP whitelist, MFA, etc)')
ON CONFLICT (name) DO NOTHING;

-- Atribuir ao admin
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, p.id
FROM public.permissions p
WHERE p.name = 'security.manage'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Garantir que TODOS os user_roles têm is_active = true
UPDATE public.user_roles
SET is_active = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'ti@promobrindes.com.br'
);
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

applySQL().catch(console.error);