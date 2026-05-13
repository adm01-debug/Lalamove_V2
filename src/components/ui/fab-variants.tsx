import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "./button";
import type { LucideIcon } from "lucide-react";

const positionClasses = {
  "bottom-right": "bottom-6 right-6",
  "bottom-left": "bottom-6 left-6",
  "bottom-center": "bottom-6 left-1/2 -translate-x-1/2",
  "top-right": "top-20 right-6",
  "top-left": "top-20 left-6",
};

const variantStyles = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
};

interface FABAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "destructive" | "success" | "warning";
  badge?: number;
  disabled?: boolean;
  tooltip?: string;
}

// FAB Badge
function FABBadge({ count, className, variant = "destructive" }: { count: number; className?: string; variant?: "destructive" | "primary" | "success" }) {
  if (count <= 0) return null;
  const bgClass = { destructive: "bg-destructive text-destructive-foreground", primary: "bg-primary text-primary-foreground", success: "bg-success text-success-foreground" }[variant];
  return (
    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn("absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full shadow-lg border-2 border-background", bgClass, className)}>
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

// Extended FAB with label always visible
interface ExtendedFABProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  position?: keyof typeof positionClasses;
  variant?: keyof typeof variantStyles;
  className?: string;
  loading?: boolean;
  badge?: number;
}

export function ExtendedFAB({ icon: Icon, label, onClick, position = "bottom-right", variant = "primary", className, loading = false, badge }: ExtendedFABProps) {
  return (
    <motion.div className={cn("fixed z-50", positionClasses[position], className)} initial={{ scale: 0, opacity: 0, y: 50 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
      <Button onClick={onClick} disabled={loading} className={cn("h-14 px-6 rounded-full shadow-2xl gap-3 relative overflow-hidden hover:shadow-xl transition-shadow duration-300", variantStyles[variant])}>
        {loading ? <motion.div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} /> : <Icon className="w-5 h-5" />}
        <span className="font-semibold">{label}</span>
        <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" initial={{ x: "-100%" }} whileHover={{ x: "100%" }} transition={{ duration: 0.6 }} />
        {badge !== undefined && badge > 0 && <FABBadge count={badge} className="-top-2 -right-2" />}
      </Button>
    </motion.div>
  );
}

// Mini FAB for secondary actions
interface MiniFABProps {
  icon: LucideIcon;
  onClick: () => void;
  position?: keyof typeof positionClasses;
  className?: string;
  tooltip?: string;
}

export function MiniFAB({ icon: Icon, onClick, position = "bottom-right", className, tooltip }: MiniFABProps) {
  return (
    <motion.div className={cn("fixed z-40", positionClasses[position], className)} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
      <Button size="icon" variant="secondary" onClick={onClick} className="w-10 h-10 rounded-full shadow-lg" title={tooltip}>
        <Icon className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}

// Speed Dial FAB (radial menu)
interface SpeedDialFABProps {
  actions: FABAction[];
  position?: keyof typeof positionClasses;
  className?: string;
}

export function SpeedDialFAB({ actions, position = "bottom-right", className }: SpeedDialFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const radius = 80;

  return (
    <motion.div className={cn("fixed z-50", positionClasses[position], className)} initial={{ scale: 0 }} animate={{ scale: 1 }}>
      <AnimatePresence>
        {isOpen && actions.map((action, index) => {
          const Icon = action.icon;
          const angle = ((index / actions.length) * Math.PI * 0.75) + Math.PI * 0.625;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <motion.div key={index} className="absolute" initial={{ x: 0, y: 0, scale: 0, opacity: 0 }} animate={{ x, y: -y, scale: 1, opacity: 1, transition: { delay: index * 0.05, type: "spring", stiffness: 400 } }} exit={{ x: 0, y: 0, scale: 0, opacity: 0, transition: { delay: (actions.length - index) * 0.03 } }} style={{ left: "50%", top: "50%", marginLeft: -20, marginTop: -20 }}>
              <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                <Button size="icon" onClick={() => { action.onClick(); setIsOpen(false); }} className={cn("w-10 h-10 rounded-full shadow-lg", variantStyles[action.variant || "primary"])} title={action.label}>
                  <Icon className="w-4 h-4" />
                </Button>
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button size="icon" onClick={() => setIsOpen(!isOpen)} className="w-14 h-14 rounded-full shadow-2xl relative z-10 bg-gradient-to-br from-primary to-accent">
          <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 300 }}>
            <Plus className="w-6 h-6" />
          </motion.div>
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && <motion.div className="fixed inset-0 -z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
