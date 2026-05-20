import { Settings, X, Ruler, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapSettings } from '@/hooks/useMapSettings';

interface MapSettingsPanelProps {
  show: boolean;
  onClose: () => void;
}

export function MapSettingsPanel({ show, onClose }: MapSettingsPanelProps) {
  const { 
    offRouteThreshold, 
    stoppedThreshold, 
    geofenceRadius,
    setOffRouteThreshold,
    setStoppedThreshold,
    setGeofenceRadius
  } = useMapSettings();

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="absolute top-6 left-[340px] z-30 w-80 glass-card bg-background/80 backdrop-blur-xl border-primary/20 shadow-2xl rounded-xl overflow-hidden"
      >
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest">Configurações Guardian</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <Ruler className="w-3 h-3" />
                  Desvio de Rota
                </div>
                <span className="text-[10px] font-black text-primary font-mono">{offRouteThreshold}M</span>
              </div>
              <Slider 
                value={[offRouteThreshold]} 
                min={100} 
                max={2000} 
                step={50} 
                onValueChange={(val) => setOffRouteThreshold(val[0])}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <Clock className="w-3 h-3" />
                  Alerta Parado
                </div>
                <span className="text-[10px] font-black text-primary font-mono">{stoppedThreshold}MIN</span>
              </div>
              <Slider 
                value={[stoppedThreshold]} 
                min={5} 
                max={60} 
                step={1} 
                onValueChange={(val) => setStoppedThreshold(val[0])}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <ShieldCheck className="w-3 h-3" />
                  Raio Geofence
                </div>
                <span className="text-[10px] font-black text-primary font-mono">{geofenceRadius}M</span>
              </div>
              <Slider 
                value={[geofenceRadius]} 
                min={50} 
                max={1000} 
                step={50} 
                onValueChange={(val) => setGeofenceRadius(val[0])}
              />
            </div>
          </div>
          
          <div className="pt-2 border-t border-white/5 text-[8px] font-bold text-muted-foreground text-center uppercase tracking-widest">
            Alterações aplicadas em tempo real
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
