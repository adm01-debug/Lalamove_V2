import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SwipeableListItem, createSwipeAction } from '@/components/ui/swipeable-list';
import { TrendIndicator } from '@/components/ui/sparkline';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import { cn } from '@/lib/utils';
import type { DriverWithIncidents } from '@/hooks/useDrivers';
import type { Database } from '@/integrations/supabase/types';
import {
  Star, Package, Shield, Ban, CheckCircle2, Clock, AlertTriangle, Loader2,
  ShieldCheck, ShieldX, MoreVertical, TrendingUp,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { forwardRef } from 'react';

type DriverStatus = Database['public']['Enums']['driver_status'];

const statusConfig: Record<DriverStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'muted' | 'glow-success' | 'glow-destructive'; icon: typeof Shield }> = {
  APPROVED: { label: 'Aprovado', variant: 'success', icon: CheckCircle2 },
  PENDING_APPROVAL: { label: 'Pendente', variant: 'warning', icon: Clock },
  BLOCKED: { label: 'Bloqueado', variant: 'destructive', icon: Ban },
  WHITELIST: { label: 'Whitelist', variant: 'glow-success', icon: Shield },
  BLACKLIST: { label: 'Blacklist', variant: 'glow-destructive', icon: Ban },
};

const vehicleLabels: Record<string, string> = {
  MOTORCYCLE: 'Moto', CAR: 'Carro', VAN: 'Van', TRUCK: 'Caminhão',
};

interface DriverCardProps {
  driver: DriverWithIncidents;
  index: number;
  leftActions: ReturnType<typeof createSwipeAction>[];
  rightActions: ReturnType<typeof createSwipeAction>[];
  onApprove: (id: string) => void;
  onOpenDialog: (type: 'whitelist' | 'blacklist' | 'block', driver: DriverWithIncidents) => void;
  onRemoveWhitelist: (id: string) => void;
  onRemoveBlacklist: (id: string) => void;
  isApproving?: boolean;
}

