import { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import {
  Phone, Car, CheckCircle2, Clock, Shield, Ban, Activity, BarChart3, History, Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DriverWithIncidents } from '@/hooks/useDrivers';
import type { Database } from '@/integrations/supabase/types';
import { OverviewTab, PerformanceTab, HistoryTab } from './DriverProfileTabs';

type DriverStatus = Database['public']['Enums']['driver_status'];

interface DriverProfileModalProps {
  driver: DriverWithIncidents | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (driverId: string) => void;
  onBlock?: (driverId: string) => void;
  onWhitelist?: (driverId: string) => void;
  onBlacklist?: (driverId: string) => void;
}

const statusConfig: Record<DriverStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'glow-success' | 'glow-destructive'; color: string }> = {
  APPROVED: { label: 'Aprovado', variant: 'success', color: 'success' },
  PENDING_APPROVAL: { label: 'Pendente', variant: 'warning', color: 'warning' },
  BLOCKED: { label: 'Bloqueado', variant: 'destructive', color: 'destructive' },
  WHITELIST: { label: 'Whitelist', variant: 'glow-success', color: 'success' },
  BLACKLIST: { label: 'Blacklist', variant: 'glow-destructive', color: 'destructive' },
};

const vehicleLabels: Record<string, string> = {
  MOTORCYCLE: 'Moto', CAR: 'Carro', VAN: 'Van', TRUCK: 'Caminhão',
};

const generatePerformanceData = (base: number): number[] =>
  Array.from({ length: 12 }, () => Math.max(0, Math.min(100, base + (Math.random() - 0.5) * 20)));

export function DriverProfileModal({ driver, open, onOpenChange, onApprove, onBlock, onWhitelist, onBlacklist }: DriverProfileModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  if (!driver) return null;

  const status = statusConfig[driver.status];
  const completionRate = driver.totalDeliveries > 0 ? (driver.completedDeliveries / driver.totalDeliveries) * 100 : 0;
  const failedDeliveries = driver.totalDeliveries - driver.completedDeliveries;
  const failureRate = driver.totalDeliveries > 0 ? (failedDeliveries / driver.totalDeliveries) * 100 : 0;
  const performanceData = generatePerformanceData(completionRate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 bg-card/95 backdrop-blur-xl">
        {/* Header */}
        <div className={cn(
          "relative p-6 bg-gradient-to-br overflow-hidden",
          driver.status === 'WHITELIST' && "from-success/20 via-success/10 to-transparent",
          driver.status === 'BLACKLIST' && "from-destructive/20 via-destructive/10 to-transparent",
          driver.status === 'APPROVED' && "from-primary/20 via-accent/10 to-transparent",
          driver.status === 'PENDING_APPROVAL' && "from-warning/20 via-warning/10 to-transparent",
          driver.status === 'BLOCKED' && "from-muted/20 via-muted/10 to-transparent"
        )}>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent/20 to-transparent rounded-full blur-3xl" />
          </div>
          <DialogHeader className="relative">
            <div className="flex items-start gap-5">
              <motion.div className="relative" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                {driver.photoUrl ? (
                  <img src={driver.photoUrl} alt={driver.name} className="w-20 h-20 rounded-2xl object-cover border-3 border-border/50 shadow-xl" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center text-2xl font-bold text-foreground/70 shadow-xl border border-border/50">
                    {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div className={cn("absolute -bottom-2 -right-2 p-2 rounded-xl border-2 border-card shadow-lg", `bg-${status.color}`)}>
                  {driver.status === 'APPROVED' && <CheckCircle2 className="w-4 h-4 text-white" />}
                  {driver.status === 'PENDING_APPROVAL' && <Clock className="w-4 h-4 text-white" />}
                  {driver.status === 'BLOCKED' && <Ban className="w-4 h-4 text-white" />}
                  {driver.status === 'WHITELIST' && <Shield className="w-4 h-4 text-white" />}
                  {driver.status === 'BLACKLIST' && <Ban className="w-4 h-4 text-white" />}
                </div>
              </motion.div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold text-foreground mb-2">{driver.name}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant={status.variant} size="lg">{status.label}</Badge>
                  <Badge variant="muted" size="sm" className="gap-1"><Car className="w-3 h-3" />{vehicleLabels[driver.vehicleType] || driver.vehicleType}</Badge>
                  {driver.vehiclePlate && <Badge variant="secondary" size="sm" className="font-mono">{driver.vehiclePlate}</Badge>}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {driver.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{driver.phone}</span>}
                  {driver.createdAt && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Desde {format(new Date(driver.createdAt), 'MMM yyyy', { locale: ptBR })}</span>}
                </div>
              </div>
              <motion.div className="flex-shrink-0" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}>
                <RiskScoreGauge score={driver.riskScore} size="lg" showLabel />
              </motion.div>
            </div>
          </DialogHeader>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <div className="px-6 border-b border-border/50">
            <TabsList className="h-12 bg-transparent p-0 gap-6">
              {[
                { value: 'overview', icon: BarChart3, label: 'Visão Geral' },
                { value: 'performance', icon: Activity, label: 'Performance' },
                { value: 'history', icon: History, label: 'Histórico' },
              ].map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="relative h-12 px-0 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  <span className="flex items-center gap-2"><tab.icon className="w-4 h-4" />{tab.label}</span>
                  {activeTab === tab.value && <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" layoutId="tabIndicator" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-6">
            <TabsContent value="overview" className="mt-0">
              <OverviewTab driver={driver} completionRate={completionRate} failureRate={failureRate} failedDeliveries={failedDeliveries} performanceData={performanceData} />
            </TabsContent>
            <TabsContent value="performance" className="mt-0">
              <PerformanceTab driver={driver} completionRate={completionRate} failureRate={failureRate} failedDeliveries={failedDeliveries} performanceData={performanceData} />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <HistoryTab driver={driver} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border/50 bg-secondary/30">
          <div className="flex flex-wrap gap-2 justify-end">
            {driver.status === 'PENDING_APPROVAL' && onApprove && (
              <Button variant="gradient-success" size="sm" onClick={() => onApprove(driver.id)}><CheckCircle2 className="w-4 h-4 mr-2" />Aprovar</Button>
            )}
            {driver.status !== 'WHITELIST' && driver.status !== 'BLACKLIST' && onWhitelist && (
              <Button variant="outline" size="sm" className="text-success border-success/30 hover:bg-success/10" onClick={() => onWhitelist(driver.id)}><Shield className="w-4 h-4 mr-2" />Whitelist</Button>
            )}
            {driver.status !== 'BLOCKED' && driver.status !== 'BLACKLIST' && onBlock && (
              <Button variant="outline" size="sm" className="text-warning border-warning/30 hover:bg-warning/10" onClick={() => onBlock(driver.id)}><Ban className="w-4 h-4 mr-2" />Bloquear</Button>
            )}
            {driver.status !== 'BLACKLIST' && onBlacklist && (
              <Button variant="destructive" size="sm" onClick={() => onBlacklist(driver.id)}><Ban className="w-4 h-4 mr-2" />Blacklist</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
