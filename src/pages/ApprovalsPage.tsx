import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { DataRefreshIndicator } from '@/components/ui/data-refresh-indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DataErrorBanner } from '@/components/ui/data-error-banner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, AlertTriangle, CheckCircle2, XCircle, Clock, History, Loader2, RefreshCw, Zap, TrendingUp, Sparkles } from 'lucide-react';
import { usePendingApprovals, useApprovalHistory, useApprovalStats, useApprovalActions } from '@/hooks/usePendingApprovals';
import { useApprovalRealtime } from '@/hooks/useApprovalRealtime';
import { DriverApproval } from '@/types';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { ApprovalCard, HistoryCard } from './approvals/ApprovalCard';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }, exit: { opacity: 0, x: -50, transition: { duration: 0.3 } } };

export function ApprovalsPage() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const { data: pendingApprovals = [], isLoading, error, refetch, isFetching } = usePendingApprovals();
  const { data: historyApprovals = [], isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = useApprovalHistory();
  const { data: stats } = useApprovalStats();
  const { approveMutation, rejectMutation, whitelistMutation, blacklistMutation } = useApprovalActions();
  useApprovalRealtime();

  const isProcessing = approveMutation.isPending || rejectMutation.isPending || whitelistMutation.isPending || blacklistMutation.isPending;
  const handleRefresh = useCallback(async () => { await queryClient.invalidateQueries({ queryKey: ['pending-approvals'] }); await queryClient.invalidateQueries({ queryKey: ['approval-history'] }); setLastUpdated(new Date()); }, [queryClient]);
  const handleApprove = (approval: DriverApproval, notes?: string) => { approveMutation.mutate({ approvalId: approval.id, driverId: approval.driverId, notes }); };
  const handleReject = (approval: DriverApproval, notes?: string) => { rejectMutation.mutate({ approvalId: approval.id, driverId: approval.driverId, notes }); };
  const handleWhitelist = (approval: DriverApproval) => { whitelistMutation.mutate({ approvalId: approval.id, driverId: approval.driverId }); };
  const handleBlacklist = (approval: DriverApproval, reason?: string) => { blacklistMutation.mutate({ approvalId: approval.id, driverId: approval.driverId, reason }); };

  const statsCards = [
    { icon: Clock, color: 'warning', value: stats?.pending || pendingApprovals.length, label: 'Pend.', fullLabel: 'Pendentes' },
    { icon: CheckCircle2, color: 'success', value: stats?.approvedToday || 0, label: 'Aprov.', fullLabel: 'Aprovados hoje' },
    { icon: XCircle, color: 'destructive', value: stats?.rejectedToday || 0, label: 'Rej.', fullLabel: 'Rejeitados hoje' },
    { icon: TrendingUp, color: 'accent', value: stats?.avgRiskScore ? stats.avgRiskScore.toFixed(1) : '--', label: 'Score', fullLabel: 'Score médio' }
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh} className="h-full">
      <motion.div className="h-full flex flex-col gap-4 sm:gap-6 p-4 sm:p-6" initial="hidden" animate="visible" variants={containerVariants}>
        {/* Header */}
        <motion.div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4" variants={itemVariants}>
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div className="relative flex-shrink-0" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ type: 'spring', stiffness: 400 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-warning to-warning/50 rounded-xl sm:rounded-2xl blur-xl opacity-50" />
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-warning/20 via-accent/20 to-info/20 flex items-center justify-center border border-warning/20 shadow-lg shadow-warning/10"><Shield className="w-5 h-5 sm:w-6 sm:h-6 text-warning" /></div>
            </motion.div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent truncate">Fila de Aprovação</h2>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2"><Zap className="w-3 h-3 text-warning flex-shrink-0" /><span className="truncate">Motoristas aguardando aprovação</span></p>
            </div>
          </div>
          <div className="sm:hidden"><DataRefreshIndicator lastUpdated={lastUpdated} isRefreshing={isFetching} onRefresh={handleRefresh} variant="minimal" /></div>
          <motion.div className="hidden sm:block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="bg-background/50 backdrop-blur-sm border-border/50 hover:bg-secondary/50 hover:border-primary/30"><RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin")} />Atualizar</Button>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div className="grid grid-cols-4 gap-2 sm:gap-4" variants={containerVariants}>
          {statsCards.map((stat, index) => (
            <motion.div key={stat.fullLabel} variants={itemVariants} whileHover={{ scale: 1.03, y: -2 }} transition={{ type: 'spring', stiffness: 400 }}>
              <Card variant="glass" hover="lift" className="overflow-hidden">
                <div className={cn("h-0.5 sm:h-1 bg-gradient-to-r", `from-${stat.color} to-${stat.color}/50`)} />
                <CardContent className="p-2 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
                    <div className={cn("p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border", `bg-${stat.color}/10 border-${stat.color}/30`)}><stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", `text-${stat.color}`)} /></div>
                    <div className="text-center sm:text-left">
                      <motion.p className={cn("text-lg sm:text-2xl font-bold", `text-${stat.color}`)} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + index * 0.1 }}>{stat.value}</motion.p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate"><span className="sm:hidden">{stat.label}</span><span className="hidden sm:inline">{stat.fullLabel}</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants} className="flex-1 flex flex-col">
          <Tabs defaultValue="pending" className="flex-1 flex flex-col">
            <TabsList className="bg-background/80 backdrop-blur-sm border border-border/50 p-1 w-fit">
              <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"><Clock className="w-4 h-4" />Pendentes{pendingApprovals.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{pendingApprovals.length}</Badge>}</TabsTrigger>
              <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground"><History className="w-4 h-4" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="flex-1 space-y-4 mt-4">
              <Card variant="glass" className="overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-warning via-warning/70 to-warning/30" />
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-warning/20 border border-warning/30"><AlertTriangle className="w-4 h-4 text-warning" /></div>
                    <div><h3 className="font-semibold text-foreground mb-1">Sobre o Score de Risco</h3><p className="text-sm text-muted-foreground">Motoristas com score acima de 5.0 ou na primeira entrega são automaticamente encaminhados para aprovação manual. Use <strong className="text-success">Whitelist</strong> para confiar permanentemente ou <strong className="text-destructive">Blacklist</strong> para bloquear permanentemente.</p></div>
                  </div>
                </CardContent>
              </Card>

              {isLoading ? (
                <div className="flex-1 flex items-center justify-center py-12"><motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}><div className="relative inline-block"><div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/50 rounded-full blur-xl opacity-50 animate-pulse" /><Loader2 className="w-12 h-12 text-primary animate-spin relative" /></div><p className="text-muted-foreground mt-4">Carregando aprovações...</p></motion.div></div>
              ) : error ? (
                <motion.div className="flex-1 flex items-center justify-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}><Card variant="glass" className="p-8 text-center border-destructive/30"><div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4 border border-destructive/20"><XCircle className="w-8 h-8 text-destructive" /></div><p className="text-muted-foreground">Erro ao carregar aprovações pendentes</p></Card></motion.div>
              ) : pendingApprovals.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="w-6 h-6 text-success" />}
                  title="Nenhuma aprovação pendente"
                  description="Todas as aprovações foram processadas!"
                  className="flex-1"
                />
              ) : (
                <motion.div className="space-y-4 overflow-y-auto" variants={containerVariants} initial="hidden" animate="visible">
                  <AnimatePresence mode="popLayout">
                    {pendingApprovals.map((approval) => <motion.div key={approval.id} variants={itemVariants} layout exit={{ opacity: 0, x: -50, transition: { duration: 0.3 } }}><ApprovalCard approval={approval} onApprove={handleApprove} onReject={handleReject} onWhitelist={handleWhitelist} onBlacklist={handleBlacklist} isProcessing={isProcessing} /></motion.div>)}
                  </AnimatePresence>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1 space-y-4 mt-4 overflow-y-auto">
              {historyLoading ? (
                <div className="flex-1 flex items-center justify-center py-12"><motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}><Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" /><p className="text-muted-foreground mt-4">Carregando histórico...</p></motion.div></div>
              ) : historyError ? (
                <DataErrorBanner message="Não foi possível carregar o histórico de aprovações." onRetry={() => refetchHistory()} />
              ) : historyApprovals.length === 0 ? (
                <EmptyState
                  icon={<History className="w-6 h-6" />}
                  title="Nenhum histórico"
                  description="As aprovações processadas aparecerão aqui."
                  className="flex-1"
                />
              ) : (
                <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="visible">
                  <AnimatePresence>{historyApprovals.map((approval) => <motion.div key={approval.id} variants={itemVariants}><HistoryCard approval={approval} /></motion.div>)}</AnimatePresence>
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </PullToRefresh>
  );
}
