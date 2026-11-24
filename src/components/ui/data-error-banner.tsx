import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface DataErrorBannerProps {
  message?: string;
  details?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}

/**
 * Aviso compacto para quando uma consulta de dados falha: sem ele a pagina
 * segue renderizando como se nao houvesse dado, e o operador nao sabe se o
 * sistema esta vazio ou quebrado (classe do bug #330).
 */
export function DataErrorBanner({
  message = 'Não foi possível carregar os dados.',
  details,
  onRetry,
  retrying,
}: DataErrorBannerProps) {
  return (
    <Card variant="glass" className="border-destructive/40" role="alert">
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">{message}</p>
        {details && <p className="max-w-sm text-xs text-muted-foreground">{details}</p>}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying} className="mt-1 gap-2">
            <RefreshCw className={retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}