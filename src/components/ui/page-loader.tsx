import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  className?: string;
  message?: string;
}

export function PageLoader({ className, message = 'Carregando...' }: PageLoaderProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-h-[50vh] gap-4',
      className
    )}>
      {/* Animated background glow */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/20 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Spinner container */}
        <motion.div
          className="relative p-4 rounded-2xl bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-sm border border-border/50 shadow-xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </motion.div>
      </div>

      {/* Loading message */}
      <motion.p
        className="text-sm text-muted-foreground font-medium"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {message}
      </motion.p>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/50"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Minimal inline loader for smaller sections
export function InlineLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}
