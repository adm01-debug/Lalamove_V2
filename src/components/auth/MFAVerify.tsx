import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMFA } from '@/hooks/useMFA';

interface MFAVerifyProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MFAVerify({ onSuccess, onCancel }: MFAVerifyProps) {
  const {
    createChallenge,
    isCreatingChallenge,
    verifyChallenge,
    isVerifyingChallenge,
  } = useMFA();

  const [code, setCode] = useState('');
  const [challengeCreated, setChallengeCreated] = useState(false);

  useEffect(() => {
    // Criar challenge automaticamente ao montar
    createChallenge(undefined, {
      onSuccess: () => setChallengeCreated(true),
    });
  }, []);

  const handleVerify = () => {
    verifyChallenge(code, {
      onSuccess: () => {
        setCode('');
        onSuccess?.();
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  if (isCreatingChallenge || !challengeCreated) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-4"
        >
          <Shield className="h-8 w-8 text-primary" />
        </motion.div>
        <CardTitle>Verificação MFA</CardTitle>
        <CardDescription>
          Insira o código de 6 dígitos do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
        </motion.div>

        <div className="flex gap-2">
          {onCancel && (
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
          )}
          <Button 
            onClick={handleVerify} 
            disabled={code.length !== 6 || isVerifyingChallenge}
            className="flex-1"
          >
            {isVerifyingChallenge ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          O código expira em 30 segundos. Se expirar, recarregue a página.
        </p>
      </CardContent>
    </Card>
  );
}
