-- Versão de compatibilidade: já aplicada em produção (ledger `20261122110913`) antes deste fix.
-- O REVOKE original ficava ANTES de `20261122130100_geo_foundation.sql` (quem cria as 5 funcoes),
-- o que quebra `supabase db reset`/`make db-reset` num banco novo (REVOKE em funcao inexistente).
-- Achado real do Devin Review na PR #260 (comentário em supabase/migrations/20261122110913_revoke_anon_geo_rpcs.sql:12-16).
-- Este arquivo fica como no-op para não duplicar a entrada no ledger; o REVOKE de verdade
-- está em supabase/migrations/20261123190000_revoke_anon_geo_rpcs.sql, depois da criacao das funcoes.
select 1;
