import { useState } from 'react';
import { RiskRuleFormDialog, DeleteRuleConfirm, getFieldLabel, getOperatorLabel } from './RiskRulesPage.dialogs';
import { 
  useRiskRules, 
  useCreateRiskRule, 
  useUpdateRiskRule, 
  useDeleteRiskRule,
  RiskRule,
  RiskRuleInput
} from '@/hooks/useRiskRules';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Scale, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Equal
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FIELD_OPTIONS = [
  { value: 'total_deliveries', label: 'Total de Entregas' },
  { value: 'rating', label: 'Avaliação' },
  { value: 'completion_rate', label: 'Taxa de Conclusão (%)' },
  { value: 'incident_count', label: 'Número de Incidentes' },
  { value: 'days_since_registration', label: 'Dias desde Cadastro' },
  { value: 'external_rating', label: 'Avaliação Externa' },
  { value: 'external_total_deliveries', label: 'Entregas Externas' },
  { value: 'external_success_rate', label: 'Taxa de Sucesso Externa (%)' },
];

const OPERATOR_OPTIONS = [
  { value: '<', label: 'Menor que', icon: TrendingDown },
  { value: '<=', label: 'Menor ou igual', icon: TrendingDown },
  { value: '=', label: 'Igual a', icon: Equal },
  { value: '>=', label: 'Maior ou igual', icon: TrendingUp },
  { value: '>', label: 'Maior que', icon: TrendingUp },
];

const defaultFormData: RiskRuleInput = {
  name: '',
  description: '',
  condition: {
    field: 'total_deliveries',
    operator: '<',
    value: 50
  },
  score_impact: 2.0,
  is_active: true
};

export function RiskRulesPage() {
  const { data: rules, isLoading, error } = useRiskRules();
  const createMutation = useCreateRiskRule();
  const updateMutation = useUpdateRiskRule();
  const deleteMutation = useDeleteRiskRule();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RiskRuleInput>(defaultFormData);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (rule: RiskRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      condition: rule.condition,
      score_impact: rule.score_impact,
      is_active: rule.is_active ?? true
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (id: string) => {
    setDeletingRuleId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, data: formData });
        toast.success('Regra atualizada com sucesso');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Regra criada com sucesso');
      }
      setIsDialogOpen(false);
    } catch (err) {
      toast.error('Falha ao salvar regra');
    }
  };

  const handleDelete = async () => {
    if (!deletingRuleId) return;
    
    try {
      await deleteMutation.mutateAsync(deletingRuleId);
      toast.success('Regra removida com sucesso');
      setIsDeleteDialogOpen(false);
      setDeletingRuleId(null);
    } catch (err) {
      toast.error('Falha ao remover regra');
    }
  };

  const handleToggleActive = async (rule: RiskRule) => {
    try {
      await updateMutation.mutateAsync({ 
        id: rule.id, 
        data: { is_active: !rule.is_active } 
      });
      toast.success(rule.is_active ? 'Regra desativada' : 'Regra ativada', {
        description: `"${rule.name}" foi ${rule.is_active ? 'desativada' : 'ativada'}`
      });
    } catch (err) {
      toast.error('Falha ao atualizar regra');
    }
  };

  const getFieldLabel = (field: string) => 
    FIELD_OPTIONS.find(f => f.value === field)?.label || field;

  const getOperatorLabel = (operator: string) => 
    OPERATOR_OPTIONS.find(o => o.value === operator)?.label || operator;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">Erro ao carregar regras</p>
        </div>
      </div>
    );
  }

  const activeRules = rules?.filter(r => r.is_active) || [];
  const inactiveRules = rules?.filter(r => !r.is_active) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Regras de Risco</h1>
            <p className="text-sm text-muted-foreground">
              Configure as regras para cálculo automático do score de risco dos motoristas
            </p>
          </div>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Regra
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Scale className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{rules?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total de Regras</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeRules.length}</p>
              <p className="text-xs text-muted-foreground">Regras Ativas</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/50">
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{inactiveRules.length}</p>
              <p className="text-xs text-muted-foreground">Regras Inativas</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules?.length === 0 ? (
          <Card className="glass-card p-12 text-center">
            <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma regra configurada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie regras para calcular automaticamente o score de risco dos motoristas
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Criar Primeira Regra
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {rules?.map((rule) => (
              <Card 
                key={rule.id} 
                className={cn(
                  "glass-card p-4 transition-all",
                  !rule.is_active && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground truncate">{rule.name}</h3>
                      <Badge 
                        variant={rule.is_active ? "default" : "secondary"}
                        className={cn(
                          "shrink-0",
                          rule.is_active ? "bg-success/20 text-success" : ""
                        )}
                      >
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-3">{rule.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline" className="font-mono">
                        {getFieldLabel(rule.condition.field)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {getOperatorLabel(rule.condition.operator)}
                      </span>
                      <Badge variant="outline" className="font-mono">
                        {rule.condition.value}
                      </Badge>
                      <span className="text-muted-foreground mx-2">→</span>
                      <Badge 
                        className={cn(
                          "font-mono",
                          rule.score_impact >= 3 
                            ? "bg-destructive/20 text-destructive" 
                            : rule.score_impact >= 2 
                              ? "bg-warning/20 text-warning"
                              : "bg-info/20 text-info"
                        )}
                      >
                        +{rule.score_impact.toFixed(1)} pontos
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.is_active ?? false}
                      onCheckedChange={() => handleToggleActive(rule)}
                      disabled={updateMutation.isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(rule)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDelete(rule.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RiskRuleFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingRule={editingRule}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <DeleteRuleConfirm
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
