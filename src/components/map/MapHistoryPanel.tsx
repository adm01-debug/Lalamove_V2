import { History, X, Loader2, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrackingEvent } from '@/hooks/useTrackingHistory';

interface MapHistoryPanelProps {
  show: boolean;
  driverName: string;
  history: TrackingEvent[];
  loading: boolean;
  onClose: () => void;
}

export function MapHistoryPanel({ show, driverName, history, loading, onClose }: MapHistoryPanelProps) {
  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="absolute bottom-6 right-6 z-30 w-80 glass-card bg-background/60 backdrop-blur-xl border-primary/20 shadow-2xl overflow-hidden rounded-xl"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-primary/50" />
        
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <History className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Time Travel</span>
                <span className="text-sm font-black tracking-tight text-foreground truncate max-w-[160px]">
                  {driverName}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Recuperando Histórico</span>
              </div>
            ) : history.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <div className="text-[9px] font-bold text-primary uppercase opacity-70">Pontos</div>
                    <div className="text-lg font-black italic text-primary">{history.length}</div>
                  </div>
                  <div className="bg-secondary/20 p-2 rounded-lg border border-white/5">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase opacity-70">Duração</div>
                    <div className="text-lg font-black italic">~{Math.floor(history.length * 0.5)} <span className="text-[10px] font-normal not-italic">MIN</span></div>
                  </div>
                </div>

                <ScrollArea className="h-64 pr-4">
                  <div className="space-y-3 relative">
                    <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />
                    
                    {history.slice(0, 100).map((event, i) => (
                      <div key={event.id} className="relative pl-8 group">
                        <div className={`absolute left-1.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-background group-hover:scale-150 transition-all z-10 ${
                          event.speed && event.speed > 60 ? 'border-destructive' : 'border-primary'
                        }`} />
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 group-hover:bg-white/10 transition-all group-hover:border-primary/20">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black font-mono text-primary/90 flex items-center gap-1.5">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            {event.speed !== null && (
                              <span className={`text-[9px] font-black font-mono ${event.speed > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {event.speed} KM/H
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-mono bg-black/20 p-1 rounded">
                            <MapPin className="w-2.5 h-2.5 text-primary/60" />
                            <span className="truncate">{event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {history.length > 50 && (
                      <div className="text-[10px] text-center text-muted-foreground font-bold uppercase py-2">
                        + {history.length - 50} eventos adicionais
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <Button variant="outline" className="w-full h-8 text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10 hover:bg-white/10">
                  Exportar Telemetria (CSV)
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                <History className="w-8 h-8 text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Nenhum histórico encontrado para este período</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}