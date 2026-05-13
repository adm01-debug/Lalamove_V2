import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Route, Zap, Play, Loader2, ArrowRight } from 'lucide-react';
import { useMapboxOptimization } from '@/hooks/useMapbox';
import { CoordinateInput } from './CoordinateInput';

export function OptimizationTab() {
  const mutation = useMapboxOptimization();
  const [coords, setCoords] = useState<[number, number][]>([[-46.6544, -23.5629], [-46.6250, -23.5505], [-46.6880, -23.5630]]);
  const [profile, setProfile] = useState('driving');
  const [roundtrip, setRoundtrip] = useState(false);

  const updateCoord = (i: number, val: [number, number]) => { const next = [...coords]; next[i] = val; setCoords(next); };
  const handleRun = () => {
    if (coords.length < 2) return toast.error('Mínimo 2 coordenadas');
    mutation.mutate({ coordinates: coords, profile, roundtrip }, { onSuccess: () => toast.success('Rota otimizada calculada!'), onError: (e) => toast.error('Erro', { description: e.message }) });
  };
  const result = mutation.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4 text-primary" />Otimização de Rota Multi-Parada</CardTitle>
          <CardDescription>Calcula a melhor sequência para visitar múltiplos pontos (TSP). Suporta 2-12 waypoints.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CoordinateInput coords={coords} onChange={updateCoord} onAdd={() => setCoords([...coords, [-46.65, -23.56]])} onRemove={(i) => setCoords(coords.filter((_, j) => j !== i))} />
          <div className="flex gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Perfil</Label>
              <Select value={profile} onValueChange={setProfile}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="driving">Dirigindo</SelectItem>
                  <SelectItem value="driving-traffic">Com Tráfego</SelectItem>
                  <SelectItem value="cycling">Bicicleta</SelectItem>
                  <SelectItem value="walking">A pé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ida e volta</Label>
              <Select value={roundtrip ? 'true' : 'false'} onValueChange={(v) => setRoundtrip(v === 'true')}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="false">Não</SelectItem><SelectItem value="true">Sim</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleRun} disabled={mutation.isPending} className="gap-2">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Otimizar Rota</Button>
        </CardContent>
      </Card>
      {result && result.trips?.[0] && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Resultado da Otimização</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-2xl font-bold text-foreground">{(result.trips[0].distance / 1000).toFixed(1)} km</p><p className="text-xs text-muted-foreground">Distância Total</p></div>
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-2xl font-bold text-foreground">{Math.round(result.trips[0].duration / 60)} min</p><p className="text-xs text-muted-foreground">Tempo Estimado</p></div>
            </div>
            {result.waypoints && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Sequência otimizada:</p>
                <div className="flex flex-wrap items-center gap-1">
                  {result.waypoints.sort((a, b) => a.waypoint_index - b.waypoint_index).map((wp, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Badge variant="default" className="text-xs">{String.fromCharCode(65 + wp.waypoint_index)}</Badge>
                      <span className="text-xs text-muted-foreground">{wp.name || `(${wp.location[1].toFixed(4)}, ${wp.location[0].toFixed(4)})`}</span>
                      {i < result.waypoints.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
