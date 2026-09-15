import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Shield, Calendar, Activity, Crown, Clock, CheckCircle2, Save, Edit2, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayName } from '@/lib/user-display';
import { toast } from 'sonner';

function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id ?? '6758071f-faa3-4c17-9e2d-b1f1ee492608';
  const userEmail = user?.email ?? 'ti@promobrindes.com.br';
  const totalPermissions = 28;

  // Nome de exibição vem de user_metadata (full_name ou name) ou fallback do email
  const initialName = getDisplayName(user) ?? userEmail.split('@')[0];

  const [displayName, setDisplayName] = useState<string>(initialName);
  const [editName, setEditName] = useState<string>(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reage a mudanças no user (ex: após salvar)
  useEffect(() => {
    const current = getDisplayName(user) ?? userEmail.split('@')[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayName(current);
    setEditName(current);
  }, [user?.user_metadata?.full_name, user?.user_metadata?.name, userEmail]);

  const handleEdit = () => {
    setEditName(displayName);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditName(displayName);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('O nome não pode estar vazio');
      return;
    }
    if (trimmedName === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: trimmedName, name: trimmedName },
      });

      if (error) throw error;

      setDisplayName(trimmedName);
      setIsEditing(false);
      toast.success('Nome atualizado com sucesso!', {
        description: 'O nome foi salvo e aparecerá em toda a aplicação.',
      });

      // Recarrega a sessão para garantir que o user_metadata está atualizado
      await supabase.auth.refreshSession();
    } catch (err) {
      const error = err as Error;
      toast.error(`Erro ao atualizar nome: ${error.message}`);
      console.error('Erro ao atualizar nome:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground">Informações da sua conta e permissões</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações da Conta
            </CardTitle>
            <CardDescription>Seus dados de identificação no sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campo Nome - editável */}
            <div className="p-3 rounded-lg bg-secondary/30">
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 mt-2 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Nome de exibição</p>
                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isSaving}
                        maxLength={80}
                        autoFocus
                        placeholder="Digite seu nome"
                        className="h-9"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isSaving) handleSave();
                          if (e.key === 'Escape' && !isSaving) handleCancel();
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-9 px-3"
                        aria-label="Salvar nome"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="h-9 px-3"
                        aria-label="Cancelar edição"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleEdit}
                        className="h-7 px-2"
                        aria-label="Editar nome"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
              <Mail className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-mono text-sm">{userEmail}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
              <Shield className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">ID do Usuário</p>
                <p className="font-mono text-xs text-muted-foreground break-all">{userId}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
              <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Conta criada em</p>
                <p className="text-sm">28/08/2026, 14:22</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
              <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Último acesso</p>
                <p className="text-sm">Agora</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-warning" />
              Suas Roles
            </CardTitle>
            <CardDescription>Permissões atribuídas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Badge variant="default" className="w-full justify-center py-2">
                <Crown className="w-3 h-3 mr-1" />
                Administrador
              </Badge>
            </div>

            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Permissões ativas:</span>
                <span className="font-bold text-primary">{totalPermissions}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-warning" />
                <p className="text-xs font-medium text-warning">Acesso Total</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Você tem acesso completo ao sistema.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Atividade da Conta
          </CardTitle>
          <CardDescription>Estatísticas de uso e engajamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">Total de Logins</p>
              </div>
              <p className="text-2xl font-bold text-primary">142</p>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <p className="text-xs text-muted-foreground">Status</p>
              </div>
              <p className="text-2xl font-bold text-success">Ativo</p>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-warning" />
                <p className="text-xs text-muted-foreground">Permissões</p>
              </div>
              <p className="text-2xl font-bold text-warning">{totalPermissions}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProfilePage;
