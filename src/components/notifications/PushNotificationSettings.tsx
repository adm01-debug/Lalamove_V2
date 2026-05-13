import React from 'react';
import { Bell, BellOff, BellRing, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSecurityPushNotifications } from '@/hooks/useSecurityPushNotifications';
import { motion } from 'framer-motion';

export function PushNotificationSettings() {
  const { isSupported, permission, requestPermission, isEnabled, showNotification } = useSecurityPushNotifications();

  const handleTestNotification = () => {
    showNotification({
      title: '🔔 Teste de Notificação',
      body: 'Esta é uma notificação de teste do sistema de segurança.',
      tag: 'test-' + Date.now(),
    });
  };

  if (!isSupported) {
    return (
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600">
            <BellOff className="h-5 w-5" />
            Notificações não suportadas
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push. Tente usar um navegador mais recente.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
              {isEnabled ? (
                <BellRing className="h-5 w-5 text-green-500" />
              ) : (
                <Bell className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Notificações Push</CardTitle>
              <CardDescription>
                Receba alertas de segurança em tempo real no navegador
              </CardDescription>
            </div>
          </div>
          <Badge variant={isEnabled ? 'default' : 'secondary'}>
            {isEnabled ? 'Ativo' : permission === 'denied' ? 'Bloqueado' : 'Desativado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {permission === 'denied' ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              As notificações foram bloqueadas. Para ativá-las, clique no ícone de cadeado 
              na barra de endereços do navegador e permita notificações.
            </p>
          </div>
        ) : isEnabled ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-700 dark:text-green-400">
                Você receberá notificações sobre:
              </p>
            </div>
            <ul className="space-y-2 ml-6 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Login de novo dispositivo
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Tentativas de login falhas
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                IPs bloqueados
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Atividades MFA
              </li>
            </ul>
            <Button variant="outline" size="sm" onClick={handleTestNotification}>
              <Bell className="h-4 w-4 mr-2" />
              Enviar Notificação de Teste
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ative as notificações push para receber alertas de segurança importantes 
              diretamente no navegador, mesmo quando não estiver usando o app.
            </p>
            <Button onClick={requestPermission}>
              <Bell className="h-4 w-4 mr-2" />
              Ativar Notificações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
