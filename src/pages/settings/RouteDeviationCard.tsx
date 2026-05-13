import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AlertSettings } from '@/hooks/useAlertSettings';

interface RouteDeviationCardProps {
  settings: AlertSettings;
  onUpdate: <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => void;
}

export function RouteDeviationCard({ settings, onUpdate }: RouteDeviationCardProps) {
  return (
    <Card variant="glass" hover="lift" className="overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive via-destructive/50 to-transparent" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center border border-destructive/20"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              <MapPin className="w-6 h-6 text-destructive" />
            </motion.div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Desvio de Rota
                {settings.off_route_alert_enabled && <Badge variant="success" size="sm">Ativo</Badge>}
              </CardTitle>
              <CardDescription>Alerta quando um motorista sai da rota planejada</CardDescription>
            </div>
          </div>
          <Switch
            checked={settings.off_route_alert_enabled}
            onCheckedChange={(checked) => onUpdate('off_route_alert_enabled', checked)}
          />
        </div>
      </CardHeader>
      {settings.off_route_alert_enabled && (
        <CardContent>
          <Separator className="mb-4 bg-border/50" />
          <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/30 border border-border/50">
            <AlertTriangle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Este alerta é disparado instantaneamente quando o sistema detecta que o motorista
              está fora da rota esperada. O alerta é automaticamente dispensado quando o motorista
              retorna à rota.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
