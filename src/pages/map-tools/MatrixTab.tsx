import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Target, Play, Loader2 } from 'lucide-react';
import { useMapboxMatrix } from '@/hooks/useMapbox';
import { CoordinateInput } from './CoordinateInput';

export function MatrixTab() {
  const mutation = useMapboxMatrix();
  const [coords, setCoords] = useState<[number, number][]>([[-46.6544, -23.5629], [-46.6250, -23.5505], [-46.6880, -23.5630]]);
  const [profile, setProfile] = useState('driving');
  const updateCoord = (i: number, val: [number, number]) => { const next = [...coords]; next[i] = val; setCoords(next); };
  const handleRun = () => { mutation.mutate({ coordinates: coords, profile }, { onSuccess: () => toast.success('Matriz calculada!'), onError: (e) => toast.error('Erro', { description: e.message }) }); };
  const result = mutation.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Matriz de Distância / Duração</CardTitle><CardDescription>Calcula distâncias e tempos entre todos os pares de pontos.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <CoordinateInput coords={coords} onChange={updateCoord} onAdd={() => setCoords([...coords, [-46.65, -23.56]])} onRemove={(i) => setCoords(coords.filter((_, j) => j !== i))} max={25} />
          <div className="flex gap-3 items-end">
            <div className="space-y-1"><Label className="text-xs">Perfil</Label><Select value={profile} onValueChange={setProfile}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="driving">Dirigindo</SelectItem><SelectItem value="walking">A pé</SelectItem><SelectItem value="cycling">Bicicleta</SelectItem></SelectContent></Select></div>
            <Button onClick={handleRun} disabled={mutation.isPending} className="gap-2">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Calcular Matriz</Button>
          </div>
        </CardContent>
      </Card>
      {result && result.durations && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Resultado — Matriz NxN</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr><th className="p-2 text-left text-muted-foreground">De \ Para</th>{result.destinations?.map((_, j) => <th key={j} className="p-2 text-center"><Badge variant="outline">{String.fromCharCode(65 + j)}</Badge></th>)}</tr></thead>
                <tbody>{result.durations.map((row, i) => <tr key={i} className="border-t border-border/30"><td className="p-2"><Badge variant="outline">{String.fromCharCode(65 + i)}</Badge></td>{row.map((dur, j) => <td key={j} className="p-2 text-center"><div className="font-medium text-foreground">{dur != null ? `${Math.round(dur / 60)}min` : '—'}</div><div className="text-muted-foreground">{result.distances?.[i]?.[j] != null ? `${(result.distances[i][j] / 1000).toFixed(1)}km` : ''}</div></td>)}</tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
