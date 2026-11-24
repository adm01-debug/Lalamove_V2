import { useState, useEffect, useRef } from 'react';
import { RefreshCw, List, MapPin, Package, Phone, Clock, Bike, Car, Truck as TruckIcon, Play, Pause, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiveMap, VehicleFilter, StatusFilter } from '@/components/map/LiveMap';
import { supabase } from '@/integrations/supabase/client';
import { uniqueTopic } from '@/lib/realtimeTopic';
import { toast } from 'sonner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

interface ActiveDelivery {
  id: string;
  order_id: string;
  driver_id: string;
  current_latitude: number;
  current_longitude: number;
  speed: number | null;
  eta_minutes: number | null;
  is_stopped: boolean | null;
  is_on_route: boolean | null;
  driver?: {
    name: string;
    phone: string | null;
    vehicle_type: string;
  };
  order?: {
    lalamove_id: string;
    internal_order_id: string | null;
    customer_name: string;
    pickup_address: string;
    delivery_address: string;
    status: string;
  };
}

const vehicleIcons: Record<string, React.ReactNode> = {
  MOTORCYCLE: <Bike className="w-4 h-4" />,
  CAR: <Car className="w-4 h-4" />,
  VAN: <TruckIcon className="w-4 h-4" />,
  TRUCK: <TruckIcon className="w-4 h-4" />,
};

const vehicleLabels: Record<string, string> = {
  MOTORCYCLE: 'Moto',
  CAR: 'Carro',
  VAN: 'Van',
  TRUCK: 'Caminhão',
};

const vehicleColors: Record<string, string> = {
  MOTORCYCLE: 'bg-primary',
  CAR: 'bg-info',
  VAN: 'bg-warning',
  TRUCK: 'bg-destructive',
};

