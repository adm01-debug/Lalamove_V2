import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, Package, MapPin, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { statsVariants } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

interface HeatmapStats {
  totalDeliveries: number;
  completedDeliveries: number;
  topRegions: Array<{ address: string; count: number }>;
}

export function HeatmapStatsPanel({ stats, showStats, setShowStats }: { stats: HeatmapStats; showStats: boolean; setShowStats: (v: boolean) => void }) {
  return (
    <>
      <AnimatePresence>
        {showStats && (
          <motion.div className="absolute bottom-4 left-4 z-20 w-80" variants={statsVariants} initial="hidden" animate="visible" exit="exit">
            <motion.div className="p-4 rounded-xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-xl" whileHover={{ scale: 1.01 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <motion.div className="p-1.5 rounded-lg bg-primary/10" animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}><TrendingUp className="w-4 h-4 text-primary" /></motion.div>
                  <span className="text-sm font-semibold">Estatísticas</span>
                </div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowStats(false)}><ChevronDown className="w-4 h-4" /></Button></motion.div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <motion.div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border border-cyan-500/20" whileHover={{ scale: 1.03 }}>
                  <div className="flex items-center gap-2 mb-1"><Package className="w-3.5 h-3.5 text-cyan-500" /><span className="text-xs text-muted-foreground">Total Entregas</span></div>
                  <motion.p className="text-xl font-bold text-foreground" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>{stats.totalDeliveries}</motion.p>
                </motion.div>
                <motion.div className="p-3 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20" whileHover={{ scale: 1.03 }}>
                  <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-3.5 h-3.5 text-success" /><span className="text-xs text-muted-foreground">Concluídas</span></div>
                  <motion.p className="text-xl font-bold text-success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>{stats.completedDeliveries}</motion.p>
                </motion.div>
              </div>
              {stats.topRegions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2"><MapPin className="w-3 h-3" />Top Regiões</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                    {stats.topRegions.slice(0, 5).map((region, idx) => (
                      <motion.div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} whileHover={{ x: 4 }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold", idx === 0 && "bg-gradient-to-br from-amber-400 to-orange-500 text-white", idx === 1 && "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800", idx === 2 && "bg-gradient-to-br from-amber-600 to-amber-700 text-white", idx > 2 && "bg-muted text-muted-foreground")}>{idx + 1}</span>
                          <span className="text-xs truncate max-w-[160px]" title={region.address}>{region.address}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0 bg-primary/10 text-primary border-0">{region.count}</Badge>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!showStats && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <Button variant="outline" size="sm" onClick={() => setShowStats(true)} className="absolute bottom-4 left-4 z-20 bg-background/80 backdrop-blur-xl border-border/50"><TrendingUp className="w-4 h-4 mr-2" />Ver Estatísticas</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
