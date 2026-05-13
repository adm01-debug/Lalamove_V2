import { logger } from '@/utils/logger';
import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// WebAuthn utilities
function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLToBuffer(base64URL: string): ArrayBuffer {
  const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return bufferToBase64URL(array.buffer);
}

export interface Passkey {
  id: string;
  credential_id: string;
  device_type: string | null;
  friendly_name: string | null;
  created_at: string;
  last_used_at: string | null;
  backed_up: boolean;
}

export function useWebAuthn() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSupported = typeof window !== 'undefined' && 
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === 'function';

  // Fetch user's passkeys
  const { data: passkeys, isLoading: loadingPasskeys } = useQuery({
    queryKey: ['passkeys', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_passkeys')
        .select('id, credential_id, device_type, friendly_name, created_at, last_used_at, backed_up')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Passkey[];
    },
    enabled: !!user?.id,
  });

  // Check if platform authenticator is available (biometric)
  const checkPlatformAuthenticator = useCallback(async () => {
    if (!isSupported) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }, [isSupported]);

  // Register a new passkey
  const registerMutation = useMutation({
    mutationFn: async (friendlyName?: string) => {
      if (!user?.id || !user?.email) {
        throw new Error('Usuário não autenticado');
      }

      if (!isSupported) {
        throw new Error('WebAuthn não é suportado neste navegador');
      }

      // Generate challenge
      const challenge = generateChallenge();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      // Store challenge in database
      const { error: challengeError } = await supabase
        .from('webauthn_challenges')
        .insert({
          user_id: user.id,
          challenge,
          type: 'registration',
          expires_at: expiresAt,
        });

      if (challengeError) throw challengeError;

      // Get existing credentials to exclude
      const existingCredentials = passkeys?.map(p => ({
        id: base64URLToBuffer(p.credential_id),
        type: 'public-key' as const,
      })) || [];

      // Create credential options
      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64URLToBuffer(challenge),
        rp: {
          name: 'Lalamove Guardian',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email,
          displayName: user.email.split('@')[0],
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        excludeCredentials: existingCredentials,
      };

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Falha ao criar credencial');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      
      // Extract public key
      const publicKeyBuffer = response.getPublicKey();
      if (!publicKeyBuffer) {
        throw new Error('Falha ao obter chave pública');
      }

      // Detect device type
      let deviceType = 'unknown';
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('iphone') || ua.includes('ipad')) {
        deviceType = 'Apple Touch ID / Face ID';
      } else if (ua.includes('android')) {
        deviceType = 'Android Biometric';
      } else if (ua.includes('windows')) {
        deviceType = 'Windows Hello';
      } else if (ua.includes('mac')) {
        deviceType = 'macOS Touch ID';
      }

      // Get transports if available
      const transports = response.getTransports?.() || [];

      // Store the passkey
      const { error: saveError } = await supabase
        .from('user_passkeys')
        .insert({
          user_id: user.id,
          credential_id: bufferToBase64URL(credential.rawId),
          public_key: bufferToBase64URL(publicKeyBuffer),
          counter: 0,
          device_type: deviceType,
          transports,
          friendly_name: friendlyName || deviceType,
          backed_up: false,
        });

      if (saveError) throw saveError;

      // Clean up challenge
      await supabase
        .from('webauthn_challenges')
        .delete()
        .eq('challenge', challenge);

      return { credentialId: bufferToBase64URL(credential.rawId) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success('Passkey registrada com sucesso!');
    },
    onError: (error: Error) => {
      logger.error('Registration error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Registro cancelado pelo usuário');
      } else if (error.name === 'InvalidStateError') {
        toast.error('Este dispositivo já está registrado');
      } else {
        toast.error(`Erro ao registrar passkey: ${error.message}`);
      }
    },
  });

  // Authenticate with passkey
  const authenticateMutation = useMutation({
    mutationFn: async (email?: string) => {
      if (!isSupported) {
        throw new Error('WebAuthn não é suportado neste navegador');
      }

      // Generate challenge
      const challenge = generateChallenge();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Store challenge
      const { error: challengeError } = await supabase
        .from('webauthn_challenges')
        .insert({
          challenge,
          type: 'authentication',
          expires_at: expiresAt,
        });

      if (challengeError) throw challengeError;

      // Get credential options
      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64URLToBuffer(challenge),
        timeout: 60000,
        userVerification: 'required',
        rpId: window.location.hostname,
      };

      // Request credential
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('Falha na autenticação');
      }

      const credentialId = bufferToBase64URL(assertion.rawId);

      // Find the passkey and user
      const { data: passkey, error: findError } = await supabase
        .from('user_passkeys')
        .select('id, user_id, counter')
        .eq('credential_id', credentialId)
        .single();

      if (findError || !passkey) {
        throw new Error('Passkey não encontrada');
      }

      // Update last used and counter
      await supabase
        .from('user_passkeys')
        .update({
          last_used_at: new Date().toISOString(),
          counter: (passkey.counter || 0) + 1,
        })
        .eq('id', passkey.id);

      // Clean up challenge
      await supabase
        .from('webauthn_challenges')
        .delete()
        .eq('challenge', challenge);

      // Log auth event
      await supabase.from('auth_logs').insert({
        user_id: passkey.user_id,
        event_type: 'passkey_login',
        success: true,
        metadata: { credential_id: credentialId },
      });

      return { 
        userId: passkey.user_id,
        credentialId,
        success: true 
      };
    },
    onSuccess: () => {
      toast.success('Autenticação biométrica bem-sucedida!');
    },
    onError: (error: Error) => {
      logger.error('Authentication error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Autenticação cancelada pelo usuário');
      } else {
        toast.error(`Erro na autenticação: ${error.message}`);
      }
    },
  });

  // Remove a passkey
  const removeMutation = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await supabase
        .from('user_passkeys')
        .delete()
        .eq('id', passkeyId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success('Passkey removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover passkey: ${error.message}`);
    },
  });

  // Rename a passkey
  const renameMutation = useMutation({
    mutationFn: async ({ passkeyId, name }: { passkeyId: string; name: string }) => {
      const { error } = await supabase
        .from('user_passkeys')
        .update({ friendly_name: name })
        .eq('id', passkeyId)
        .eq('user_id', user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast.success('Passkey renomeada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao renomear: ${error.message}`);
    },
  });

  return {
    isSupported,
    passkeys: passkeys || [],
    loadingPasskeys,
    hasPasskeys: (passkeys?.length || 0) > 0,
    
    checkPlatformAuthenticator,
    
    registerPasskey: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    
    authenticate: authenticateMutation.mutateAsync,
    isAuthenticating: authenticateMutation.isPending,
    
    removePasskey: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    
    renamePasskey: renameMutation.mutate,
    isRenaming: renameMutation.isPending,
  };
}
