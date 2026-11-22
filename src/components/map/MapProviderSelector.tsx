import { Layers, Map as MapIcon, Satellite, Globe, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMapSettings, type MapProvider } from '@/hooks/useMapSettings';
import { useEffectiveMapProvider } from '@/hooks/useMapProviderPolicy';
import { openExternal } from '@/lib/html';

interface ProviderOption {
  id: MapProvider;
  label: string;
  icon: typeof MapIcon;
  hint?: string;
}

const OPTIONS: ProviderOption[] = [
  { id: 'mapbox-dark', label: 'Mapa Escuro (Mapbox)', icon: MapIcon },
  { id: 'mapbox-sat', label: 'Satélite (Mapbox)', icon: Satellite },
  { id: 'google-roadmap', label: 'Google Ruas', icon: MapIcon, hint: 'Google' },
  { id: 'google-hybrid', label: 'Google Satélite', icon: Satellite, hint: 'Google' },
  { id: 'google-3d', label: 'Google Earth 3D', icon: Globe, hint: 'Beta' },
  { id: 'osm', label: 'OpenStreetMap', icon: MapIcon, hint: 'Grátis' },
  { id: 'esri-sat', label: 'Esri Satélite', icon: Satellite, hint: 'Grátis' },
];

interface MapProviderSelectorProps {
  externalCoords?: { lat: number; lng: number } | null;
  className?: string;
}

export function MapProviderSelector({ externalCoords, className = '' }: MapProviderSelectorProps) {
  const setProvider = useMapSettings((s) => s.setPreferredProvider);
  const { provider, allowed } = useEffectiveMapProvider();
  const visibleOptions = OPTIONS.filter((o) => allowed.includes(o.id));
  const current = OPTIONS.find((o) => o.id === provider) ?? OPTIONS[0];
  const CurrentIcon = current.icon;

  const lat = externalCoords?.lat;
  const lng = externalCoords?.lng;

  return (
    <div className={`flex gap-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-3 rounded-full glass-card border-white/10 font-semibold text-xs shadow-xl pointer-events-auto"
          >
            <CurrentIcon className="w-4 h-4 mr-2" />
            {current.label}
            <Layers className="w-3 h-3 ml-2 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Escolher provider</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {visibleOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <DropdownMenuItem
                key={opt.id}
                onClick={() => setProvider(opt.id)}
                className={opt.id === provider ? 'bg-accent' : ''}
              >
                <Icon className="w-4 h-4 mr-2" />
                <span className="flex-1">{opt.label}</span>
                {opt.hint && (
                  <span className="text-[10px] text-muted-foreground ml-2">{opt.hint}</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {lat != null && lng != null && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-3 rounded-full glass-card border-white/10 font-semibold text-xs shadow-xl pointer-events-auto"
              title="Abrir em serviços externos"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Abrir externamente</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                openExternal(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
              }
            >
              <MapIcon className="w-4 h-4 mr-2" />
              Google Maps
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                openExternal(`https://earth.google.com/web/@${lat},${lng},1000a,1500d,35y,0h,60t,0r`)
              }
            >
              <Globe className="w-4 h-4 mr-2" />
              Google Earth Web
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                openExternal(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`)
              }
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Street View
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                openExternal(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`)
              }
            >
              <MapIcon className="w-4 h-4 mr-2" />
              OpenStreetMap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
