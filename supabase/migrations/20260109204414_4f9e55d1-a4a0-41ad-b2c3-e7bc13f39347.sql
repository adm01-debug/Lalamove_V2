-- =====================================================
-- RATE LIMITING RIGOROSO - MIGRAÇÃO COMPLETA
-- =====================================================

-- 1. Adicionar colunas para tracking avançado em login_attempts
ALTER TABLE public.login_attempts 
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS is_suspicious boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS block_reason text;

-- 2. Recriar função is_ip_blocked usando estrutura existente (expires_at)
DROP FUNCTION IF EXISTS public.is_ip_blocked(inet);

CREATE FUNCTION public.is_ip_blocked(p_ip_address inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip_address = p_ip_address
      AND (is_permanent = true OR expires_at > now())
  );
END;
$$;

-- 3. Função melhorada para verificar lockout com rate limiting por IP
CREATE OR REPLACE FUNCTION public.check_login_lockout_v2(
  p_email text,
  p_ip_address inet DEFAULT NULL
)
RETURNS TABLE(
  is_locked boolean,
  remaining_seconds integer,
  attempt_count integer,
  is_ip_blocked boolean,
  block_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
  v_ip_blocked blocked_ips%ROWTYPE;
  v_ip_attempts integer;
BEGIN
  -- Verificar se IP está bloqueado permanentemente ou temporariamente
  IF p_ip_address IS NOT NULL THEN
    SELECT * INTO v_ip_blocked
    FROM blocked_ips
    WHERE ip_address = p_ip_address
      AND (is_permanent = true OR expires_at > now());
    
    IF v_ip_blocked IS NOT NULL THEN
      RETURN QUERY SELECT 
        true,
        CASE WHEN v_ip_blocked.is_permanent THEN 86400 
             ELSE EXTRACT(EPOCH FROM (v_ip_blocked.expires_at - now()))::integer 
        END,
        0,
        true,
        v_ip_blocked.reason;
      RETURN;
    END IF;
    
    -- Verificar rate limit por IP (máximo 20 tentativas em 1 hora)
    SELECT COUNT(*) INTO v_ip_attempts
    FROM login_attempts
    WHERE ip_address = p_ip_address
      AND last_attempt_at > now() - interval '1 hour';
    
    IF v_ip_attempts >= 20 THEN
      -- Bloquear IP temporariamente
      INSERT INTO blocked_ips (ip_address, reason, expires_at)
      VALUES (p_ip_address, 'Excesso de tentativas de login', now() + interval '1 hour')
      ON CONFLICT (ip_address) DO UPDATE SET
        expires_at = now() + interval '1 hour',
        attempts_count = blocked_ips.attempts_count + 1;
      
      RETURN QUERY SELECT true, 3600, v_ip_attempts, true, 'IP bloqueado por excesso de tentativas'::text;
      RETURN;
    END IF;
  END IF;

  -- Verificar lockout por email
  SELECT * INTO v_record
  FROM login_attempts
  WHERE email = lower(p_email)
  ORDER BY last_attempt_at DESC
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, false, NULL::text;
    RETURN;
  END IF;

  -- Reset se primeira tentativa foi há mais de 24 horas
  IF v_record.first_attempt_at < now() - interval '24 hours' THEN
    DELETE FROM login_attempts WHERE email = lower(p_email);
    RETURN QUERY SELECT false, 0, 0, false, NULL::text;
    RETURN;
  END IF;

  -- Verificar se está bloqueado
  IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
    RETURN QUERY SELECT 
      true,
      EXTRACT(EPOCH FROM (v_record.locked_until - now()))::integer,
      v_record.attempt_count,
      false,
      v_record.block_reason;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 0, v_record.attempt_count, false, NULL::text;
END;
$$;

-- 4. Função melhorada para registrar tentativas falhas (mais rigorosa: 3 tentativas)
CREATE OR REPLACE FUNCTION public.record_failed_login_v2(
  p_email text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(
  is_locked boolean,
  lockout_seconds integer,
  attempt_count integer,
  is_suspicious boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record login_attempts%ROWTYPE;
  v_new_count integer;
  v_lockout_duration interval;
  v_is_suspicious boolean := false;
  v_block_reason text;
BEGIN
  -- Verificar padrões suspeitos: mesmo IP tentando múltiplos emails
  IF p_ip_address IS NOT NULL THEN
    SELECT COUNT(DISTINCT email) > 5 INTO v_is_suspicious
    FROM login_attempts
    WHERE ip_address = p_ip_address
      AND last_attempt_at > now() - interval '10 minutes';
  END IF;

  SELECT * INTO v_record
  FROM login_attempts
  WHERE email = lower(p_email)
  ORDER BY last_attempt_at DESC
  LIMIT 1;

  -- Reset se primeira tentativa foi há mais de 24 horas
  IF v_record IS NOT NULL AND v_record.first_attempt_at < now() - interval '24 hours' THEN
    DELETE FROM login_attempts WHERE email = lower(p_email);
    v_record := NULL;
  END IF;

  IF v_record IS NULL THEN
    INSERT INTO login_attempts (email, ip_address, attempt_count, user_agent, is_suspicious)
    VALUES (lower(p_email), p_ip_address, 1, p_user_agent, v_is_suspicious);
    
    RETURN QUERY SELECT false, 0, 1, v_is_suspicious;
    RETURN;
  END IF;

  v_new_count := v_record.attempt_count + 1;

  -- Rate limiting RIGOROSO:
  -- 3 tentativas: 1 minuto
  -- 4 tentativas: 5 minutos
  -- 5 tentativas: 15 minutos
  -- 6 tentativas: 30 minutos
  -- 7 tentativas: 1 hora
  -- 8+ tentativas: 2 horas
  IF v_new_count >= 3 THEN
    CASE 
      WHEN v_new_count = 3 THEN 
        v_lockout_duration := interval '1 minute';
        v_block_reason := 'Múltiplas tentativas incorretas';
      WHEN v_new_count = 4 THEN 
        v_lockout_duration := interval '5 minutes';
        v_block_reason := 'Tentativas persistentes';
      WHEN v_new_count = 5 THEN 
        v_lockout_duration := interval '15 minutes';
        v_block_reason := 'Possível ataque de força bruta';
      WHEN v_new_count = 6 THEN 
        v_lockout_duration := interval '30 minutes';
        v_block_reason := 'Ataque de força bruta detectado';
      WHEN v_new_count = 7 THEN 
        v_lockout_duration := interval '1 hour';
        v_block_reason := 'Ataque persistente';
      ELSE 
        v_lockout_duration := interval '2 hours';
        v_block_reason := 'Conta sob ataque - bloqueio estendido';
    END CASE;
    
    -- Se suspeito, dobrar tempo de lockout
    IF v_is_suspicious OR v_record.is_suspicious THEN
      v_lockout_duration := v_lockout_duration * 2;
      v_block_reason := v_block_reason || ' (atividade suspeita)';
    END IF;
    
    UPDATE login_attempts
    SET 
      attempt_count = v_new_count,
      last_attempt_at = now(),
      locked_until = now() + v_lockout_duration,
      ip_address = COALESCE(p_ip_address, login_attempts.ip_address),
      user_agent = COALESCE(p_user_agent, login_attempts.user_agent),
      is_suspicious = v_is_suspicious OR login_attempts.is_suspicious,
      block_reason = v_block_reason
    WHERE id = v_record.id;
    
    RETURN QUERY SELECT 
      true, 
      EXTRACT(EPOCH FROM v_lockout_duration)::integer,
      v_new_count,
      v_is_suspicious OR v_record.is_suspicious;
    RETURN;
  END IF;

  UPDATE login_attempts
  SET 
    attempt_count = v_new_count,
    last_attempt_at = now(),
    ip_address = COALESCE(p_ip_address, login_attempts.ip_address),
    user_agent = COALESCE(p_user_agent, login_attempts.user_agent),
    is_suspicious = v_is_suspicious OR login_attempts.is_suspicious
  WHERE id = v_record.id;

  RETURN QUERY SELECT false, 0, v_new_count, v_is_suspicious;
END;
$$;

-- 5. Função para limpar tentativas antigas
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM login_attempts
  WHERE last_attempt_at < now() - interval '7 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  DELETE FROM blocked_ips
  WHERE is_permanent = false AND expires_at < now() - interval '1 day';
  
  RETURN v_deleted;
END;
$$;

-- 6. Atualizar política de INSERT (mais restritiva)
DROP POLICY IF EXISTS "Authenticated can insert login attempts" ON public.login_attempts;

CREATE POLICY "System can insert login attempts" ON public.login_attempts
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL OR 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'operator'::app_role) OR
    has_role(auth.uid(), 'viewer'::app_role)
  );

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_last_attempt 
  ON login_attempts(ip_address, last_attempt_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_suspicious 
  ON login_attempts(is_suspicious) WHERE is_suspicious = true;

CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires 
  ON blocked_ips(ip_address, expires_at) WHERE is_permanent = false;