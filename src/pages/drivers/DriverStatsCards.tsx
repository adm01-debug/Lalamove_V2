import { Card, CardContent } from '@/components/ui/card';
import { TrendIndicator } from '@/components/ui/sparkline';
import { cn } from '@/lib/utils';
import { Users, CheckCircle2, Clock, Ban } from 'lucide-react';

interface DriverStatsCardsProps {
  stats: { total: number; approved: number; pending: number; blocked: number };
}

const statItems = [
  { icon: Users, label: 'Total', variant: 'primary' as const, trend: 5.2, key: 'total' as const },
  { icon: CheckCircle2, label: 'Aprovados', variant: 'success' as const, trend: 12.5, key: 'approved' as const },
  { icon: Clock, label: 'Pendentes', variant: 'warning' as const, trend: -8.3, invertColors: true, key: 'pending' as const },
  { icon: Ban, label: 'Bloqueados', variant: 'destructive' as const, trend: -15.2, invertColors: true, key: 'blocked' as const },
];

export function DriverStatsCards({ stats }: DriverStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      {statItems.map((stat, index) => (
        <Card key={stat.label} variant="glass" hover="lift" className="animate-fade-up overflow-hidden" style={{ animationDelay: `${index * 75}ms` }}>
          <div className={cn("absolute inset-0 opacity-20",
            stat.variant === 'primary' && "bg-gradient-to-br from-primary/30 to-accent/10",
            stat.variant === 'success' && "bg-gradient-to-br from-success/30 to-emerald/10",
            stat.variant === 'warning' && "bg-gradient-to-br from-warning/30 to-amber/10",
            stat.variant === 'destructive' && "bg-gradient-to-br from-destructive/30 to-rose/10"
          )} />
          <CardContent className="p-3 sm:p-4 relative">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn("p-2 sm:p-2.5 rounded-lg sm:rounded-xl shadow-lg",
                stat.variant === 'primary' && "bg-gradient-to-br from-primary/30 to-accent/20",
                stat.variant === 'success' && "bg-gradient-to-br from-success/30 to-emerald/20",
                stat.variant === 'warning' && "bg-gradient-to-br from-warning/30 to-amber/20",
                stat.variant === 'destructive' && "bg-gradient-to-br from-destructive/30 to-rose/20"
              )}>
                <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5",
                  stat.variant === 'primary' && "text-primary",
                  stat.variant === 'success' && "text-success",
                  stat.variant === 'warning' && "text-warning",
                  stat.variant === 'destructive' && "text-destructive"
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-xl sm:text-3xl font-bold text-foreground">{stats[stat.key]}</p>
                  <TrendIndicator value={stat.trend} size="xs" invertColors={stat.invertColors} className="hidden sm:flex" />
                </div>
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{stat.label}</p>
                  <TrendIndicator value={stat.trend} size="xs" showValue={false} invertColors={stat.invertColors} className="sm:hidden" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
