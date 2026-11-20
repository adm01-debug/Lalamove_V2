# P-07 · SECURITY DEFINER sem set search_path (risco de escalação)

**Status:** Pendente (auditoria de segurança, sem fix)
**Origem:** docs/contexto/regras/11-GLOSSARIO-E-LACUNAS.md (seção segurança)

## Problema
Funções SECURITY DEFINER sem `set search_path` — risco de search_path hijacking (escalação). Lista completa no doc gerado:

- cleanup_old_system_logs — supabase/migrations/20251226000001_create_system_logs.sql
- create_audit_log — supabase/migrations/20251226000002_create_audit_log.sql
- add_job, process_job_queue, get_cron_jobs_status, pause_cron_job, resume_cron_job — migrations 20251226010000/20251226010001
- run_rls_security_audit — 20260513180724
- log_mfa_session — 20260516112923

## Impacto no negócio
- Funções com privilégio elevado executam com search_path controlável por quem tiver permissão de criar objetos no schema — vetor de escalação.

## Ação sugerida (fatia de segurança)
- Migration aditiva por função: `SET search_path = pg_catalog, public` (ou schema explícito) + validate. Idempotente (OR REPLACE).
- Regra 8? É DDL em produção (migration) — confirmar com o dono antes do merge.
