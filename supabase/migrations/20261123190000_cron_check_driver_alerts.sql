-- Etapa 70 dos planos Google/Mapbox: `check-driver-alerts` nunca era executada.
--
-- A edge existe e implementa o Guardian System (motorista parado, POD fora do prazo,
-- desvio de rota), mas nenhum `cron.job` e nenhum handler do `job-worker` a invocava:
-- em 22/11/2026 a consulta a `cron.job` retornava apenas
-- `escalate-unacknowledged-alerts`, e `grep` por `check-driver-alerts` no
-- `job-worker` nao retornava nada. Resultado: os alertas de motorista nunca eram
-- avaliados, mesmo com as configuracoes e o enum de `alert_type` ja corretos.
--
-- Cadencia de 2 minutos: o menor limiar configuravel e `stopped_threshold_minutes`
-- = 5 min (default). Rodar a cada 2 min da duas chances de detectar a janela antes
-- de ela virar CRITICAL em 10 min, sem custo relevante (a edge so faz SELECTs e
-- so cria alerta quando o limiar e realmente cruzado).
--
-- A chave vem de `vault.decrypted_secrets` (nome `dispatcher_key`), igual a
-- `process_job_queue` em `20261122140000_fix_crons_dispatcher.sql` - nunca
-- embutida no SQL.
--
-- Idempotente: `cron.schedule` com o mesmo jobname substitui o agendamento
-- existente em vez de duplicar.

DO $do$
DECLARE
  v_key text;
  v_url text := 'https://iecgydonctmabiijadsf.supabase.co/functions/v1';
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'dispatcher_key' LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'cron check-driver-alerts: vault.dispatcher_key ausente; agendamento nao criado';
    RETURN;
  END IF;

  PERFORM cron.unschedule('check-driver-alerts')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check-driver-alerts');

  PERFORM cron.schedule(
    'check-driver-alerts',
    '*/2 * * * *',
    format(
      $cron$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'apikey', %L,
          'Authorization','Bearer ' || %L
        ),
        body := jsonb_build_object('time', now()),
        timeout_milliseconds := 25000
      ) as request_id;
      $cron$,
      v_url || '/check-driver-alerts', v_key, v_key
    )
  );
END $do$;

-- Verificacao pos-apply (rodar manualmente no SQL editor):
--   select jobname, schedule, active from cron.job where jobname = 'check-driver-alerts';
