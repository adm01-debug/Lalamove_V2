import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Battery, Wifi, Navigation, Shield, Clock, Zap, 
  Map as MapIcon, Cloud, Sun, Thermometer, ExternalLink, 
  Eye, MessageSquare, AlertTriangle 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TrackingData } from './hooks/useTrackingData';

interface MapHUDProps {
  selectedTracking: TrackingData | null;
}

export function MapHUD({ selectedTracking }: MapHUDProps) {
  if (!selectedTracking) return null;

  // Simulated real-time metrics for "Excellence"
  const batteryLevel = Math.floor(Math.random() * 20) + 75;
  const signalStrength = Math.floor(Math.random() * 15) + 85;
  const temperature = 24;
  const riskLevel = selectedTracking.is_on_route ? 'Baixo' : 'Alto';
  const driverName = selectedTracking.driver?.name || 'Motorista';

  const openStreetView = () => {
    const url = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedTracking.current_latitude},${selectedTracking.current_longitude}`;
    window.open(url, '_blank');
  };

  const sendWhatsApp = () => {
    const phone = selectedTracking.driver?.phone || '';
    if (phone) {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        className="absolute top-6 right-20 z-20 pointer-events-auto"
      >
        <Card className="w-85 glass-card border-primary/20 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-pulse" />
          
          <div className="p-4 space-y-4">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Guardian Intelligence</span>
                </div>
                <h3 className="text-lg font-black tracking-tighter uppercase truncate max-w-[140px]">{driverName}</h3>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={selectedTracking.is_on_route ? 'success' : 'destructive'} className="text-[9px] h-4 font-black">
                  {selectedTracking.is_on_route ? 'ON ROUTE' : 'OFF ROUTE'}
                </Badge>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <Sun className="w-3 h-3 text-yellow-500" />
                  <span>{temperature}°C ENSOLARADO</span>
                </div>
              </div>
            </div>

            {/* Quick Actions (Stage 10) */}
            <div className="grid grid-cols-3 gap-2 py-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-9 w-full bg-primary/10 hover:bg-primary/20 border-primary/20" onClick={openStreetView}>
                      <Eye className="w-4 h-4 text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Abrir Street View</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-9 w-full bg-success/10 hover:bg-success/20 border-success/20" onClick={sendWhatsApp}>
                      <MessageSquare className="w-4 h-4 text-success" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Enviar WhatsApp</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-9 w-full bg-destructive/10 hover:bg-destructive/20 border-destructive/20">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Disparar Alerta Crítico</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/50 relative overflow-hidden group">
                <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Zap className="w-12 h-12" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-[10px] font-black tracking-tighter uppercase">Velocidade</span>
                </div>
                <div className="text-2xl font-black italic flex items-baseline gap-1">
                  {selectedTracking.speed || 0} 
                  <span className="text-[10px] font-bold not-italic opacity-40">KM/H</span>
                </div>
              </div>
              
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/50 relative overflow-hidden group">
                <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Clock className="w-12 h-12" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-black tracking-tighter uppercase">Estimativa</span>
                </div>
                <div className="text-2xl font-black italic text-primary flex items-baseline gap-1">
                  {selectedTracking.eta_minutes || '--'} 
                  <span className="text-[10px] font-bold not-italic opacity-40 text-muted-foreground">MIN</span>
                </div>
              </div>
            </div>

            {/* Health Indicators */}
            <div className="space-y-3 bg-black/20 p-3 rounded-lg border border-white/5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Battery className="w-3 h-3" />
                    <span className="uppercase tracking-tighter">Energia do Dispositivo</span>
                  </div>
                  <span className={batteryLevel < 20 ? 'text-destructive' : 'text-success'}>{batteryLevel}%</span>
                </div>
                <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${batteryLevel}%` }}
                    className={`h-full ${batteryLevel < 20 ? 'bg-destructive' : 'bg-success'}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wifi className="w-3 h-3" />
                  <span className="uppercase tracking-tighter">Sinal GPS/LTE (Ping: 42ms)</span>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={`w-1 h-2 rounded-sm ${i <= 4 ? 'bg-success' : 'bg-secondary'}`} />
                  ))}
                </div>
              </div>
              
              {/* Risk Analysis (Stage 4/6) */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className={`w-3 h-3 ${riskLevel === 'Baixo' ? 'text-success' : 'text-destructive'}`} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Nível de Risco Contextual</span>
                  </div>
                  <span className={`text-[10px] font-black ${riskLevel === 'Baixo' ? 'text-success' : 'text-destructive'}`}>
                    {riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <div 
                      key={i} 
                      className={`h-1 flex-1 rounded-full ${
                        i <= (riskLevel === 'Baixo' ? 2 : 8) 
                        ? (riskLevel === 'Baixo' ? 'bg-success' : 'bg-destructive') 
                        : 'bg-secondary'
                      } ${riskLevel !== 'Baixo' && i <= 8 ? 'animate-pulse' : ''}`} 
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Coordinates Footer */}
            <div className="pt-1 flex items-center justify-between">
              <div className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground bg-black/30 px-2 py-1 rounded border border-white/5">
                <Navigation className="w-2 h-2" />
                {selectedTracking.current_latitude.toFixed(6)}, {selectedTracking.current_longitude.toFixed(6)}
              </div>
              <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase hover:bg-white/5" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedTracking.current_latitude},${selectedTracking.current_longitude}`, '_blank')}>
                Maps <ExternalLink className="w-2 h-2 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
