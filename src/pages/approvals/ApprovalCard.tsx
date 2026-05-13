import { useState } from 'react';
import { motion } from 'framer-motion';
import { RiskScoreGauge } from '@/components/dashboard/RiskScoreGauge';
import { WaitingTimeCounter } from '@/components/approvals/WaitingTimeCounter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, XCircle, Clock, User, MapPin, Star, Truck, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { DriverApproval } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function ApprovalCard({ approval, onApprove, onReject, onWhitelist, onBlacklist, isProcessing }: {
  approval: DriverApproval;
  onApprove: (approval: DriverApproval, notes?: string) => void;
  onReject: (approval: DriverApproval, notes?: string) => void;
  onWhitelist: (approval: DriverApproval) => void;
  onBlacklist: (approval: DriverApproval, reason?: string) => void;
  isProcessing: boolean;
}) {
  const [notes, setNotes] = useState('');
  const riskLevel = approval.riskScore >= 7 ? 'critical' : approval.riskScore >= 5 ? 'warning' : 'info';
  const riskColors = {
    critical: { bg: 'from-destructive/20 via-destructive/10', border: 'border-destructive/30' },
    warning: { bg: 'from-warning/20 via-warning/10', border: 'border-warning/30' },
    info: { bg: 'from-info/20 via-info/10', border: 'border-info/30' },
  };

  return (
    <Card variant="glass" hover="lift" className={cn("overflow-hidden", riskColors[riskLevel].border)}>
      <div className={cn("h-1 bg-gradient-to-r", riskLevel === 'critical' ? 'from-destructive via-destructive/70 to-destructive/50' : riskLevel === 'warning' ? 'from-warning via-warning/70 to-warning/50' : 'from-info via-info/70 to-info/50')} />
      <div className={cn("p-3 sm:p-4 border-b border-border/30 bg-gradient-to-r", riskColors[riskLevel].bg, "to-transparent")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <motion.div className="relative flex-shrink-0" whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 400 }}>
              {approval.driver.photoUrl ? <img src={approval.driver.photoUrl} alt={approval.driver.name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border-2 border-border/50 shadow-lg" /> : <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary/20 via-accent/20 to-info/20 flex items-center justify-center border border-primary/20"><User className="w-6 h-6 sm:w-7 sm:h-7 text-primary" /></div>}
              <motion.div className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-warning border-2 border-background shadow-lg" animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}><Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-warning-foreground" /></motion.div>
            </motion.div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">{approval.driver.name}</h3>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /><span className="truncate">{approval.driver.vehicleType}</span>
                {approval.driver.vehiclePlate && <><span className="text-border hidden sm:inline">•</span><span className="font-mono bg-secondary/50 px-1.5 py-0.5 rounded text-xs">{approval.driver.vehiclePlate}</span></>}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <RiskScoreGauge score={approval.riskScore} size="sm" className="sm:hidden" />
            <RiskScoreGauge score={approval.riskScore} size="md" className="hidden sm:block" />
          </div>
        </div>
      </div>

      <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { value: approval.driver.totalDeliveries, label: 'Total', fullLabel: 'Total entregas', color: 'info' },
            { value: approval.driver.completedDeliveries, label: 'Feitas', fullLabel: 'Completadas', color: 'success' },
            { value: approval.driver.rating.toFixed(1), label: 'Nota', fullLabel: 'Avaliação', color: 'warning', icon: Star },
            { value: `${approval.driver.totalDeliveries > 0 ? ((approval.driver.completedDeliveries / approval.driver.totalDeliveries) * 100).toFixed(0) : 0}%`, label: 'Taxa', fullLabel: 'Taxa sucesso', color: 'accent' }
          ].map((stat, idx) => (
            <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} className={cn("text-center p-2 sm:p-3 rounded-lg sm:rounded-xl border backdrop-blur-sm", `bg-${stat.color}/10 border-${stat.color}/20`)}>
              <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                {stat.icon && <stat.icon className={`w-3 h-3 sm:w-4 sm:h-4 text-${stat.color} fill-${stat.color}`} />}
                <p className={cn("text-base sm:text-xl font-bold", `text-${stat.color}`)}>{stat.value}</p>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate"><span className="sm:hidden">{stat.label}</span><span className="hidden sm:inline">{stat.fullLabel}</span></p>
            </motion.div>
          ))}
        </div>

        {approval.riskFactors.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-sm font-medium text-foreground flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-destructive" />Fatores de Risco</p>
            <div className="flex flex-wrap gap-2">
              {approval.riskFactors.map((factor, index) => <motion.div key={index} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }}><Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30">{factor}</Badge></motion.div>)}
            </div>
          </motion.div>
        )}

        {approval.order && (
          <Card variant="glass" className="p-3 space-y-2">
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Pedido: <span className="font-mono text-primary">{approval.order.lalamoveId}</span></p>
            <div className="space-y-1 text-sm text-muted-foreground pl-6">
              <p><strong className="text-foreground/70">De:</strong> {approval.order.pickupAddress}</p>
              <p><strong className="text-foreground/70">Para:</strong> {approval.order.deliveryAddress}</p>
            </div>
          </Card>
        )}

        <Textarea placeholder="Notas opcionais sobre a decisão..." value={notes} onChange={(e) => setNotes(e.target.value)} className="resize-none bg-secondary/30 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20" rows={2} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl bg-gradient-to-r from-warning/10 to-transparent border border-warning/20">
          <WaitingTimeCounter requestedAt={approval.requestedAt} />
          <p className="text-xs text-muted-foreground">Solicitado em: {format(approval.requestedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>

        <div className="space-y-2 sm:space-y-3 pt-2">
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" size="sm" className="flex-1 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs sm:text-sm h-9 sm:h-10" onClick={() => onReject(approval, notes)} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" /> : <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />}Rejeitar
            </Button>
            <Button size="sm" className="flex-1 bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 text-success-foreground shadow-lg shadow-success/20 text-xs sm:text-sm h-9 sm:h-10" onClick={() => onApprove(approval, notes)} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />}Aprovar
            </Button>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" size="sm" className="flex-1 text-success border-success/30 hover:bg-success/10 bg-success/5 text-xs sm:text-sm h-8 sm:h-9" onClick={() => onWhitelist(approval)} disabled={isProcessing}><UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /><span className="hidden xs:inline">Whitelist</span><span className="xs:hidden">WL</span></Button>
            <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 bg-destructive/5 text-xs sm:text-sm h-8 sm:h-9" onClick={() => onBlacklist(approval, notes)} disabled={isProcessing}><UserMinus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" /><span className="hidden xs:inline">Blacklist</span><span className="xs:hidden">BL</span></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HistoryCard({ approval }: { approval: DriverApproval }) {
  const isApproved = approval.status === 'APPROVED';
  return (
    <Card variant="glass" hover="lift" className={cn("overflow-hidden", isApproved ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", isApproved ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30")}>
              {isApproved ? <CheckCircle2 className="w-5 h-5 text-success" /> : <XCircle className="w-5 h-5 text-destructive" />}
            </div>
            <div><p className="font-medium text-foreground">{approval.driver.name}</p><p className="text-sm text-muted-foreground font-mono">{approval.order?.lalamoveId || 'Pedido não disponível'}</p></div>
          </div>
          <div className="text-right">
            <Badge variant={isApproved ? 'success' : 'destructive'} className="shadow-sm">{isApproved ? 'Aprovado' : 'Rejeitado'}</Badge>
            <p className="text-xs text-muted-foreground mt-1">{approval.reviewedAt ? format(approval.reviewedAt, "dd/MM HH:mm", { locale: ptBR }) : '--'}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Risk Score: <strong className="text-foreground">{approval.riskScore.toFixed(1)}</strong></span>
          {approval.riskFactors.length > 0 && <Badge variant="secondary" className="text-xs">{approval.riskFactors.length} fator(es)</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
