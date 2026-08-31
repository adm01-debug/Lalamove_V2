import { Alert } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  MapPin,
  Shield,
  Clock,
  Hand,
  Archive,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SwipeableListItem, createSwipeAction } from '@/components/ui/swipeable-list';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';
import { forwardRef } from 'react';

interface AlertsPanelProps {
  alerts: Alert[];
  onDismiss?: (alert: Alert) => void;
  onView?: (alert: Alert) => void;
}

const alertIcons: Record<string, typeof AlertTriangle> = {
  DRIVER_BLOCKED: Shield,
  ROUTE_DEVIATION: MapPin,
  DRIVER_STOPPED: Clock,
  LATE_DELIVERY: AlertCircle,
  APPROVAL_REQUIRED: AlertTriangle,
  ORDER_CANCELLED: X,
};

const severityStyles = {
  INFO: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    icon: 'text-primary',
  },
  WARNING: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    icon: 'text-warning',
  },
  CRITICAL: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    icon: 'text-destructive',
  },
};

function formatTimeAgoValue(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h atrás`;
}

// Alert Card Component
const AlertCard = forwardRef<HTMLDivElement, {
  alert: Alert;
  onDismiss?: () => void;
  showDismiss?: boolean;
  index?: number;
}>(function AlertCard({
  alert,
  onDismiss,
  showDismiss = true,
  index = 0
}, ref) {
  const Icon = alertIcons[alert.type] || AlertCircle;
  const styles = severityStyles[alert.severity];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "p-4 transition-colors",
        !alert.isRead && styles.bg
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg flex-shrink-0",
          styles.bg,
          "border",
          styles.border
        )}>
          <Icon className={cn("w-4 h-4", styles.icon)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              "text-sm font-semibold",
              !alert.isRead ? "text-foreground" : "text-muted-foreground"
            )}>
              {alert.title}
            </h4>
            {!alert.isRead && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {alert.message}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatTimeAgoValue(alert.createdAt)}
          </p>
        </div>

        {showDismiss && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
});

export function AlertsPanel({ alerts, onDismiss, onView }: AlertsPanelProps) {
  const unreadAlerts = alerts.filter(a => !a.isRead);
  const isMobile = useIsMobile();

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-foreground" />
          <h3 className="font-semibold text-foreground">Alertas</h3>
        </div>
        <div className="flex items-center gap-2">
          {isMobile && alerts.length > 0 && (
            <Badge variant="outline" className="text-xs gap-1">
              <Hand className="w-3 h-3" />
              Deslize
            </Badge>
          )}
          {unreadAlerts.length > 0 && (
            <Badge variant="destructive">{unreadAlerts.length} novo{unreadAlerts.length > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-success/20 mx-auto mb-4 flex items-center justify-center">
            <Bell className="w-6 h-6 text-success" />
          </div>
          <h4 className="font-medium text-foreground mb-1">Tudo tranquilo</h4>
          <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {alerts.map((alert, index) => {
              // Mobile: Swipe actions
              if (isMobile) {
                return (
                  <SwipeableListItem
                    key={alert.id}
                    leftActions={[
                      createSwipeAction(
                        'view',
                        'Ver',
                        <Eye className="w-5 h-5" />,
                        'primary',
                        () => onView?.(alert)
                      ),
                    ]}
                    rightActions={[
                      createSwipeAction(
                        'dismiss',
                        'Dispensar',
                        <Archive className="w-5 h-5" />,
                        'info',
                        () => onDismiss?.(alert)
                      ),
                    ]}
                  >
                    <AlertCard 
                      alert={alert} 
                      showDismiss={false}
                      index={index}
                    />
                  </SwipeableListItem>
                );
              }

              // Desktop: Regular buttons
              return (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDismiss={() => onDismiss?.(alert)}
                  index={index}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
