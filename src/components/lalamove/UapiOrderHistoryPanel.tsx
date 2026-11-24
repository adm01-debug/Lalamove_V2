import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader2, PackageSearch } from 'lucide-react';
import { toast } from 'sonner';
import {
  useUapiOrderHistory,
  flattenOrderPages,
  useDownloadReceipt,
  UapiError,
} from '@/hooks/useLalamoveUapi';
import { formatFen, formatUapiTime } from '@/lib/uapiFormat';
import { isUapiSessionMissing } from '@/lib/uapiErrors';
import { UapiSessionRequired } from '@/components/lalamove/UapiSessionRequired';
import { DataErrorBanner } from '@/components/ui/data-error-banner';

/** Etapa 20 + 21 — histórico com cursor real e download de comprovante. */
export function UapiOrderHistoryPanel() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useUapiOrderHistory();
  const receipt = useDownloadReceipt();

  const orders = flattenOrderPages(data?.pages);

  const handleReceipt = async (orderUuid: string) => {
    try {
      const url = await receipt.mutateAsync(orderUuid);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const message = err instanceof UapiError ? err.message : 'Falha ao obter o comprovante';
      toast.error(message, { description: err instanceof UapiError ? err.hint : undefined });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageSearch className="h-4 w-4" />
          Histórico Lalamove (cursor)
        </CardTitle>
        <CardDescription>
          Paginação por cursor oficial (`last_id`), sem duplicatas entre páginas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {isError && isUapiSessionMissing(error) && (
          <UapiSessionRequired onRetry={() => void refetch()} retrying={isFetchingNextPage} />
        )}

        {isError && !isUapiSessionMissing(error) && (
          <DataErrorBanner
            message={
              error instanceof UapiError ? error.message : 'Falha ao carregar o histórico.'
            }
            details={error instanceof UapiError ? error.hint : undefined}
            onRetry={() => void refetch()}
            retrying={isFetchingNextPage}
          />
        )}

        {!isLoading && !isError && orders.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum pedido encontrado na conta Lalamove.</p>
        )}

        <ul className="space-y-2">
          {orders.map((order) => (
            <li
              key={order.order_uuid}
              className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {order.order_display_id || order.order_uuid}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {order.from_address || '—'} → {order.to_address || '—'}
                </p>
                <p className="text-xs text-muted-foreground">{formatUapiTime(order.create_time)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{formatFen(order.total_fee_fen)}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReceipt(order.order_uuid)}
                  disabled={receipt.isPending}
                  aria-label={`Baixar comprovante do pedido ${order.order_display_id || order.order_uuid}`}
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Comprovante
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {hasNextPage && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Carregar mais'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
