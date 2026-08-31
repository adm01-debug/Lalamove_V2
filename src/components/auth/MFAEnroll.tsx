import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Copy, CheckCircle2, Loader2, Smartphone, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMFA } from '@/hooks/useMFA';
import { toast } from 'sonner';

interface MFAEnrollProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MFAEnroll({ onSuccess, onCancel }: MFAEnrollProps) {
  const {
    qrCode,
    secret,
    startEnrollment,
    isEnrolling,
    verifyEnrollment,
    isVerifyingEnrollment,
    cancelEnrollment,
  } = useMFA();

  const [code, setCode] = useState('');
  const [step, setStep] = useState<'start' | 'scan' | 'verify'>('start');
  const [copied, setCopied] = useState(false);

  const handleStart = () => {
    startEnrollment('Lalamove Guardian', {
      onSuccess: () => setStep('scan'),
    });
  };

  const handleCopySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = () => {
    verifyEnrollment(code, {
      onSuccess: () => {
        setStep('start');
        setCode('');
        onSuccess?.();
      },
    });
  };

  const handleCancel = () => {
    cancelEnrollment();
    setStep('start');
    setCode('');
    onCancel?.();
  };

  if (step === 'start') {
    return (
      <Card className="glass-card">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Autenticação de Dois Fatores</CardTitle>
          <CardDescription>
            Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Smartphone className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Você precisará de um app autenticador</p>
              <p className="text-muted-foreground">
                Como Google Authenticator, Authy ou Microsoft Authenticator
              </p>
            </div>
          </div>

          <Button 
            onClick={handleStart} 
            disabled={isEnrolling}
            className="w-full"
          >
            {isEnrolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configurando...
              </>
            ) : (
              <>
                <Key className="mr-2 h-4 w-4" />
                Configurar MFA
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'scan') {
    return (
      <Card className="glass-card">
        <CardHeader className="text-center">
          <CardTitle>Escaneie o QR Code</CardTitle>
          <CardDescription>
            Use seu aplicativo autenticador para escanear o código abaixo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {qrCode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center"
            >
              <div className="p-4 bg-card rounded-xl border border-border/50">
                <img src={qrCode} alt="QR Code MFA" className="w-48 h-48" />
              </div>
            </motion.div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-center text-muted-foreground">
              Ou insira o código manualmente:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 rounded-lg bg-muted font-mono text-sm break-all">
                {secret}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopySecret}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={() => setStep('verify')} className="flex-1">
              Próximo
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="text-center">
        <CardTitle>Verificar Código</CardTitle>
        <CardDescription>
          Insira o código de 6 dígitos do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="text-center text-2xl tracking-widest font-mono"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setStep('scan')} 
            className="flex-1"
          >
            Voltar
          </Button>
          <Button 
            onClick={handleVerify} 
            disabled={code.length !== 6 || isVerifyingEnrollment}
            className="flex-1"
          >
            {isVerifyingEnrollment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
