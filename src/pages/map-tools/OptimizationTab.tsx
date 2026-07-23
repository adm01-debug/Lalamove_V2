import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Route, Zap, Play, Loader2, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useMapboxOptimization, useMapboxDirections } from '@/hooks/useMapbox';
import { CoordinateInput } from './CoordinateInput';

interface SavingsSnapshot {
  originalDistance: number;
  originalDuration: number;
  optimizedDistance: number;
  optimizedDuration: number;
  distanceSavedPct: number;
  durationSavedPct: number;
  isRouteOptimized: boolean;
}

const OPTIMIZATION_THRESHOLD_PCT = 5;

export function OptimizationTab() {
  const optimization = useMapboxOptimization();
  const directions = useMapboxDirections();
  const [coords, setCoords] = useState<[number, number][]>([[-46.6544, -23.5629], [-46.6250, -23.5505], [-46.6880, -23.5630]]);
  const [profile, setProfile] = useState('driving');
  const [roundtrip, setRoundtrip] = useState(false);
  const [savings, setSavings] = useState<SavingsSnapshot | null>(null);

  const updateCoord = (i: number, val: [number, number]) => { const next = [...coords]; next[i] = val; setCoords(next); };

  const handleRun = async () => {
    if (coords.length < 2) return toast.error('Mínimo 2 coordenadas');
    setSavings(null);
    try {
      const baselineCoords = roundtrip ? [...coords, coords[0]] : coords;
      const [baseline, optimized] = await Promise.all([
        directions.mutateAsync({ coordinates: baselineCoords, profile }),
        optimization.mutateAsync({ coordinates: coords, profile, roundtrip }),
      ]);

      const baseRoute = baseline.routes?.[0];
      const optTrip = optimized.trips?.[0];
      if (!baseRoute || !optTrip) {
        toast.warning('Otimização calculada, sem baseline para comparar.');
        return;
      }

      const distanceSavedPct = baseRoute.distance > 0
        ? ((baseRoute.distance - optTrip.distance) / baseRoute.distance) * 100
        : 0;
      const durationSavedPct = baseRoute.duration > 0
        ? ((baseRoute.duration - optTrip.duration) / baseRoute.duration) * 100
        : 0;

      setSavings({
        originalDistance: baseRoute.distance,
        originalDuration: baseRoute.duration,
        optimizedDistance: optTrip.distance,
        optimizedDuration: optTrip.duration,
        distanceSavedPct,
        durationSavedPct,
        isRouteOptimized: distanceSavedPct >= OPTIMIZATION_THRESHOLD_PCT,
      });

      toast.success('Rota otimizada calculada!', {
        description: distanceSavedPct >= OPTIMIZATION_THRESHOLD_PCT
          ? `Economia de ${distanceSavedPct.toFixed(1)}% em distância`
          : 'Rota original já está próxima do ideal',
      });
    } catch (e) {
      toast.error('Erro na otimização', { description: (e as Error).message });
    }
  };

  const result = optimization.data;
  const isPending = optimization.isPending || directions.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Route className="w-4 h-4 text-primary" />Otimização de Rota Multi-Parada</CardTitle>
          <CardDescription>Calcula a melhor sequência (TSP) e compara com a ordem original para medir economia real. Suporta 2-12 waypoints.</CardDescription>
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
          <Button onClick={handleRun} disabled={isPending} className="gap-2">{isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Otimizar Rota</Button>
        </CardContent>
      </Card>

      {savings && (
        <Card className={savings.isRouteOptimized ? 'border-emerald-500/40' : 'border-muted'}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {savings.isRouteOptimized
                ? <TrendingDown className="w-4 h-4 text-emerald-500" />
                : <TrendingUp className="w-4 h-4 text-muted-foreground" />}
              Economia da Otimização
              <Badge variant={savings.isRouteOptimized ? 'default' : 'secondary'} className="ml-2">
                {savings.isRouteOptimized ? `isRouteOptimized: true` : 'isRouteOptimized: false'}
              </Badge>
            </CardTitle>
            <CardDescription>Comparação entre a ordem informada (baseline via Directions) e a sequência ótima (Optimization).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Distância original</p>
                <p className="text-lg font-bold text-foreground">{(savings.originalDistance / 1000).toFixed(2)} km</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Distância otimizada</p>
                <p className="text-lg font-bold text-foreground">{(savings.optimizedDistance / 1000).toFixed(2)} km</p>
              </div>
              <div className={`p-3 rounded-lg ${savings.distanceSavedPct > 0 ? 'bg-emerald-500/10' : 'bg-muted/40'}`}>
                <p className="text-xs text-muted-foreground">Economia distância</p>
                <p className="text-lg font-bold text-foreground">{savings.distanceSavedPct.toFixed(1)}%</p>
              </div>
              <div className={`p-3 rounded-lg ${savings.durationSavedPct > 0 ? 'bg-emerald-500/10' : 'bg-muted/40'}`}>
                <p className="text-xs text-muted-foreground">Economia tempo</p>
                <p className="text-lg font-bold text-foreground">{savings.durationSavedPct.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Threshold para marcar como rota otimizada na Lalamove: <span className="font-semibold">≥ {OPTIMIZATION_THRESHOLD_PCT}%</span> em distância.
            </p>
          </CardContent>
        </Card>
      )}

      {result && result.trips?.[0] && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Sequência Otimizada</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-2xl font-bold text-foreground">{(result.trips[0].distance / 1000).toFixed(1)} km</p><p className="text-xs text-muted-foreground">Distância Total</p></div>
              <div className="p-3 rounded-lg bg-primary/10 text-center"><p className="text-2xl font-bold text-foreground">{Math.round(result.trips[0].duration / 60)} min</p><p className="text-xs text-muted-foreground">Tempo Estimado</p></div>
            </div>
            {result.waypoints && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Sequência otimizada:</p>
                <div className="flex flex-wrap items-center gap-1">
                  {result.waypoints.slice().sort((a, b) => a.waypoint_index - b.waypoint_index).map((wp, i, arr) => (
                    <div key={`${wp.waypoint_index}-${i}`} className="flex items-center gap-1">
                      <Badge variant="default" className="text-xs">{String.fromCharCode(65 + wp.waypoint_index)}</Badge>
                      <span className="text-xs text-muted-foreground">{wp.name || `(${wp.location[1].toFixed(4)}, ${wp.location[0].toFixed(4)})`}</span>
                      {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
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
