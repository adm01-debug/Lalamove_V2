import { Settings, X, Ruler, Clock, ShieldCheck, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapSettings } from '@/hooks/useMapSettings';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface MapSettingsPanelProps {
  show: boolean;
  onClose: () => void;
  activeContext?: string; // e.g. "region:sul" or "type:truck"
}

export function MapSettingsPanel({ show, onClose, activeContext = 'default' }: MapSettingsPanelProps) {
  const { 
    offRouteThreshold, 
    stoppedThreshold, 
    geofenceRadius,
    setOffRouteThreshold,
    setStoppedThreshold,
    setGeofenceRadius,
    saveContextSettings,
    loadContextSettings
  } = useMapSettings();
  
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    await saveContextSettings(activeContext);
    setSaving(false);
    toast({
      title: "Configurações Persistidas",
      description: `Limites salvos para o contexto: ${activeContext}`,
    });
  };

  const handleReload = async () => {
    await loadContextSettings(activeContext);
    toast({
      title: "Configurações Carregadas",
      description: "Valores restaurados do servidor.",
    });
  };

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
              <span className="text-xs font-black uppercase tracking-widest">Ajustes de Precisão</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-primary/5 rounded-lg p-2 border border-primary/10 mb-4">
            <div className="text-[8px] font-black uppercase text-primary/60 tracking-tighter">Contexto Ativo</div>
            <div className="text-[10px] font-bold truncate uppercase">{activeContext}</div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <Ruler className="w-3 h-3" />
                  Desvio de Rota (m)
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
                  Tempo de Parada (min)
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
                  Raio Geofence Entrega (m)
                </div>
                <span className="text-[10px] font-black text-primary font-mono">{geofenceRadius}M</span>
              </div>
              <Slider 
                value={[geofenceRadius]} 
                min={50} 
                max={2000} 
                step={50} 
                onValueChange={(val) => setGeofenceRadius(val[0])}
              />
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1 h-8 text-[9px] font-black uppercase tracking-widest gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-3 h-3" />
              {saving ? 'Salvando...' : 'Salvar no Perfil'}
            </Button>
            <Button 
              variant="outline"
              className="h-8 w-8 p-0 border-primary/20"
              onClick={handleReload}
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          <div className="pt-2 border-t border-white/5 text-[8px] font-bold text-muted-foreground text-center uppercase tracking-widest">
            Ajustes de Precisão Guardian 10/10
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

