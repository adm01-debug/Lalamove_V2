import { AnimatePresence, motion } from 'framer-motion';
import { Layers, Calendar, Flame, MapPin, RefreshCw, Maximize2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { panelVariants } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

type HeatmapType = 'pickup' | 'delivery' | 'both';

interface HeatmapControlsProps {
  days: number;
  setDays: (v: number) => void;
  heatmapType: HeatmapType;
  setHeatmapType: (v: HeatmapType) => void;
}

export function HeatmapFiltersPanel({ days, setDays, heatmapType, setHeatmapType }: HeatmapControlsProps) {
  return (
    <motion.div className="p-4 rounded-xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-xl" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
      <div className="flex items-center gap-2 mb-3">
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}><Layers className="w-4 h-4 text-primary" /></motion.div>
        <span className="text-sm font-semibold">Filtros</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Período</label>
          <Select value={days.toString()} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 hover:bg-muted transition-colors"><Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Visualização</label>
          <Select value={heatmapType} onValueChange={(v) => setHeatmapType(v as HeatmapType)}>
            <SelectTrigger className="w-full h-9 bg-muted/50 border-border/50 hover:bg-muted transition-colors"><Flame className="w-3.5 h-3.5 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Coletas + Entregas</SelectItem>
              <SelectItem value="pickup">Apenas Coletas</SelectItem>
              <SelectItem value="delivery">Apenas Entregas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </motion.div>
  );
}

export function HeatmapLegendPanel({ heatmapType }: { heatmapType: HeatmapType }) {
  return (
    <motion.div className="p-4 rounded-xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-xl" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
      <div className="flex items-center gap-2 mb-3"><MapPin className="w-4 h-4 text-primary" /><span className="text-sm font-semibold">Legenda</span></div>
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {(heatmapType === 'pickup' || heatmapType === 'both') && <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}><div className="w-8 h-3 rounded-full bg-gradient-to-r from-cyan-500/30 via-teal-500 to-emerald-600" /><span className="text-xs font-medium">Coletas</span></motion.div>}
          {(heatmapType === 'delivery' || heatmapType === 'both') && <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}><div className="w-8 h-3 rounded-full bg-gradient-to-r from-pink-500/30 via-purple-500 to-violet-600" /><span className="text-xs font-medium">Entregas</span></motion.div>}
        </AnimatePresence>
      </div>
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Baixa</span>
          <motion.div className="flex-1 mx-2 h-1.5 rounded-full bg-gradient-to-r from-transparent via-primary/50 to-primary" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.8 }} />
          <span>Alta</span>
        </div>
      </div>
    </motion.div>
  );
}

export function HeatmapActionButtons({ onRefresh, onResetView, onToggleFullscreen, isRefreshing }: { onRefresh: () => void; onResetView: () => void; onToggleFullscreen: () => void; isRefreshing: boolean }) {
  return (
    <motion.div className="absolute top-4 right-16 z-20 flex gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: 'spring' }}>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={isRefreshing} className="h-9 w-9 bg-background/80 backdrop-blur-xl border-border/50 hover:bg-muted"><RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} /></Button>
      </motion.div>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <Button variant="outline" size="icon" onClick={onResetView} className="h-9 w-9 bg-background/80 backdrop-blur-xl border-border/50 hover:bg-muted"><Navigation className="w-4 h-4" /></Button>
      </motion.div>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <Button variant="outline" size="icon" onClick={onToggleFullscreen} className="h-9 w-9 bg-background/80 backdrop-blur-xl border-border/50 hover:bg-muted"><Maximize2 className="w-4 h-4" /></Button>
      </motion.div>
    </motion.div>
  );
}
