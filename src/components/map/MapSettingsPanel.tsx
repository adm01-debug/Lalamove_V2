import { Settings, X, Ruler, Clock, ShieldCheck, Save, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapSettings } from '@/hooks/useMapSettings';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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
    markerDensity,
    setOffRouteThreshold,
    setStoppedThreshold,
    setGeofenceRadius,
    setMarkerDensity,
    saveContextSettings,
    loadContextSettings,
    resetToDefaults
  } = useMapSettings();
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-load settings when context changes
  useEffect(() => {
    if (show && activeContext) {
      const loadData = async () => {
        setLoading(true);
        try {
          await loadContextSettings(activeContext);
        } catch (error) {
          // Error handled in loadContextSettings (fallbacks to defaults)
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [activeContext, show, loadContextSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveContextSettings(activeContext);
      toast.success("Configurações Persistidas", {
        description: `Limites salvos para o contexto: ${activeContext}`,
      });
    } catch (error) {
      toast.error("Erro ao Salvar", {
        description: "Falha na comunicação com o servidor Guardian.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReload = async () => {
    try {
      setLoading(true);
      await loadContextSettings(activeContext);
      toast.success("Configurações Carregadas", {
        description: "Valores restaurados do servidor.",
      });
    } catch (error) {
      toast.error("Erro ao Carregar", {
        description: "Usando padrões locais por segurança.",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleReset = () => {
    if (window.confirm("Deseja resetar para os valores padrão do Guardian?")) {
      resetToDefaults();
      toast.success("Valores Restaurados", {
        description: "Os limites foram resetados para o padrão de fábrica.",
      });
    }
  };

  const handleResetItem = (item: 'threshold' | 'stop' | 'geofence') => {
    if (window.confirm(`Deseja resetar este item para o padrão?`)) {
      if (item === 'threshold') setOffRouteThreshold(500);
      if (item === 'stop') setStoppedThreshold(15);
      if (item === 'geofence') setGeofenceRadius(300);
      
      toast.success("Valor Restaurado", {
        description: "O limite individual foi resetado.",
      });
    }
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
            <Button variant="ghost" size="icon" aria-label="Fechar ajustes" className="h-6 w-6" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-primary/5 rounded-lg p-2 border border-primary/10 mb-4 flex justify-between items-center">
            <div>
              <div className="text-[8px] font-black uppercase text-primary/60 tracking-tighter">Contexto Ativo</div>
              <div className="text-[10px] font-bold truncate uppercase max-w-[150px]">{activeContext}</div>
            </div>
            {loading && <RefreshCw className="w-3 h-3 animate-spin text-primary" />}
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <Ruler className="w-3 h-3" />
                  Desvio de Rota (m)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-primary font-mono">{offRouteThreshold}M</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 hover:text-destructive" 
                    onClick={() => handleResetItem('threshold')}
                    title="Resetar Desvio"
                    aria-label="Resetar Desvio"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
              <Slider 
                value={[offRouteThreshold]} 
                min={100} 
                max={2000} 
                step={50} 
                onValueChange={(val) => setOffRouteThreshold(val[0])}
              />
              <div className="flex justify-between text-[8px] text-muted-foreground font-mono">
                <span>100M</span>
                <span>2000M</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <Clock className="w-3 h-3" />
                  Tempo de Parada (min)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-primary font-mono">{stoppedThreshold}MIN</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 hover:text-destructive" 
                    onClick={() => handleResetItem('stop')}
                    title="Resetar Parada"
                    aria-label="Resetar Parada"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
              <Slider 
                value={[stoppedThreshold]} 
                min={5} 
                max={60} 
                step={1} 
                onValueChange={(val) => setStoppedThreshold(val[0])}
              />
              <div className="flex justify-between text-[8px] text-muted-foreground font-mono">
                <span>5MIN</span>
                <span>60MIN</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                  <ShieldCheck className="w-3 h-3" />
                  Raio Geofence Entrega (m)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-primary font-mono">{geofenceRadius}M</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 hover:text-destructive" 
                    onClick={() => handleResetItem('geofence')}
                    title="Resetar Geofence"
                    aria-label="Resetar Geofence"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
              <Slider 
                value={[geofenceRadius]} 
                min={50} 
                max={2000} 
                step={50} 
                onValueChange={(val) => setGeofenceRadius(val[0])}
              />
              <div className="flex justify-between text-[8px] text-muted-foreground font-mono">
                <span>50M</span>
                <span>2000M</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                <Settings className="w-3 h-3" />
                Densidade dos Marcadores
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Densidade dos marcadores">
                {([
                  { value: 'comfortable', label: 'Confortável' },
                  { value: 'compact', label: 'Compacto' },
                ] as const).map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={markerDensity === value}
                    variant={markerDensity === value ? 'default' : 'outline'}
                    className="h-7 text-[9px] font-black uppercase tracking-widest"
                    onClick={() => setMarkerDensity(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-[8px] text-muted-foreground leading-tight">
                O modo compacto reduz rótulos e o tamanho dos ícones para melhor leitura com muitos motoristas.
              </p>
            </div>
          </div>

          
          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1 h-8 text-[9px] font-black uppercase tracking-widest gap-2"
              onClick={handleSave}
              disabled={saving || loading}
            >
              <Save className="w-3 h-3" />
              {saving ? 'Salvando...' : 'Salvar no Perfil'}
            </Button>
            <Button 
              variant="outline"
              className="h-8 w-8 p-0 border-primary/20"
              onClick={handleReload}
              disabled={loading}
              title="Recarregar do Servidor"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="outline"
              className="h-8 w-8 p-0 border-destructive/20 text-destructive hover:bg-destructive/10"
              onClick={handleReset}
              title="Resetar Tudo"
            >
              <RotateCcw className="w-3 h-3" />
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


