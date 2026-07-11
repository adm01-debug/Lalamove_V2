import { useState, useMemo } from 'react';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { HighlightText } from '@/components/ui/highlight-match';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Ban, Check, Clock, Globe, Activity, 
  Plus, Search, Trash2, MoreVertical, AlertTriangle,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BlockIPDialog, WhitelistDialog } from './ratelimit/RateLimitDialogs';

export default function RateLimitDashboardPage() {
  const {
    rateLimitLogs,
    blockedIPs,
    ipWhitelist,
    stats,
    isLoading,
    blockIP,
    isBlocking,
    unblockIP,
    addToWhitelist,
    isAddingToWhitelist,
    removeFromWhitelist,
    toggleWhitelist,
  } = useRateLimiting();

  const [searchTerm, setSearchTerm] = useState('');
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showWhitelistDialog, setShowWhitelistDialog] = useState(false);
  const [blockData, setBlockData] = useState({ ip: '', reason: '', duration: '24h', isPermanent: false });
  const [whitelistData, setWhitelistData] = useState({ ip: '', description: '', cidrRange: '' });

  // Preparar dados para o gráfico
  const chartData = rateLimitLogs?.slice(0, 24).reverse().map((log, index) => ({
    time: format(new Date(log.created_at), 'HH:mm'),
    requests: log.request_count,
    blocked: log.blocked ? 1 : 0,
  })) || [];

  // Fuzzy search with Fuse.js for blocked IPs - with match highlighting
  const blockedIPSearchKeys = useMemo(() => ['ip_address', 'reason'], []);
  const blockedIPSearchResults = useFuseSearchWithMatches(blockedIPs || [], blockedIPSearchKeys, searchTerm);
  const filteredBlockedIPs = searchTerm.trim() 
    ? blockedIPSearchResults.map(r => ({ ...r.item, _matches: r.matches }))
    : (blockedIPs || []);

  const handleBlockIP = () => {
    if (!blockData.ip || !blockData.reason) return;
    
    const expiresAt = blockData.isPermanent 
      ? undefined 
      : new Date(Date.now() + parseDuration(blockData.duration)).toISOString();

    blockIP({
      ipAddress: blockData.ip,
      reason: blockData.reason,
      isPermanent: blockData.isPermanent,
      expiresAt,
    });

    setShowBlockDialog(false);
    setBlockData({ ip: '', reason: '', duration: '24h', isPermanent: false });
  };

  const handleAddToWhitelist = () => {
    if (!whitelistData.ip || !whitelistData.description) return;

    addToWhitelist({
      ipAddress: whitelistData.ip,
      description: whitelistData.description,
      cidrRange: whitelistData.cidrRange || undefined,
    });

    setShowWhitelistDialog(false);
    setWhitelistData({ ip: '', description: '', cidrRange: '' });
  };

  const parseDuration = (duration: string): number => {
    const units: Record<string, number> = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000,
    };
    return units[duration] || 86400000;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PermissionGate permission="security.view" showLocked>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Rate Limiting & Proteção</h2>
            <p className="text-muted-foreground">Monitore e controle o acesso à API</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowWhitelistDialog(true)}>
              <Check className="mr-2 h-4 w-4" />
              Whitelist
            </Button>
            <Button variant="destructive" onClick={() => setShowBlockDialog(true)}>
              <Ban className="mr-2 h-4 w-4" />
              Bloquear IP
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalRequests}</p>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Ban className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.blockedRequests}</p>
                  <p className="text-sm text-muted-foreground">Bloqueados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Globe className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.uniqueIPs}</p>
                  <p className="text-sm text-muted-foreground">IPs Únicos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeBlockedIPs}</p>
                  <p className="text-sm text-muted-foreground">IPs Bloqueados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Shield className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.whitelistedIPs}</p>
                  <p className="text-sm text-muted-foreground">Whitelist</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Atividade de Requests</CardTitle>
            <CardDescription>Últimas 24 horas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)" 
                    name="Requests"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="blocked" className="space-y-4">
          <TabsList>
            <TabsTrigger value="blocked">
              <Ban className="mr-2 h-4 w-4" />
              IPs Bloqueados ({blockedIPs?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="whitelist">
              <Check className="mr-2 h-4 w-4" />
              Whitelist ({ipWhitelist?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Clock className="mr-2 h-4 w-4" />
              Logs Recentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blocked">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>IPs Bloqueados</CardTitle>
                    <CardDescription>IPs que foram bloqueados por excesso de requests</CardDescription>
                  </div>
                  <div className="w-64">
                    <SearchInputWithHelp
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder="Buscar IP..."
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  <AnimatePresence>
                    {filteredBlockedIPs.map((ip) => (
                      <motion.div
                        key={ip.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-destructive/10">
                            <Ban className="h-5 w-5 text-destructive" />
                          </div>
                          <div>
                            <p className="font-mono font-medium">{ip.ip_address}</p>
                            <p className="text-sm text-muted-foreground">{ip.reason}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Bloqueado {formatDistanceToNow(new Date(ip.blocked_at), { addSuffix: true, locale: ptBR })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ip.is_permanent ? 'destructive' : 'secondary'}>
                            {ip.is_permanent ? 'Permanente' : `Expira em ${formatDistanceToNow(new Date(ip.expires_at!), { locale: ptBR })}`}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => unblockIP(ip.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {blockedIPs?.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum IP bloqueado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whitelist">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>IP Whitelist</CardTitle>
                    <CardDescription>IPs que ignoram rate limiting</CardDescription>
                  </div>
                  <Button onClick={() => setShowWhitelistDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  <AnimatePresence>
                    {ipWhitelist?.map((ip) => (
                      <motion.div
                        key={ip.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-success/10">
                            <Check className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <p className="font-mono font-medium">{ip.ip_address}</p>
                            {ip.cidr_range && (
                              <p className="text-xs text-muted-foreground">CIDR: {ip.cidr_range}</p>
                            )}
                            <p className="text-sm text-muted-foreground">{ip.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={ip.is_active}
                            onCheckedChange={(checked) => toggleWhitelist({ id: ip.id, isActive: checked })}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromWhitelist(ip.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {ipWhitelist?.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum IP na whitelist</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Logs de Rate Limit</CardTitle>
                <CardDescription>Últimos 500 registros</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {rateLimitLogs?.slice(0, 50).map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        log.blocked 
                          ? 'bg-destructive/5 border-destructive/20' 
                          : 'bg-muted/50 border-border/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${log.blocked ? 'bg-destructive/10' : 'bg-muted'}`}>
                          {log.blocked ? (
                            <Ban className="h-4 w-4 text-destructive" />
                          ) : (
                            <Activity className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-mono text-sm">{log.ip_address}</p>
                          <p className="text-xs text-muted-foreground">{log.endpoint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant={log.blocked ? 'destructive' : 'secondary'}>
                          {log.request_count} reqs
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <BlockIPDialog
          open={showBlockDialog}
          onOpenChange={setShowBlockDialog}
          blockData={blockData}
          setBlockData={setBlockData}
          onSubmit={handleBlockIP}
          isBlocking={isBlocking}
        />

        <WhitelistDialog
          open={showWhitelistDialog}
          onOpenChange={setShowWhitelistDialog}
          whitelistData={whitelistData}
          setWhitelistData={setWhitelistData}
          onSubmit={handleAddToWhitelist}
          isAdding={isAddingToWhitelist}
        />
      </div>
    </PermissionGate>
  );
}
