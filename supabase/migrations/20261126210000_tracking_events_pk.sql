-- ============================================================================
-- PK em `public.tracking_events`.
--
-- A tabela e particionada por `created_at` e nenhuma particao tem chave
-- primaria (advisor `no_primary_key`). Consequencias hoje: linha duplicada e
-- aceita, REPLICA IDENTITY depende de full, e o advisor mantem o aviso em 10
-- objetos.
--
-- A PK inclui a chave de particionamento, que e o que o Postgres exige:
-- `(id, created_at)`. Conferido em producao antes de aplicar: 216 linhas, 216
-- combinacoes distintas de (id, created_at), `id` e `created_at` NOT NULL, e
-- nenhuma particao tem PK propria que colidisse com a herdada.
--
-- Nenhum codigo faz upsert nessa tabela (nao ha `onConflict` em
-- `lalamove-webhook`, `job-worker`, `zapp-callback` nem
-- `simulate-driver-movement`), entao o alvo de conflito novo nao quebra nada.
--
-- Idempotente: se a PK ja existir, nao faz nada.
-- ============================================================================
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname = 'tracking_events' AND c.contype = 'p'
  ) THEN
    ALTER TABLE public.tracking_events
      ADD CONSTRAINT tracking_events_pkey PRIMARY KEY (id, created_at);
  END IF;
END $$;

-- Verificacao: pai e todas as particoes com PK, e nenhuma linha duplicada.
DO $$
DECLARE
  v_sem text;
BEGIN
  SELECT string_agg(t.relname, ', ') INTO v_sem
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND (t.relname = 'tracking_events' OR t.relname LIKE 'tracking_events\_%')
     AND t.relkind IN ('r', 'p')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = t.oid AND c.contype = 'p');
  IF v_sem IS NOT NULL THEN
    RAISE EXCEPTION 'sem PK: %', v_sem;
  END IF;
END $$;

COMMIT;