-- Tipo de alerta "motorista designado" — usado pelo GUARDIAN do lalamove-webhook (DRIVER_ASSIGNED)
-- para avisar o responsavel pela coleta. Arquivo separado: ADD VALUE nao pode ser usado na mesma
-- transacao em que e criado. Aplicar com .github/workflows/apply-migrations.yml.
ALTER TYPE public.alert_type ADD VALUE IF NOT EXISTS 'DRIVER_ASSIGNED';
