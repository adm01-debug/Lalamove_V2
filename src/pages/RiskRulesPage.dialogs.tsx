import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import type { RiskRule, RiskRuleInput } from '@/hooks/useRiskRules';

export const FIELD_OPTIONS = [
  { value: 'total_deliveries', label: 'Total de Entregas' },
  { value: 'rating', label: 'Avaliação' },
  { value: 'completion_rate', label: 'Taxa de Conclusão (%)' },
  { value: 'incident_count', label: 'Número de Incidentes' },
  { value: 'days_since_registration', label: 'Dias desde Cadastro' },
  { value: 'external_rating', label: 'Avaliação Externa' },
  { value: 'external_total_deliveries', label: 'Entregas Externas' },
  { value: 'external_success_rate', label: 'Taxa de Sucesso Externa (%)' },
];

export const OPERATOR_OPTIONS = [
  { value: '<', label: 'Menor que' },
  { value: '<=', label: 'Menor ou igual' },
  { value: '=', label: 'Igual a' },
  { value: '>=', label: 'Maior ou igual' },
  { value: '>', label: 'Maior que' },
];

export const getFieldLabel = (field: string) =>
  FIELD_OPTIONS.find(f => f.value === field)?.label || field;

export const getOperatorLabel = (operator: string) =>
  OPERATOR_OPTIONS.find(o => o.value === operator)?.label || operator;

interface RiskRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: RiskRule | null;
  formData: RiskRuleInput;
  setFormData: (data: RiskRuleInput) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function RiskRuleFormDialog({ open, onOpenChange, editingRule, formData, setFormData, onSubmit, isPending }: RiskRuleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Risco'}</DialogTitle>
          <DialogDescription>Configure a condição e o impacto no score de risco</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Regra *</Label>
            <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Baixo número de entregas" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descreva quando esta regra se aplica..." rows={2} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Condição</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={formData.condition.field} onValueChange={(value) => setFormData({ ...formData, condition: { ...formData.condition, field: value } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={formData.condition.operator} onValueChange={(value) => setFormData({ ...formData, condition: { ...formData.condition, operator: value } })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OPERATOR_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" value={formData.condition.value} onChange={(e) => setFormData({ ...formData, condition: { ...formData.condition, value: Number(e.target.value) } })} placeholder="Valor" min={0} step={0.1} />
            </div>
            <p className="text-xs text-muted-foreground">
              Se "{getFieldLabel(formData.condition.field)}" {getOperatorLabel(formData.condition.operator).toLowerCase()} {formData.condition.value}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="score_impact">Impacto no Score (pontos)</Label>
            <Input id="score_impact" type="number" value={formData.score_impact} onChange={(e) => setFormData({ ...formData, score_impact: Number(e.target.value) })} placeholder="2.0" min={0} max={10} step={0.5} />
            <p className="text-xs text-muted-foreground">Quanto maior o valor, maior o impacto no risco do motorista (0-10)</p>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Regra Ativa</Label>
            <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingRule ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteRuleConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function DeleteRuleConfirm({ open, onOpenChange, onConfirm, isPending }: DeleteRuleConfirmProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover Regra</AlertDialogTitle>
          <AlertDialogDescription>Tem certeza que deseja remover esta regra? Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
