import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, VolumeX, Play, Music, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { AVAILABLE_TONES, type AlertPriority, type ToneType } from '@/hooks/useSoundSettings';
import { playTestSound, previewTone } from '@/utils/alertSounds';
import { toast } from 'sonner';

const priorityLabels: Record<AlertPriority, { label: string; colorClass: string; bgClass: string }> = {
  CRITICAL: { label: 'Crítico', colorClass: 'text-destructive', bgClass: 'bg-destructive/10' },
  URGENT: { label: 'Urgente', colorClass: 'text-warning', bgClass: 'bg-warning/10' },
  HIGH: { label: 'Alto', colorClass: 'text-warning', bgClass: 'bg-warning/10' },
  MEDIUM: { label: 'Médio', colorClass: 'text-info', bgClass: 'bg-info/10' },
  LOW: { label: 'Baixo', colorClass: 'text-success', bgClass: 'bg-success/10' },
};

interface SoundSettingsCardProps {
  soundEnabled: boolean;
  soundVolume: number;
  priorityTones: Record<AlertPriority, ToneType>;
  toggleSound: () => void;
  setVolume: (v: number) => void;
  setPriorityTone: (p: AlertPriority, t: ToneType) => void;
  resetSoundDefaults: () => void;
}

export function SoundSettingsCard({
  soundEnabled, soundVolume, priorityTones,
  toggleSound, setVolume, setPriorityTone, resetSoundDefaults,
}: SoundSettingsCardProps) {
  const handleTestSound = () => {
    playTestSound();
    toast.success('Som de teste reproduzido!');
  };

  return (
    <Card variant="glass" hover="lift" className="overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent/50 to-transparent" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center border border-accent/20"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              {soundEnabled ? <Volume2 className="w-6 h-6 text-accent-foreground" /> : <VolumeX className="w-6 h-6 text-muted-foreground" />}
            </motion.div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Sons de Notificação
                {soundEnabled && <Badge variant="success" size="sm">Ativo</Badge>}
              </CardTitle>
              <CardDescription>Alertas sonoros para novas aprovações e notificações</CardDescription>
            </div>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={toggleSound} />
        </div>
      </CardHeader>
      {soundEnabled && (
        <CardContent className="space-y-6">
          <Separator className="bg-border/50" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="sound-volume" className="text-sm font-medium">Volume dos alertas</Label>
              <Badge variant="secondary" className="font-mono">{soundVolume}%</Badge>
            </div>
            <Slider id="sound-volume" value={[soundVolume]} onValueChange={([value]) => setVolume(value)} min={10} max={100} step={10} className="w-full" />
            <p className="text-xs text-muted-foreground">Ajuste o volume dos sons de alerta para aprovações e notificações</p>
          </div>
          <Separator className="bg-border/50" />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Sons por Prioridade</Label>
            </div>
            <p className="text-xs text-muted-foreground">Escolha um tom diferente para cada nível de prioridade de alerta</p>
            <div className="space-y-3">
              {(Object.keys(priorityLabels) as AlertPriority[]).map((priority) => (
                <motion.div key={priority} className={`flex items-center gap-3 p-3 rounded-xl ${priorityLabels[priority].bgClass} border border-border/30`} whileHover={{ scale: 1.01 }}>
                  <div className="w-20">
                    <span className={`text-sm font-semibold ${priorityLabels[priority].colorClass}`}>{priorityLabels[priority].label}</span>
                  </div>
                  <Select value={priorityTones[priority]} onValueChange={(value: ToneType) => setPriorityTone(priority, value)}>
                    <SelectTrigger className="flex-1 bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_TONES.map((tone) => (
                        <SelectItem key={tone.type} value={tone.type}>
                          <div className="flex flex-col">
                            <span>{tone.label}</span>
                            <span className="text-xs text-muted-foreground">{tone.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => previewTone(priorityTones[priority])} disabled={priorityTones[priority] === 'silent'} className="flex-shrink-0 hover:bg-background/50">
                    <Play className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
          <Separator className="bg-border/50" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestSound} className="gap-2"><Play className="w-4 h-4" />Testar som</Button>
            <Button variant="ghost" size="sm" onClick={resetSoundDefaults} className="gap-2"><RotateCcw className="w-4 h-4" />Restaurar padrões</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
