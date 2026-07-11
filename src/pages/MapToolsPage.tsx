import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Route, Clock, Navigation, Image, Layers, MapPin, Target } from 'lucide-react';
import { OptimizationTab } from './map-tools/OptimizationTab';
import { MatrixTab } from './map-tools/MatrixTab';
import { IsochroneTab } from './map-tools/IsochroneTab';
import { MapMatchingTab } from './map-tools/MapMatchingTab';
import { StaticImageTab } from './map-tools/StaticImageTab';
import { TilequeryTab } from './map-tools/TilequeryTab';

export default function MapToolsPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary" />
          Ferramentas de Mapa
        </h2>
        <p className="text-muted-foreground">
          Todas as capacidades da API Mapbox disponíveis para logística
        </p>
      </div>
      <Tabs defaultValue="optimization" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="optimization" className="gap-1.5"><Route className="w-3.5 h-3.5" /> Otimização</TabsTrigger>
          <TabsTrigger value="matrix" className="gap-1.5"><Target className="w-3.5 h-3.5" /> Matriz</TabsTrigger>
          <TabsTrigger value="isochrone" className="gap-1.5"><Clock className="w-3.5 h-3.5" /> Isócronas</TabsTrigger>
          <TabsTrigger value="map-matching" className="gap-1.5"><Navigation className="w-3.5 h-3.5" /> Map Matching</TabsTrigger>
          <TabsTrigger value="static-image" className="gap-1.5"><Image className="w-3.5 h-3.5" /> Imagem Estática</TabsTrigger>
          <TabsTrigger value="tilequery" className="gap-1.5"><MapPin className="w-3.5 h-3.5" /> Tilequery</TabsTrigger>
        </TabsList>
        <TabsContent value="optimization"><OptimizationTab /></TabsContent>
        <TabsContent value="matrix"><MatrixTab /></TabsContent>
        <TabsContent value="isochrone"><IsochroneTab /></TabsContent>
        <TabsContent value="map-matching"><MapMatchingTab /></TabsContent>
        <TabsContent value="static-image"><StaticImageTab /></TabsContent>
        <TabsContent value="tilequery"><TilequeryTab /></TabsContent>
      </Tabs>
    </div>
  );
}
