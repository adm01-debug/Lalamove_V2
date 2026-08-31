import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Play, Loader2, Copy } from 'lucide-react';
import { useMapboxIsochrone, type IsochroneFeature } from '@/hooks/useMapbox';

export function IsochroneTab() {
  const mutation = useMapboxIsochrone();
  const [lng, setLng] = useState(-46.6544);
  const [lat, setLat] = useState(-23.5629);
  const [minutes, setMinutes] = useState('10,20,30');
  const [profile, setProfile] = useState('driving');
  const handleRun = () => { mutation.mutate({ lng, lat, contours_minutes: minutes, profile }, { onSuccess: () => toast.success('Isócronas calculadas!'), onError: (e) => toast.error('Erro', { description: e.message }) }); };
  const result = mutation.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Isócronas (Zonas de Alcance)</CardTitle><CardDescription>Gera polígonos que representam áreas alcançáveis em X minutos a partir de um ponto.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value) || 0)} className="w-32 font-mono text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value) || 0)} className="w-32 font-mono text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Minutos (vírgula)</Label><Input value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-28 text-xs" placeholder="10,20,30" /></div>
            <div className="space-y-1"><Label className="text-xs">Perfil</Label><Select value={profile} onValueChange={setProfile}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="driving">Dirigindo</SelectItem><SelectItem value="walking">A pé</SelectItem><SelectItem value="cycling">Bicicleta</SelectItem></SelectContent></Select></div>
          </div>
          <Button onClick={handleRun} disabled={mutation.isPending} className="gap-2">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Gerar Isócronas</Button>
        </CardContent>
      </Card>
      {result?.features && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Resultado — {result.features.length} Zona(s)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {result.features.map((f: IsochroneFeature, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{f.properties?.contour}′</div>
                <div className="text-sm"><p className="font-medium text-foreground">Zona de {f.properties?.contour} minutos</p><p className="text-xs text-muted-foreground">{f.geometry?.coordinates?.[0]?.length || 0} pontos no polígono</p></div>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { navigator.clipboard.writeText(JSON.stringify(f.geometry)); toast.success('GeoJSON copiado!'); }}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
