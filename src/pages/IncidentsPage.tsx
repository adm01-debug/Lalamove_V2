import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useFuseSearchWithMatches, type WithMatches } from '@/hooks/useFuseSearch';
import { HighlightText } from '@/components/ui/highlight-match';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, Loader2, Trash2, Sparkles, Clock, XCircle, AlertCircle, FileWarning, Filter, Plus } from 'lucide-react';
import { useIncidents, useCreateIncident, useResolveIncident, useDeleteIncident, Incident, CreateIncidentInput } from '@/hooks/useIncidents';
import { useDrivers } from '@/hooks/useDrivers';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DataRefreshIndicator } from '@/components/ui/data-refresh-indicator';
import { CreateIncidentDialog, ResolveIncidentDialog } from './incidents/IncidentDialogs';

const typeLabels: Record<string, string> = { ROUTE_DEVIATION: 'Desvio de Rota', LONG_STOP: 'Parada Longa', LATE_DELIVERY: 'Atraso na Entrega', CUSTOMER_COMPLAINT: 'Reclamação', DAMAGE: 'Dano', OTHER: 'Outro' };
const typeIcons: Record<string, typeof AlertTriangle> = { ROUTE_DEVIATION: AlertTriangle, LONG_STOP: Clock, LATE_DELIVERY: AlertCircle, CUSTOMER_COMPLAINT: FileWarning, DAMAGE: XCircle, OTHER: AlertTriangle };
const severityConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'destructive'; color: string; bg: string; border: string }> = {
  LOW: { label: 'Baixa', variant: 'secondary', color: 'text-muted-foreground', bg: 'bg-secondary/50', border: 'border-border/50' },
  MEDIUM: { label: 'Média', variant: 'warning', color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  HIGH: { label: 'Alta', variant: 'destructive', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
  CRITICAL: { label: 'Crítica', variant: 'destructive', color: 'text-destructive', bg: 'bg-destructive/20', border: 'border-destructive/50' },
};

export function IncidentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [formDriverId, setFormDriverId] = useState('');
  const [formType, setFormType] = useState('');
  const [formSeverity, setFormSeverity] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: incidents, isLoading } = useIncidents();
  const { data: drivers } = useDrivers();
  const createMutation = useCreateIncident();
  const resolveMutation = useResolveIncident();
  const deleteMutation = useDeleteIncident();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => { setIsRefreshing(true); await queryClient.invalidateQueries({ queryKey: ['incidents'] }); await queryClient.invalidateQueries({ queryKey: ['drivers'] }); setLastRefreshed(new Date()); setIsRefreshing(false); }, [queryClient]);

  const incidentSearchKeys = useMemo(() => ['description', 'driverName'], []);
  const incidentSearchResults = useFuseSearchWithMatches(incidents || [], incidentSearchKeys, searchQuery);
  const filteredIncidents = useMemo(() => {
    const list = searchQuery.trim() ? incidentSearchResults.map(r => ({ ...r.item, _matches: r.matches })) : (incidents || []);
    return list.filter(inc => statusFilter === 'ALL' || (statusFilter === 'OPEN' && !inc.resolved) || (statusFilter === 'RESOLVED' && inc.resolved));
  }, [incidents, incidentSearchResults, searchQuery, statusFilter]);

  const handleCreate = () => {
    if (!formDriverId || !formType || !formSeverity || !formDescription) return;
    createMutation.mutate({ driver_id: formDriverId, type: formType as CreateIncidentInput['type'], severity: formSeverity as CreateIncidentInput['severity'], description: formDescription }, {
      onSuccess: () => { setCreateDialogOpen(false); setFormDriverId(''); setFormType(''); setFormSeverity(''); setFormDescription(''); }
    });
  };
  const handleResolve = () => { if (!selectedIncident) return; resolveMutation.mutate({ id: selectedIncident.id, notes: resolutionNotes }, { onSuccess: () => { setResolveDialogOpen(false); setSelectedIncident(null); setResolutionNotes(''); } }); };
  const openResolveDialog = (incident: Incident) => { setSelectedIncident(incident); setResolutionNotes(''); setResolveDialogOpen(true); };

  const openCount = incidents?.filter(i => !i.resolved).length || 0;
  const resolvedCount = incidents?.filter(i => i.resolved).length || 0;
  const criticalCount = incidents?.filter(i => !i.resolved && (i.severity === 'HIGH' || i.severity === 'CRITICAL')).length || 0;

  if (isLoading) return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="relative inline-block"><div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-full blur-xl opacity-50 animate-pulse" /><Loader2 className="w-12 h-12 text-primary animate-spin relative" /></div>
        <p className="text-muted-foreground mt-4">Carregando incidentes...</p>
      </motion.div>
    </div>
  );

  const statsCards = [
    { label: 'Total', value: incidents?.length || 0, icon: AlertTriangle, color: 'primary' },
    { label: 'Em Aberto', value: openCount, icon: Clock, color: 'warning' },
    { label: 'Críticos', value: criticalCount, icon: XCircle, color: 'destructive' },
    { label: 'Resolvidos', value: resolvedCount, icon: CheckCircle2, color: 'success' },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <motion.div className="relative" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ type: 'spring', stiffness: 400 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/50 to-warning/50 rounded-xl md:rounded-2xl blur-xl opacity-50" />
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-br from-destructive/20 via-warning/20 to-primary/20 flex items-center justify-center border border-destructive/20 shadow-lg"><AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-destructive" /></div>
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent truncate">Incidentes</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs md:text-sm text-muted-foreground">{openCount} em aberto</p>
                <div className="md:hidden"><DataRefreshIndicator lastUpdated={lastRefreshed} isRefreshing={isRefreshing} variant="minimal" /></div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block"><DataRefreshIndicator lastUpdated={lastRefreshed} isRefreshing={isRefreshing} onRefresh={handleRefresh} variant="compact" /></div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 h-9 md:h-10 text-xs md:text-sm"><Plus className="w-4 h-4 mr-1 md:mr-2" /><span className="hidden xs:inline">Novo</span> Incidente</Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          {statsCards.map((stat, index) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card variant="glass" hover="lift" className="overflow-hidden">
                <div className={cn("h-1 bg-gradient-to-r", `from-${stat.color} to-${stat.color}/50`)} />
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className={cn("p-2 md:p-2.5 rounded-lg md:rounded-xl border shrink-0", `bg-${stat.color}/10 border-${stat.color}/30`)}><stat.icon className={cn("w-4 h-4 md:w-5 md:h-5", `text-${stat.color}`)} /></div>
                    <div className="min-w-0"><p className={cn("text-lg md:text-2xl font-bold", `text-${stat.color}`)}>{stat.value}</p><p className="text-[10px] md:text-xs text-muted-foreground truncate">{stat.label}</p></div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card variant="glass" className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1"><SearchInputWithHelp value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por descrição ou motorista..." inputClassName="bg-secondary/30 border-border/50" /></div>
            <div className="flex gap-2">
              {(['ALL', 'OPEN', 'RESOLVED'] as const).map(status => (
                <Button key={status} variant={statusFilter === status ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(status)} className={cn("transition-all", statusFilter === status ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20" : "bg-background/50 border-border/50 hover:bg-secondary/50")}>
                  {status === 'ALL' ? <><Filter className="w-3 h-3 mr-1" />Todos</> : status === 'OPEN' ? <><Clock className="w-3 h-3 mr-1" />Em Aberto</> : <><CheckCircle2 className="w-3 h-3 mr-1" />Resolvidos</>}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredIncidents.map((incident, index) => {
              const severity = severityConfig[incident.severity];
              const TypeIcon = typeIcons[incident.type] || AlertTriangle;
              return (
                <motion.div key={incident.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: index * 0.03 }}>
                  <Card variant="glass" className={cn("overflow-hidden", !incident.resolved && severity.bg)}>
                    <div className={cn("h-1", severity.bg.replace('/10', ''))} />
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("p-1.5 rounded-lg shrink-0", severity.bg, severity.border)}><TypeIcon className={cn("w-4 h-4", severity.color)} /></div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{searchQuery.trim() && (incident as WithMatches<typeof incident>)._matches ? <HighlightText text={incident.driverName || ''} matches={(incident as WithMatches<typeof incident>)._matches} matchKey="driverName" /> : incident.driverName}</p>
                            <p className="text-xs text-muted-foreground">{typeLabels[incident.type] || incident.type}</p>
                          </div>
                        </div>
                        <Badge variant={severity.variant} className="shadow-sm text-[10px] px-1.5 shrink-0">{severity.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{searchQuery.trim() && (incident as WithMatches<typeof incident>)._matches ? <HighlightText text={incident.description} matches={(incident as WithMatches<typeof incident>)._matches} matchKey="description" /> : incident.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="w-3 h-3" />{format(incident.createdAt, "dd/MM HH:mm", { locale: ptBR })}</div>
                          {incident.resolved ? <Badge variant="success" className="shadow-sm text-[10px] px-1.5"><CheckCircle2 className="w-3 h-3 mr-0.5" />Resolvido</Badge> : <Badge variant="warning" className="shadow-sm text-[10px] px-1.5 animate-pulse"><Clock className="w-3 h-3 mr-0.5" />Aberto</Badge>}
                        </div>
                        <div className="flex gap-1">
                          {!incident.resolved && <Button size="sm" variant="outline" className="bg-success/10 border-success/30 text-success hover:bg-success hover:text-success-foreground h-7 w-7 p-0" onClick={() => openResolveDialog(incident)}><CheckCircle2 className="w-3.5 h-3.5" /></Button>}
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0" onClick={() => deleteMutation.mutate(incident.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filteredIncidents.length === 0 && <div className="p-8 text-center"><div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto mb-3 border border-success/20"><CheckCircle2 className="w-6 h-6 text-success" /></div><h4 className="font-medium text-sm text-foreground mb-1">Nenhum incidente encontrado</h4><p className="text-xs text-muted-foreground">Tente ajustar os filtros</p></div>}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Card variant="glass" className="overflow-hidden">
            <CardHeader className="relative border-b border-border/30 pb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-info/5" />
              <div className="relative flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><Sparkles className="w-4 h-4 text-primary" /></div><CardTitle className="text-lg">Lista de Incidentes</CardTitle><Badge variant="secondary" className="ml-auto">{filteredIncidents.length} registros</Badge></div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent border-border/30"><TableHead>Motorista</TableHead><TableHead>Tipo</TableHead><TableHead>Severidade</TableHead><TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredIncidents.map((incident, index) => {
                      const severity = severityConfig[incident.severity];
                      const TypeIcon = typeIcons[incident.type] || AlertTriangle;
                      return (
                        <motion.tr key={incident.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: index * 0.03 }} className={cn("group border-b border-border/30 hover:bg-secondary/30 transition-colors", !incident.resolved && severity.bg)}>
                          <TableCell className="font-medium text-foreground">{incident.driverName}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-muted-foreground" /><span>{typeLabels[incident.type] || incident.type}</span></div></TableCell>
                          <TableCell><Badge variant={severity.variant} className="shadow-sm">{severity.label}</Badge></TableCell>
                          <TableCell className="max-w-[200px]"><p className="truncate text-muted-foreground">{incident.description}</p></TableCell>
                          <TableCell className="text-muted-foreground"><div className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(incident.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}</div></TableCell>
                          <TableCell>{incident.resolved ? <Badge variant="success" className="shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1" />Resolvido</Badge> : <Badge variant="warning" className="shadow-sm animate-pulse"><Clock className="w-3 h-3 mr-1" />Em Aberto</Badge>}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!incident.resolved && <Button size="sm" variant="outline" className="bg-success/10 border-success/30 text-success hover:bg-success hover:text-success-foreground" onClick={() => openResolveDialog(incident)}><CheckCircle2 className="w-4 h-4" /></Button>}
                              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(incident.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
              {filteredIncidents.length === 0 && <div className="p-12 text-center"><div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4 border border-success/20"><CheckCircle2 className="w-8 h-8 text-success" /></div><h4 className="font-medium text-foreground mb-1">Nenhum incidente encontrado</h4><p className="text-sm text-muted-foreground">Tente ajustar os filtros de busca</p></div>}
            </CardContent>
          </Card>
        </div>

        <CreateIncidentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} drivers={drivers || []} formDriverId={formDriverId} formType={formType} formSeverity={formSeverity} formDescription={formDescription} onDriverChange={setFormDriverId} onTypeChange={setFormType} onSeverityChange={setFormSeverity} onDescriptionChange={setFormDescription} onCreate={handleCreate} isPending={createMutation.isPending} />
        <ResolveIncidentDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen} resolutionNotes={resolutionNotes} onNotesChange={setResolutionNotes} onResolve={handleResolve} isPending={resolveMutation.isPending} />
      </div>
    </PullToRefresh>
  );
}
