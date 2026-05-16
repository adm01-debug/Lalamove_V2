import { useState } from 'react';
import { useLalamoveStatus, useLalamoveUser, useWallet, useUpdateUapiToken, useUpdateV3Keys, useRefreshUapiToken, useWalletHistory, useVehicles, useServiceAreas } from '@/hooks/useLalamove';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Wallet, Wifi, WifiOff, User, RefreshCw, Key, Clock, Shield, Zap, CheckCircle2, XCircle, History, ChevronLeft, ChevronRight, Truck, MapPin } from 'lucide-react';
import { LalamoveV3Explorer } from './lalamove/LalamoveV3Explorer';

interface Transaction {
  id: string;
  description?: string;
  remark?: string;
  flow_type_name?: string;
  created_at?: string;
  create_time?: number;
  amount_fen?: number;
  amount?: number;
  balance_fen?: number;
}

interface Vehicle {
  id?: string | number;
  vehicle_type_id?: string | number;
  name?: string;
  vehicle_type_name?: string;
  key?: string | number;
}

interface ServiceArea {
  id?: string | number;
  city_id?: string | number;
  name?: string;
  city_name?: string;
  key?: string | number;
}

export default function LalamoveSettingsPage() {
  const { data: status, isLoading: statusLoading } = useLalamoveStatus();
  const { data: user } = useLalamoveUser();
  const { data: wallet } = useWallet();
  const updateToken = useUpdateUapiToken();
  const updateV3 = useUpdateV3Keys();
  const refreshToken = useRefreshUapiToken();
  const [newToken, setNewToken] = useState('');
  const [v3Key, setV3Key] = useState('');
  const [v3Secret, setV3Secret] = useState('');
  const [walletPage, setWalletPage] = useState(1);
  const { data: walletHistory, isLoading: historyLoading } = useWalletHistory(walletPage);
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehicles();
  const { data: serviceAreasData, isLoading: areasLoading } = useServiceAreas();

  const userData = user as Record<string, unknown> | undefined;

  const v3Ok = status?.v3?.ok;
  const uapiOk = status?.uapi?.ok;

  const handleUpdateToken = async () => {
    if (!newToken.trim()) return toast.error('Token não pode ser vazio');
    try {
      const result = await updateToken.mutateAsync(newToken);
      if (result.ok) {
        toast.success('Token atualizado e verificado com sucesso!');
        setNewToken('');
      } else {
        toast.error('Token inválido ou expirado.');
      }
    } catch {
      toast.error('Erro ao atualizar token');
    }
  };

  const handleRefreshToken = async () => {
    try {
      const result = await refreshToken.mutateAsync();
      if (result.ok) {
        toast.success('Token renovado automaticamente!');
      } else {
        toast.warning('Não foi possível renovar. Cole um novo token manualmente.');
      }
    } catch {
      toast.error('Erro ao renovar token');
    }
  };

  const handleUpdateV3Keys = async () => {
    if (!v3Key.trim() || !v3Secret.trim()) return toast.error('API Key e Secret são obrigatórios');
    try {
      const result = await updateV3.mutateAsync({ apiKey: v3Key, apiSecret: v3Secret });
      if (result.ok) {
        toast.success('Credenciais V3 atualizadas!');
        setV3Key('');
        setV3Secret('');
      } else {
        toast.error('Credenciais inválidas.');
      }
    } catch {
      toast.error('Erro ao atualizar credenciais V3');
    }
  };

  const transactions = walletHistory?.body?.data?.list || walletHistory?.data?.list || [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" />
          Lalamove — Configurações
        </h1>
        <p className="text-muted-foreground">Gerenciamento das conexões com as APIs da Lalamove</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {v3Ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
              API v3 (Oficial)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={v3Ok ? 'default' : 'destructive'} className="text-sm">
              {statusLoading ? 'Verificando...' : v3Ok ? 'Conectado' : 'Erro'}
            </Badge>
            {status?.v3?.apiKeyPreview && (
              <p className="text-xs text-muted-foreground mt-2">
                Key: <code className="bg-muted px-1 rounded">{status.v3.apiKeyPreview}</code>
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Auth: HMAC-SHA256 (permanente)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {uapiOk ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-destructive" />}
              UAPI (Web Session)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={uapiOk ? 'default' : 'destructive'} className="text-sm">
              {statusLoading ? 'Verificando...' : uapiOk ? 'Conectado' : 'Token Expirado'}
            </Badge>
            {status?.uapi?.tokenPreview && (
              <p className="text-xs text-muted-foreground mt-2">
                Token: <code className="bg-muted px-1 rounded">{status.uapi.tokenPreview}</code>
              </p>
            )}
            {status?.uapi?.username && (
              <p className="text-xs text-muted-foreground mt-1">Usuário: {status.uapi.username}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo Carteira
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {wallet?.formatted ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Info */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil UAPI
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Nome:</span> {String(userData?.nickname || userData?.real_name || '—')}</p>
            <p><span className="text-muted-foreground">Email:</span> {String(userData?.email || '—')}</p>
          </CardContent>
        </Card>
      )}

      {/* Session Details */}
      {status?.uapi?.session && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sessão UAPI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Device ID:</span>{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{status.uapi.session.device_id}</code>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Último uso:</span>{' '}
                {status.uapi.session.last_used_at
                  ? new Date(status.uapi.session.last_used_at).toLocaleString('pt-BR')
                  : '—'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh UAPI Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Renovar Token UAPI
          </CardTitle>
          <CardDescription>
            Tente renovar automaticamente usando o refresh_token armazenado. Se falhar, cole um novo token manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleRefreshToken} disabled={refreshToken.isPending} variant="outline" className="w-full sm:w-auto">
            {refreshToken.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Renovando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Renovar Automaticamente
              </>
            )}
          </Button>

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ou cole um novo token (DevTools → web.lalamove.com → Network → get_user_info → token):
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Cole o novo token aqui..."
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={handleUpdateToken} disabled={updateToken.isPending || !newToken.trim()}>
                {updateToken.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Atualizar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update V3 Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Atualizar Credenciais API V3
          </CardTitle>
          <CardDescription>
            API Key e Secret do Partner Portal Lalamove (HMAC). Essas credenciais não expiram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="API Key (pk_...)"
            value={v3Key}
            onChange={(e) => setV3Key(e.target.value)}
            className="font-mono text-sm"
          />
          <Input
            placeholder="API Secret (sk_...)"
            type="password"
            value={v3Secret}
            onChange={(e) => setV3Secret(e.target.value)}
            className="font-mono text-sm"
          />
          <Button onClick={handleUpdateV3Keys} disabled={updateV3.isPending || !v3Key.trim() || !v3Secret.trim()}>
            {updateV3.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              'Salvar Credenciais V3'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Wallet History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Transações
          </CardTitle>
          <CardDescription>Extrato da carteira Lalamove (UAPI)</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-2">
              {(transactions as Transaction[]).map((tx, i) => (
                <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description || tx.remark || tx.flow_type_name || 'Transação'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.created_at || tx.create_time
                        ? new Date(tx.created_at || tx.create_time * 1000).toLocaleString('pt-BR')
                        : '—'}
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className={`text-sm font-semibold ${
                      (tx.amount_fen || tx.amount || 0) >= 0 ? 'text-primary' : 'text-destructive'
                    }`}>
                      {((tx.amount_fen || tx.amount || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    {tx.balance_fen != null && (
                      <p className="text-xs text-muted-foreground">
                        Saldo: {(tx.balance_fen / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWalletPage(p => Math.max(1, p - 1))}
                  disabled={walletPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {walletPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWalletPage(p => p + 1)}
                  disabled={transactions.length < 20}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma transação encontrada. Verifique se o token UAPI está ativo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vehicles (UAPI) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Veículos Disponíveis (UAPI)
          </CardTitle>
          <CardDescription>Tipos de veículos disponíveis na plataforma Lalamove</CardDescription>
        </CardHeader>
        <CardContent>
          {vehiclesLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : vehiclesData?.body?.data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Array.isArray(vehiclesData?.body?.data) ? (vehiclesData.body.data as any[]) : Object.entries(vehiclesData?.body?.data || {})).map((item: any, i: number) => {
                const vehicle = Array.isArray(vehiclesData?.body?.data) ? item : { key: item[0], ...item[1] };
                const name = vehicle.name || vehicle.vehicle_type_name || vehicle.key || `Veículo ${i + 1}`;
                const id = vehicle.id || vehicle.vehicle_type_id || vehicle.key || i;
                return (
                  <div key={String(id)} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-sm">🚗</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">ID: {id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum veículo encontrado. Verifique se o token UAPI está ativo.</p>
          )}
        </CardContent>
      </Card>

      {/* Service Areas (UAPI) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Áreas de Serviço (UAPI)
          </CardTitle>
          <CardDescription>Regiões atendidas pela Lalamove</CardDescription>
        </CardHeader>
        <CardContent>
          {areasLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : serviceAreasData?.body?.data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(Array.isArray(serviceAreasData?.body?.data) ? (serviceAreasData.body.data as any[]) : Object.entries(serviceAreasData?.body?.data || {})).map((item: any, i: number) => {
                const area = Array.isArray(serviceAreasData?.body?.data) ? item : { key: item[0], ...item[1] };
                const name = area.name || area.city_name || area.key || `Área ${i + 1}`;
                const id = area.id || area.city_id || area.key || i;
                return (
                  <div key={String(id)} className="flex items-center gap-2 p-2 rounded-lg border border-border/50">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">ID: {id}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma área encontrada. Verifique se o token UAPI está ativo.</p>
          )}
        </CardContent>
      </Card>

      {/* V3 API Explorer */}
      <LalamoveV3Explorer />
    </div>
  );
}
