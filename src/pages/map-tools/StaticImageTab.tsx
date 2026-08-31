import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Image, Loader2, Download, Copy } from 'lucide-react';
import { useMapboxStaticImage } from '@/hooks/useMapbox';

export function StaticImageTab() {
  const mutation = useMapboxStaticImage();
  const [lng, setLng] = useState(-46.6544);
  const [lat, setLat] = useState(-23.5629);
  const [zoom, setZoom] = useState(13);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(500);
  const [style, setStyle] = useState('dark-v11');

  const handleGenerate = () => {
    mutation.mutate({ lng, lat, zoom, width, height, style, retina: true, markers: [{ lng, lat, color: 'f44336', label: 'a' }] }, { onSuccess: () => toast.success('Imagem gerada!'), onError: (e) => toast.error('Erro', { description: e.message }) });
  };
  const result = mutation.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Image className="w-4 h-4 text-primary" />Imagem Estática do Mapa</CardTitle><CardDescription>Gera uma imagem PNG do mapa para relatórios, notificações ou compartilhamento.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Latitude</Label><Input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value) || 0)} className="font-mono text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Longitude</Label><Input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value) || 0)} className="font-mono text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Zoom</Label><Input type="number" value={zoom} onChange={(e) => setZoom(parseInt(e.target.value) || 12)} className="text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Largura (px)</Label><Input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 600)} className="text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Altura (px)</Label><Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 400)} className="text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Estilo</Label><Select value={style} onValueChange={setStyle}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dark-v11">Dark</SelectItem><SelectItem value="light-v11">Light</SelectItem><SelectItem value="streets-v12">Streets</SelectItem><SelectItem value="satellite-streets-v12">Satélite</SelectItem><SelectItem value="outdoors-v12">Outdoors</SelectItem></SelectContent></Select></div>
          </div>
          <Button onClick={handleGenerate} disabled={mutation.isPending} className="gap-2">{mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}Gerar Imagem</Button>
        </CardContent>
      </Card>
      {result?.image && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">Imagem Gerada ({result.width}×{result.height})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <img src={result.image} alt="Mapa estático" className="w-full rounded-lg border border-border/50" style={{ maxHeight: 500 }} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" asChild><a href={result.image} download="map-image.png"><Download className="w-3.5 h-3.5" /> Download PNG</a></Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { navigator.clipboard.writeText(result.image); toast.success('Base64 copiado!'); }}><Copy className="w-3.5 h-3.5" /> Copiar Base64</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
