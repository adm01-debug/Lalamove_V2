import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUapiCoupons, useExchangeCoupon, UapiError } from '@/hooks/useLalamoveUapi';
import { formatFen, formatUapiTime } from '@/lib/uapiFormat';

/** Etapa 22 — resgate e listagem de cupons com erros `qp` traduzidos. */
export function UapiCouponsPanel() {
  const [code, setCode] = useState('');
  const { data, isLoading, isError, error } = useUapiCoupons();
  const exchange = useExchangeCoupon();

  const coupons = data ?? [];

  const handleExchange = async () => {
    if (!code.trim()) {
      toast.error('Informe o código do cupom.');
      return;
    }
    try {
      await exchange.mutateAsync(code);
      toast.success('Cupom resgatado com sucesso!');
      setCode('');
    } catch (err) {
      if (err instanceof UapiError) {
        toast.error(err.message, { description: err.hint });
      } else {
        toast.error('Falha ao resgatar o cupom.');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="h-4 w-4" />
          Cupons
        </CardTitle>
        <CardDescription>
          Resgate códigos promocionais. Erros da Lalamove são traduzidos para PT-BR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Código do cupom"
            aria-label="Código do cupom"
            className="font-mono"
          />
          <Button onClick={handleExchange} disabled={exchange.isPending || !code.trim()}>
            {exchange.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resgatar'}
          </Button>
        </div>

        {isLoading && <Skeleton className="h-20 w-full" />}

        {isError && (
          <p className="text-sm text-destructive">
            {error instanceof UapiError ? error.message : 'Falha ao carregar os cupons.'}
          </p>
        )}

        {!isLoading && !isError && coupons.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum cupom disponível na conta.</p>
        )}

        <ul className="space-y-2">
          {coupons.map((coupon, index) => (
            <li
              key={coupon.coupon_id ?? index}
              className="flex items-center justify-between rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{coupon.name || 'Cupom'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {coupon.description || 'Sem descrição'} · expira em {formatUapiTime(coupon.expire_time)}
                </p>
              </div>
              <Badge>{formatFen(coupon.amount_fen)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
