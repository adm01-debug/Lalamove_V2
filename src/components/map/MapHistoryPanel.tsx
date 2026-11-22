import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History, X, Loader2, MapPin, Clock, Play, Pause, ChevronLeft, ChevronRight, FastForward, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  onPlaybackUpdate?: (lat: number, lng: number, heading: number) => void;
}

export function MapHistoryPanel({ show, driverName, history, loading, onClose, onPlaybackUpdate }: MapHistoryPanelProps) {
  const { t } = useTranslation();
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(800);

  // Auto-playback logic (Requested Feature)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playbackActive && history.length > 0) {
      interval = setInterval(() => {
        setPlaybackIndex(prev => {
          const next = (prev + 1) % history.length;
          const event = history[next];
          if (event && onPlaybackUpdate) {
            onPlaybackUpdate(event.latitude, event.longitude, event.heading || 0);
          }
          if (next === history.length - 1) setPlaybackActive(false);
          return next;
        });
      }, playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [playbackActive, history, onPlaybackUpdate]);

  const exportToCSV = () => {
    if (!history || history.length === 0) return;
    
    const headers = ['ID', 'Data/Hora', 'Latitude', 'Longitude', 'Velocidade', 'Heading', 'Evento'];
    const csvContent = [
      headers.join(','),
      ...history.map(e => [
        e.id,
        e.created_at ? new Date(e.created_at).toISOString() : 'N/A',
        e.latitude || 0,
        e.longitude || 0,
        e.speed || 0,
        e.heading || 0,
        e.event_type || 'TRACK'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `trajetoria_${driverName.replace(/\s+/g, '_')}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (!history || history.length === 0) return;

    const doc = new jsPDF();
    const tableColumn = ["Data/Hora", "Lat", "Lng", "Vel (km/h)", "Tipo"];
    const tableRows = history.map(e => [
      e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : 'N/A',
      typeof e.latitude === 'number' ? e.latitude.toFixed(6) : '0',
      typeof e.longitude === 'number' ? e.longitude.toFixed(6) : '0',
      e.speed ?? 0,
      e.event_type || 'TRACK'
    ]);

    // Estatísticas: considera apenas leituras de velocidade válidas (não-nulas),
    // evitando que registros sem GPS puxem a média para baixo.
    const validSpeeds = history
      .map(e => e.speed)
      .filter((s): s is number => typeof s === 'number');
    const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 0;
    const avgSpeed = validSpeeds.length > 0
      ? validSpeeds.reduce((acc, s) => acc + s, 0) / validSpeeds.length
      : 0;
    
    const startTime = history[0]?.created_at ? new Date(history[0].created_at) : null;
    const endTime = history[history.length - 1]?.created_at ? new Date(history[history.length - 1].created_at) : null;
    const durationMin = (startTime && endTime) ? Math.floor((endTime.getTime() - startTime.getTime()) / 60000) : 0;

    doc.setFontSize(18);
    doc.text(`Relatório de Trajetória - ${driverName}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Período: ${startTime ? startTime.toLocaleTimeString() : 'N/A'} - ${endTime ? endTime.toLocaleTimeString() : 'N/A'} (${durationMin} min)`, 14, 35);
    doc.text(`Velocidade Máxima: ${maxSpeed} km/h | Média: ${avgSpeed.toFixed(1)} km/h`, 14, 40);
    doc.text(`Total de eventos: ${history.length}`, 14, 45);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }
    });

    doc.save(`trajetoria_${driverName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="absolute bottom-6 right-6 z-30 w-85 glass-card bg-background/60 backdrop-blur-xl border-primary/20 shadow-2xl overflow-hidden rounded-xl"
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
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={onClose} aria-label={t('map.actions.closeHistory')}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Playback Controls (Requested Feature) */}
            {!loading && history.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Simulação de Trajetória</span>
                  <div className="flex items-center gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        const next = Math.max(0, playbackIndex - 1);
                        setPlaybackIndex(next);
                        const event = history[next];
                        if (event && onPlaybackUpdate) onPlaybackUpdate(event.latitude, event.longitude, event.heading || 0);
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-7 px-3 text-[9px] font-black uppercase bg-primary/20 hover:bg-primary/30"
                      onClick={() => setPlaybackActive(!playbackActive)}
                    >
                      {playbackActive ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                      {playbackActive ? 'Pausar' : 'Play'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        const next = Math.min(history.length - 1, playbackIndex + 1);
                        setPlaybackIndex(next);
                        const event = history[next];
                        if (event && onPlaybackUpdate) onPlaybackUpdate(event.latitude, event.longitude, event.heading || 0);
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between px-1">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Velocidade:</span>
                  <div className="flex gap-1">
                    {[2000, 800, 200, 100].map((speed, i) => (
                      <button 
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`text-[8px] px-1.5 py-0.5 rounded border ${playbackSpeed === speed ? 'bg-primary border-primary text-white' : 'border-white/10 text-muted-foreground'}`}
                      >
                        {i === 0 ? '0.5x' : i === 1 ? '1x' : i === 2 ? '4x' : '8x'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <input 
                    type="range" 
                    min="0" 
                    max={Math.max(0, history.length - 1)} 
                    value={playbackIndex} 
                    disabled={history.length <= 1}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      setPlaybackIndex(idx);
                      const event = history[idx];
                      if (event && onPlaybackUpdate) {
                        onPlaybackUpdate(event.latitude, event.longitude, event.heading || 0);
                      }
                    }}
                    className="w-full h-1.5 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary/80 transition-all"
                  />
                  <div className="flex justify-between text-[9px] font-black font-mono text-muted-foreground bg-black/20 px-2 py-0.5 rounded">
                    <span>{history[0]?.created_at ? new Date(history[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                    <span className="text-primary italic">EVENTO {playbackIndex + 1}/{history.length}</span>
                    <span>{history[history.length-1]?.created_at ? new Date(history[history.length-1].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                  </div>
                </div>
              </div>
            )}

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
                          (event.speed !== undefined && event.speed !== null && event.speed > 60) ? 'border-destructive' : 'border-primary'
                        }`} />
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/5 group-hover:bg-white/10 transition-all group-hover:border-primary/20">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black font-mono text-primary/90 flex items-center gap-1.5">
                              <Clock className="w-2.5 h-2.5" />
                               {event.created_at ? new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                            </span>
                            {(event.speed !== undefined && event.speed !== null) && (
                              <span className={`text-[9px] font-black font-mono ${event.speed > 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {event.speed} KM/H
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-mono bg-black/20 p-1 rounded">
                            <MapPin className="w-2.5 h-2.5 text-primary/60" />
                            <span className="truncate">{typeof event.latitude === 'number' ? event.latitude.toFixed(6) : '0.000000'}, {typeof event.longitude === 'number' ? event.longitude.toFixed(6) : '0.000000'}</span>
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
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="h-8 text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10 hover:bg-white/10"
                    onClick={exportToCSV}
                  >
                    <Download className="w-3 h-3 mr-1.5" />
                    CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-8 text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10 hover:bg-white/10"
                    onClick={exportToPDF}
                  >
                    <FileText className="w-3 h-3 mr-1.5" />
                    PDF
                  </Button>
                </div>
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