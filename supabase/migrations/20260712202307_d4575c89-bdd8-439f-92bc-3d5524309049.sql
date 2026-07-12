-- Agenda as rotinas de manutenção que existiam sem cron job associado.
-- São chamadas de funções SQL puras (sem URL/anon key), seguras para remix.

-- Evita duplicidade caso re-executado.
SELECT cron.unschedule('daily-cleanup-with-logging')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cleanup-with-logging');

SELECT cron.unschedule('cleanup-old-cron-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-cron-logs');

-- Limpeza diária de tokens de reset expirados e tentativas de login antigas,
-- com logging em cron_job_logs. Roda às 03:45 (após o rollup das 03:30).
SELECT cron.schedule(
  'daily-cleanup-with-logging',
  '45 3 * * *',
  $$ SELECT public.run_daily_cleanup_with_logging(); $$
);

-- Poda semanal dos logs de cron com mais de 30 dias. Domingo 04:15.
SELECT cron.schedule(
  'cleanup-old-cron-logs',
  '15 4 * * 0',
  $$ SELECT public.cleanup_old_cron_logs(); $$
);