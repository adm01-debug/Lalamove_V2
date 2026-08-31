import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb, ChevronRight, Sparkles, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Types
interface Hint {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
  delay?: number;
  variant?: 'info' | 'tip' | 'feature' | 'warning';
}

interface HintContextValue {
  showHint: (hint: Hint) => void;
  dismissHint: (id: string) => void;
  dismissAllHints: () => void;
  isHintDismissed: (id: string) => boolean;
  activeHints: Hint[];
}

// Context
const HintContext = createContext<HintContextValue | null>(null);

const STORAGE_KEY = 'dismissed_hints';

// Provider
export function HintProvider({ children }: { children: ReactNode }) {
  const [activeHints, setActiveHints] = useState<Hint[]>([]);
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const saveDismissedHints = useCallback((hints: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...hints]));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Rastreia timers pendentes de exibição adiada para evitar atualização de
  // estado após desmontagem (setState em componente desmontado / memory leak).
  const pendingTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = pendingTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const showHint = useCallback((hint: Hint) => {
    if (hint.showOnce && dismissedHints.has(hint.id)) {
      return;
    }

    const addHint = () => {
      setActiveHints((prev) => {
        if (prev.some((h) => h.id === hint.id)) return prev;
        return [...prev, hint];
      });
    };

    if (hint.delay) {
      const timer = setTimeout(() => {
        pendingTimers.current.delete(timer);
        addHint();
      }, hint.delay);
      pendingTimers.current.add(timer);
    } else {
      addHint();
    }
  }, [dismissedHints]);

  const dismissHint = useCallback((id: string) => {
    setActiveHints((prev) => prev.filter((h) => h.id !== id));
    
    const hint = activeHints.find((h) => h.id === id);
    if (hint?.showOnce) {
      const newDismissed = new Set([...dismissedHints, id]);
      setDismissedHints(newDismissed);
      saveDismissedHints(newDismissed);
    }
  }, [activeHints, dismissedHints, saveDismissedHints]);

  const dismissAllHints = useCallback(() => {
    const hintIds = activeHints.filter((h) => h.showOnce).map((h) => h.id);
    const newDismissed = new Set([...dismissedHints, ...hintIds]);
    setDismissedHints(newDismissed);
    saveDismissedHints(newDismissed);
    setActiveHints([]);
  }, [activeHints, dismissedHints, saveDismissedHints]);

  const isHintDismissed = useCallback((id: string) => {
    return dismissedHints.has(id);
  }, [dismissedHints]);

  return (
    <HintContext.Provider value={{ showHint, dismissHint, dismissAllHints, isHintDismissed, activeHints }}>
      {children}
      <HintContainer hints={activeHints} onDismiss={dismissHint} />
    </HintContext.Provider>
  );
}

export function useHints() {
  const context = useContext(HintContext);
  if (!context) {
    throw new Error('useHints must be used within a HintProvider');
  }
  return context;
}

