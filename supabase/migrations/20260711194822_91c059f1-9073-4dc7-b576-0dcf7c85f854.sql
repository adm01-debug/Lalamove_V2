-- Corrige FKs de auditoria: NO ACTION -> SET NULL
-- Preserva histórico e não bloqueia exclusão de usuários.

ALTER TABLE public.geo_blocks
  DROP CONSTRAINT geo_blocks_blocked_by_fkey,
  ADD CONSTRAINT geo_blocks_blocked_by_fkey
    FOREIGN KEY (blocked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.password_reset_requests
  DROP CONSTRAINT password_reset_requests_reviewed_by_fkey,
  ADD CONSTRAINT password_reset_requests_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;