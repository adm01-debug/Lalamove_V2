import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Re-export all variants from the extracted module
export {
  fadeVariants,
  fadeUpVariants,
  fadeDownVariants,
  slideInLeftVariants,
  slideInRightVariants,
  scaleVariants,
  staggerContainerVariants,
  staggerItemVariants,
  containerVariants,
  itemVariants,
  headerVariants,
  statsCardVariants,
  cardVariants,
  statsVariants,
  panelVariants,
  variantMap,
} from './motion-variants';

import {
  fadeVariants,
  staggerContainerVariants,
  staggerItemVariants,
  scaleVariants,
} from './motion-variants';

// ============= Motion Components =============

interface MotionContainerProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  delay?: number;
}

export const MotionContainer = forwardRef<HTMLDivElement, MotionContainerProps>(
  ({ children, className, stagger = false, delay = 0, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={stagger ? staggerContainerVariants : fadeVariants}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionContainer.displayName = 'MotionContainer';

interface MotionItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  variant?: 'fade' | 'fadeUp' | 'fadeDown' | 'slideLeft' | 'slideRight' | 'scale';
  delay?: number;
  hover?: boolean;
  hoverScale?: number;
}

import { variantMap } from './motion-variants';

export const MotionItem = forwardRef<HTMLDivElement, MotionItemProps>(
  ({ children, className, variant = 'fadeUp', delay = 0, hover = false, hoverScale = 1.02, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={variantMap[variant]}
      transition={{ delay }}
      whileHover={hover ? { scale: hoverScale, y: -2 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionItem.displayName = 'MotionItem';

interface MotionCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  delay?: number;
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'none';
}

export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  ({ children, className, delay = 0, hoverEffect = 'lift', ...props }, ref) => {
    const hoverEffects = {
      lift: { y: -4, transition: { type: 'spring' as const, stiffness: 400, damping: 17 } },
      scale: { scale: 1.02, transition: { type: 'spring' as const, stiffness: 400, damping: 17 } },
      glow: { boxShadow: '0 0 30px rgba(var(--primary), 0.3)', transition: { duration: 0.2 } },
      none: {}
    };

    return (
      <motion.div
        ref={ref}
        className={className}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={scaleVariants}
        transition={{ delay }}
        whileHover={hoverEffects[hoverEffect]}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
MotionCard.displayName = 'MotionCard';

interface MotionListProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const MotionList = forwardRef<HTMLDivElement, MotionListProps>(
  ({ children, className, staggerDelay = 0.1, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay }
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionList.displayName = 'MotionList';

interface MotionListItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const MotionListItem = forwardRef<HTMLDivElement, MotionListItemProps>(
  ({ children, className, hover = true, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerItemVariants}
      whileHover={hover ? { scale: 1.01, x: 4 } : undefined}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionListItem.displayName = 'MotionListItem';

interface MotionButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ children, className, disabled, ...props }, ref) => (
    <motion.button
      ref={ref}
      className={className}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.button>
  )
);
MotionButton.displayName = 'MotionButton';

interface MotionIconProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  pulse?: boolean;
  spin?: boolean;
  bounce?: boolean;
}

export const MotionIcon = forwardRef<HTMLDivElement, MotionIconProps>(
  ({ children, className, pulse = false, spin = false, bounce = false, ...props }, ref) => {
    const getAnimation = () => {
      if (spin) return { rotate: 360 };
      if (pulse) return { scale: [1, 1.1, 1] };
      if (bounce) return { y: [0, -4, 0] };
      return {};
    };

    const getTransition = () => {
      if (spin) return { duration: 2, repeat: Infinity, ease: 'linear' as const };
      if (pulse) return { duration: 2, repeat: Infinity };
      if (bounce) return { duration: 1.5, repeat: Infinity };
      return {};
    };

    return (
      <motion.div
        ref={ref}
        className={cn('inline-flex', className)}
        animate={getAnimation()}
        transition={getTransition()}
        whileHover={{ scale: 1.1, rotate: 5 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
MotionIcon.displayName = 'MotionIcon';

interface MotionPageProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
}

export const MotionPage = forwardRef<HTMLDivElement, MotionPageProps>(
  ({ children, className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionPage.displayName = 'MotionPage';

interface MotionStatProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  index?: number;
}

export const MotionStat = forwardRef<HTMLDivElement, MotionStatProps>(
  ({ children, className, index = 0, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        delay: index * 0.1, 
        type: 'spring' as const, 
        stiffness: 300, 
        damping: 24 
      }}
      whileHover={{ scale: 1.03, y: -2 }}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionStat.displayName = 'MotionStat';

interface MotionBadgeProps extends HTMLMotionProps<'span'> {
  children: ReactNode;
  className?: string;
  pulse?: boolean;
}

export const MotionBadge = forwardRef<HTMLSpanElement, MotionBadgeProps>(
  ({ children, className, pulse = false, ...props }, ref) => (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: pulse ? [1, 1.05, 1] : 1 
      }}
      transition={pulse ? { 
        scale: { duration: 2, repeat: Infinity },
        opacity: { duration: 0.3 }
      } : { duration: 0.3 }}
      {...props}
    >
      {children}
    </motion.span>
  )
);
MotionBadge.displayName = 'MotionBadge';

interface MotionPanelProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  isVisible?: boolean;
}

export const MotionPanel = forwardRef<HTMLDivElement, MotionPanelProps>(
  ({ children, className, direction = 'left', isVisible = true, ...props }, ref) => {
    const getInitialPosition = () => {
      switch (direction) {
        case 'left': return { x: -20, opacity: 0 };
        case 'right': return { x: 20, opacity: 0 };
        case 'top': return { y: -20, opacity: 0 };
        case 'bottom': return { y: 20, opacity: 0 };
      }
    };

    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={ref}
            className={className}
            initial={getInitialPosition()}
            animate={{ x: 0, y: 0, opacity: 1 }}
            exit={getInitialPosition()}
            transition={{ type: 'spring' as const, stiffness: 300, damping: 24 }}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
MotionPanel.displayName = 'MotionPanel';

interface MotionOverlayProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  isVisible?: boolean;
}

export const MotionOverlay = forwardRef<HTMLDivElement, MotionOverlayProps>(
  ({ children, className, isVisible = true, ...props }, ref) => (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={ref}
          className={className}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
);
MotionOverlay.displayName = 'MotionOverlay';

// Re-export AnimatePresence for convenience
export { AnimatePresence, motion };
