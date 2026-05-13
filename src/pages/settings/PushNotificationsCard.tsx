import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, BellOff, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface PushNotificationsCardProps {
  pushSupported: boolean;
  pushPermission: NotificationPermission | 'default';
  pushSettings: { enabled: boolean; criticalOnly: boolean };
  requestPushPermission: () => Promise<string>;
  togglePushEnabled: () => void;
  togglePushCriticalOnly: () => void;
  sendTestNotification: () => Notification | null;
}

export function PushNotificationsCard({
  pushSupported, pushPermission, pushSettings,
  requestPushPermission, togglePushEnabled, togglePushCriticalOnly, sendTestNotification,
}: PushNotificationsCardProps) {
  const handleRequestPermission = async () => {
    const result = await requestPushPermission();
    if (result === 'granted') {
      toast.success('Notificações push ativadas!');
    } else if (result === 'denied') {
      toast.error('Permissão negada. Verifique as configurações do navegador.');
    }
  };

  const handleTestNotification = () => {
    const notification = sendTestNotification();
    if (notification) {
      toast.success('Notificação de teste enviada!');
    } else {
      toast.error('Não foi possível enviar a notificação de teste.');
    }
  };

  return (
    <Card variant="glass" hover="lift" className="overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-transparent" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center border border-primary/20"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              {pushPermission === 'granted' && pushSettings.enabled
                ? <BellRing className="w-6 h-6 text-primary" />
                : <BellOff className="w-6 h-6 text-muted-foreground" />}
            </motion.div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Notificações Push
                {pushPermission === 'granted' && pushSettings.enabled && <Badge variant="success" size="sm">Ativo</Badge>}
              </CardTitle>
              <CardDescription>Receba alertas mesmo quando a aba não estiver ativa</CardDescription>
            </div>
          </div>
          {pushPermission === 'granted' && (
            <Switch checked={pushSettings.enabled} onCheckedChange={togglePushEnabled} />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator className="bg-border/50" />
        {!pushSupported ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">Seu navegador não suporta notificações push.</p>
          </div>
        ) : pushPermission === 'default' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ative as notificações push para receber alertas críticos mesmo quando a aba do navegador não estiver ativa.</p>
            <Button onClick={handleRequestPermission} className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
              <BellRing className="w-4 h-4" />Ativar notificações
            </Button>
          </div>
        ) : pushPermission === 'denied' ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
            <p className="text-sm text-warning">Permissão negada. Para ativar, acesse as configurações do navegador.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Apenas alertas críticos</Label>
                <p className="text-xs text-muted-foreground">Receber notificações apenas para prioridade CRÍTICO e URGENTE</p>
              </div>
              <Switch checked={pushSettings.criticalOnly} onCheckedChange={togglePushCriticalOnly} />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleTestNotification} className="gap-2" disabled={!pushSettings.enabled}>
                <Bell className="w-4 h-4" />Testar notificação
              </Button>
              <span className="text-xs text-muted-foreground">Envia uma notificação de teste</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
