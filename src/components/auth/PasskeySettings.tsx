import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Smartphone,
  Laptop,
  Shield,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export function PasskeySettings() {
  const {
    isSupported,
    passkeys,
    loadingPasskeys,
    hasPasskeys,
    checkPlatformAuthenticator,
    registerPasskey,
    isRegistering,
    removePasskey,
    isRemoving,
    renamePasskey,
    isRenaming,
  } = useWebAuthn();

  const [hasPlatformAuth, setHasPlatformAuth] = useState<boolean | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    checkPlatformAuthenticator().then(setHasPlatformAuth);
  }, [checkPlatformAuthenticator]);

  const getDeviceIcon = (deviceType: string | null) => {
    if (!deviceType) return <Fingerprint className="h-5 w-5" />;
    const type = deviceType.toLowerCase();
    if (type.includes('iphone') || type.includes('android') || type.includes('mobile')) {
      return <Smartphone className="h-5 w-5" />;
    }
    return <Laptop className="h-5 w-5" />;
  };

  const handleRegister = async () => {
    try {
      await registerPasskey(newPasskeyName || undefined);
      setShowAddDialog(false);
      setNewPasskeyName('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRename = (passkeyId: string) => {
    if (editName.trim()) {
      renamePasskey({ passkeyId, name: editName.trim() });
      setEditingId(null);
      setEditName('');
    }
  };

  const startEditing = (passkey: { id: string; friendly_name: string | null }) => {
    setEditingId(passkey.id);
    setEditName(passkey.friendly_name || '');
  };

  if (!isSupported) {
    return (
      <Card className="border-warning/20 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            Passkeys não suportadas
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta WebAuthn/Passkeys. Tente usar um navegador mais recente 
            como Chrome, Safari, Firefox ou Edge.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (hasPlatformAuth === false) {
    return (
      <Card className="border-warning/20 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertCircle className="h-5 w-5" />
            Autenticador biométrico não disponível
          </CardTitle>
          <CardDescription>
            Seu dispositivo não possui um autenticador biométrico configurado (Touch ID, Face ID, 
            Windows Hello, etc). Configure um nas configurações do sistema para usar Passkeys.
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
            <div className="p-2 rounded-lg bg-primary/10">
              <Fingerprint className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Passkeys / Login Biométrico</CardTitle>
              <CardDescription>
                Use impressão digital ou reconhecimento facial para login seguro
              </CardDescription>
            </div>
          </div>
          <Badge variant={hasPasskeys ? 'default' : 'secondary'}>
            {hasPasskeys ? `${passkeys.length} ativa(s)` : 'Nenhuma'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info box */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Segurança aprimorada com Passkeys</p>
              <p className="text-muted-foreground">
                Passkeys são mais seguras que senhas tradicionais. Elas usam criptografia 
                avançada e sua biometria nunca sai do seu dispositivo.
              </p>
            </div>
          </div>
        </div>

        {/* Passkeys list */}
        {loadingPasskeys ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando passkeys...
          </div>
        ) : passkeys.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {passkeys.map((passkey, index) => (
                <motion.div
                  key={passkey.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {getDeviceIcon(passkey.device_type)}
                    </div>
                    <div>
                      {editingId === passkey.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 w-48"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRename(passkey.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleRename(passkey.id)}
                            disabled={isRenaming}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium">
                            {passkey.friendly_name || passkey.device_type || 'Passkey'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criada {formatDistanceToNow(new Date(passkey.created_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                            {passkey.last_used_at && (
                              <> · Último uso: {formatDistanceToNow(new Date(passkey.last_used_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}</>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {editingId !== passkey.id && (
                    <div className="flex items-center gap-2">
                      {passkey.backed_up && (
                        <Badge variant="outline" className="text-xs">
                          Sincronizada
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEditing(passkey)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover Passkey?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Você não poderá mais usar esta 
                              passkey para fazer login.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removePasskey(passkey.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isRemoving ? 'Removendo...' : 'Remover'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-8">
            <Fingerprint className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Nenhuma passkey registrada</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              Adicione uma passkey para fazer login de forma rápida e segura usando 
              sua impressão digital ou reconhecimento facial.
            </p>
          </div>
        )}

        {/* Add passkey dialog */}
        <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <AlertDialogTrigger asChild>
            <Button className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Passkey
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Registrar Nova Passkey
              </AlertDialogTitle>
              <AlertDialogDescription>
                Você será solicitado a usar sua biometria (impressão digital ou rosto) 
                para criar uma nova passkey.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium">
                Nome da passkey (opcional)
              </label>
              <Input
                value={newPasskeyName}
                onChange={(e) => setNewPasskeyName(e.target.value)}
                placeholder="Ex: MacBook Pro, iPhone"
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button onClick={handleRegister} disabled={isRegistering}>
                {isRegistering ? (
                  <>Aguardando biometria...</>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Registrar
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
