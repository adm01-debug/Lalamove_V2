import { useState } from 'react';
import { useUAPIStatus, useUAPIUser, useWalletBalance, useUpdateToken } from '@/hooks/useUAPI';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Wallet, Wifi, WifiOff, User, RefreshCw, Key, Clock, Shield, Eye, EyeOff } from 'lucide-react';
import { QueryState } from '@/components/ui/query-state';

export default function UAPISettingsPage() {
  const { data: status, isLoading: statusLoading, isError, error, refetch } = useUAPIStatus();
  const { data: user } = useUAPIUser();
  const { data: wallet } = useWalletBalance();
  const updateToken = useUpdateToken();
  const [newToken, setNewToken] = useState('');
  const [newRefreshToken, setNewRefreshToken] = useState('');
  const [showNewToken, setShowNewToken] = useState(false);

  const isConnected = status?.ok !== false && status?.session?.is_active;

  const handleUpdate = async () => {
    if (!newToken.trim()) return toast.error('Token de acesso não pode ser vazio');
    if (!newRefreshToken.trim()) return toast.error('O refresh token é obrigatório para salvar a sessão');
    try {
      const result = await updateToken.mutateAsync({ token: newToken, refreshToken: newRefreshToken });
      if (result.ok) {
        toast.success('Sessão UAPI salva. As anteriores foram desativadas.');
        setNewToken('');
        setNewRefreshToken('');
      } else {
        toast.error(result.message || 'Não foi possível salvar a sessão UAPI.');
      }
    } catch {
      toast.error('Erro ao atualizar token. Só um perfil admin pode gravar a sessão.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configurações UAPI</h2>
        <p className="text-muted-foreground">Gerenciamento da conexão com a API não-oficial da Lalamove</p>
      </div>

      {isError && <QueryState isError error={error} onRetry={refetch} />}

      {/* Status + Wallet row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connection Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              {isConnected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
              Status Conexão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={isConnected ? 'default' : 'destructive'} className="text-sm">
              {statusLoading ? 'Verificando...' : isConnected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </CardContent>
        </Card>

        {/* Wallet */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo Carteira
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {wallet?.balanceFormatted ?? '—'}
            </p>
          </CardContent>
        </Card>

        {/* User */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Usuário UAPI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-foreground truncate">
              {user?.nickname || user?.real_name || '—'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Session Details */}
      {status?.session && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sessão Ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Token:</span>{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{status.session.tokenPreview}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Device ID:</span>{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{status.session.device_id}</code>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Último uso:</span>{' '}
                {status.session.last_used_at
                  ? new Date(status.session.last_used_at).toLocaleString('pt-BR')
                  : '—'}
              </div>
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Último refresh:</span>{' '}
                {status.session.last_refreshed_at
                  ? new Date(status.session.last_refreshed_at).toLocaleString('pt-BR')
                  : 'Nunca'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Update Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Atualizar Token
          </CardTitle>
          <CardDescription>
            Quando o token expirar (~24h), cole o par access token + refresh token abaixo. Grava a sessão UAPI e desativa a anterior; exige perfil admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Cole o novo token aqui..."
              type={showNewToken ? 'text' : 'password'}
              autoComplete="off"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              className="font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewToken(!showNewToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showNewToken ? 'Ocultar token' : 'Mostrar token'}
            >
              {showNewToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              placeholder="Cole o refresh token aqui..."
              type={showNewToken ? 'text' : 'password'}
              autoComplete="off"
              value={newRefreshToken}
              onChange={(e) => setNewRefreshToken(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button onClick={handleUpdate} disabled={updateToken.isPending || !newToken.trim() || !newRefreshToken.trim()}>
            {updateToken.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Atualizando...
              </>
            ) : (
              'Atualizar Token'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
