import { Link } from 'react-router-dom';
import { KeyRound, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UAPI_SESSION_MISSING_HINT, UAPI_SESSION_MISSING_MESSAGE } from '@/lib/uapiErrors';

interface UapiSessionRequiredProps {
  onRetry?: () => void;
  retrying?: boolean;
}

/**
 * Estado explícito de "sem sessão UAPI ativa". Antes disso o painel mostrava o
 * erro cru da edge ("Edge Function returned a non-2xx status code"), que parece
 * bug de sistema quando na verdade falta configuração.
 */
export function UapiSessionRequired({ onRetry, retrying }: UapiSessionRequiredProps) {
  return (
    <Card variant="glass" className="border-warning/40" role="status">
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <KeyRound className="h-6 w-6 text-warning" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{UAPI_SESSION_MISSING_MESSAGE}</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {UAPI_SESSION_MISSING_HINT}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Button asChild size="sm">
            <Link to="/settings/uapi">Configurar sessão UAPI</Link>
          </Button>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="gap-2"
            >
              <RefreshCw className={retrying ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Tentar novamente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}