export const DriverCard = forwardRef<HTMLDivElement, DriverCardProps>(function DriverCard({
  driver, index, leftActions, rightActions,
  onApprove, onOpenDialog, onRemoveWhitelist, onRemoveBlacklist, isApproving,
}, ref) {
  const status = statusConfig[driver.status];
  const StatusIcon = status.icon;
  const completionRate = driver.totalDeliveries > 0
    ? ((driver.completedDeliveries / driver.totalDeliveries) * 100).toFixed(1)
    : '0.0';

  return (
    <motion.div ref={ref} key={driver.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: index * 0.05 }}>
      <SwipeableListItem leftActions={leftActions} rightActions={rightActions} threshold={80}>
        <Card variant="glass" hover="lift" className={cn("overflow-hidden group", driver.status === 'BLACKLIST' && "border-destructive/40", driver.status === 'WHITELIST' && "border-success/40")}>
          <div className={cn("h-1 w-full",
            driver.status === 'WHITELIST' && "bg-gradient-to-r from-success to-emerald",
            driver.status === 'BLACKLIST' && "bg-gradient-to-r from-destructive to-rose",
            driver.status === 'APPROVED' && "bg-gradient-to-r from-primary to-accent",
            driver.status === 'PENDING_APPROVAL' && "bg-gradient-to-r from-warning to-amber",
            driver.status === 'BLOCKED' && "bg-gradient-to-r from-muted-foreground to-muted"
          )} />
          <CardContent className="p-4">
            <div className="flex items-start gap-4 mb-4">
              <div className="relative">
                {driver.photoUrl ? (
                  <img src={driver.photoUrl} alt={driver.name} className="w-16 h-16 rounded-xl object-cover border-2 border-border shadow-lg" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center text-xl font-bold text-foreground/70 shadow-lg">
                    {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className={cn("absolute -bottom-1 -right-1 p-1.5 rounded-lg border-2 border-card shadow-lg",
                  status.variant === 'success' && "bg-gradient-to-br from-success to-emerald",
                  status.variant === 'glow-success' && "bg-gradient-to-br from-success to-emerald",
                  status.variant === 'warning' && "bg-gradient-to-br from-warning to-amber",
                  status.variant === 'destructive' && "bg-gradient-to-br from-destructive to-rose",
                  status.variant === 'glow-destructive' && "bg-gradient-to-br from-destructive to-rose",
                  status.variant === 'info' && "bg-gradient-to-br from-info to-cyan",
                  status.variant === 'muted' && "bg-muted"
                )}>
                  <StatusIcon className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate">{driver.name}</h3>
                </div>
                <Badge variant={status.variant} size="sm">{status.label}</Badge>
                <p className="text-sm text-muted-foreground mt-1">{driver.phone || 'Sem telefone'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" size="sm">{vehicleLabels[driver.vehicleType] || driver.vehicleType}</Badge>
                  {driver.vehiclePlate && <span className="text-xs text-muted-foreground font-mono">{driver.vehiclePlate}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <RiskScoreGauge score={driver.riskScore} size="sm" showLabel={false} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover/95 backdrop-blur-xl">
                    {driver.status === 'PENDING_APPROVAL' && <DropdownMenuItem onClick={() => onApprove(driver.id)}><CheckCircle2 className="w-4 h-4 mr-2" />Aprovar</DropdownMenuItem>}
                    {driver.status !== 'WHITELIST' && driver.status !== 'BLACKLIST' && <DropdownMenuItem onClick={() => onOpenDialog('whitelist', driver)}><ShieldCheck className="w-4 h-4 mr-2" />Adicionar à Whitelist</DropdownMenuItem>}
                    {driver.status === 'WHITELIST' && <DropdownMenuItem onClick={() => onRemoveWhitelist(driver.id)}><Shield className="w-4 h-4 mr-2" />Remover da Whitelist</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    {driver.status !== 'BLACKLIST' && driver.status !== 'BLOCKED' && <DropdownMenuItem onClick={() => onOpenDialog('block', driver)} className="text-warning"><Ban className="w-4 h-4 mr-2" />Bloquear</DropdownMenuItem>}
                    {driver.status !== 'BLACKLIST' && <DropdownMenuItem onClick={() => onOpenDialog('blacklist', driver)} className="text-destructive"><ShieldX className="w-4 h-4 mr-2" />Adicionar à Blacklist</DropdownMenuItem>}
                    {driver.status === 'BLACKLIST' && <DropdownMenuItem onClick={() => onRemoveBlacklist(driver.id)}><ShieldX className="w-4 h-4 mr-2" />Remover da Blacklist</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-secondary/50 border border-border/30">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1"><Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" /></div>
                <p className="text-base sm:text-lg font-bold text-foreground">{driver.totalDeliveries}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Entregas</p>
              </div>
              <div className="text-center border-x border-border/50">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1"><Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-warning fill-warning" /></div>
                <p className="text-base sm:text-lg font-bold text-foreground">{driver.rating.toFixed(1)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Nota</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1"><TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" /></div>
                <p className="text-base sm:text-lg font-bold text-success">{completionRate}%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Taxa</p>
              </div>
            </div>
            <AnimatePresence>
              {driver.incidentCount > 0 && (
                <motion.div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">{driver.incidentCount} incidente{driver.incidentCount > 1 ? 's' : ''} não resolvido{driver.incidentCount > 1 ? 's' : ''}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {driver.status === 'BLACKLIST' && driver.blacklistReason && (
                <motion.div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <p className="text-xs text-muted-foreground">Motivo:</p>
                  <p className="text-sm text-destructive line-clamp-2">{driver.blacklistReason}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex gap-2 mt-3 sm:mt-4">
              {driver.status === 'PENDING_APPROVAL' && (
                <>
                  <Button size="sm" variant="gradient-success" className="flex-1 h-9 sm:h-10 text-xs sm:text-sm" onClick={() => onApprove(driver.id)} disabled={isApproving}>
                    {isApproving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />Aprovar</>}
                  </Button>
                  <Button variant="destructive" size="sm" className="h-9 sm:h-10 w-9 sm:w-10" onClick={() => onOpenDialog('block', driver)}><Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                </>
              )}
              {driver.status === 'APPROVED' && (
                <Button variant="outline" size="sm" className="flex-1 bg-secondary/50 h-9 sm:h-10 text-xs sm:text-sm" onClick={() => onOpenDialog('whitelist', driver)}>
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Adicionar à Whitelist</span>
                  <span className="sm:hidden">Whitelist</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </SwipeableListItem>
    </motion.div>
  );
});
