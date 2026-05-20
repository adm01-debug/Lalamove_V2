import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Battery, Wifi, Navigation, Shield, Clock, Zap, Map as MapIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TrackingData } from './hooks/useTrackingData';

interface MapHUDProps {
  selectedTracking: TrackingData | null;
}

export function MapHUD({ selectedTracking }: MapHUDProps) {
  if (!selectedTracking) return null;

  const batteryLevel = Math.floor(Math.random() * 30) + 70; // Simulated
  const signalStrength = Math.floor(Math.random() * 20) + 80; // Simulated
  const riskLevel = selectedTracking.is_on_route ? 'Baixo' : 'Alto';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.95 }}
        className="absolute top-6 right-20 z-20 pointer-events-auto"
      >
        <Card className="w-80 glass-card border-primary/20 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-pulse" />
          
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Telemetry</span>
              </div>
              <Badge variant={selectedTracking.is_on_route ? 'success' : 'destructive'} className="text-[10px] h-5">
                {selectedTracking.is_on_route ? 'EM ROTA' : 'DESVIO DETECTADO'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-[10px] font-medium">VELOCIDADE</span>
                </div>
                <div className="text-xl font-black italic">
                  {selectedTracking.speed || 0} <span className="text-[10px] font-normal not-italic opacity-60">KM/H</span>
                </div>
              </div>
              
              <div className="bg-secondary/30 p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-medium">PREVISÃO ETA</span>
                </div>
                <div className="text-xl font-black italic text-primary">
                  {selectedTracking.eta_minutes || '--'} <span className="text-[10px] font-normal not-italic opacity-60 text-muted-foreground">MIN</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Battery className="w-3 h-3" />
                  <span>Bateria do Dispositivo</span>
                </div>
                <span className="font-bold text-success">{batteryLevel}%</span>
              </div>
              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${batteryLevel}%` }}
                  className="h-full bg-success"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wifi className="w-3 h-3" />
                  <span>Sinal de Rede (GPS/LTE)</span>
                </div>
                <span className="font-bold">{signalStrength}%</span>
              </div>
              
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Análise de Risco</span>
                  <span className={`text-[10px] font-bold ${riskLevel === 'Baixo' ? 'text-success' : 'text-destructive'}`}>
                    NÍVEL {riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i} 
                      className={`h-1 flex-1 rounded-full ${
                        i <= (riskLevel === 'Baixo' ? 1 : 4) 
                        ? (riskLevel === 'Baixo' ? 'bg-success' : 'bg-destructive') 
                        : 'bg-secondary'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-muted-foreground">COORDENADAS ATUAIS</span>
              </div>
              <div className="bg-black/20 p-2 rounded font-mono text-[10px] text-center border border-border/20">
                {selectedTracking.current_latitude.toFixed(6)}, {selectedTracking.current_longitude.toFixed(6)}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
