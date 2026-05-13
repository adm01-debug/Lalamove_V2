import { Save, RotateCcw, Loader2, Settings, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useAlertSettings } from '@/hooks/useAlertSettings';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { StoppedDriverCard } from './settings/StoppedDriverCard';
import { RouteDeviationCard } from './settings/RouteDeviationCard';
import { LateDeliveryCard } from './settings/LateDeliveryCard';
import { SoundSettingsCard } from './settings/SoundSettingsCard';
import { PushNotificationsCard } from './settings/PushNotificationsCard';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
} as const;

export function SettingsPage() {
  const { settings, loading, saving, hasChanges, saveSettings, updateSetting, resetToDefaults } = useAlertSettings();
  const { isEnabled: soundEnabled, volume: soundVolume, priorityTones, toggleSound, setVolume, setPriorityTone, resetToDefaults: resetSoundDefaults } = useSoundSettings();
  const { isSupported: pushSupported, permission: pushPermission, settings: pushSettings, requestPermission, toggleEnabled: togglePushEnabled, toggleCriticalOnly: togglePushCriticalOnly, sendTestNotification } = usePushNotifications();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 animate-ping" />
          </div>
          <p className="text-muted-foreground animate-pulse">Carregando configurações...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div className="p-6 max-w-4xl mx-auto space-y-6" variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-accent to-primary/50 flex items-center justify-center shadow-lg" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
            <Settings className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Configurações de Alertas</h2>
            <p className="text-muted-foreground">Ajuste os limites e comportamentos dos alertas automáticos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefaults} disabled={saving} className="gap-2"><RotateCcw className="w-4 h-4" />Restaurar</Button>
          <Button onClick={saveSettings} disabled={!hasChanges || saving} className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Salvar
          </Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}><StoppedDriverCard settings={settings} onUpdate={updateSetting} /></motion.div>
      <motion.div variants={itemVariants}><RouteDeviationCard settings={settings} onUpdate={updateSetting} /></motion.div>
      <motion.div variants={itemVariants}><LateDeliveryCard settings={settings} onUpdate={updateSetting} /></motion.div>
      <motion.div variants={itemVariants}>
        <SoundSettingsCard soundEnabled={soundEnabled} soundVolume={soundVolume} priorityTones={priorityTones} toggleSound={toggleSound} setVolume={setVolume} setPriorityTone={setPriorityTone} resetSoundDefaults={resetSoundDefaults} />
      </motion.div>
      <motion.div variants={itemVariants}>
        <PushNotificationsCard pushSupported={pushSupported} pushPermission={pushPermission} pushSettings={pushSettings} requestPushPermission={requestPermission} togglePushEnabled={togglePushEnabled} togglePushCriticalOnly={togglePushCriticalOnly} sendTestNotification={sendTestNotification} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card variant="gradient" className="overflow-hidden border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5 text-primary" /></div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Como funcionam os alertas automáticos?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Os alertas são verificados automaticamente a cada vez que a simulação de movimento é executada. Quando uma condição de alerta é detectada (motorista parado, fora da rota, etc.), um alerta é criado e exibido em tempo real na interface. Os alertas são automaticamente dispensados quando as condições voltam ao normal. Com notificações push ativas, você receberá alertas mesmo quando a aba não estiver em foco.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
