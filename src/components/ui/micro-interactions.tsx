import { motion, useSpring, useTransform, MotionValue } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

// Animated counter that smoothly transitions between numbers
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export function AnimatedCounter({
  value,
  duration = 1000,
  className,
  prefix = '',
  suffix = '',
  decimals = 0,
}: AnimatedCounterProps) {
  const spring = useSpring(0, { duration });
  const display = useTransform(spring, (current) =>
    `${prefix}${current.toFixed(decimals)}${suffix}`
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span className={className}>
      {display}
    </motion.span>
  );
}

// Animated percentage with circular progress
interface AnimatedPercentageProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  color?: string;
}

export function AnimatedPercentage({
  value,
  size = 60,
  strokeWidth = 6,
  className,
  showLabel = true,
  color = 'hsl(var(--primary))',
}: AnimatedPercentageProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const strokeDashoffset = useTransform(
    spring,
    [0, 100],
    [circumference, 0]
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>
      {showLabel && (
        <motion.span 
          className="absolute text-sm font-bold"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatedCounter value={value} suffix="%" decimals={0} />
        </motion.span>
      )}
    </div>
  );
}

// Pulse animation component
interface PulseProps {
  children: React.ReactNode;
  isActive?: boolean;
  color?: string;
  className?: string;
}

export function Pulse({ children, isActive = true, color = 'primary', className }: PulseProps) {
  if (!isActive) return <>{children}</>;
  
  return (
    <div className={cn("relative", className)}>
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full",
          color === 'primary' && "bg-primary/30",
          color === 'destructive' && "bg-destructive/30",
          color === 'success' && "bg-success/30",
          color === 'warning' && "bg-warning/30"
        )}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {children}
    </div>
  );
}

// Shimmer loading effect
interface ShimmerProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Shimmer({ className, width, height }: ShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className
      )}
      style={{ width, height }}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ translateX: ['0%', '200%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}

// Staggered list animation
interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function StaggeredList({ children, staggerDelay = 0.05, className }: StaggeredListProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: index * staggerDelay,
            duration: 0.3,
            ease: "easeOut",
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

// Hover scale effect wrapper
interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.02, className }: HoverScaleProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}

// Success checkmark animation
interface SuccessCheckProps {
  show: boolean;
  size?: number;
  className?: string;
}

export function SuccessCheck({ show, size = 24, className }: SuccessCheckProps) {
  return (
    <motion.div
      className={cn("flex items-center justify-center", className)}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="text-emerald-500"
      >
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: show ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        <motion.path
          d="M8 12l3 3 5-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: show ? 1 : 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
  );
}

// Number ticker with slot machine effect
interface NumberTickerProps {
  value: number;
  className?: string;
  direction?: 'up' | 'down';
}

export function NumberTicker({ value, className, direction = 'up' }: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDisplayValue(value), 50);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <motion.span
        key={displayValue}
        initial={{ y: direction === 'up' ? 20 : -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: direction === 'up' ? -20 : 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="inline-block"
      >
        {displayValue.toLocaleString('pt-BR')}
      </motion.span>
    </div>
  );
}

// Ripple effect button
interface RippleButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function RippleButton({ children, onClick, className, disabled }: RippleButtonProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setRipples((prev) => [...prev, { x, y, id: Date.now() }]);
    onClick?.();
    
    setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, 600);
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn("relative overflow-hidden", className)}
    >
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          style={{ left: ripple.x, top: ripple.y }}
          initial={{ width: 0, height: 0, x: 0, y: 0 }}
          animate={{ width: 300, height: 300, x: -150, y: -150 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
      {children}
    </button>
  );
}

// Typing animation
interface TypingTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypingText({ text, speed = 50, className, onComplete }: TypingTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  return (
    <span className={className}>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-[1.1em] bg-current ml-0.5 align-text-bottom"
      />
    </span>
  );
}

// Bounce notification badge
interface BounceBadgeProps {
  count: number;
  className?: string;
  variant?: 'default' | 'destructive' | 'warning';
}

export function BounceBadge({ count, className, variant = 'default' }: BounceBadgeProps) {
  if (count === 0) return null;

  return (
    <motion.span
      key={count}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 20,
      }}
      className={cn(
        "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full",
        variant === 'default' && "bg-primary text-primary-foreground",
        variant === 'destructive' && "bg-destructive text-destructive-foreground",
        variant === 'warning' && "bg-warning text-warning-foreground",
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </motion.span>
  );
}

// Glow effect on hover
interface GlowEffectProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function GlowEffect({ children, color = 'primary', className }: GlowEffectProps) {
  return (
    <motion.div
      className={cn("relative group", className)}
      whileHover="hover"
    >
      <motion.div
        className={cn(
          "absolute -inset-1 rounded-lg opacity-0 blur-md group-hover:opacity-75 transition-opacity duration-300",
          color === 'primary' && "bg-primary/50",
          color === 'accent' && "bg-accent/50",
          color === 'success' && "bg-success/50"
        )}
        variants={{
          hover: { opacity: 0.75 },
        }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

// Skeleton with shimmer
interface SkeletonShimmerProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function SkeletonShimmer({ 
  className, 
  variant = 'rectangular',
  width,
  height 
}: SkeletonShimmerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted animate-pulse",
        variant === 'circular' && "rounded-full",
        variant === 'text' && "rounded h-4",
        variant === 'rectangular' && "rounded-md",
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-background/40 to-transparent animate-shimmer" />
    </div>
  );
}
