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
-- Idempotente: `cron.schedule` com o mesmo jobname substitui o agendamento
-- existente em vez de duplicar.

SELECT cron.schedule(
  'check-driver-alerts',
  '*/2 * * * *',
  $$
  select net.http_post(
    url:='https://iecgydonctmabiijadsf.supabase.co/functions/v1/check-driver-alerts',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_3Hefdii3_kdWpyxdGKkaWQ_6sJhd8yB"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
