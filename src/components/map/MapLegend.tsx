import { vehicleIcons, vehicleColors } from './types';

interface MapLegendProps {
  vehicleCounts: Record<string, number>;
}

export function MapLegend({ vehicleCounts }: MapLegendProps) {
  return (
    <>
      {/* Vehicle type legend */}
      <div className="absolute bottom-4 left-4 glass-card px-4 py-3 rounded-lg">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Veículos em trânsito</div>
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(vehicleCounts).map(([type, count]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: vehicleColors[type] || '#00d9ff' }} />
              <span className="text-xs text-foreground">{vehicleIcons[type]} {count}</span>
            </div>
          ))}
          {Object.keys(vehicleCounts).length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhum veículo</span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📦</span>
            <span className="text-xs text-muted-foreground">Coleta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📍</span>
            <span className="text-xs text-muted-foreground">Entrega</span>
          </div>
        </div>
      </div>

      {/* Status legend */}
      <div className="absolute top-4 right-16 glass-card px-3 py-2 rounded-lg">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Trânsito</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-muted-foreground">Parado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Fora da rota</span>
          </div>
        </div>
      </div>
    </>
  );
}
