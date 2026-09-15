import { useState, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { cn } from '@/lib/utils';

export const OfflineIndicator = forwardRef<HTMLDivElement>(function OfflineIndicator(_props, _ref) {
  const { isOnline, hasUpdate, updateServiceWorker } = useServiceWorker();
  const [dismissed, setDismissed] = useState(false);

  // Show offline banner
  if (!isOnline) {
    return (
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950"
      >
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            Você está offline. Algumas funcionalidades podem estar limitadas.
          </span>
        </div>
      </motion.div>
    );
  }

  // Show update banner
  if (hasUpdate && !dismissed) {
    return (
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground"
      >
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Nova versão disponível!</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={updateServiceWorker}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
});

// Floating status indicator
export function ConnectionStatus() {
  const { isOnline } = useServiceWorker();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className={cn(
          'fixed bottom-4 right-4 z-50 p-2 rounded-full shadow-lg',
          'transition-colors duration-300',
          isOnline
            ? 'bg-success/10 text-success border border-success/30'
            : 'bg-warning/10 text-warning border border-warning/30 animate-pulse'
        )}
        title={isOnline ? 'Online' : 'Offline'}
      >
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      </motion.div>
    </AnimatePresence>
  );
}

// Status badge for header/nav
export function OfflineStatusBadge() {
  const { isOnline } = useServiceWorker();
  
  if (isOnline) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-warning/10 text-warning border border-warning/30">
      <WifiOff className="h-3 w-3" />
      Offline
    </span>
  );
}

// Connection quality indicator
export function ConnectionQuality() {
  const { isOnline } = useServiceWorker();
  const [quality, setQuality] = useState<'good' | 'medium' | 'poor'>('good');
  
  useEffect(() => {
    if (!isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuality('poor');
      return;
    }
    
    // Simple quality check based on network API
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    if (connection?.effectiveType) {
      if (connection.effectiveType === '4g') {
        setQuality('good');
      } else if (connection.effectiveType === '3g') {
        setQuality('medium');
      } else {
        setQuality('poor');
      }
    }
  }, [isOnline]);
  
  const getColor = () => {
    switch (quality) {
      case 'good': return 'bg-success';
      case 'medium': return 'bg-warning';
      case 'poor': return 'bg-destructive';
    }
  };
  
  return (
    <div className="flex items-center gap-0.5">
      <div className={cn('w-1 h-2 rounded-sm', quality === 'poor' ? 'bg-muted' : getColor())} />
      <div className={cn('w-1 h-3 rounded-sm', quality === 'good' ? getColor() : 'bg-muted')} />
      <div className={cn('w-1 h-4 rounded-sm', quality === 'good' ? getColor() : 'bg-muted')} />
    </div>
  );
}

// PWA install prompt event interface
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Install prompt component
export const InstallPrompt = forwardRef<HTMLDivElement>(function InstallPrompt(_props, ref) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Listen for install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || dismissed) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50"
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Instalar App</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Instale o Lalamove Guardian para acesso rápido e offline.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
            className="flex-1"
          >
            Agora não
          </Button>
          <Button size="sm" onClick={handleInstall} className="flex-1">
            Instalar
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
