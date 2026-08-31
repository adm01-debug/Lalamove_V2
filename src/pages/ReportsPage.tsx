import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { exportToCSV, exportToJSON, exportToPDFText } from '@/utils/exportUtils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, RefreshCw, FileBarChart, Loader2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReportData } from './reports/useReportData';
import { ReportStatsCards } from './reports/ReportStatsCards';
import { ReportOverviewTab } from './reports/ReportOverviewTab';
import { ReportDriversTab } from './reports/ReportDriversTab';
import { ReportDistributionTab } from './reports/ReportDistributionTab';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } }
};

export function ReportsPage() {
  const [period, setPeriod] = useState('7');
  const { loading, refreshing, stats, dailyStats, driverPerformance, vehicleDistribution, statusDistribution, fetchReportData } = useReportData(period);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
            <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
          </div>
          <p className="text-muted-foreground animate-pulse">Carregando relatórios...</p>
        </motion.div>
      </div>
    );
  }

  const completionRate = stats ? Math.round((stats.completedDeliveries / Math.max(stats.totalDeliveries, 1)) * 100) : 0;

  return (
    <motion.div className="p-6 space-y-6" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.div className="relative" whileHover={{ scale: 1.05, rotate: 5 }} transition={{ type: "spring", stiffness: 400 }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-info/30 blur-xl rounded-2xl" />
            <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-info shadow-lg">
              <FileBarChart className="w-7 h-7 text-primary-foreground" />
            </div>
          </motion.div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Relatórios de Entregas</h2>
            <p className="text-muted-foreground">Análise de performance e métricas detalhadas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] backdrop-blur-xl bg-card/50 border-border/50">
              <Calendar className="w-4 h-4 mr-2 text-primary" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="icon" onClick={fetchReportData} disabled={refreshing} className="backdrop-blur-xl bg-card/50 border-border/50 hover:bg-primary/10">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm" onClick={() => { if (!stats || !dailyStats.length) return; exportToCSV(dailyStats.map(d => ({ Data: d.date, Entregas: d.deliveries, Concluídas: d.completed, Canceladas: d.cancelled, 'Tempo Médio (min)': d.avgTime })), `relatorio_entregas_${period}d`); }} disabled={!stats} className="backdrop-blur-xl bg-card/50 border-border/50 hover:bg-primary/10 gap-2">
              <Download className="w-4 h-4" /> CSV
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm" onClick={() => { if (!stats) return; exportToJSON({ periodo: `${period} dias`, resumo: stats, diario: dailyStats, motoristas: driverPerformance, veiculos: vehicleDistribution, status: statusDistribution }, `relatorio_entregas_${period}d`); }} disabled={!stats} className="backdrop-blur-xl bg-card/50 border-border/50 hover:bg-primary/10 gap-2">
              <Download className="w-4 h-4" /> JSON
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="sm" onClick={() => { if (!stats) return; exportToPDFText({ title: `Relatório de Entregas - Últimos ${period} dias`, sections: [ { title: 'Resumo', content: `Total: ${stats.totalDeliveries} | Concluídas: ${stats.completedDeliveries} | Canceladas: ${stats.cancelledDeliveries}\nTempo Médio: ${stats.avgDeliveryTime}min | Pontualidade: ${stats.onTimeRate}%\nMotoristas: ${stats.totalDrivers} (${stats.activeDrivers} ativos)` }, { title: 'Top Motoristas', content: driverPerformance.map((d, i) => `${i + 1}. ${d.name} - ${d.completedDeliveries} entregas, ⭐${d.rating}, ${d.onTimeRate}% pontual, ${d.incidents} incidentes`).join('\n') }, { title: 'Distribuição por Veículo', content: vehicleDistribution.map(v => `${v.type}: ${v.count} (${v.percentage}%)`).join('\n') } ] }, `relatorio_entregas_${period}d`); }} disabled={!stats} className="backdrop-blur-xl bg-card/50 border-border/50 hover:bg-primary/10 gap-2">
              <Download className="w-4 h-4" /> PDF
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportStatsCards stats={stats} />
      </motion.div>

      {/* Charts */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="backdrop-blur-xl bg-card/50 border border-border/50 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Visão Geral</TabsTrigger>
            <TabsTrigger value="drivers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Performance Motoristas</TabsTrigger>
            <TabsTrigger value="distribution" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Distribuição</TabsTrigger>
          </TabsList>
          <AnimatePresence mode="wait">
            <TabsContent value="overview"><ReportOverviewTab dailyStats={dailyStats} statusDistribution={statusDistribution} stats={stats} completionRate={completionRate} /></TabsContent>
            <TabsContent value="drivers"><ReportDriversTab driverPerformance={driverPerformance} /></TabsContent>
            <TabsContent value="distribution"><ReportDistributionTab dailyStats={dailyStats} vehicleDistribution={vehicleDistribution} /></TabsContent>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
