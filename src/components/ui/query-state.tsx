import { Loader2, AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
  children?: React.ReactNode;
}

export function QueryState({
  isLoading,
  isError,
  isEmpty,
  error,
  onRetry,
  loadingText = 'Carregando...',
  errorText = 'Não foi possível carregar os dados.',
  emptyText = 'Nenhum resultado encontrado.',
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">{loadingText}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm font-medium">{errorText}</p>
        {error?.message && (
          <p className="text-xs text-muted-foreground max-w-sm text-center">{error.message}</p>
        )}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Database className="h-8 w-8 opacity-40" />
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return <>{children}</>;
}