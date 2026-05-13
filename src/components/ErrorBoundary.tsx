import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { 
import { logger } from '@/utils/logger';
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare
} from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Uncaught error in React component", {
      errorId: this.state.errorId,
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
      stack: error.stack,
    });

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Send to error monitoring service
    import('@/services/errorMonitoring').then(({ captureError }) => {
      captureError(error, {
        source: 'react-boundary',
        severity: 'critical',
        componentStack: errorInfo.componentStack ?? undefined,
      });
    }).catch(() => { /* silently fail */ });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleCopyError = async () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorReport = `
=== Error Report ===
ID: ${errorId}
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.name}: ${error?.message}

Stack Trace:
${error?.stack || "N/A"}

Component Stack:
${errorInfo?.componentStack || "N/A"}
`.trim();

    try {
      await navigator.clipboard.writeText(errorReport);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      logger.error("Failed to copy error:", err);
    }
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId, copied, showDetails } = this.state;

      // Use pure CSS animations instead of framer-motion to avoid hook issues at root level
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          {/* Background effects */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-destructive/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          </div>

          <div 
            className="relative z-10 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden">
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent p-6 border-b border-border/50">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center animate-in zoom-in duration-300"
                  >
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">
                      Ops! Algo deu errado
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Ocorreu um erro inesperado na aplicação
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Error ID badge */}
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-muted rounded-full text-xs font-mono text-muted-foreground">
                    {errorId}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={this.handleCopyError}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-xs">Copiar erro</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Error message */}
                <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Bug className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-destructive">
                        {error?.name || "Error"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 break-words">
                        {error?.message || "Um erro desconhecido ocorreu"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expandable details */}
                <div className="border border-border/50 rounded-xl overflow-hidden">
                  <button
                    onClick={this.toggleDetails}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      Detalhes técnicos
                    </span>
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  
                  {showDetails && (
                    <div className="border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
                      <div className="p-3 space-y-3">
                        {error?.stack && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Stack Trace:
                            </p>
                            <pre className="text-xs font-mono bg-muted/50 p-2 rounded-lg overflow-x-auto max-h-32 text-muted-foreground">
                              {error.stack}
                            </pre>
                          </div>
                        )}

                        {errorInfo?.componentStack && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Component Stack:
                            </p>
                            <pre className="text-xs font-mono bg-muted/50 p-2 rounded-lg overflow-x-auto max-h-32 text-muted-foreground">
                              {errorInfo.componentStack}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={this.handleReload}
                    className="flex-1 gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recarregar página
                  </Button>
                  <Button
                    variant="outline"
                    onClick={this.handleGoHome}
                    className="flex-1 gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Ir para início
                  </Button>
                </div>

                {/* Help text */}
                <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-xl">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Se o problema persistir, copie o erro acima e entre em contato 
                    com o suporte técnico incluindo o código <strong>{errorId}</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook para usar com componentes funcionais
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const handleError = React.useCallback((err: Error) => {
    setError(err);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return { handleError, resetError };
}

// HOC para adicionar error boundary a componentes
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export default ErrorBoundary;
