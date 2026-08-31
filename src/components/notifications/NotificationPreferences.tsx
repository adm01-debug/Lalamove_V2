import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  Settings,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Moon,
  Sun,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
// Badge removed
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { SoundSettingsPanel } from './SoundSettingsPanel';
import { motion, AnimatePresence } from 'framer-motion';

const NOTIFICATION_TYPES = [
  {
    id: 'approval_request',
    label: 'Solicitações de Aprovação',
    description: 'Novas solicitações de aprovação de motoristas',
    icon: AlertCircle,
    defaultEnabled: true,
  },
  {
    id: 'critical_alert',
    label: 'Alertas Críticos',
    description: 'Alertas de segurança e incidentes graves',
    icon: AlertTriangle,
    defaultEnabled: true,
  },
  {
    id: 'driver_update',
    label: 'Atualizações de Motoristas',
    description: 'Mudanças de status e avaliações',
    icon: Bell,
    defaultEnabled: true,
  },
  {
    id: 'order_status',
    label: 'Status de Pedidos',
    description: 'Atualizações de entregas em andamento',
    icon: Info,
    defaultEnabled: false,
  },
  {
    id: 'system_notification',
    label: 'Notificações do Sistema',
    description: 'Manutenção e atualizações do sistema',
    icon: Settings,
    defaultEnabled: false,
  },
];

const QUIET_HOURS_KEY = 'notification_quiet_hours';

interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

interface TypePreferences {
  [typeId: string]: boolean;
}

const getQuietHours = (): QuietHours => {
  try {
    const stored = localStorage.getItem(QUIET_HOURS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    logger.error('Error reading quiet hours:', e);
  }
  return { enabled: false, startHour: 22, endHour: 7 };
};

const saveQuietHours = (hours: QuietHours) => {
  localStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(hours));
};

const TYPE_PREFS_KEY = 'notification_type_preferences';

const getTypePreferences = (): TypePreferences => {
  try {
    const stored = localStorage.getItem(TYPE_PREFS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    logger.error('Error reading type preferences:', e);
  }
  const defaults: TypePreferences = {};
  NOTIFICATION_TYPES.forEach(t => {
    defaults[t.id] = t.defaultEnabled;
  });
  return defaults;
};

const saveTypePreferences = (prefs: TypePreferences) => {
  localStorage.setItem(TYPE_PREFS_KEY, JSON.stringify(prefs));
};

// Check if currently in quiet hours
export const isInQuietHours = (): boolean => {
  const hours = getQuietHours();
  if (!hours.enabled) return false;
  
  const now = new Date().getHours();
  if (hours.startHour > hours.endHour) {
    // Wraps around midnight
    return now >= hours.startHour || now < hours.endHour;
  }
  return now >= hours.startHour && now < hours.endHour;
};

// Check if a notification type is enabled
export const isTypeEnabled = (typeId: string): boolean => {
  const prefs = getTypePreferences();
  return prefs[typeId] ?? true;
};

const QuietHoursConfig = () => {
  const [hours, setHours] = useState<QuietHours>(getQuietHours);
  const [isQuiet, setIsQuiet] = useState(isInQuietHours);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsQuiet(isInQuietHours());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [hours]);

  const updateHours = (updates: Partial<QuietHours>) => {
    const newHours = { ...hours, ...updates };
    setHours(newHours);
    saveQuietHours(newHours);
    setIsQuiet(isInQuietHours());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            hours.enabled ? "bg-primary/10" : "bg-muted"
          )}>
            <Moon className={cn(
              "h-5 w-5",
              hours.enabled ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <Label className="text-base font-medium">Horário de Silêncio</Label>
            <p className="text-sm text-muted-foreground">
              Pausar notificações durante um período
            </p>
          </div>
        </div>
        <Switch
          checked={hours.enabled}
          onCheckedChange={(enabled) => updateHours({ enabled })}
        />
      </div>

      <AnimatePresence>
        {hours.enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg bg-muted/50 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-warning" />
                  <span className="text-sm">Início</span>
                </div>
                <select
                  value={hours.startHour}
                  onChange={(e) => updateHours({ startHour: parseInt(e.target.value) })}
                  className="px-3 py-1.5 rounded-md border bg-background text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-info" />
                  <span className="text-sm">Fim</span>
                </div>
                <select
                  value={hours.endHour}
                  onChange={(e) => updateHours({ endHour: parseInt(e.target.value) })}
                  className="px-3 py-1.5 rounded-md border bg-background text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>

              {isQuiet && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
                  Modo silêncio ativo agora
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TypePreferencesConfig = () => {
  const [prefs, setPrefs] = useState<TypePreferences>(getTypePreferences);

  const toggleType = (typeId: string) => {
    const newPrefs = { ...prefs, [typeId]: !prefs[typeId] };
    setPrefs(newPrefs);
    saveTypePreferences(newPrefs);
  };

  return (
    <div className="space-y-3">
      {NOTIFICATION_TYPES.map((type) => {
        const Icon = type.icon;
        const isEnabled = prefs[type.id] ?? type.defaultEnabled;

        return (
          <motion.div
            key={type.id}
            whileHover={{ scale: 1.01 }}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg border transition-colors",
              isEnabled ? "border-border" : "border-border/50 opacity-60"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isEnabled ? "bg-primary/10" : "bg-muted"
              )}>
                <Icon className={cn(
                  "h-4 w-4",
                  isEnabled ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={() => toggleType(type.id)}
            />
          </motion.div>
        );
      })}
    </div>
  );
};

interface NotificationPreferencesProps {
  trigger?: React.ReactNode;
}

export const NotificationPreferences = ({ trigger }: NotificationPreferencesProps) => {
  const { isEnabled: soundEnabled } = useSoundSettings();
  const { permission, settings: pushSettings } = usePushNotifications();

  const isPushActive = permission === 'granted' && pushSettings.enabled;

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Preferências
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferências de Notificação
          </SheetTitle>
          <SheetDescription>
            Configure como e quando receber alertas
          </SheetDescription>
        </SheetHeader>

        {/* Quick Status */}
        <div className="flex items-center gap-3 mt-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-success" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs">
              Som {soundEnabled ? 'ligado' : 'mudo'}
            </span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            {isPushActive ? (
              <BellRing className="h-4 w-4 text-success" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs">
              Push {isPushActive ? 'ativo' : 'inativo'}
            </span>
          </div>
          {isInQuietHours() && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-info" />
                <span className="text-xs text-info">Modo silêncio</span>
              </div>
            </>
          )}
        </div>

        <Tabs defaultValue="sounds" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sounds" className="gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sons</span>
            </TabsTrigger>
            <TabsTrigger value="types" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tipos</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Horário</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(100vh-280px)] mt-4">
            <TabsContent value="sounds" className="m-0">
              <SoundSettingsPanel />
            </TabsContent>

            <TabsContent value="types" className="m-0 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Tipos de Notificação</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha quais tipos de alertas você deseja receber
                </p>
              </div>
              <TypePreferencesConfig />
            </TabsContent>

            <TabsContent value="schedule" className="m-0 space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Agendamento</h3>
                <p className="text-xs text-muted-foreground">
                  Configure quando receber notificações
                </p>
              </div>
              <QuietHoursConfig />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationPreferences;
