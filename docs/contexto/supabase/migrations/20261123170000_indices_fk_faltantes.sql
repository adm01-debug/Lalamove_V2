-- Os dois indices da 20261121201800_indices_alert_id_created_by.sql nunca foram
-- criados em producao: aquela migration nao esta no ledger (`supabase_migrations
-- .schema_migrations`) e nao foi aplicada por outro caminho — conferido em
-- pg_indexes, que so lista os indices preexistentes das duas tabelas.
--
-- Efeito pratico: `order_geo_events.alert_id` e alvo de JOIN na notificacao do
-- alerta (seq scan a cada evento geo) e `job_queue.created_by` e comparado em toda
-- policy RLS via auth.uid(), ou seja, em cada leitura da fila pelo usuario logado.
--
-- Idempotente (IF NOT EXISTS): cidade limpa em producao e em `supabase db reset`.

CREATE INDEX IF NOT EXISTS idx_order_geo_events_alert_id
  ON public.order_geo_events (alert_id)

CREATE INDEX IF NOT EXISTS idx_job_queue_created_by
  ON public.job_queue (created_by)
