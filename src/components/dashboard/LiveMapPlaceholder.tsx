import { useState } from 'react';
import { Map } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiveMap } from '@/components/map/LiveMap';
import { useNavigate } from 'react-router-dom';

interface LiveMapPlaceholderProps {
  activeDeliveries: number;
  className?: string;
}

export function LiveMapPlaceholder({ activeDeliveries, className }: LiveMapPlaceholderProps) {
  const navigate = useNavigate();
  
  return (
    <div className={cn(
      "glass-card rounded-xl overflow-hidden relative",
      className
    )}>
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="p-2 rounded-lg bg-primary/20 glow-primary">
              <Map className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Mapa ao Vivo</h3>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            className="pointer-events-auto"
            onClick={() => navigate('/live-map')}
          >
            Ver em tela cheia
          </Button>
        </div>
      </div>

      {/* Live Map */}
      <LiveMap 
        className="h-[300px]" 
        showControls={false}
        initialZoom={11}
      />
    </div>
  );
}
