import { useState, useEffect } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLoginLockout } from '@/hooks/useLoginLockout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Truck, Mail, Lock, Loader2, Eye, EyeOff, ShieldAlert, Radar, Navigation, Activity, ShieldCheck, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasskeyLoginButton } from '@/components/auth/PasskeyLoginButton';
import { lovable } from '@/integrations/lovable/index';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export function AuthPage() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const from = (location.state?.from as { pathname?: string } | null)?.pathname ?? '/';
  const { lockoutStatus, checkLockout, recordFailedAttempt, clearAttempts, formatRemainingTime } = useLoginLockout();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutStatus.isLocked || lockoutStatus.remainingSeconds <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(lockoutStatus.remainingSeconds);
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutStatus.isLocked, lockoutStatus.remainingSeconds]);

  // Ao zerar o countdown, revalida o lockout (sem reiniciar o timer a cada tecla de e-mail).
  useEffect(() => {
    if (countdown !== 0 || !lockoutStatus.isLocked) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    checkLockout(email);
  }, [countdown, lockoutStatus.isLocked, checkLockout]);

  // Redirect if already authenticated
  if (user) {
    return <Navigate to={from} replace />;
  }

  const validateLoginForm = () => {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const firstError = result.error.issues[0];
      toast.error(firstError.message);
      return false;
    }
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;

    // Check if account is locked
    const status = await checkLockout(email);
    if (status.isLocked) {
      toast.error(`Conta temporariamente bloqueada. Tente novamente em ${formatRemainingTime(status.remainingSeconds)}.`);
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      // Record failed attempt
      const lockResult = await recordFailedAttempt(email);
      
      if (lockResult.isLocked) {
        toast.error(`Conta bloqueada por ${formatRemainingTime(lockResult.remainingSeconds)} após ${lockResult.attemptCount} tentativas falhadas.`);
      } else if (error.message.includes('Invalid login credentials')) {
        const attemptsLeft = 5 - lockResult.attemptCount;
        if (attemptsLeft > 0) {
          toast.error(`Email ou senha incorretos. ${attemptsLeft} tentativa${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}.`);
        } else {
          toast.error('Email ou senha incorretos.');
        }
      } else {
        toast.error('Erro ao fazer login: ' + error.message);
      }
    } else {
      // Clear failed attempts on successful login
      await clearAttempts(email);
      toast.success('Login realizado com sucesso!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex bg-background">
      {/* Painel esquerdo — hero "control tower" (dark) */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden p-12 text-white"
        style={{ background: 'radial-gradient(circle at 30% 20%, hsl(222 47% 11%), hsl(222 47% 5%))' }}
        aria-hidden="true"
      >
        {/* grade decorativa */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(199 89% 48% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(199 89% 48% / 0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* halos */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl" style={{ background: 'hsl(199 89% 48% / 0.18)' }} />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full blur-3xl" style={{ background: 'hsl(142 71% 45% / 0.12)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'hsl(199 89% 48% / 0.15)', border: '1px solid hsl(199 89% 48% / 0.3)' }}>
            <Radar className="w-6 h-6" style={{ color: 'hsl(199 89% 48%)' }} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Lalamove Intelligence Hub</p>
            <p className="text-xs text-white/60">Torre de controle logística</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <h2 className="text-3xl font-bold leading-tight">
            Monitore cada entrega em <span style={{ color: 'hsl(199 89% 60%)' }}>tempo real</span>.
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Rastreamento ao vivo, triagem de motoristas e alertas inteligentes em um só painel.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Navigation, label: 'Rastreamento ao vivo', tint: '199 89% 48%' },
              { icon: ShieldCheck, label: 'Triagem de risco', tint: '142 71% 45%' },
              { icon: Activity, label: 'Alertas em tempo real', tint: '38 92% 50%' },
              { icon: MapPin, label: 'Prova de entrega', tint: '199 89% 48%' },
            ].map(({ icon: Icon, label, tint }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-lg p-3" style={{ background: 'hsl(0 0% 100% / 0.04)', border: '1px solid hsl(0 0% 100% / 0.08)' }}>
                <Icon className="w-4 h-4 shrink-0" style={{ color: `hsl(${tint})` }} />
                <span className="text-xs font-medium text-white/85">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">Promo Brindes © {new Date().getFullYear()}</p>
      </aside>

      {/* Painel direito — formulário */}
      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Lalamove Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">Sistema de gestão de entregas</p>
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader className="text-center pb-2">
            <CardTitle>Bem-vindo</CardTitle>
            <CardDescription>Entre na sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
                  {/* Lockout warning */}
                  {lockoutStatus.isLocked && countdown > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                      <ShieldAlert className="h-5 w-5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">Conta temporariamente bloqueada</p>
                        <p className="text-xs opacity-80">
                          Aguarde {formatRemainingTime(countdown)} para tentar novamente.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={lockoutStatus.isLocked && countdown > 0}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                        Esqueceu a senha?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        disabled={lockoutStatus.isLocked && countdown > 0}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        disabled={lockoutStatus.isLocked && countdown > 0}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isSubmitting || (lockoutStatus.isLocked && countdown > 0)}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Entrando...
                      </>
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                  
                  {/* Passkey login option */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>
                  
                  <PasskeyLoginButton fullWidth variant="outline" />
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={async () => {
                      const { error } = await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: window.location.origin,
                      });
                      if (error) {
                        toast.error('Erro ao entrar com Google: ' + (error as Error).message);
                      }
                    }}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Entrar com Google
                  </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Promo Brindes © {new Date().getFullYear()}
        </p>
      </div>
      </main>
    </div>
  );
}
