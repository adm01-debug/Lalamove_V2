import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: 'totp';
  status: 'verified' | 'unverified';
  created_at: string;
  updated_at: string;
}

export interface MFAChallenge {
  id: string;
  expires_at: number;
}

export function useMFA() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  // Buscar fatores MFA do usuário
  const { data: factors, isLoading: loadingFactors } = useQuery({
    queryKey: ['mfa-factors', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Verificar se MFA está habilitado
  const isMFAEnabled = factors?.totp && factors.totp.length > 0 && 
    factors.totp.some(f => f.status === 'verified');

  // Verificar nível de autenticação atual
  const { data: aalLevel } = useQuery({
    queryKey: ['mfa-aal', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Precisa verificar MFA?
  const needsMFAVerification = aalLevel?.currentLevel === 'aal1' && 
    aalLevel?.nextLevel === 'aal2';

  // Iniciar enrollment de TOTP
  const enrollMutation = useMutation({
    mutationFn: async (friendlyName: string = 'Authenticator App') => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      });
      
      if (error) throw error;
      
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      
      return data;
    },
    onError: (error: Error) => {
      toast.error(`Erro ao iniciar MFA: ${error.message}`);
    },
  });

  // Verificar código TOTP durante enrollment
  const verifyEnrollmentMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!factorId) throw new Error('Factor ID não encontrado');

      const { data: challengeData, error: challengeError } = 
        await supabase.auth.mfa.challenge({ factorId });
      
      if (challengeError) throw challengeError;

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      
      if (error) throw error;
      
      // Limpar estado
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      queryClient.invalidateQueries({ queryKey: ['mfa-aal'] });
      toast.success('MFA configurado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Código inválido: ${error.message}`);
    },
  });

  // Criar challenge para login
  const createChallengeMutation = useMutation({
    mutationFn: async () => {
      const verifiedFactor = factors?.totp?.find(f => f.status === 'verified');
      if (!verifiedFactor) throw new Error('Nenhum fator MFA verificado');

      const { data, error } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      
      if (error) throw error;
      
      setChallengeId(data.id);
      setFactorId(verifiedFactor.id);
      
      return data;
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar challenge: ${error.message}`);
    },
  });

  // Verificar código TOTP para login
  const verifyChallengeMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!factorId || !challengeId) {
        throw new Error('Challenge não iniciado');
      }

      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      
      if (error) throw error;
      
      setChallengeId(null);
      setFactorId(null);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-aal'] });
      toast.success('Verificação MFA concluída!');
    },
    onError: (error: Error) => {
      toast.error(`Código inválido: ${error.message}`);
    },
  });

  // Desabilitar MFA
  const unenrollMutation = useMutation({
    mutationFn: async (factorIdToRemove: string) => {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorIdToRemove,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
      queryClient.invalidateQueries({ queryKey: ['mfa-aal'] });
      toast.success('MFA desabilitado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desabilitar MFA: ${error.message}`);
    },
  });

  // Cancelar enrollment em progresso
  const cancelEnrollment = () => {
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
  };

  return {
    // Estado
    factors: factors?.totp || [],
    isMFAEnabled,
    needsMFAVerification,
    aalLevel,
    qrCode,
    secret,
    loadingFactors,

    // Enrollment
    startEnrollment: enrollMutation.mutate,
    isEnrolling: enrollMutation.isPending,
    verifyEnrollment: verifyEnrollmentMutation.mutate,
    isVerifyingEnrollment: verifyEnrollmentMutation.isPending,
    cancelEnrollment,

    // Challenge/Verify
    createChallenge: createChallengeMutation.mutate,
    isCreatingChallenge: createChallengeMutation.isPending,
    verifyChallenge: verifyChallengeMutation.mutate,
    isVerifyingChallenge: verifyChallengeMutation.isPending,

    // Unenroll
    disableMFA: unenrollMutation.mutate,
    isDisabling: unenrollMutation.isPending,
  };
}
