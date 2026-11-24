import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle,
  Clock,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RiskLevel, RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from '@/types/driver';
import { useFuseSearchWithMatches, type WithMatches } from '@/hooks/useFuseSearch';
import { HighlightText } from '@/components/ui/highlight-match';
import { EvaluationDetailsPanel } from './evaluations/EvaluationDetails';

interface RiskFactor {
  factor: string;
  impact: number;
  description?: string;
  weight?: number;
  score?: number;
}

interface DriverEvaluation {
  id: string;
  driver_id: string;
  order_id: string | null;
  triggered_by: string;
  approved: boolean;
  requires_manual: boolean;
  auto_blocked: boolean;
  risk_score: number;
  risk_level: string;
  risk_factors: RiskFactor[];
  risk_reasons: string[];
  total_deliveries: number | null;
  completed_deliveries: number | null;
  failure_rate: number | null;
  incident_count: number | null;
  recommendation: string | null;
  action_required: string | null;
  evaluated_at: string;
  created_at: string;
  drivers?: {
    id: string;
    name: string;
  };
}

const fetchEvaluations = async (): Promise<DriverEvaluation[]> => {
  const { data, error } = await supabase
    .from('driver_evaluations')
    .select(`
      *,
      drivers (id, name)
    `)
    .order('evaluated_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  
  // Map the data with proper type handling for risk_factors
  return (data || []).map(item => ({
    ...item,
    risk_factors: Array.isArray(item.risk_factors) 
      ? item.risk_factors as unknown as RiskFactor[]
      : [],
  })) as DriverEvaluation[];
};

const fetchDrivers = async () => {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, name')
    .order('name');
  
  if (error) throw error;
  return data || [];
};

export function EvaluationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [selectedEvaluation, setSelectedEvaluation] = useState<DriverEvaluation | null>(null);

  const { data: evaluations = [], isLoading, refetch, error } = useQuery({
    queryKey: ['driver-evaluations'],
    queryFn: fetchEvaluations,
    refetchInterval: 30000
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: fetchDrivers
  });

  // Fuzzy search with Fuse.js - with match highlighting
  const evaluationSearchKeys = useMemo(() => ['id', 'order_id', 'drivers.name'], []);
  const evaluationSearchResults = useFuseSearchWithMatches(evaluations, evaluationSearchKeys, searchTerm);

  const filteredEvaluations = useMemo(() => {
    const evaluationsToFilter = searchTerm.trim() 
      ? evaluationSearchResults.map(r => ({ ...r.item, _matches: r.matches }))
      : evaluations;
    
    return evaluationsToFilter.filter(evaluation => {
      // Risk level filter
      const matchesRiskLevel = riskLevelFilter === 'all' || evaluation.risk_level === riskLevelFilter;

      // Driver filter
      const matchesDriver = driverFilter === 'all' || evaluation.driver_id === driverFilter;

      // Result filter
      let matchesResult = true;
      if (resultFilter === 'approved') matchesResult = evaluation.approved && !evaluation.requires_manual;
      else if (resultFilter === 'manual') matchesResult = evaluation.requires_manual;
      else if (resultFilter === 'blocked') matchesResult = evaluation.auto_blocked;

      return matchesRiskLevel && matchesDriver && matchesResult;
    });
  }, [evaluations, evaluationSearchResults, searchTerm, riskLevelFilter, driverFilter, resultFilter]);

  const stats = useMemo(() => {
    const total = evaluations.length;
    const approved = evaluations.filter(e => e.approved && !e.requires_manual).length;
    const manual = evaluations.filter(e => e.requires_manual).length;
    const blocked = evaluations.filter(e => e.auto_blocked).length;
    const byRiskLevel = {
      LOW: evaluations.filter(e => e.risk_level === 'LOW').length,
      MEDIUM: evaluations.filter(e => e.risk_level === 'MEDIUM').length,
      HIGH: evaluations.filter(e => e.risk_level === 'HIGH').length,
      CRITICAL: evaluations.filter(e => e.risk_level === 'CRITICAL').length,
    };

    return { total, approved, manual, blocked, byRiskLevel };
  }, [evaluations]);

  const getRiskLevelBadge = (level: string) => {
    const colorClass = RISK_LEVEL_COLORS[level as RiskLevel] || 'bg-muted text-muted-foreground';
    return (
      <Badge className={`${colorClass} font-medium`}>
        {RISK_LEVEL_LABELS[level as RiskLevel] || level}
      </Badge>
    );
  };

  const getResultIcon = (evaluation: DriverEvaluation) => {
    if (evaluation.auto_blocked) {
      return <ShieldX className="w-5 h-5 text-destructive" />;
    }
    if (evaluation.requires_manual) {
      return <ShieldAlert className="w-5 h-5 text-warning" />;
    }
    if (evaluation.approved) {
      return <ShieldCheck className="w-5 h-5 text-success" />;
    }
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  const getResultLabel = (evaluation: DriverEvaluation) => {
    if (evaluation.auto_blocked) return 'Bloqueado';
    if (evaluation.requires_manual) return 'Aprovação Manual';
    if (evaluation.approved) return 'Aprovado';
    return 'Pendente';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">Histórico de Avaliações</h2>
          <p className="text-muted-foreground">
            Visualize todas as avaliações automáticas de motoristas
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-success/30 bg-success/5">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-success">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Aprovados</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-warning/30 bg-warning/5">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-warning">{stats.manual}</div>
            <p className="text-xs text-muted-foreground">Manuais</p>
          </CardContent>
        </Card>
        <Card className="col-span-1 border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
            <p className="text-xs text-muted-foreground">Bloqueados</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-success">{stats.byRiskLevel.LOW}</div>
            <p className="text-xs text-muted-foreground">Baixo Risco</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-warning">{stats.byRiskLevel.MEDIUM}</div>
            <p className="text-xs text-muted-foreground">Médio Risco</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats.byRiskLevel.HIGH + stats.byRiskLevel.CRITICAL}</div>
            <p className="text-xs text-muted-foreground">Alto/Crítico</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SearchInputWithHelp
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar por motorista ou ID..."
            />
            
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os motoristas</SelectItem>
                {drivers.map(driver => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Nível de Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="LOW">Baixo</SelectItem>
                <SelectItem value="MEDIUM">Médio</SelectItem>
                <SelectItem value="HIGH">Alto</SelectItem>
                <SelectItem value="CRITICAL">Crítico</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="manual">Aprovação Manual</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Evaluations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Avaliações ({filteredEvaluations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="font-medium text-foreground">Não foi possível carregar as avaliações</p>
              <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
            </div>
          ) : filteredEvaluations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma avaliação encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Taxa Falha</TableHead>
                    <TableHead>Incidentes</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.map((evaluation) => (
                    <TableRow key={evaluation.id} className="hover:bg-muted/50">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(evaluation.evaluated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {searchTerm.trim() && (evaluation as WithMatches<typeof evaluation>)._matches ? (
                            <HighlightText text={evaluation.drivers?.name || 'Desconhecido'} matches={(evaluation as WithMatches<typeof evaluation>)._matches} matchKey="drivers.name" />
                        ) : (
                          evaluation.drivers?.name || 'Desconhecido'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-lg">
                          {evaluation.risk_score.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getRiskLevelBadge(evaluation.risk_level)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResultIcon(evaluation)}
                          <span className="text-sm">{getResultLabel(evaluation)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {evaluation.total_deliveries ?? '-'}
                      </TableCell>
                      <TableCell>
                        {evaluation.failure_rate !== null 
                          ? `${evaluation.failure_rate.toFixed(1)}%` 
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {evaluation.incident_count ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {evaluation.triggered_by}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedEvaluation(evaluation)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalhes da Avaliação</DialogTitle>
                            </DialogHeader>
                            {selectedEvaluation && (
                              <EvaluationDetailsPanel evaluation={selectedEvaluation} />
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// EvaluationDetails is now in src/pages/evaluations/EvaluationDetails.tsx
