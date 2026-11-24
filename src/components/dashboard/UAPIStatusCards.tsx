import { Wallet, Wifi, WifiOff, Zap } from 'lucide-react';
import { useWallet, useLalamoveStatus } from '@/hooks/useLalamove';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

export function UAPIStatusCards() {
  const { data: wallet, isLoading: walletLoading, isError: walletError } = useWallet();
  const { data: status, isLoading: statusLoading } = useLalamoveStatus();
  const navigate = useNavigate();

  const v3Ok = status?.v3?.ok;
  const uapiOk = status?.uapi?.ok;
  const bothOk = v3Ok && uapiOk;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Wallet */}
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
        onClick={() => navigate(walletError ? '/settings/uapi' : '/settings/lalamove')}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Saldo Lalamove</p>
            {walletLoading ? (
              <Skeleton className="h-6 w-24 mt-0.5" />
            ) : walletError ? (
              <p
                className="text-sm font-semibold text-destructive truncate"
                title="A carteira depende da sessão UAPI. Clique para abrir Configurações → UAPI e salvar o token e o refresh_token do portal."
              >
                Indisponível — ver sessão
              </p>
            ) : (
              <p className="text-lg font-bold text-foreground truncate">
                {wallet?.formatted ?? '—'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection status */}
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
        onClick={() => navigate('/settings/lalamove')}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
            bothOk ? 'bg-primary/10' : 'bg-destructive/10'
          }`}>
            {bothOk
              ? <Wifi className="h-5 w-5 text-primary" />
              : <WifiOff className="h-5 w-5 text-destructive" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">APIs Lalamove</p>
            {statusLoading ? (
              <Skeleton className="h-5 w-20 mt-0.5" />
            ) : (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={v3Ok ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                  <Zap className="w-3 h-3 mr-0.5" />V3
                </Badge>
                <Badge variant={uapiOk ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                  UAPI
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
