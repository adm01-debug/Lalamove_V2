import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AlertSettings } from '@/hooks/useAlertSettings';

interface LateDeliveryCardProps {
  settings: AlertSettings;
  onUpdate: <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => void;
}

export function LateDeliveryCard({ settings, onUpdate }: LateDeliveryCardProps) {
  return (
    <Card variant="glass" hover="lift" className="overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              <Bell className="w-6 h-6 text-primary" />
            </motion.div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Entrega Atrasada
                {settings.late_delivery_alert_enabled && <Badge variant="success" size="sm">Ativo</Badge>}
              </CardTitle>
              <CardDescription>Alerta quando uma entrega ultrapassa o tempo estimado</CardDescription>
            </div>
          </div>
          <Switch
            checked={settings.late_delivery_alert_enabled}
            onCheckedChange={(checked) => onUpdate('late_delivery_alert_enabled', checked)}
          />
        </div>
      </CardHeader>
      {settings.late_delivery_alert_enabled && (
        <CardContent className="space-y-4">
          <Separator className="bg-border/50" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="late-threshold" className="text-sm font-medium">Tolerância de atraso</Label>
              <Badge variant="info" className="font-mono">{settings.late_delivery_minutes} min</Badge>
            </div>
            <Slider id="late-threshold" value={[settings.late_delivery_minutes]} onValueChange={([value]) => onUpdate('late_delivery_minutes', value)} min={5} max={60} step={5} className="w-full" />
            <p className="text-xs text-muted-foreground">Um alerta será enviado quando a entrega ultrapassar o tempo estimado por esta margem</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
