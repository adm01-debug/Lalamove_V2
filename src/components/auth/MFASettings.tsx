import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, Trash2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMFA } from '@/hooks/useMFA';
import { MFAEnroll } from './MFAEnroll';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function MFASettings() {
  const { factors, isMFAEnabled, disableMFA, isDisabling, loadingFactors } = useMFA();
  const [showEnroll, setShowEnroll] = useState(false);
  const [factorToRemove, setFactorToRemove] = useState<string | null>(null);

  if (loadingFactors) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (showEnroll) {
    return (
      <MFAEnroll
        onSuccess={() => setShowEnroll(false)}
        onCancel={() => setShowEnroll(false)}
      />
    );
  }

  return (
    <>
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMFAEnabled ? (
                <div className="p-2 rounded-lg bg-success/10">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-warning/10">
                  <ShieldOff className="h-5 w-5 text-warning" />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">Autenticação de Dois Fatores</CardTitle>
                <CardDescription>
                  {isMFAEnabled 
                    ? 'Sua conta está protegida com MFA' 
                    : 'Adicione uma camada extra de segurança'}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isMFAEnabled ? 'default' : 'secondary'}>
              {isMFAEnabled ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence mode="wait">
            {factors.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {factors.map((factor) => (
                  <motion.div
                    key={factor.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{factor.friendly_name || 'Authenticator'}</p>
                        <p className="text-sm text-muted-foreground">
                          Adicionado {formatDistanceToNow(new Date(factor.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={factor.status === 'verified' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {factor.status === 'verified' ? 'Verificado' : 'Pendente'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setFactorToRemove(factor.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhum método de autenticação configurado
                </p>
                <Button onClick={() => setShowEnroll(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Configurar MFA
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {factors.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setShowEnroll(true)}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar outro método
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!factorToRemove} onOpenChange={() => setFactorToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover MFA?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desabilitar a autenticação de dois fatores para este método. 
              Sua conta ficará menos segura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (factorToRemove) {
                  disableMFA(factorToRemove);
                  setFactorToRemove(null);
                }
              }}
              disabled={isDisabling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisabling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
