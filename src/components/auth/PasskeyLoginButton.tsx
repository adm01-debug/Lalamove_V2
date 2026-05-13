import React, { useState, useEffect, forwardRef } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { motion } from 'framer-motion';

interface PasskeyLoginButtonProps {
  onSuccess?: (userId: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  fullWidth?: boolean;
}

export const PasskeyLoginButton = forwardRef<HTMLDivElement, PasskeyLoginButtonProps>(
  function PasskeyLoginButton({
    onSuccess,
    onError,
    className,
    variant = 'outline',
    size = 'default',
    fullWidth = false,
  }, ref) {
  const { isSupported, authenticate, isAuthenticating, checkPlatformAuthenticator } = useWebAuthn();
  const [hasPlatformAuth, setHasPlatformAuth] = useState<boolean | null>(null);

  useEffect(() => {
    if (isSupported) {
      checkPlatformAuthenticator().then(setHasPlatformAuth);
    }
  }, [isSupported, checkPlatformAuthenticator]);

  const handleClick = async () => {
    try {
      const result = await authenticate(undefined);
      if (result.success && onSuccess) {
        onSuccess(result.userId);
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  };

  // Don't show if not supported or no platform authenticator
  if (!isSupported || hasPlatformAuth === false) {
    return null;
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={fullWidth ? 'w-full' : ''}
    >
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isAuthenticating || hasPlatformAuth === null}
        className={`${fullWidth ? 'w-full' : ''} ${className}`}
      >
        {isAuthenticating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <Fingerprint className="h-4 w-4 mr-2" />
            Entrar com Biometria
          </>
        )}
      </Button>
    </motion.div>
  );
});