// Hint container (renders active hints)
function HintContainer({ hints, onDismiss }: { hints: Hint[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
      <AnimatePresence mode="popLayout">
        {hints.map((hint) => (
          <HintCard key={hint.id} hint={hint} onDismiss={() => onDismiss(hint.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Individual hint card
const HintCard = forwardRef<HTMLDivElement, { hint: Hint; onDismiss: () => void }>(function HintCard({ hint, onDismiss }, ref) {
  const variantStyles = {
    info: {
      bg: 'bg-gradient-to-br from-info/10 to-info/5',
      border: 'border-info/20',
      icon: <Info className="w-5 h-5 text-info" />,
      iconBg: 'bg-info/20',
    },
    tip: {
      bg: 'bg-gradient-to-br from-warning/10 to-warning/5',
      border: 'border-warning/20',
      icon: <Lightbulb className="w-5 h-5 text-warning" />,
      iconBg: 'bg-warning/20',
    },
    feature: {
      bg: 'bg-gradient-to-br from-primary/10 to-accent/5',
      border: 'border-primary/20',
      icon: <Sparkles className="w-5 h-5 text-primary" />,
      iconBg: 'bg-primary/20',
    },
    warning: {
      bg: 'bg-gradient-to-br from-destructive/10 to-destructive/5',
      border: 'border-destructive/20',
      icon: <HelpCircle className="w-5 h-5 text-destructive" />,
      iconBg: 'bg-destructive/20',
    },
  };

  const style = variantStyles[hint.variant || 'tip'];

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        "relative overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm",
        style.bg,
        style.border
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex-shrink-0 p-2 rounded-lg", style.iconBg)}>
            {hint.icon || style.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm text-foreground">
                {hint.title}
              </h4>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDismiss}
                className="flex-shrink-0 h-6 w-6 -mr-1 -mt-1"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {hint.description}
            </p>

            {hint.action && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  hint.action?.onClick();
                  onDismiss();
                }}
                className="h-auto p-0 mt-2 text-xs"
              >
                {hint.action.label}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// Inline hint (attached to an element)
interface InlineHintProps {
  id: string;
  children: ReactNode;
  hint: Omit<Hint, 'id'>;
  className?: string;
  triggerOnHover?: boolean;
  showArrow?: boolean;
}

export function InlineHint({
  id,
  children,
  hint,
  className,
  triggerOnHover = false,
  showArrow = true,
}: InlineHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { isHintDismissed } = useHints();
  
  const isDismissed = isHintDismissed(id);

  useEffect(() => {
    if (!isDismissed && !triggerOnHover) {
      const timer = setTimeout(() => setIsVisible(true), hint.delay || 1000);
      return () => clearTimeout(timer);
    }
  }, [isDismissed, triggerOnHover, hint.delay]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (isDismissed) {
    return <>{children}</>;
  }

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  };

  const position = hint.position || 'bottom';

  return (
    <div 
      className={cn("relative inline-block", className)}
      onMouseEnter={() => triggerOnHover && setIsVisible(true)}
      onMouseLeave={() => triggerOnHover && setIsVisible(false)}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              "absolute z-50 w-64 p-3 rounded-lg bg-popover border border-border shadow-lg",
              positionClasses[position]
            )}
          >
            {showArrow && (
              <div
                className={cn(
                  "absolute w-0 h-0 border-4 border-popover",
                  arrowClasses[position]
                )}
              />
            )}
            
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{hint.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{hint.description}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleDismiss}
                className="flex-shrink-0 h-5 w-5"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>

            {hint.action && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  hint.action?.onClick();
                  handleDismiss();
                }}
                className="h-auto p-0 mt-2 text-xs"
              >
                {hint.action.label}
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Feature spotlight
interface FeatureSpotlightProps {
  id: string;
  children: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function FeatureSpotlight({
  id,
  children,
  title,
  description,
  className,
}: FeatureSpotlightProps) {
  const [isActive, setIsActive] = useState(false);
  const { isHintDismissed } = useHints();

  useEffect(() => {
    if (!isHintDismissed(id)) {
      const timer = setTimeout(() => setIsActive(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [id, isHintDismissed]);

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence>
        {isActive && (
          <>
            {/* Spotlight ring */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background" />
              <motion.div
                className="absolute inset-0 rounded-lg ring-2 ring-primary"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ opacity: 0.3 }}
              />
            </motion.div>

            {/* Tooltip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-64"
            >
              <div className="p-3 rounded-lg bg-primary text-primary-foreground shadow-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{description}</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsActive(false)}
                  className="w-full mt-2 h-7 text-xs"
                >
                  Entendi!
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {children}
    </div>
  );
}

// Pre-defined hints for common scenarios
export const commonHints = {
  swipeToAction: {
    title: 'Deslize para ações rápidas',
    description: 'Deslize itens para esquerda ou direita para revelar ações como aprovar, rejeitar ou arquivar.',
    variant: 'tip' as const,
    showOnce: true,
  },
  pullToRefresh: {
    title: 'Puxe para atualizar',
    description: 'Arraste a tela para baixo para atualizar os dados.',
    variant: 'tip' as const,
    showOnce: true,
  },
  keyboardShortcuts: {
    title: 'Atalhos de teclado',
    description: 'Pressione ? para ver todos os atalhos disponíveis.',
    variant: 'feature' as const,
    showOnce: true,
  },
  bulkActions: {
    title: 'Seleção múltipla',
    description: 'Selecione vários itens para realizar ações em lote.',
    variant: 'tip' as const,
    showOnce: true,
  },
  filters: {
    title: 'Filtros avançados',
    description: 'Use filtros para encontrar exatamente o que precisa.',
    variant: 'info' as const,
    showOnce: true,
  },
};
