import { Bell, Webhook, X } from 'lucide-react';
import { useAlertConfigurations } from '@/hooks/useAlertConfigurations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertConfigCard } from './alert-configurations/AlertConfigCard';

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} variant="glass" className="animate-pulse">
          <div className="p-6"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-72" /></div></div></div>
          <div className="px-6 pb-6"><Skeleton className="h-12 w-full rounded-xl" /></div>
        </Card>
      ))}
    </div>
  );
}

export function AlertConfigurationsPage() {
  const { data: configs, isLoading, error } = useAlertConfigurations();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight"><span className="gradient-text">Configurações</span> de Alertas</h1>
          <p className="text-muted-foreground">Gerencie os canais de notificação e templates para cada tipo de alerta</p>
        </div>
        <div className="flex items-center gap-3"><Badge variant="gradient" size="lg" className="gap-1.5"><Bell className="w-4 h-4" />{configs?.filter(c => c.is_enabled).length || 0} ativos</Badge></div>
      </div>

      <Card variant="glass" className="border-warning/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-amber/5" />
        <CardContent className="flex items-center gap-4 py-5 relative">
          <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-amber/20 shadow-lg shadow-warning/10"><Webhook className="w-6 h-6 text-warning" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Secrets de notificação pendentes</p>
            <p className="text-sm text-muted-foreground mt-0.5">Configure <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">EVOLUTION_API_KEY</code>, <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">RESEND_API_KEY</code> e <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">SLACK_WEBHOOK_URL</code> para ativar as notificações.</p>
          </div>
          <Button variant="warning" size="sm">Configurar</Button>
        </CardContent>
      </Card>

      {isLoading ? <LoadingSkeleton /> : error ? (
        <Card variant="glass" className="border-destructive/40"><CardContent className="py-8 text-center"><div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4"><X className="w-8 h-8 text-destructive" /></div><p className="text-destructive font-medium">Erro ao carregar configurações</p><p className="text-sm text-muted-foreground mt-1">{error.message}</p></CardContent></Card>
      ) : configs?.length === 0 ? (
        <Card variant="gradient" className="border-dashed"><CardContent className="py-16 text-center"><div className="p-4 rounded-2xl bg-primary/10 w-fit mx-auto mb-4"><Bell className="w-12 h-12 text-primary" /></div><p className="text-lg font-medium text-foreground">Nenhuma configuração encontrada</p><p className="text-muted-foreground mt-1">As configurações de alerta aparecerão aqui</p></CardContent></Card>
      ) : (
        <div className="space-y-4">{configs?.map((config, index) => <AlertConfigCard key={config.id} config={config} index={index} />)}</div>
      )}
    </div>
  );
}
