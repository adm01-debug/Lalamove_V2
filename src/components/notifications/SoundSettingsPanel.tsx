import { useState } from 'react';
import { 
  Volume2, VolumeX, Play, Bell, BellRing, AlertTriangle, 
  AlertCircle, Info, ChevronDown, RotateCcw, Smartphone,
  Check, Zap, Shield
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
// Separator removed
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { 
  useSoundSettings, 
  AVAILABLE_TONES, 
  type AlertPriority, 
  type ToneType 
} from '@/hooks/useSoundSettings';
import { previewTone, playTestSound } from '@/utils/alertSounds';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const priorityConfig: Record<AlertPriority, { 
  label: string; 
  description: string; 
  icon: React.ReactNode; 
  color: string;
  bgColor: string;
}> = {
  CRITICAL: {
    label: 'Crítico',
    description: 'Alertas que requerem ação imediata',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  URGENT: {
    label: 'Urgente',
    description: 'Alertas de alta prioridade',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
  HIGH: {
    label: 'Alto',
    description: 'Alertas importantes',
    icon: <BellRing className="h-4 w-4" />,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  MEDIUM: {
    label: 'Médio',
    description: 'Alertas de rotina',
    icon: <Bell className="h-4 w-4" />,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  LOW: {
    label: 'Baixo',
    description: 'Informações e atualizações',
    icon: <Info className="h-4 w-4" />,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
};

const TonePreview = ({ 
  tone, 
  isSelected,
  onSelect,
  onPreview 
}: { 
  tone: typeof AVAILABLE_TONES[0];
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
        isSelected 
          ? "border-primary bg-primary/5" 
          : "border-border hover:border-primary/50"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        {isSelected && (
          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
        <div>
          <p className="font-medium text-sm">{tone.label}</p>
          <p className="text-xs text-muted-foreground">{tone.description}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        <Play className="h-4 w-4" />
      </Button>
    </motion.div>
  );
};

const PriorityToneSelector = ({
  priority,
  currentTone,
  onToneChange,
}: {
  priority: AlertPriority;
  currentTone: ToneType;
  onToneChange: (tone: ToneType) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = priorityConfig[priority];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors hover:bg-accent/50",
          config.bgColor
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor, config.color)}>
              {config.icon}
            </div>
            <div>
              <p className="font-medium text-sm">{config.label}</p>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {AVAILABLE_TONES.find(t => t.type === currentTone)?.label || currentTone}
            </Badge>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-2 pt-3 pl-12">
          {AVAILABLE_TONES.map((tone) => (
            <TonePreview
              key={tone.type}
              tone={tone}
              isSelected={currentTone === tone.type}
              onSelect={() => onToneChange(tone.type)}
              onPreview={() => previewTone(tone.type)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SoundSettingsPanel = () => {
  const {
    isEnabled,
    volume,
    priorityTones,
    toggleSound,
    setVolume,
    setPriorityTone,
    resetToDefaults,
  } = useSoundSettings();

  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    settings: pushSettings,
    requestPermission,
    toggleEnabled: togglePush,
    toggleCriticalOnly,
    sendTestNotification,
  } = usePushNotifications();

  const [isTestingSound, setIsTestingSound] = useState(false);

  const handleTestSound = () => {
    setIsTestingSound(true);
    playTestSound('alert');
    toast.success('Som de teste reproduzido!');
    setTimeout(() => setIsTestingSound(false), 1000);
  };

  const handleTestNotification = () => {
    const result = sendTestNotification();
    if (result) {
      toast.success('Notificação de teste enviada!');
    } else {
      toast.error('Não foi possível enviar a notificação');
    }
  };

  return (
    <div className="space-y-6">
      {/* Master Sound Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <div className="p-2 rounded-lg bg-primary/10">
                  <Volume2 className="h-5 w-5 text-primary" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-muted">
                  <VolumeX className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Sons de Alerta</CardTitle>
                <CardDescription>
                  Configure os sons para diferentes tipos de alertas
                </CardDescription>
              </div>
            </div>
            <Switch 
              checked={isEnabled} 
              onCheckedChange={toggleSound}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Volume Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Volume</Label>
              <span className="text-sm text-muted-foreground">{volume}%</span>
            </div>
            <div className="flex items-center gap-4">
              <VolumeX className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                onValueChange={([v]) => setVolume(v)}
                max={100}
                step={5}
                disabled={!isEnabled}
                className="flex-1"
              />
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Test Button */}
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestSound}
              disabled={!isEnabled || isTestingSound}
              className="gap-2"
            >
              <AnimatePresence mode="wait">
                {isTestingSound ? (
                  <motion.div
                    key="playing"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Zap className="h-4 w-4 text-primary animate-pulse" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Play className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
              Testar Som
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              Restaurar Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Priority-based Tone Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Sons por Prioridade
          </CardTitle>
          <CardDescription>
            Configure um tom diferente para cada nível de prioridade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(priorityConfig) as AlertPriority[]).map((priority) => (
            <PriorityToneSelector
              key={priority}
              priority={priority}
              currentTone={priorityTones[priority]}
              onToneChange={(tone) => setPriorityTone(priority, tone)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificações Push</CardTitle>
                <CardDescription>
                  Receba alertas mesmo quando o app não estiver em foco
                </CardDescription>
              </div>
            </div>
            {isPushSupported && pushPermission === 'granted' && (
              <Switch 
                checked={pushSettings.enabled} 
                onCheckedChange={togglePush}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPushSupported ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="text-sm">
                Seu navegador não suporta notificações push.
              </p>
            </div>
          ) : pushPermission === 'denied' ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <Shield className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium">Notificações bloqueadas</p>
                <p className="text-xs text-muted-foreground">
                  Habilite nas configurações do navegador
                </p>
              </div>
            </div>
          ) : pushPermission === 'default' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para habilitar notificações push.
              </p>
              <Button onClick={requestPermission} className="gap-2">
                <Bell className="h-4 w-4" />
                Habilitar Notificações
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Critical Only Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Apenas Críticos</Label>
                  <p className="text-xs text-muted-foreground">
                    Receber apenas alertas críticos e urgentes
                  </p>
                </div>
                <Switch
                  checked={pushSettings.criticalOnly}
                  onCheckedChange={toggleCriticalOnly}
                  disabled={!pushSettings.enabled}
                />
              </div>

              {/* Test Notification */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                disabled={!pushSettings.enabled}
                className="gap-2"
              >
                <Bell className="h-4 w-4" />
                Enviar Notificação de Teste
              </Button>

              {/* Status */}
              <div className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "h-2 w-2 rounded-full",
                  pushSettings.enabled ? "bg-success" : "bg-muted-foreground"
                )} />
                <span className="text-muted-foreground">
                  {pushSettings.enabled ? 'Notificações ativas' : 'Notificações pausadas'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SoundSettingsPanel;
