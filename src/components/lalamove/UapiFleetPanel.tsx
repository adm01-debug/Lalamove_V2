import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Star, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  useUapiFleet,
  useFleetMutation,
  useFleetSearch,
  UapiError,
  type FleetKind,
} from '@/hooks/useLalamoveUapi';
import { isUapiSessionMissing } from '@/lib/uapiErrors';
import { UapiSessionRequired } from '@/components/lalamove/UapiSessionRequired';
import { UapiSnapshotBadge } from '@/components/lalamove/UapiSnapshotBadge';
import { DataErrorBanner } from '@/components/ui/data-error-banner';

interface FleetListProps {
  kind: FleetKind;
  search: string;
}

function FleetList({ kind, search }: FleetListProps) {
  const { data, isLoading, isError, error, isFetching, refetch } = useUapiFleet(
    kind,
    search || undefined,
  );
  const mutate = useFleetMutation();

  const drivers = data?.items ?? [];

  const handleAction = async (driverFid: string) => {
    const action = kind === 'favorites' ? 'remove' : 'unblock';
    try {
      await mutate.mutateAsync({ driverFid, action });
      toast.success(kind === 'favorites' ? 'Motorista removido dos favoritos.' : 'Motorista desbloqueado.');
    } catch (err) {
      toast.error(err instanceof UapiError ? err.message : 'Falha ao atualizar a frota.');
    }
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (isError) {
    if (isUapiSessionMissing(error)) {
      return <UapiSessionRequired onRetry={() => void refetch()} retrying={isFetching} />;
    }
    return (
      <DataErrorBanner
        message={error instanceof UapiError ? error.message : 'Falha ao carregar a frota.'}
        details={error instanceof UapiError ? error.hint : undefined}
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }
  if (drivers.length === 0) {
    return (
      <div className="space-y-2">
        <UapiSnapshotBadge info={data?.freshness} />
        <p className="text-sm text-muted-foreground">Nenhum motorista nesta lista.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <UapiSnapshotBadge info={data?.freshness} />
      <ul className="space-y-2">
        {drivers.map((driver) => (
          <li
            key={driver.driver_fid}
            className="flex items-center justify-between rounded-md border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{driver.name || driver.driver_fid}</p>
              <p className="truncate text-xs text-muted-foreground">
                {driver.vehicle_type || '—'}
                {typeof driver.rating === 'number' ? ` · nota ${driver.rating.toFixed(2)}` : ''}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction(driver.driver_fid)}
              disabled={mutate.isPending}
            >
              {kind === 'favorites' ? 'Remover' : 'Desbloquear'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Etapa 23 — frota enterprise: favoritos e bloqueados. */
export function UapiFleetPanel() {
  const { term, setTerm } = useFleetSearch();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Frota Lalamove
        </CardTitle>
        <CardDescription>Motoristas favoritos e bloqueados da conta corporativa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar motorista..."
          aria-label="Buscar motorista na frota"
        />
        <Tabs defaultValue="favorites">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="favorites">
              <Star className="mr-1 h-3.5 w-3.5" />
              Favoritos
            </TabsTrigger>
            <TabsTrigger value="blocked">
              <Ban className="mr-1 h-3.5 w-3.5" />
              Bloqueados
            </TabsTrigger>
          </TabsList>
          <TabsContent value="favorites" className="mt-4">
            <FleetList kind="favorites" search={term} />
          </TabsContent>
          <TabsContent value="blocked" className="mt-4">
            <FleetList kind="blocked" search={term} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
