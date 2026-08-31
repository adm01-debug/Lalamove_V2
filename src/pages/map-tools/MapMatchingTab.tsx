import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Navigation, Play, Loader2, Copy } from 'lucide-react';
import { useMapboxMapMatching } from '@/hooks/useMapbox';
import { CoordinateInput } from './CoordinateInput';

export function MapMatchingTab() {
  const mutation = useMapboxMapMatching();
  const [coords, setCoords] = useState<[number, number][]>([[-46.6544, -23.5629], [-46.6530, -23.5610], [-46.6510, -23.5595], [-46.6490, -23.5580]]);
  const [profile, setProfile] = useState('driving');
  const updateCoord = (i: number, val: [number, number]) => { const next = [...coords]; next[i] = val; setCoords(next); };
  const handleRun = () => {
    if (coords.length < 2) return toast.error('Mínimo 2 coordenadas');
    mutation.mutate({ coordinates: coords, profile, tidy: true }, { onSuccess: () => toast.success('GPS traces corrigidos!'), onError: (e) => toast.error('Erro', { description: e.message }) });
  };
  const result = mutation.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Navigation className="w-4 h-4 text-primary" />Map Matching (Correção GPS)</CardTitle><CardDescription>Corrige coordenadas GPS brutas encaixando-as nas vias reais mais próximas.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <CoordinateInput coords={coords} onChange={updateCoord} onAdd={() => setCoords([...coords, [-46.65, -23.56]])} onRemove={(i) => setCoords(coords.filter((_, j) => j !== i))} max={100} labels={coords.map((_, i) => String(i + 1))} />
          <div className="flex gap-3 items-end">
            <div className="space-y-1"><Label className="text-xs">Perfil</Label><Select value={profile} onValueChange={setProfile}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="driving">Dirigindo</SelectItem><SelectItem value="walking">A pé</SelectItem><SelectItem value="cycling">Bicicleta</SelectItem></SelectContent></Select></div>
            <Button onClick={handleRun} disabled={mutation.isPending} className="gap-2">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Corrigir Traces</Button>
          </div>
        </CardContent>
      </Card>
      {result?.matchings?.[0] && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Resultado — Map Matching</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-xl font-bold text-foreground">{(result.matchings[0].confidence * 100).toFixed(0)}%</p><p className="text-xs text-muted-foreground">Confiança</p></div>
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-xl font-bold text-foreground">{(result.matchings[0].distance / 1000).toFixed(2)} km</p><p className="text-xs text-muted-foreground">Distância Corrigida</p></div>
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-xl font-bold text-foreground">{Math.round(result.matchings[0].duration / 60)} min</p><p className="text-xs text-muted-foreground">Duração</p></div>
            </div>
            <div className="text-xs text-muted-foreground">{result.matchings[0].geometry?.coordinates?.length || 0} pontos corrigidos na geometria</div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result.matchings[0].geometry)); toast.success('GeoJSON copiado!'); }}><Copy className="w-3.5 h-3.5" /> Copiar GeoJSON</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
