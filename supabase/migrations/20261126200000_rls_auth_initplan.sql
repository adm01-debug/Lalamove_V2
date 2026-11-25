-- ============================================================================
-- RLS: avalia `auth.uid()` / `auth.role()` uma vez por consulta, nao por linha.
--
-- O advisor `auth_rls_initplan` aponta 221 policies em `public` que chamam
-- `auth.uid()` direto dentro do predicado. O planejador avalia esse predicado
-- para CADA linha candidata; envolvendo a chamada num subselect
-- (`(select auth.uid())`) ela vira InitPlan e e executada uma unica vez.
--
-- A troca e so de avaliacao: a expressao logica continua identica. Nada de
-- policy e criada, removida, renomeada ou muda de `cmd`/`roles`. Rodar de novo
-- nao envolve duas vezes: antes de gravar, a migration desfaz qualquer
-- `( SELECT auth.uid() AS uid)` que ja exista.
--
-- As duas provas no fim comparam o texto normalizado (sem espacos e com o
-- subselect desfeito) de cada expressao antes e depois. Qualquer policy que
-- tenha sumido ou cuja logica tenha mudado aborta a migration inteira.
-- ============================================================================
BEGIN;

CREATE FUNCTION pg_temp.unwrap_auth(e text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT regexp_replace(coalesce(e, ''),
           '\(\s*select\s+auth\.(uid|role)\(\)(\s+AS\s+\w+)?\s*\)', 'auth.\1()', 'gi');
$fn$;

-- mesmo desfazimento acima, agora sem espacos, para comparar textos
CREATE FUNCTION pg_temp.norm_auth(e text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT lower(regexp_replace(pg_temp.unwrap_auth(coalesce(e, '')), '\s', '', 'g'));
$fn$;

-- remove o subselect ja aplicado, deixando so as chamadas cruas
CREATE FUNCTION pg_temp.strip_auth_subselect(e text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT regexp_replace(coalesce(e, ''),
           '\(\s*select\s+auth\.(uid|role)\(\)(\s+AS\s+\w+)?\s*\)', '', 'gi');
$fn$;

CREATE TEMP TABLE _pol_before ON COMMIT DROP AS
SELECT schemaname, tablename, policyname, cmd, roles::text[] AS roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'auth\.(uid|role)\(\)';

DO $$
DECLARE
  r         record;
  v_qual    text;
  v_check   text;
  v_roles   text;
  v_using   text := '';
  v_checkkw text := '';
BEGIN
  FOR r IN SELECT * FROM _pol_before ORDER BY tablename, policyname LOOP
    v_qual := CASE WHEN r.qual IS NULL THEN NULL ELSE
      replace(replace(pg_temp.unwrap_auth(r.qual),
                      'auth.uid()', '(select auth.uid())'),
                      'auth.role()', '(select auth.role())') END;
    v_check := CASE WHEN r.with_check IS NULL THEN NULL ELSE
      replace(replace(pg_temp.unwrap_auth(r.with_check),
                      'auth.uid()', '(select auth.uid())'),
                      'auth.role()', '(select auth.role())') END;

    -- `USING` so existe onde o comando permite ler a linha; `WITH CHECK` so
    -- onde permite escrever. Emitir clausula fora disso e erro de sintaxe.
    v_using := CASE WHEN v_qual IS NOT NULL AND r.cmd IN ('ALL', 'SELECT', 'UPDATE', 'DELETE')
                    THEN format(' using (%s)', v_qual) ELSE '' END;
    v_checkkw := CASE WHEN v_check IS NOT NULL AND r.cmd IN ('ALL', 'INSERT', 'UPDATE')
                      THEN format(' with check (%s)', v_check) ELSE '' END;

    v_roles := array_to_string(array(SELECT quote_ident(x) FROM unnest(r.roles) AS x), ', ');

    EXECUTE format('alter policy %I on %I.%I to %s%s%s',
                   r.policyname, r.schemaname, r.tablename, v_roles, v_using, v_checkkw);
  END LOOP;
END $$;

-- Prova 1: nenhuma policy de `public` ficou com chamada de auth fora de subselect.
DO $$
DECLARE
  v_restantes text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO v_restantes
    FROM pg_policies
   WHERE schemaname = 'public'
     AND ( pg_temp.strip_auth_subselect(qual)       ~* 'auth\.(uid|role)\(\)'
        OR pg_temp.strip_auth_subselect(with_check) ~* 'auth\.(uid|role)\(\)' );
  IF v_restantes IS NOT NULL THEN
    RAISE EXCEPTION 'policy sem initplan: %', v_restantes;
  END IF;
END $$;

-- Prova 2: desfazendo o subselect, o texto normalizado de cada expressao e o
-- mesmo de antes da troca.
DO $$
DECLARE
  r        record;
  v_qual   text;
  v_check  text;
BEGIN
  FOR r IN SELECT * FROM _pol_before LOOP
    SELECT coalesce(qual, ''), coalesce(with_check, '') INTO v_qual, v_check
      FROM pg_policies
     WHERE schemaname = r.schemaname AND tablename = r.tablename AND policyname = r.policyname;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'policy sumiu: %.%', r.tablename, r.policyname;
    END IF;
    IF pg_temp.norm_auth(r.qual) <> pg_temp.norm_auth(v_qual)
       OR pg_temp.norm_auth(r.with_check) <> pg_temp.norm_auth(v_check) THEN
      RAISE EXCEPTION 'expressao de %.% mudou: qual [%] -> [%], check [%] -> [%]',
        r.tablename, r.policyname,
        pg_temp.norm_auth(r.qual), pg_temp.norm_auth(v_qual),
        pg_temp.norm_auth(r.with_check), pg_temp.norm_auth(v_check);
    END IF;
  END LOOP;
END $$;

COMMIT;