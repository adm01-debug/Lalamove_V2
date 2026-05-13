import { useState, useRef, ReactNode, useCallback } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, X, Trash2, Eye, Edit, Archive, MoreHorizontal } from 'lucide-react';

interface SwipeAction {
  id: string;
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
  onAction: () => void;
}

interface SwipeableListItemProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  threshold?: number;
  disabled?: boolean;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

export function SwipeableListItem({
  children,
  leftActions = [],
  rightActions = [],
  className,
  threshold = 80,
  disabled = false,
  onSwipeStart,
  onSwipeEnd,
}: SwipeableListItemProps) {
  const [isOpen, setIsOpen] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  
  const leftActionsWidth = leftActions.length * 72;
  const rightActionsWidth = rightActions.length * 72;

  const leftOpacity = useTransform(x, [0, threshold], [0, 1]);
  const rightOpacity = useTransform(x, [-threshold, 0], [1, 0]);
  
  const leftScale = useTransform(x, [0, threshold], [0.8, 1]);
  const rightScale = useTransform(x, [-threshold, 0], [1, 0.8]);

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const velocity = info.velocity.x;
      const offset = info.offset.x;

      if (offset > threshold && leftActions.length > 0) {
        x.set(leftActionsWidth);
        setIsOpen('left');
      } else if (offset < -threshold && rightActions.length > 0) {
        x.set(-rightActionsWidth);
        setIsOpen('right');
      } else {
        x.set(0);
        setIsOpen(null);
      }

      onSwipeEnd?.();
    },
    [x, threshold, leftActionsWidth, rightActionsWidth, leftActions.length, rightActions.length, onSwipeEnd]
  );

  const handleActionClick = (action: SwipeAction) => {
    action.onAction();
    x.set(0);
    setIsOpen(null);
  };

  const closeActions = () => {
    x.set(0);
    setIsOpen(null);
  };

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden", className)}>
      {/* Left actions */}
      {leftActions.length > 0 && (
        <motion.div
          className="absolute left-0 top-0 bottom-0 flex items-stretch"
          style={{ opacity: leftOpacity, scale: leftScale }}
        >
          {leftActions.map((action) => (
            <motion.button
              key={action.id}
              className={cn(
                "w-[72px] flex flex-col items-center justify-center gap-1 text-xs font-medium",
                action.bgColor
              )}
              onClick={() => handleActionClick(action)}
              whileTap={{ scale: 0.95 }}
            >
              {action.icon}
              <span className={action.color}>{action.label}</span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Right actions */}
      {rightActions.length > 0 && (
        <motion.div
          className="absolute right-0 top-0 bottom-0 flex items-stretch"
          style={{ opacity: rightOpacity, scale: rightScale }}
        >
          {rightActions.map((action) => (
            <motion.button
              key={action.id}
              className={cn(
                "w-[72px] flex flex-col items-center justify-center gap-1 text-xs font-medium",
                action.bgColor
              )}
              onClick={() => handleActionClick(action)}
              whileTap={{ scale: 0.95 }}
            >
              {action.icon}
              <span className={action.color}>{action.label}</span>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Main content */}
      <motion.div
        className="relative bg-background z-10"
        style={{ x }}
        drag="x"
        dragConstraints={{ 
          left: rightActions.length > 0 ? -rightActionsWidth : 0, 
          right: leftActions.length > 0 ? leftActionsWidth : 0 
        }}
        dragElastic={0.1}
        onDragStart={onSwipeStart}
        onDragEnd={handleDragEnd}
        onClick={isOpen ? closeActions : undefined}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Pre-configured swipe actions for common use cases
export const approveRejectActions = {
  left: [
    {
      id: 'approve',
      icon: <Check className="w-5 h-5 text-white" />,
      label: 'Aprovar',
      color: 'text-white',
      bgColor: 'bg-success',
      onAction: () => {},
    },
  ],
  right: [
    {
      id: 'reject',
      icon: <X className="w-5 h-5 text-white" />,
      label: 'Rejeitar',
      color: 'text-white',
      bgColor: 'bg-destructive',
      onAction: () => {},
    },
  ],
};

export const deleteArchiveActions = {
  left: [
    {
      id: 'archive',
      icon: <Archive className="w-5 h-5 text-white" />,
      label: 'Arquivar',
      color: 'text-white',
      bgColor: 'bg-info',
      onAction: () => {},
    },
  ],
  right: [
    {
      id: 'delete',
      icon: <Trash2 className="w-5 h-5 text-white" />,
      label: 'Excluir',
      color: 'text-white',
      bgColor: 'bg-destructive',
      onAction: () => {},
    },
  ],
};

export const viewEditActions = {
  left: [
    {
      id: 'view',
      icon: <Eye className="w-5 h-5 text-white" />,
      label: 'Ver',
      color: 'text-white',
      bgColor: 'bg-primary',
      onAction: () => {},
    },
  ],
  right: [
    {
      id: 'edit',
      icon: <Edit className="w-5 h-5 text-white" />,
      label: 'Editar',
      color: 'text-white',
      bgColor: 'bg-warning',
      onAction: () => {},
    },
  ],
};

// Create custom actions helper
export function createSwipeAction(
  id: string,
  label: string,
  icon: ReactNode,
  variant: 'primary' | 'success' | 'warning' | 'destructive' | 'info',
  onAction: () => void
): SwipeAction {
  const variants = {
    primary: { color: 'text-white', bgColor: 'bg-primary' },
    success: { color: 'text-white', bgColor: 'bg-success' },
    warning: { color: 'text-white', bgColor: 'bg-warning' },
    destructive: { color: 'text-white', bgColor: 'bg-destructive' },
    info: { color: 'text-white', bgColor: 'bg-info' },
  };

  return {
    id,
    label,
    icon,
    ...variants[variant],
    onAction,
  };
}

// Swipeable list container
interface SwipeableListProps {
  children: ReactNode;
  className?: string;
}

export function SwipeableList({ children, className }: SwipeableListProps) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      {children}
    </div>
  );
}

// Demo component showing usage
export function SwipeableListDemo() {
  const items = [
    { id: 1, title: 'João Silva', subtitle: 'Aguardando aprovação' },
    { id: 2, title: 'Maria Santos', subtitle: 'Documentação pendente' },
    { id: 3, title: 'Pedro Oliveira', subtitle: 'Análise de risco' },
  ];

  return (
    <SwipeableList className="rounded-xl border overflow-hidden">
      {items.map((item) => (
        <SwipeableListItem
          key={item.id}
          leftActions={[
            createSwipeAction('approve', 'Aprovar', <Check className="w-5 h-5" />, 'success', () => {
              // Action handler for approve
            }),
          ]}
          rightActions={[
            createSwipeAction('reject', 'Rejeitar', <X className="w-5 h-5" />, 'destructive', () => {
              // Action handler for reject
            }),
          ]}
        >
          <div className="p-4">
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
          </div>
        </SwipeableListItem>
      ))}
    </SwipeableList>
  );
}
