import { useEffect, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useTrackingData } from './hooks/useTrackingData';
import { getGoogleMapsMapId, useGoogleMapsLoader } from './hooks/useGoogleMapsLoader';
import { createDriverMarkerElement } from './markerFactories';
import type { VehicleFilter, StatusFilter } from './types';

interface GoogleMapsCanvasProps {
  className?: string;
  initialCenter: [number, number]; // [lng, lat]
  initialZoom: number;
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid';
  vehicleFilter?: VehicleFilter;
  statusFilter?: StatusFilter;
  onSelect?: (id: string | null) => void;
}

type LatLngLiteral = { lat: number; lng: number };

interface GoogleMapInstance {
  panTo(pos: LatLngLiteral): void;
  setZoom(z: number): void;
  setMapTypeId(id: string): void;
  getDiv?: () => HTMLElement;
}

interface GoogleMarkerInstance {
  setMap(map: unknown): void;
  addListener(event: string, cb: () => void): void;
  getPosition(): LatLngLiteral | null;
}

interface GoogleAdvancedMarkerInstance {
  setMap(map: unknown): void;
  addListener(event: string, cb: () => void): void;
  content: HTMLElement;
  position: LatLngLiteral;
}

/** Nome de motorista vem da API da Lalamove: escapar antes de ir para innerHTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STATUS_COLORS: Record<string, string> = {
  ASSIGNING_DRIVER: '#f59e0b',
  ON_GOING: '#3b82f6',
  PICKED_UP: '#8b5cf6',
  COMPLETED: '#10b981',
  CANCELED: '#ef4444',
  EXPIRED: '#6b7280',
  REJECTED: '#ef4444',
};

function markerIcon(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='44' viewBox='0 0 36 44'><path d='M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z' fill='${color}' stroke='white' stroke-width='2'/><circle cx='18' cy='18' r='6' fill='white'/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function GoogleMapsCanvas({
  className = '',
  initialCenter,
  initialZoom,
  mapTypeId,
  vehicleFilter = 'ALL',
  statusFilter = 'ALL',
  onSelect,
}: GoogleMapsCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<Map<string, GoogleMarkerInstance | GoogleAdvancedMarkerInstance>>(new Map());
  const selectedIdRef = useRef<string | null>(null);
  const infoRef = useRef<{ open: (m: unknown, mk: unknown) => void; setContent: (c: string) => void; close: () => void } | null>(null);

  const { ready, error, configured } = useGoogleMapsLoader();
  const { trackingData } = useTrackingData(vehicleFilter, statusFilter);

  // Initialize map
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const g = (window.google as unknown as { maps: { Map: new (el: HTMLElement, opts: unknown) => GoogleMapInstance; InfoWindow: new () => typeof infoRef.current } }).maps;
    const mapId = getGoogleMapsMapId();
    mapRef.current = new g.Map(containerRef.current, {
      center: { lat: initialCenter[1], lng: initialCenter[0] },
      zoom: initialZoom,
      mapTypeId,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      // Etapa 76: com chave propria o estilo vem do Map ID da nuvem; sem ele
      // (conector gerenciado) o mapTypeId manda, como antes.
      ...(mapId ? { mapId } : {}),
    });
    infoRef.current = new g.InfoWindow();
  }, [ready, initialCenter, initialZoom, mapTypeId]);

  // Update mapTypeId when it changes
  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapTypeId);
  }, [mapTypeId]);

  // Sync markers — etapa 76: `AdvancedMarkerElement` quando ha Map ID
  // (chave propria); o conector gerenciado proibe a API e cai no `Marker` legado.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google as unknown as {
      maps: {
        Marker: new (opts: unknown) => GoogleMarkerInstance;
        Size: new (w: number, h: number) => unknown;
        Point: new (x: number, y: number) => unknown;
        marker?: { AdvancedMarkerElement: new (opts: unknown) => GoogleAdvancedMarkerInstance };
      };
    };
    const hasMapId = Boolean(getGoogleMapsMapId());
    const useAdvanced = hasMapId && Boolean(g.maps.marker?.AdvancedMarkerElement);
    const seen = new Set<string>();

    for (const t of trackingData) {
      seen.add(t.id);
      const existing = markersRef.current.get(t.id);
      const position = { lat: t.current_latitude, lng: t.current_longitude };
      const color = STATUS_COLORS[t.order?.status ?? ''] || '#6b7280';

      if (existing) {
        const upd = existing as unknown as {
          setPosition?: (p: LatLngLiteral) => void;
          position?: LatLngLiteral;
          setIcon?: (i: unknown) => void;
          content?: HTMLElement;
        };
        if (upd.setPosition) upd.setPosition(position);
        else upd.position = position;
        if (useAdvanced) {
          upd.content = createDriverMarkerElement(t, t.id === selectedIdRef.current);
        } else if (upd.setIcon) {
          upd.setIcon({
            url: markerIcon(color),
            scaledSize: new g.maps.Size(36, 44),
            anchor: new g.maps.Point(18, 44),
          });
        }
      } else {
        const onMarkerClick = () => {
          selectedIdRef.current = t.id;
          if (infoRef.current) {
            const html = `<div style="font-family:system-ui;padding:4px;min-width:180px">
              <strong>${escapeHtml(t.driver?.name ?? 'Motorista')}</strong><br/>
              <small style="color:#666">${escapeHtml(t.order?.status ?? '')}</small><br/>
              <button id="lm-sel-${t.id}" style="margin-top:6px;padding:4px 10px;background:${color};color:white;border:0;border-radius:4px;cursor:pointer;font-size:12px">Selecionar</button>
            </div>`;
            infoRef.current.setContent(html);
            infoRef.current.open(mapRef.current, marker as unknown);
            setTimeout(() => {
              const btn = document.getElementById(`lm-sel-${t.id}`);
              if (btn) btn.onclick = () => onSelect?.(t.id);
            }, 60);
          }
        };
        const marker = useAdvanced
          ? new g.maps.marker!.AdvancedMarkerElement({
              position,
              map: mapRef.current,
              title: t.driver?.name ?? 'Motorista',
              content: createDriverMarkerElement(t),
            })
          : new g.maps.Marker({
              position,
              map: mapRef.current,
              icon: {
                url: markerIcon(color),
                scaledSize: new g.maps.Size(36, 44),
                anchor: new g.maps.Point(18, 44),
              },
              title: t.driver?.name ?? 'Motorista',
            });
        marker.addListener('click', onMarkerClick);
        markersRef.current.set(t.id, marker);
      }
    }

    // Remove stale
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        (marker as unknown as { setMap: (m: unknown) => void }).setMap(null);
        markersRef.current.delete(id);
      }
    }
  }, [ready, trackingData, onSelect]);

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) marker.setMap(null);
      markersRef.current.clear();
    };
  }, []);

  if (!configured) {
    return (
      <div className={`relative w-full h-full flex flex-col items-center justify-center bg-muted/20 gap-2 p-6 text-center ${className}`}>
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm font-semibold">Google Maps não configurado</p>
        <p className="text-xs text-muted-foreground max-w-md">
          Conecte o Google Maps Platform em Integrações para habilitar este provider.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative w-full h-full flex flex-col items-center justify-center bg-muted/20 gap-2 p-6 text-center ${className}`}>
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-semibold">Falha ao carregar Google Maps</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
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
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: '600px' }} />
    </div>
  );
}
