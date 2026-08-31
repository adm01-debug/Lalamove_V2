import { logger } from '@/utils/logger';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  attemptCount: number;
}

export function useLoginLockout() {
  const [lockoutStatus, setLockoutStatus] = useState<LockoutStatus>({
    isLocked: false,
    remainingSeconds: 0,
    attemptCount: 0,
  });

  const checkLockout = useCallback(async (email: string): Promise<LockoutStatus> => {
    try {
      // v2: além do lockout por e-mail, considera bloqueio/rate-limit por IP.
      const { data, error } = await supabase.rpc('check_login_lockout_v2', {
        p_email: email,
        p_ip_address: undefined,
      });

      if (error) {
        logger.error('Error checking lockout:', error);
        return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
      }

      const result = data?.[0] || { is_locked: false, remaining_seconds: 0, attempt_count: 0 };
      const status: LockoutStatus = {
        isLocked: result.is_locked,
        remainingSeconds: result.remaining_seconds,
        attemptCount: result.attempt_count,
      };

      setLockoutStatus(status);
      return status;
    } catch (err) {
      logger.error('Error checking lockout:', err);
      return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
    }
  }, []);

  const recordFailedAttempt = useCallback(async (email: string): Promise<LockoutStatus> => {
    try {
      // v2: rate-limit progressivo + detecção de atividade suspeita por IP.
      const { data, error } = await supabase.rpc('record_failed_login_v2', {
        p_email: email,
        p_ip_address: undefined, // IP capturado server-side quando disponível
        p_user_agent: undefined,
      });

      if (error) {
        logger.error('Error recording failed attempt:', error);
        return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
      }

      const result = data?.[0] || { is_locked: false, lockout_seconds: 0, attempt_count: 0 };
      const status: LockoutStatus = {
        isLocked: result.is_locked,
        remainingSeconds: result.lockout_seconds,
        attemptCount: result.attempt_count,
      };

      setLockoutStatus(status);
      return status;
    } catch (err) {
      logger.error('Error recording failed attempt:', err);
      return { isLocked: false, remainingSeconds: 0, attemptCount: 0 };
    }
  }, []);

  const clearAttempts = useCallback(async (email: string): Promise<void> => {
    try {
      await supabase.rpc('clear_login_attempts', {
        p_email: email,
      });
      setLockoutStatus({ isLocked: false, remainingSeconds: 0, attemptCount: 0 });
    } catch (err) {
      logger.error('Error clearing attempts:', err);
    }
  }, []);

  const formatRemainingTime = useCallback((seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }, []);

  return {
    lockoutStatus,
    checkLockout,
    recordFailedAttempt,
    clearAttempts,
    formatRemainingTime,
  };
}
