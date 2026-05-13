import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Settings, Moon, Sun, Monitor, Clock, Bell, Volume2, VolumeX, 
  Globe, Eye, Accessibility, Palette, Check, RotateCcw, Sparkles,
  Languages, Keyboard, MousePointer2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supportedLanguages } from '@/i18n';
import { useScheduledTheme } from '@/hooks/useScheduledTheme';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function UserPreferencesPage() {
  const { t, i18n } = useTranslation();
  const theme = useScheduledTheme();
  const sound = useSoundSettings();
  const push = usePushNotifications();

  // Accessibility settings
  const [accessibility, setAccessibility] = useState({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: false,
    largerText: false,
    focusIndicators: true,
  });

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    toast.success(t('settings.languageChanged', 'Idioma alterado com sucesso!'));
  };

  const handleResetAll = () => {
    theme.setMode('auto');
    theme.disableSchedule();
    sound.resetToDefaults();
    setAccessibility({
      reducedMotion: false,
      highContrast: false,
      largerText: false,
      focusIndicators: true,
    });
    toast.success(t('settings.resetSuccess', 'Configurações restauradas!'));
  };

  return (
    <motion.div
      className="p-6 max-w-4xl mx-auto space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-accent to-primary/50 flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Settings className="w-7 h-7 text-white" />
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold">{t('settings.preferences', 'Preferências do Usuário')}</h2>
            <p className="text-muted-foreground">{t('settings.preferencesDesc', 'Personalize sua experiência no sistema')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleResetAll} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          {t('common.reset', 'Restaurar')}
        </Button>
      </motion.div>

      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">{t('settings.appearance', 'Aparência')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">{t('settings.notifications', 'Notificações')}</span>
          </TabsTrigger>
          <TabsTrigger value="language" className="gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{t('settings.language', 'Idioma')}</span>
          </TabsTrigger>
          <TabsTrigger value="accessibility" className="gap-2">
            <Accessibility className="w-4 h-4" />
            <span className="hidden sm:inline">{t('settings.accessibility', 'Acessibilidade')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card variant="glass" hover="lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  {t('settings.themeMode', 'Modo do Tema')}
                </CardTitle>
                <CardDescription>{t('settings.themeModeDesc', 'Escolha como o tema é aplicado')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup
                  value={theme.mode}
                  onValueChange={(value) => theme.setMode(value as 'light' | 'dark' | 'auto' | 'scheduled')}
                  className="grid grid-cols-2 gap-4"
                >
                  {[
                    { value: 'light', icon: Sun, label: t('settings.themeLight', 'Claro') },
                    { value: 'dark', icon: Moon, label: t('settings.themeDark', 'Escuro') },
                    { value: 'auto', icon: Monitor, label: t('settings.themeAuto', 'Sistema') },
                    { value: 'scheduled', icon: Clock, label: t('settings.themeScheduled', 'Agendado') },
                  ].map(({ value, icon: Icon, label }) => (
                    <Label
                      key={value}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        theme.mode === value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={value} className="sr-only" />
                      <Icon className={`w-5 h-5 ${theme.mode === value ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-medium">{label}</span>
                      {theme.mode === value && <Check className="w-4 h-4 text-primary ml-auto" />}
                    </Label>
                  ))}
                </RadioGroup>

                {/* Schedule Settings */}
                {theme.mode === 'scheduled' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-4 border-t"
                  >
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {t('settings.scheduleSettings', 'Configurações de Agendamento')}
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="darkStart">{t('settings.darkModeStart', 'Início modo escuro')}</Label>
                        <Input
                          id="darkStart"
                          type="time"
                          value={theme.schedule.darkModeStart}
                          onChange={(e) => theme.setSchedule({ darkModeStart: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="darkEnd">{t('settings.darkModeEnd', 'Fim modo escuro')}</Label>
                        <Input
                          id="darkEnd"
                          type="time"
                          value={theme.schedule.darkModeEnd}
                          onChange={(e) => theme.setSchedule({ darkModeEnd: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.scheduleNote', 'O tema escuro será ativado automaticamente entre os horários configurados.')}
                    </p>
                  </motion.div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    {t('settings.currentTheme', 'Tema atual')}: <Badge variant="secondary">{theme.resolvedTheme === 'dark' ? 'Escuro' : 'Claro'}</Badge>
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card variant="glass" hover="lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {sound.isEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
                  {t('settings.soundNotifications', 'Sons de Notificação')}
                </CardTitle>
                <CardDescription>{t('settings.soundNotificationsDesc', 'Configure alertas sonoros')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label>{t('settings.enableSounds', 'Ativar sons')}</Label>
                  <Switch checked={sound.isEnabled} onCheckedChange={sound.toggleSound} />
                </div>

                {sound.isEnabled && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>{t('settings.volume', 'Volume')}</Label>
                        <Badge variant="secondary">{sound.volume}%</Badge>
                      </div>
                      <Slider
                        value={[sound.volume]}
                        onValueChange={([value]) => sound.setVolume(value)}
                        min={10}
                        max={100}
                        step={10}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card variant="glass" hover="lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  {t('settings.pushNotifications', 'Notificações Push')}
                </CardTitle>
                <CardDescription>{t('settings.pushNotificationsDesc', 'Receba alertas mesmo quando não estiver na página')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {push.permission === 'granted' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>{t('settings.enablePush', 'Ativar notificações push')}</Label>
                      <Switch checked={push.settings.enabled} onCheckedChange={push.toggleEnabled} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>{t('settings.criticalOnly', 'Apenas alertas críticos')}</Label>
                      <Switch checked={push.settings.criticalOnly} onCheckedChange={push.toggleCriticalOnly} />
                    </div>
                  </>
                ) : (
                  <Button onClick={push.requestPermission} className="gap-2">
                    <Bell className="w-4 h-4" />
                    {t('settings.enablePushButton', 'Ativar notificações')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Language Tab */}
        <TabsContent value="language" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card variant="glass" hover="lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-primary" />
                  {t('settings.selectLanguage', 'Selecionar Idioma')}
                </CardTitle>
                <CardDescription>{t('settings.selectLanguageDesc', 'Escolha o idioma da interface')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={i18n.language}
                  onValueChange={handleLanguageChange}
                  className="space-y-3"
                >
                  {supportedLanguages.map((lang) => (
                    <Label
                      key={lang.code}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        i18n.language === lang.code
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <RadioGroupItem value={lang.code} className="sr-only" />
                      <span className="text-2xl">{lang.flag}</span>
                      <span className="font-medium flex-1">{lang.name}</span>
                      {i18n.language === lang.code && <Check className="w-5 h-5 text-primary" />}
                    </Label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-6">
          <motion.div variants={itemVariants}>
            <Card variant="glass" hover="lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  {t('settings.visualSettings', 'Configurações Visuais')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.reducedMotion', 'Reduzir animações')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.reducedMotionDesc', 'Minimiza efeitos de movimento')}</p>
                  </div>
                  <Switch
                    checked={accessibility.reducedMotion}
                    onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, reducedMotion: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.highContrast', 'Alto contraste')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.highContrastDesc', 'Aumenta o contraste das cores')}</p>
                  </div>
                  <Switch
                    checked={accessibility.highContrast}
                    onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, highContrast: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.largerText', 'Texto maior')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.largerTextDesc', 'Aumenta o tamanho da fonte')}</p>
                  </div>
                  <Switch
                    checked={accessibility.largerText}
                    onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, largerText: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card variant="glass" hover="lift">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-primary" />
                  {t('settings.keyboardNavigation', 'Navegação por Teclado')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.focusIndicators', 'Indicadores de foco visíveis')}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.focusIndicatorsDesc', 'Destaca elementos selecionados')}</p>
                  </div>
                  <Switch
                    checked={accessibility.focusIndicators}
                    onCheckedChange={(checked) => setAccessibility(prev => ({ ...prev, focusIndicators: checked }))}
                  />
                </div>
                
                <Separator />
                
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <Label className="font-medium">{t('settings.shortcuts', 'Atalhos Disponíveis')}</Label>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('settings.shortcutSearch', 'Busca rápida')}</span>
                      <kbd className="px-2 py-1 bg-background rounded border text-xs">Ctrl+K</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('settings.shortcutTheme', 'Alternar tema')}</span>
                      <kbd className="px-2 py-1 bg-background rounded border text-xs">Ctrl+Shift+T</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('settings.shortcutHelp', 'Ver atalhos')}</span>
                      <kbd className="px-2 py-1 bg-background rounded border text-xs">?</kbd>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
