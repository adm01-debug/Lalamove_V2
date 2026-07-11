-- ============================================================
-- Observabilidade de jobs agendados (pg_cron) — RLS-safe
-- Expõe saúde de TODAS as rotinas agendadas para admins.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cron_jobs_health(p_runs_window int DEFAULT 20)
RETURNS TABLE(
  jobid              bigint,
  jobname            text,
  schedule           text,
  active             boolean,
  last_status        text,
  last_run_started   timestamptz,
  last_run_duration_ms numeric,
  runs_considered    bigint,
  failed_runs        bigint,
  failure_rate       numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  -- Autorização explícita: somente administradores.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel de administrador'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT
      d.jobid,
      d.status,
      d.start_time,
      d.end_time,
      row_number() OVER (PARTITION BY d.jobid ORDER BY d.start_time DESC) AS rn
    FROM cron.job_run_details d
  ),
  windowed AS (
    SELECT * FROM recent WHERE rn <= GREATEST(p_runs_window, 1)
  ),
  agg AS (
    SELECT
      w.jobid,
      count(*)                                            AS runs_considered,
      count(*) FILTER (WHERE w.status <> 'succeeded')     AS failed_runs
    FROM windowed w
    GROUP BY w.jobid
  ),
  last_run AS (
    SELECT w.jobid, w.status, w.start_time, w.end_time
    FROM windowed w
    WHERE w.rn = 1
  )
  SELECT
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    lr.status::text,
    lr.start_time,
    CASE WHEN lr.end_time IS NOT NULL
         THEN round(EXTRACT(EPOCH FROM (lr.end_time - lr.start_time)) * 1000, 2)
         ELSE NULL END,
    COALESCE(a.runs_considered, 0),
    COALESCE(a.failed_runs, 0),
    CASE WHEN COALESCE(a.runs_considered, 0) > 0
         THEN round(a.failed_runs::numeric / a.runs_considered * 100, 2)
         ELSE 0 END
  FROM cron.job j
  LEFT JOIN agg a       ON a.jobid = j.jobid
  LEFT JOIN last_run lr ON lr.jobid = j.jobid
  ORDER BY j.jobid;
END;
$function$;

-- Blindagem de privilégios: função de introspecção administrativa.
REVOKE ALL ON FUNCTION public.get_cron_jobs_health(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_jobs_health(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_jobs_health(int) TO service_role;