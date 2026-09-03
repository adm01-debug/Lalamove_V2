-- Hardening: remover grants de tabela/sequence do papel `anon` (defense-in-depth).
--
-- Contexto: por padrão o Supabase concede ALL em todas as tabelas de `public`
-- para `anon` e confia no RLS como camada de autorização. RLS está em 100% das
-- tabelas (0 policies permissivas para anon), então nenhum fluxo depende de
-- acesso direto de `anon` a tabelas — o fluxo pré-login (lockout/reset/MFA) usa
-- RPCs SECURITY DEFINER. Remover os grants elimina a superfície latente: se uma
-- tabela futura ficar sem RLS, `anon` não terá acesso implícito.
--
-- Preserva: EXECUTE de `anon` nas funções (check_login_lockout_v2,
-- record_failed_login_v2) — não são tocadas aqui. `authenticated` e
-- `service_role` permanecem intactos.
-- Idempotente e reversível (basta re-conceder).

-- 1) Tabelas e views existentes
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;

-- 2) Sequences existentes (anon não insere → não precisa de nextval/currval)
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- 3) Tabelas/sequences criadas no futuro por `postgres` não devem reconceder anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- 4) Mesmo para objetos criados por `supabase_admin` (segundo dono nos defaults)
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
