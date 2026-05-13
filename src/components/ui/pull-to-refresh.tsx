import { useState, useRef, useCallback, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  threshold?: number;
  refreshingText?: string;
  pullText?: string;
  releaseText?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
  threshold = 80,
  refreshingText = 'Atualizando...',
  pullText = 'Puxe para atualizar',
  releaseText = 'Solte para atualizar',
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pullDistance = useMotionValue(0);
  const [pullValue, setPullValue] = useState(0);

  // Mantém o UI reativo ao MotionValue (evita usar .get() no render, que não re-renderiza)
  useMotionValueEvent(pullDistance, 'change', (latest) => {
    if (isPulling || isRefreshing) setPullValue(latest);
  });

  const indicatorOpacity = useTransform(pullDistance, [0, threshold / 2, threshold], [0, 0.5, 1]);
  const indicatorScale = useTransform(pullDistance, [0, threshold], [0.5, 1]);
  const indicatorRotate = useTransform(pullDistance, [0, threshold], [0, 180]);

  const canPull = useCallback(() => {
    if (disabled || isRefreshing) return false;
    const container = containerRef.current;
    if (!container) return false;
    return container.scrollTop <= 0;
  }, [disabled, isRefreshing]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!canPull()) return;
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    },
    [canPull]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling || !canPull()) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Apply resistance
        const resistance = Math.min(diff * 0.5, threshold * 1.5);
        pullDistance.set(resistance);
      }
    },
    [isPulling, canPull, pullDistance, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);

    const currentPull = pullDistance.get();

    if (currentPull >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      pullDistance.set(60);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        pullDistance.set(0);
      }
    } else {
      pullDistance.set(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  const showReleaseText = pullValue >= threshold;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-y-auto touch-pan-y', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <AnimatePresence>
        {(isPulling || isRefreshing) && (
          <motion.div
            className="absolute left-0 right-0 flex flex-col items-center justify-center z-10 pointer-events-none"
            style={{
              opacity: indicatorOpacity,
              top: 0,
            }}
            initial={{ height: 0 }}
            animate={{ height: isRefreshing ? 60 : pullValue }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-full',
                'bg-gradient-to-br from-primary/20 to-accent/10',
                'backdrop-blur-sm border border-primary/20 shadow-lg'
              )}
              style={{ scale: indicatorScale }}
            >
              {isRefreshing ? (
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
              ) : (
                <motion.div style={{ rotate: indicatorRotate }}>
                  <ArrowDown className="w-5 h-5 text-primary" />
                </motion.div>
              )}
            </motion.div>
            <motion.span
              className="text-xs font-medium text-muted-foreground mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {isRefreshing ? refreshingText : showReleaseText ? releaseText : pullText}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        style={{
          y: useTransform(pullDistance, (v) => (isPulling || isRefreshing ? v : 0)),
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Hook for managing refresh state
export function usePullToRefresh(refreshFn: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshFn();
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFn]);

  return {
    isRefreshing,
    lastRefreshed,
    onRefresh: handleRefresh,
  };
}
