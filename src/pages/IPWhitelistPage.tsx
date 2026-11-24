import { useState, useMemo } from 'react';
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { Shield, Plus, Trash2, Globe, Check, X, Network, RefreshCw, Edit2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';
import { AddEditIPDialog, DeleteIPDialog } from './ip-whitelist/IPWhitelistDialogs';

const ipSchema = z.object({
  ip_address: z.string().min(7).max(45).regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Formato de IP inválido'),
  description: z.string().min(1, 'Descrição obrigatória').max(255),
  cidr_range: z.string().optional(),
});

interface IPWhitelistEntry {
  id: string; ip_address: string; description: string; cidr_range: string | null;
  is_active: boolean; added_by: string | null; created_at: string; updated_at: string;
}

export default function IPWhitelistPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<IPWhitelistEntry | null>(null);
  const [formData, setFormData] = useState({ ip_address: '', description: '', cidr_range: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: entries, isLoading, refetch, error } = useQuery({
    queryKey: ['ip-whitelist'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ip_whitelist').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as IPWhitelistEntry[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('ip_whitelist').insert({ ip_address: data.ip_address, description: data.description, cidr_range: data.cidr_range || null, added_by: user?.id, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] }); toast.success('IP adicionado à whitelist'); setShowAddDialog(false); resetForm(); },
    onError: (error: Error) => { toast.error(`Erro: ${error.message}`); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IPWhitelistEntry> }) => {
      const { error } = await supabase.from('ip_whitelist').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] }); toast.success('IP atualizado'); },
    onError: (error: Error) => { toast.error(`Erro: ${error.message}`); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ip_whitelist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ip-whitelist'] }); toast.success('IP removido'); setShowDeleteDialog(false); setSelectedEntry(null); },
    onError: (error: Error) => { toast.error(`Erro: ${error.message}`); },
  });

  const resetForm = () => { setFormData({ ip_address: '', description: '', cidr_range: '' }); setErrors({}); setSelectedEntry(null); };

  const handleSubmit = () => {
    try {
      ipSchema.parse(formData);
      setErrors({});
      if (selectedEntry) {
        updateMutation.mutate({ id: selectedEntry.id, data: { ip_address: formData.ip_address, description: formData.description, cidr_range: formData.cidr_range || null } });
        setShowAddDialog(false); resetForm();
      } else { addMutation.mutate(formData); }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(err => { if (err.path[0]) fieldErrors[err.path[0] as string] = err.message; });
        setErrors(fieldErrors);
      }
    }
  };

  const handleEdit = (entry: IPWhitelistEntry) => { setSelectedEntry(entry); setFormData({ ip_address: entry.ip_address, description: entry.description, cidr_range: entry.cidr_range || '' }); setShowAddDialog(true); };
  const handleToggleActive = (entry: IPWhitelistEntry) => { updateMutation.mutate({ id: entry.id, data: { is_active: !entry.is_active } }); };

  const entrySearchKeys = useMemo(() => ['ip_address', 'description'], []);
  const entrySearchResults = useFuseSearchWithMatches(entries || [], entrySearchKeys, searchTerm);
  const filteredEntries = searchTerm.trim() ? entrySearchResults.map(r => ({ ...r.item, _matches: r.matches })) : (entries || []);
  const activeCount = entries?.filter(e => e.is_active).length || 0;
  const inactiveCount = entries?.filter(e => !e.is_active).length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="font-semibold text-lg">Não foi possível carregar a whitelist de IPs</h3>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PermissionGate permission="security.manage" showLocked>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success/10 border border-success/20"><Shield className="h-6 w-6 text-success" /></div>
              IP Whitelist
            </h2>
            <p className="text-muted-foreground mt-1">Gerencie IPs permitidos para acesso ao sistema</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }}><Plus className="h-4 w-4 mr-2" />Adicionar IP</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Network, label: 'Total de IPs', value: entries?.length || 0, color: 'primary' },
            { icon: Check, label: 'Ativos', value: activeCount, color: 'success' },
            { icon: X, label: 'Inativos', value: inactiveCount, color: 'muted-foreground' },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl", `bg-${stat.color}/10`)}><stat.icon className={cn("h-6 w-6", `text-${stat.color}`)} /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className={cn("text-2xl font-bold", `text-${stat.color}`)}>{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card><CardContent className="pt-6"><SearchInputWithHelp value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por IP ou descrição..." /></CardContent></Card>

        <Card>
          <CardHeader><CardTitle>IPs na Whitelist</CardTitle><CardDescription>IPs listados aqui têm acesso permitido ao sistema</CardDescription></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-12"><Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">{searchTerm ? 'Nenhum IP encontrado' : 'Nenhum IP na whitelist'}</p></div>
                ) : filteredEntries.map((entry, index) => (
                  <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.05 }}
                    className={cn("flex items-center justify-between p-4 rounded-lg border transition-colors", entry.is_active ? "bg-success/5 border-success/20" : "bg-muted/30 border-border")}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2 rounded-lg", entry.is_active ? "bg-success/10" : "bg-muted")}>
                        <Globe className={cn("h-5 w-5", entry.is_active ? "text-success" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold text-foreground">{entry.ip_address}</code>
                          {entry.cidr_range && <Badge variant="outline" className="text-xs">CIDR: {entry.cidr_range}</Badge>}
                          <Badge variant={entry.is_active ? "default" : "secondary"} className={cn(entry.is_active && "bg-success hover:bg-success/90")}>{entry.is_active ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{entry.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Adicionado em {new Date(entry.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={entry.is_active} onCheckedChange={() => handleToggleActive(entry)} />
                      <Button variant="ghost" size="icon" aria-label="Editar entrada" className="min-h-11 min-w-11 md:h-10 md:w-10" onClick={() => handleEdit(entry)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Excluir entrada" className="text-destructive hover:text-destructive min-h-11 min-w-11 md:h-10 md:w-10" onClick={() => { setSelectedEntry(entry); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        <AddEditIPDialog open={showAddDialog} onOpenChange={setShowAddDialog} formData={formData} setFormData={setFormData} errors={errors} isEditing={!!selectedEntry} isPending={addMutation.isPending || updateMutation.isPending} onSubmit={handleSubmit} onReset={resetForm} />
        <DeleteIPDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} ipAddress={selectedEntry?.ip_address} isPending={deleteMutation.isPending} onConfirm={() => selectedEntry && deleteMutation.mutate(selectedEntry.id)} />
      </div>
    </PermissionGate>
  );
}
