import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Truck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverScale } from '@/components/ui/micro-interactions';
import { cn } from '@/lib/utils';

// Quick Actions Panel
interface QuickActionsPanelProps {
  pendingApprovals: number;
  activeAlerts: number;
  className?: string;
}

export function QuickActionsPanel({ pendingApprovals, activeAlerts, className }: QuickActionsPanelProps) {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Aprovações',
      count: pendingApprovals,
      icon: Users,
      path: '/approvals',
      color: 'warning' as const,
      urgent: pendingApprovals > 5,
    },
    {
      label: 'Alertas',
      count: activeAlerts,
      icon: AlertTriangle,
      path: '/alerts',
      color: 'destructive' as const,
      urgent: activeAlerts > 0,
    },
    {
      label: 'Mapa ao Vivo',
      icon: Truck,
      path: '/map',
      color: 'info' as const,
    },
    {
      label: 'Relatórios',
      icon: TrendingUp,
      path: '/reports',
      color: 'primary' as const,
    },
  ];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Ações Rápidas
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <HoverScale key={action.path}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(action.path)}
                className={cn(
                  "w-full p-3 rounded-xl text-left transition-all",
                  "bg-secondary/30 hover:bg-secondary/50",
                  "border border-transparent hover:border-border/50",
                  action.urgent && "ring-2 ring-destructive/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    action.color === 'warning' && "bg-warning/10 text-warning",
                    action.color === 'destructive' && "bg-destructive/10 text-destructive",
                    action.color === 'info' && "bg-info/10 text-info",
                    action.color === 'primary' && "bg-primary/10 text-primary"
                  )}>
                    <action.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                  {action.count !== undefined && action.count > 0 && (
                    <Badge 
                      variant={action.urgent ? "destructive" : "secondary"} 
                      className="ml-auto text-[10px] px-1.5"
                    >
                      {action.count}
                    </Badge>
                  )}
                </div>
              </motion.button>
            </HoverScale>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Welcome Banner
interface WelcomeBannerProps {
  userName?: string;
  className?: string;
}

export function WelcomeBanner({ userName, className }: WelcomeBannerProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const displayName = userName?.split('@')[0] || 'Operador';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-primary/10 via-accent/10 to-info/10 border border-primary/20",
        className
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
      
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 mb-1"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">{getGreeting()}</span>
          </motion.div>
          
          <h1 className="text-2xl font-bold">
            Olá, <span className="text-primary">{displayName}</span>! 👋
          </h1>
          
          <p className="text-sm text-muted-foreground mt-1">
            Aqui está o resumo das suas operações de hoje.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
