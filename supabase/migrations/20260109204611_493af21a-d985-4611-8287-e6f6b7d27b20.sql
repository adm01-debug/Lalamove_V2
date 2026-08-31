-- =====================================================
-- EXPIRAÇÃO AUTOMÁTICA DE PASSWORD RESET TOKENS (24h)
-- =====================================================

-- 1. Trigger para definir expires_at automaticamente no INSERT
CREATE OR REPLACE FUNCTION public.set_token_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Definir expiração para 24 horas se não especificado
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '24 hours';
  END IF;
  
  -- Garantir que expiração máxima seja 24 horas
  IF NEW.expires_at > now() + interval '24 hours' THEN
    NEW.expires_at := now() + interval '24 hours';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_token_expiration
  BEFORE INSERT ON public.password_reset_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_token_expiration();

-- 2. Função para limpar tokens expirados automaticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Deletar tokens expirados
  DELETE FROM password_reset_tokens
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- Também limpar tokens usados há mais de 7 dias
  DELETE FROM password_reset_tokens
  WHERE used_at IS NOT NULL 
    AND used_at < now() - interval '7 days';
  
  RETURN v_deleted;
END;
$$;

-- 3. Função para verificar se token é válido
CREATE OR REPLACE FUNCTION public.is_token_valid(p_token_hash text)
RETURNS TABLE(
  is_valid boolean,
  user_id uuid,
  expires_in_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record password_reset_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_record
  FROM password_reset_tokens
  WHERE token_hash = p_token_hash
    AND expires_at > now()
    AND used_at IS NULL
  LIMIT 1;
  
  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 0;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    true,
    v_record.user_id,
    EXTRACT(EPOCH FROM (v_record.expires_at - now()))::integer;
END;
$$;

-- 4. Função para marcar token como usado
CREATE OR REPLACE FUNCTION public.use_reset_token(p_token_hash text, p_ip_address inet DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE password_reset_tokens
  SET 
    used_at = now(),
    ip_address = COALESCE(p_ip_address, password_reset_tokens.ip_address)
  WHERE token_hash = p_token_hash
    AND expires_at > now()
    AND used_at IS NULL;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$;

-- 5. Invalidar tokens antigos quando novo token é criado para mesmo usuário
CREATE OR REPLACE FUNCTION public.invalidate_old_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marcar tokens anteriores como expirados
  UPDATE password_reset_tokens
  SET expires_at = now() - interval '1 second'
  WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND used_at IS NULL
    AND expires_at > now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invalidate_old_tokens
  AFTER INSERT ON public.password_reset_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_old_tokens();

-- 6. Índice para busca eficiente de tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_lookup 
  ON password_reset_tokens(token_hash, expires_at) 
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_cleanup 
  ON password_reset_tokens(expires_at) 
  WHERE used_at IS NULL;