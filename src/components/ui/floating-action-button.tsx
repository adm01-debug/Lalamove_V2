import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Plus, X, GripVertical } from "lucide-react";
import { Button } from "./button";
import type { LucideIcon } from "lucide-react";

// Re-export variant FABs from dedicated file
export { ExtendedFAB, MiniFAB, SpeedDialFAB } from "./fab-variants";

interface FABAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "destructive" | "success" | "warning";
  badge?: number;
  disabled?: boolean;
  tooltip?: string;
}

interface FloatingActionButtonProps {
  actions: FABAction[];
  position?: "bottom-right" | "bottom-left" | "bottom-center" | "top-right" | "top-left";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  totalBadge?: number;
  hasCriticalAlerts?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  draggable?: boolean;
  expandDirection?: "up" | "down" | "left" | "right";
  showLabelsOnHover?: boolean;
  pulse?: boolean;
  glowColor?: string;
}

export interface FloatingActionButtonRef {
  toggle: () => void;
  open: () => void;
  close: () => void;
  getPosition: () => { x: number; y: number };
}

const positionClasses = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
  "top-right": "top-20 right-6",
  "top-left": "top-20 left-6",
};

const sizeClasses = {
  sm: { button: "w-10 h-10", icon: "w-4 h-4", action: "w-10 h-10" },
  md: { button: "w-14 h-14", icon: "w-6 h-6", action: "w-12 h-12" },
  lg: { button: "w-16 h-16", icon: "w-7 h-7", action: "w-14 h-14" },
  xl: { button: "w-20 h-20", icon: "w-8 h-8", action: "w-16 h-16" },
};

const variantStyles = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
};

function FABBadge({ count, className, pulse = false, variant = "destructive" }: { count: number; className?: string; pulse?: boolean; variant?: "destructive" | "primary" | "success" }) {
  if (count <= 0) return null;
  const bgClass = { destructive: "bg-destructive text-destructive-foreground", primary: "bg-primary text-primary-foreground", success: "bg-success text-success-foreground" }[variant];
  return (
    <motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 180 }} className={cn("absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full shadow-lg border-2 border-background", bgClass, className)}>
      <motion.span key={count} initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500 }}>{count > 99 ? "99+" : count}</motion.span>
      {pulse && <motion.span className={cn("absolute inset-0 rounded-full", bgClass)} initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: [1, 2, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />}
    </motion.span>
  );
}

function RippleEffect({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <motion.div className="absolute inset-0 rounded-full bg-white/30" initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 2.5, opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} />;
}

function GlowEffect({ color = "primary", pulse = false }: { color?: string; pulse?: boolean }) {
  return (
    <motion.div className={cn("absolute inset-0 rounded-full -z-10", `bg-${color}/30 blur-xl`)} animate={pulse ? { scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] } : {}} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} style={{ background: `radial-gradient(circle, hsl(var(--${color}) / 0.4) 0%, transparent 70%)` }} />
  );
}

