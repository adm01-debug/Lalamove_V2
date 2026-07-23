import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrackingData } from './hooks/useTrackingData';
import { useGoogleMapsLoader } from './hooks/useGoogleMapsLoader';
import type { VehicleFilter, StatusFilter } from './types';

interface Google3DCanvasProps {
  className?: string;
  initialCenter: [number, number];
  vehicleFilter?: VehicleFilter;
  statusFilter?: StatusFilter;
  onFallback?: () => void;
}

function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function Google3DCanvas({
  className = '',
  initialCenter,
  vehicleFilter = 'ALL',
  statusFilter = 'ALL',
  onFallback,
}: Google3DCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<HTMLElement | null>(null);
  const markersRef = useRef<Map<string, HTMLElement>>(new Map());
  const [webglOk] = useState(isWebGL2Supported);
  const { ready, error, configured } = useGoogleMapsLoader();
  const { trackingData } = useTrackingData({ vehicleFilter, statusFilter });

  useEffect(() => {
    if (!ready || !wrapperRef.current || mapElRef.current || !webglOk) return;
    let cancelled = false;
    (async () => {
      const importLib = (window.google as unknown as { maps: { importLibrary: (n: string) => Promise<unknown> } }).maps
        .importLibrary;
      try {
        await importLib('maps3d');
      } catch {
        return;
      }
      if (cancelled || !wrapperRef.current) return;
      const map3d = document.createElement('gmp-map-3d');
      map3d.setAttribute('center', `${initialCenter[1]},${initialCenter[0]},1500`);
      map3d.setAttribute('tilt', '67.5');
      map3d.setAttribute('range', '2000');
      map3d.setAttribute('mode', 'hybrid');
      map3d.style.width = '100%';
      map3d.style.height = '100%';
      wrapperRef.current.appendChild(map3d);
      mapElRef.current = map3d;
    })();
    return () => {
      cancelled = true;
      if (mapElRef.current?.parentElement) {
        mapElRef.current.parentElement.removeChild(mapElRef.current);
      }
      mapElRef.current = null;
      markersRef.current.clear();
    };
  }, [ready, webglOk, initialCenter]);

  // Sync 3D markers
  useEffect(() => {
    if (!mapElRef.current) return;
    const seen = new Set<string>();
    for (const t of trackingData) {
      seen.add(t.id);
      let el = markersRef.current.get(t.id);
      if (!el) {
        el = document.createElement('gmp-marker-3d');
        el.setAttribute('label', t.driver_name ?? 'Motorista');
        markersRef.current.set(t.id, el);
        mapElRef.current.appendChild(el);
      }
      el.setAttribute('position', `${t.current_latitude},${t.current_longitude},50`);
    }
    for (const [id, el] of markersRef.current) {
      if (!seen.has(id)) {
        el.remove();
        markersRef.current.delete(id);
      }
    }
  }, [trackingData]);

  if (!configured) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-muted/20 gap-2 p-6 text-center ${className}`}>
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-semibold">Google Earth 3D não configurado</p>
        <p className="text-xs text-muted-foreground max-w-md">
          Conecte o Google Maps Platform em Integrações para habilitar este provider.
        </p>
      </div>
    );
  }

  if (!webglOk) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-muted/20 gap-2 p-6 text-center ${className}`}>
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-semibold">Seu navegador não suporta WebGL2</p>
        <p className="text-xs text-muted-foreground">O modo 3D fotorrealístico requer WebGL2.</p>
        {onFallback && (
          <Button size="sm" variant="secondary" onClick={onFallback} className="mt-2">
            Voltar ao mapa 2D
          </Button>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center bg-muted/20 gap-2 p-6 text-center ${className}`}>
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-semibold">Falha ao carregar Google Earth 3D</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
        {onFallback && (
          <Button size="sm" variant="secondary" onClick={onFallback} className="mt-2">
            Voltar ao mapa 2D
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {!ready && (
        <div className="absolute inset-0 z-10 bg-background/80 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
      <div ref={wrapperRef} className="w-full h-full" style={{ minHeight: '600px' }} />
    </div>
  );
}
