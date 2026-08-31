import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AlertSettings } from '@/hooks/useAlertSettings';

interface StoppedDriverCardProps {
  settings: AlertSettings;
  onUpdate: <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => void;
}

export function StoppedDriverCard({ settings, onUpdate }: StoppedDriverCardProps) {
  return (
    <Card variant="glass" hover="lift" className="overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning via-warning/50 to-transparent" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center border border-warning/20"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              <Clock className="w-6 h-6 text-warning" />
            </motion.div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Motorista Parado
                {settings.stopped_alert_enabled && <Badge variant="success" size="sm">Ativo</Badge>}
              </CardTitle>
              <CardDescription>Alerta quando um motorista fica parado durante uma entrega</CardDescription>
            </div>
          </div>
          <Switch
            checked={settings.stopped_alert_enabled}
            onCheckedChange={(checked) => onUpdate('stopped_alert_enabled', checked)}
          />
        </div>
      </CardHeader>
      {settings.stopped_alert_enabled && (
        <CardContent className="space-y-6">
          <Separator className="bg-border/50" />
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="stopped-warning" className="text-sm font-medium">Tempo para alerta de aviso</Label>
                <Badge variant="warning" className="font-mono">{settings.stopped_alert_minutes} min</Badge>
              </div>
              <Slider id="stopped-warning" value={[settings.stopped_alert_minutes]} onValueChange={([value]) => onUpdate('stopped_alert_minutes', value)} min={1} max={30} step={1} className="w-full" />
              <p className="text-xs text-muted-foreground">Um alerta de aviso será enviado após o motorista ficar parado por este tempo</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="stopped-critical" className="text-sm font-medium">Tempo para alerta crítico</Label>
                <Badge variant="destructive" className="font-mono">{settings.stopped_critical_minutes} min</Badge>
              </div>
              <Slider id="stopped-critical" value={[settings.stopped_critical_minutes]} onValueChange={([value]) => onUpdate('stopped_critical_minutes', value)} min={settings.stopped_alert_minutes + 1} max={60} step={1} className="w-full" />
              <p className="text-xs text-muted-foreground">O alerta será escalado para crítico após este tempo</p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
