import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Play, Loader2, Copy } from 'lucide-react';
import { useMapboxTilequery, type TilequeryFeature } from '@/hooks/useMapbox';

export function TilequeryTab() {
  const mutation = useMapboxTilequery();
  const [lng, setLng] = useState(-46.6544);
  const [lat, setLat] = useState(-23.5629);
  const [radius, setRadius] = useState(100);
  const [limit, setLimit] = useState(10);
  const [tileset, setTileset] = useState('mapbox.mapbox-streets-v8');

  const handleRun = () => { mutation.mutate({ lng, lat, tileset, radius, limit }, { onSuccess: () => toast.success('Consulta realizada!'), onError: (e) => toast.error('Erro', { description: e.message }) }); };
  const result = mutation.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />Tilequery (Features próximas)</CardTitle><CardDescription>Consulta features geográficas (ruas, POIs, edifícios) próximas a um ponto.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value) || 0)} className="font-mono text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value) || 0)} className="font-mono text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Raio (metros)</Label><Input type="number" value={radius} onChange={(e) => setRadius(parseInt(e.target.value) || 100)} className="text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Limite</Label><Input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 5)} className="text-xs" /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Tileset</Label><Select value={tileset} onValueChange={setTileset}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mapbox.mapbox-streets-v8">Streets v8</SelectItem><SelectItem value="mapbox.mapbox-terrain-v2">Terrain v2</SelectItem></SelectContent></Select></div>
          </div>
          <Button onClick={handleRun} disabled={mutation.isPending} className="gap-2">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Consultar Features</Button>
        </CardContent>
      </Card>
      {result?.features && result.features.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Resultado — {result.features.length} Feature(s)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {result.features.map((f: TilequeryFeature, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <Badge variant="outline" className="shrink-0 mt-0.5">{i + 1}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.properties?.tilequery?.layer || f.properties?.class || 'Feature'}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {f.properties?.tilequery?.distance != null && <Badge variant="secondary" className="text-[10px]">{Math.round(f.properties.tilequery.distance)}m</Badge>}
                    {f.properties?.type && <Badge variant="outline" className="text-[10px]">{f.properties.type}</Badge>}
                    {f.properties?.name && <span className="text-xs text-muted-foreground">{f.properties.name}</span>}
                  </div>
                  {f.geometry?.coordinates && !Array.isArray(f.geometry.coordinates[0]) && (
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">[{(f.geometry.coordinates as [number, number])[0]?.toFixed(5)}, {(f.geometry.coordinates as [number, number])[1]?.toFixed(5)}]</p>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1 mt-2" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast.success('GeoJSON copiado!'); }}><Copy className="w-3.5 h-3.5" /> Copiar JSON</Button>
          </CardContent>
        </Card>
      )}
      {result?.features && result.features.length === 0 && (
        <Card className="border-border/30"><CardContent className="p-6 text-center text-muted-foreground text-sm">Nenhuma feature encontrada nesse raio.</CardContent></Card>
      )}
    </div>
  );
}