export function LiveMapPage() {
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([]);
  const [showList, setShowList] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);
  const simulationRunId = useRef(0);
  const isTogglingRef = useRef(false);

  // Kill-switch de produto: quando `realtime_map_updates` está desligada, o mapa
  // cai para polling de 10s em vez de abrir canal Realtime.
  const { isEnabled: realtimeEnabled, isLoading: flagsLoading } = useFeatureFlag('realtime_map_updates');

  const fetchDeliveries = async () => {
    setIsRefreshing(true);
    const { data, error } = await supabase
      .from('active_tracking')
      .select(`
        *,
        driver:drivers(name, phone, vehicle_type),
        order:lalamove_orders(lalamove_id, internal_order_id, customer_name, pickup_address, delivery_address, status)
      `)
      .order('last_updated', { ascending: false });

    if (error) {
      setFetchError('Falha ao atualizar dados. Tentando de novo em 10 s.');
      setIsRefreshing(false);
      return;
    }

    setFetchError(null);
    setDeliveries(data || []);
    setLastRefresh(new Date());
    setIsRefreshing(false);
  };

  const runSimulation = async (): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('simulate-driver-movement');
      if (error) throw error;
      return true;
    } catch (err: unknown) {
      const status = (err as { context?: { status?: number } } | null)?.context?.status;
      toast.error(status === 403 ? 'Sem permissão para simular (requer admin ou manager)' : 'Erro ao simular movimento');
      return false;
    }
  };

  const toggleSimulation = async () => {
    if (isSimulating) {
      simulationRunId.current += 1;
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
      }
      setIsSimulating(false);
      toast.info('Simulação pausada');
      return;
    }
    // isTogglingRef evita que um duplo clique antes da primeira resposta crie dois
    // intervalos (a pausa só conhece o último salvo em simulationInterval.current,
    // e o outro fica órfão gravando posições). runId invalida a resposta se o
    // usuário já saiu do mapa (unmount) ou pausou/clicou de novo nesse meio tempo.
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    const runId = ++simulationRunId.current;
    // Espera a primeira chamada antes de anunciar sucesso e armar o intervalo,
    // para não dizer "iniciada" e repetir uma chamada rejeitada (403) a cada 3s.
    const ok = await runSimulation();
    isTogglingRef.current = false;
    if (!ok || runId !== simulationRunId.current) return;
    simulationInterval.current = setInterval(async () => {
      const stillOk = await runSimulation();
      if ((!stillOk || runId !== simulationRunId.current) && simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
        if (runId === simulationRunId.current) setIsSimulating(false);
      }
    }, 3000);
    setIsSimulating(true);
    toast.success('Simulação iniciada - motoristas em movimento!');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDeliveries();

    const interval = setInterval(fetchDeliveries, 10000);

    return () => {
      clearInterval(interval);
      simulationRunId.current += 1;
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
      }
    };
  }, []);

  // Canal Realtime só é aberto quando `realtime_map_updates` está habilitada.
  // Enquanto as flags carregam não abrimos nada; o polling acima já cobre.
  useEffect(() => {
    if (flagsLoading || !realtimeEnabled) return;

    const channel = supabase
      .channel(uniqueTopic('live-map-tracking'))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_tracking'
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeEnabled, flagsLoading]);

  const getStatusInfo = (delivery: ActiveDelivery) => {
    if (delivery.is_stopped) {
      return { label: 'Parado', variant: 'warning' as const };
    }
    if (!delivery.is_on_route) {
      return { label: 'Fora da rota', variant: 'destructive' as const };
    }
    return { label: 'Em trânsito', variant: 'success' as const };
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)]">
      {fetchError && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{fetchError}</span>
          <button
            className="ml-4 underline hover:no-underline"
            onClick={() => { setFetchError(null); fetchDeliveries(); }}
          >
            Tentar agora
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Rastreamento em Tempo Real</h2>
            <Badge variant="success">{deliveries.length} ativas</Badge>
            {!flagsLoading && !realtimeEnabled && (
              <Badge variant="secondary" title="Atualização por polling a cada 10s (Realtime desativado)">
                Polling 10s
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Última atualização: {lastRefresh.toLocaleTimeString('pt-BR')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {(vehicleFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {(vehicleFilter !== 'ALL' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0)}
              </Badge>
            )}
          </Button>
          <Button
            variant={isSimulating ? "default" : "outline"}
            size="sm"
            onClick={toggleSimulation}
            className={isSimulating ? "bg-success hover:bg-success/90" : ""}
          >
            {isSimulating ? (
              <>
                <Pause className="w-4 h-4 mr-2" />
                Pausar Simulação
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Simular Movimento
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowList(!showList)}
          >
            <List className="w-4 h-4 mr-2" />
            {showList ? 'Ocultar lista' : 'Mostrar lista'}
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={fetchDeliveries}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center justify-between gap-3 mb-3 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <span>{fetchError}</span>
          <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" onClick={fetchDeliveries} disabled={isRefreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Tentar agora
          </Button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-secondary/30 rounded-lg border border-border/50">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground font-medium">Tipo de Veículo</span>
            <ToggleGroup 
              type="single" 
              value={vehicleFilter} 
              onValueChange={(value) => value && setVehicleFilter(value as VehicleFilter)}
              className="justify-start"
            >
              <ToggleGroupItem value="ALL" size="sm" className="text-xs">
                Todos
              </ToggleGroupItem>
              <ToggleGroupItem value="MOTORCYCLE" size="sm" className="text-xs">
                <Bike className="w-3 h-3 mr-1" /> Moto
              </ToggleGroupItem>
              <ToggleGroupItem value="CAR" size="sm" className="text-xs">
                <Car className="w-3 h-3 mr-1" /> Carro
              </ToggleGroupItem>
              <ToggleGroupItem value="VAN" size="sm" className="text-xs">
                <TruckIcon className="w-3 h-3 mr-1" /> Van
              </ToggleGroupItem>
              <ToggleGroupItem value="TRUCK" size="sm" className="text-xs">
                <TruckIcon className="w-3 h-3 mr-1" /> Caminhão
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          <div className="w-px h-8 bg-border/50" />
          
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground font-medium">Status</span>
            <ToggleGroup 
              type="single" 
              value={statusFilter} 
              onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}
              className="justify-start"
            >
              <ToggleGroupItem value="ALL" size="sm" className="text-xs">
                Todos
              </ToggleGroupItem>
              <ToggleGroupItem value="IN_TRANSIT" size="sm" className="text-xs">
                <span className="w-2 h-2 rounded-full bg-primary mr-1" /> Em trânsito
              </ToggleGroupItem>
              <ToggleGroupItem value="STOPPED" size="sm" className="text-xs">
                <span className="w-2 h-2 rounded-full bg-warning mr-1" /> Parado
              </ToggleGroupItem>
              <ToggleGroupItem value="OFF_ROUTE" size="sm" className="text-xs">
                <span className="w-2 h-2 rounded-full bg-destructive mr-1" /> Fora da rota
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          
          {(vehicleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setVehicleFilter('ALL'); setStatusFilter('ALL'); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Main content */}
      <div className={`flex gap-4 ${showFilters ? 'h-[calc(100%-140px)]' : 'h-[calc(100%-60px)]'}`}>
        {/* Map */}
        <div className={`flex-1 ${showList ? '' : 'w-full'}`}>
          <LiveMap 
            className="w-full h-full" 
            vehicleFilter={vehicleFilter}
            statusFilter={statusFilter}
          />
        </div>

        {/* Sidebar list */}
        {showList && (
          <div className="w-96 flex flex-col gap-3 overflow-y-auto pr-2">
            {deliveries.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    Nenhuma entrega ativa no momento
                  </p>
                </CardContent>
              </Card>
            ) : (
              deliveries.map((delivery) => {
                const status = getStatusInfo(delivery);
                const vehicleType = delivery.driver?.vehicle_type || 'MOTORCYCLE';
                
                return (
                  <Card key={delivery.id} className="glass-card hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${vehicleColors[vehicleType]} flex items-center justify-center text-white`}>
                            {vehicleIcons[vehicleType]}
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">
                              {delivery.driver?.name || 'Motorista'}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{vehicleLabels[vehicleType]}</span>
                              {delivery.driver?.phone && (
                                <>
                                  <span>•</span>
                                  <Phone className="w-3 h-3" />
                                  <span>{delivery.driver.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant={status.variant} className="flex-shrink-0">
                          {status.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="space-y-3">
                        {/* Order info */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Pedido</span>
                          <span className="font-mono font-medium text-foreground">
                            {delivery.order?.internal_order_id || delivery.order?.lalamove_id || '-'}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Cliente</span>
                          <span className="font-medium text-foreground truncate max-w-[180px]">
                            {delivery.order?.customer_name || '-'}
                          </span>
                        </div>

                        {/* Pickup address */}
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex items-center gap-1 flex-shrink-0 text-emerald-500">
                            <Package className="w-3 h-3" />
                            <span className="font-medium">Coleta:</span>
                          </div>
                          <span className="text-muted-foreground line-clamp-2">
                            {delivery.order?.pickup_address || '-'}
                          </span>
                        </div>

                        {/* Delivery address */}
                        <div className="flex items-start gap-2 text-xs">
                          <div className="flex items-center gap-1 flex-shrink-0 text-rose-500">
                            <MapPin className="w-3 h-3" />
                            <span className="font-medium">Entrega:</span>
                          </div>
                          <span className="text-muted-foreground line-clamp-2">
                            {delivery.order?.delivery_address || '-'}
                          </span>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-muted-foreground">Velocidade:</span>
                            <span className="font-medium text-foreground">
                              {delivery.speed ? `${delivery.speed} km/h` : '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="w-3 h-3 text-primary" />
                            <span className="text-muted-foreground">ETA:</span>
                            <span className="font-medium text-primary">
                              {delivery.eta_minutes ? `${delivery.eta_minutes} min` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
