import { vehicleIcons, vehicleColors } from './types';
import { motion } from 'framer-motion';
import { STATUS_PALETTE, STATUS_GLYPH } from '@/lib/statusPalette';

interface MapLegendProps {
  vehicleCounts: Record<string, number>;
}

export function MapLegend({ vehicleCounts }: MapLegendProps) {
  return (
    <>
      {/* Status Indicators Legend (Top Right) */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-6 left-1/2 -translate-x-1/2 z-10 glass-card px-4 py-2 rounded-full border-primary/20 bg-background/40 backdrop-blur-xl shadow-xl flex items-center gap-6"
      >
        {(['operational', 'attention', 'critical'] as const).map((level) => {
          const status = STATUS_PALETTE[level];
          return (
            <div key={level} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex items-center justify-center w-3.5 h-3.5 text-[9px] leading-none font-black ${status.text} ${level !== 'operational' ? 'animate-pulse' : ''}`}
              >
                {STATUS_GLYPH[level]}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">
                {status.label}
              </span>
            </div>
          );
        })}
      </motion.div>

      {/* Fleet Stats Legend (Bottom Left) */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute bottom-28 left-6 z-10 glass-card p-4 rounded-xl border-primary/20 bg-background/40 backdrop-blur-xl shadow-2xl min-w-[160px]"
      >
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Frota Ativa</div>
        <div className="space-y-3">
          {Object.entries(vehicleCounts).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg border border-white/5 group-hover:scale-110 transition-transform" 
                  style={{ background: `${vehicleColors[type] || '#00d9ff'}15` }}
                >
                  {vehicleIcons[type]}
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                  {type === 'MOTORCYCLE' ? 'Motos' : type === 'CAR' ? 'Carros' : type === 'VAN' ? 'Vans' : type === 'TRUCK' ? 'Caminhões' : type}
                </span>
              </div>
              <span className="text-sm font-black italic text-primary">{count}</span>
            </div>
          ))}
          {Object.keys(vehicleCounts).length === 0 && (
            <span className="text-[10px] font-bold text-muted-foreground uppercase italic opacity-50">Nenhum veículo em operação</span>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-success/20 rounded flex items-center justify-center text-[10px]">📦</div>
              <span>COLETAS</span>
            </div>
            <span className="text-success">OK</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-destructive/20 rounded flex items-center justify-center text-[10px]">📍</div>
              <span>ENTREGAS</span>
            </div>
            <span className="text-destructive">LIVE</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}