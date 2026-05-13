import { useMemo, useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  onBreachCheck?: (isBreached: boolean) => void;
}

export const calculatePasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 10;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^A-Za-z0-9]/.test(password)) strength += 15;
  return Math.min(strength, 100);
};

export const getStrengthLabel = (strength: number): { label: string; color: string; bgColor: string } => {
  if (strength < 30) return { label: 'Fraca', color: 'text-destructive', bgColor: 'bg-destructive' };
  if (strength < 50) return { label: 'Razoável', color: 'text-warning', bgColor: 'bg-warning' };
  if (strength < 70) return { label: 'Média', color: 'text-warning', bgColor: 'bg-warning' };
  if (strength < 85) return { label: 'Boa', color: 'text-info', bgColor: 'bg-info' };
  return { label: 'Forte', color: 'text-success', bgColor: 'bg-success' };
};

const requirements = [
  { label: 'Mínimo 8 caracteres', test: (p: string) => p.length >= 8 },
  { label: 'Letra maiúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Um número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Caractere especial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// Check if password has been exposed in data breaches using HaveIBeenPwned API
async function checkPasswordBreach(password: string): Promise<boolean> {
  try {
    // Create SHA-1 hash of the password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    // Use k-anonymity: send only first 5 characters of hash
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);
    
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'Add-Padding': 'true' // Add padding to prevent timing attacks
      }
    });
    
    if (!response.ok) return false;
    
    const text = await response.text();
    const hashes = text.split('\n');
    
    // Check if our suffix is in the response
    return hashes.some(line => {
      const [hash] = line.split(':');
      return hash.trim() === suffix;
    });
  } catch {
    // If API fails, don't block the user
    return false;
  }
}

export function PasswordStrengthIndicator({ 
  password, 
  showRequirements = false,
  onBreachCheck 
}: PasswordStrengthIndicatorProps) {
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);
  const [isBreached, setIsBreached] = useState<boolean | null>(null);
  
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);
  const strengthInfo = useMemo(() => getStrengthLabel(strength), [strength]);

  // Check for breached password with debounce
  useEffect(() => {
    if (!password || password.length < 8) {
      setIsBreached(null);
      onBreachCheck?.(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingBreach(true);
      const breached = await checkPasswordBreach(password);
      setIsBreached(breached);
      setIsCheckingBreach(false);
      onBreachCheck?.(breached);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [password, onBreachCheck]);

  if (!password) return null;

  return (
    <div className="space-y-2 animate-in fade-in-50 duration-200">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Força da senha:</span>
        <span className={cn("font-medium", strengthInfo.color)}>{strengthInfo.label}</span>
      </div>
      
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300 ease-out rounded-full", strengthInfo.bgColor)}
          style={{ width: `${strength}%` }}
        />
      </div>
      
      {/* Breach warning */}
      {isCheckingBreach && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Verificando segurança...</span>
        </div>
      )}
      
      {isBreached === true && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Esta senha foi exposta em vazamentos de dados. Escolha outra senha.</span>
        </div>
      )}
      
      {isBreached === false && password.length >= 8 && !isCheckingBreach && (
        <div className="flex items-center gap-2 text-xs text-success">
          <Check className="h-3 w-3" />
          <span>Senha não encontrada em vazamentos</span>
        </div>
      )}
      
      {showRequirements && (
        <div className="grid grid-cols-2 gap-1 pt-1">
          {requirements.map((req, i) => {
            const passed = req.test(password);
            return (
              <div 
                key={i} 
                className={cn(
                  "flex items-center gap-1 text-xs transition-colors",
                  passed ? "text-success" : "text-muted-foreground"
                )}
              >
                {passed ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                <span>{req.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