export const FloatingActionButton = forwardRef<FloatingActionButtonRef, FloatingActionButtonProps>(({
  actions, position = "bottom-right", size = "md", className, totalBadge = 0, hasCriticalAlerts = false,
  isOpen: controlledIsOpen, onOpenChange, draggable = false, expandDirection = "up",
  showLabelsOnHover = true, pulse = false, glowColor,
}, ref) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-100, 100], [-10, 10]);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = useCallback((open: boolean) => { onOpenChange?.(open); setInternalIsOpen(open); }, [onOpenChange]);
  const sizes = sizeClasses[size];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= actions.length) { e.preventDefault(); const action = actions[num - 1]; if (!action.disabled) { action.onClick(); setIsOpen(false); } }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, actions, setIsOpen]);

  useImperativeHandle(ref, () => ({
    toggle: () => setIsOpen(!isOpen), open: () => setIsOpen(true), close: () => setIsOpen(false),
    getPosition: () => ({ x: x.get(), y: y.get() }),
  }), [isOpen, setIsOpen, x, y]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    if (Math.abs(info.offset.x) < 50 && Math.abs(info.offset.y) < 50) { x.set(0); y.set(0); }
  };

  const handleClick = () => { setShowRipple(true); setTimeout(() => setShowRipple(false), 600); setIsOpen(!isOpen); };

  const getActionContainerStyles = () => {
    switch (expandDirection) {
      case "up": return "flex-col-reverse bottom-full mb-3";
      case "down": return "flex-col top-full mt-3";
      case "left": return "flex-row-reverse right-full mr-3";
      case "right": return "flex-row left-full ml-3";
    }
  };

  // Single action mode
  if (actions.length === 1) {
    const action = actions[0];
    const Icon = action.icon;
    return (
      <motion.div className={cn("fixed z-50", positionClasses[position], className)} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} drag={draggable} dragElastic={0.1} dragMomentum={false} style={{ x, y }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <div className="relative">
          {(pulse || glowColor) && <GlowEffect color={glowColor || "primary"} pulse={pulse} />}
          <Button size="icon" onClick={action.onClick} disabled={action.disabled} className={cn(sizes.button, "rounded-full shadow-2xl relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent hover:shadow-primary/25 hover:shadow-xl transition-shadow duration-300")}>
            <Icon className={cn(sizes.icon, "relative z-10")} />
          </Button>
          {action.badge && <FABBadge count={action.badge} pulse={hasCriticalAlerts} />}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div className={cn("fixed z-50", !isDragging && positionClasses[position], className)} initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} drag={draggable} dragElastic={0.1} dragMomentum={false} onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd} style={draggable ? { x, y, rotate } : {}}>
        {draggable && !isOpen && <motion.div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100" initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}><GripVertical className="w-4 h-4 text-muted-foreground" /></motion.div>}

        <AnimatePresence mode="popLayout">
          {isOpen && (
            <motion.div className={cn("absolute flex gap-3", getActionContainerStyles())} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {actions.map((action, index) => {
                const Icon = action.icon;
                const isHovered = hoveredAction === index;
                return (
                  <motion.div key={index} initial={{ opacity: 0, scale: 0.3, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: index * 0.05, type: "spring", stiffness: 400, damping: 25 } }} exit={{ opacity: 0, scale: 0.3, y: 20, transition: { delay: (actions.length - index - 1) * 0.03 } }} className="flex items-center gap-2" onMouseEnter={() => setHoveredAction(index)} onMouseLeave={() => setHoveredAction(null)}>
                    <motion.span className={cn("w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shadow-md bg-background/90 backdrop-blur-md border border-border/50", isHovered ? "text-primary scale-110" : "text-muted-foreground")} animate={{ scale: isHovered ? 1.1 : 1 }}>{index + 1}</motion.span>
                    <AnimatePresence>
                      {(showLabelsOnHover ? isHovered : true) && (
                        <motion.span initial={{ opacity: 0, x: -10, width: 0 }} animate={{ opacity: 1, x: 0, width: "auto" }} exit={{ opacity: 0, x: -10, width: 0 }} className="px-3 py-1.5 rounded-xl text-sm font-medium shadow-lg bg-card/95 backdrop-blur-md border border-border/50 whitespace-nowrap flex items-center gap-2 overflow-hidden">
                          {action.label}
                          {action.badge && action.badge > 0 && <span className={cn("min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full", action.variant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>{action.badge > 99 ? "99+" : action.badge}</span>}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <motion.div className="relative" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button size="icon" onClick={() => { if (!action.disabled) { action.onClick(); setIsOpen(false); } }} disabled={action.disabled} className={cn(sizes.action, "rounded-full shadow-lg relative overflow-hidden", variantStyles[action.variant || "primary"], action.disabled && "opacity-50 cursor-not-allowed")} title={action.tooltip}>
                        <Icon className="w-5 h-5 relative z-10" />
                        <motion.div className="absolute inset-0 bg-white/20" initial={{ x: "-100%" }} whileHover={{ x: "100%" }} transition={{ duration: 0.5 }} />
                      </Button>
                      {action.badge && action.badge > 0 && <FABBadge count={action.badge} className="scale-75" variant={action.variant === "destructive" ? "destructive" : "primary"} />}
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="relative group" whileHover={{ scale: isDragging ? 1 : 1.05 }} whileTap={{ scale: 0.95 }}>
          {(pulse || glowColor) && !isOpen && <GlowEffect color={glowColor || "primary"} pulse={pulse} />}
          <Button size="icon" onClick={handleClick} className={cn(sizes.button, "rounded-full shadow-2xl relative overflow-hidden transition-all duration-300", isOpen ? "bg-muted text-muted-foreground hover:bg-muted/90" : "bg-gradient-to-br from-primary via-primary to-accent hover:shadow-primary/30 hover:shadow-xl")}>
            <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              {isOpen ? <X className={sizes.icon} /> : <Plus className={sizes.icon} />}
            </motion.div>
            <RippleEffect isActive={showRipple} />
          </Button>
          {!isOpen && <FABBadge count={totalBadge} pulse={hasCriticalAlerts} />}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isOpen && <motion.div className="fixed inset-0 bg-background/40 backdrop-blur-sm z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} />}
      </AnimatePresence>
    </>
  );
});

FloatingActionButton.displayName = "FloatingActionButton";
