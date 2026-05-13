import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, CheckCircle2, Loader2 } from 'lucide-react';
import type { Incident, CreateIncidentInput } from '@/hooks/useIncidents';
import type { DriverWithIncidents } from '@/hooks/useDrivers';

const typeLabels: Record<string, string> = {
  ROUTE_DEVIATION: 'Desvio de Rota', LONG_STOP: 'Parada Longa', LATE_DELIVERY: 'Atraso na Entrega',
  CUSTOMER_COMPLAINT: 'Reclamação', DAMAGE: 'Dano', OTHER: 'Outro',
};
const severityLabels: Record<string, string> = {
  LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', CRITICAL: 'Crítica',
};

interface CreateIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: DriverWithIncidents[];
  formDriverId: string;
  formType: string;
  formSeverity: string;
  formDescription: string;
  onDriverChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onSeverityChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export function CreateIncidentDialog({
  open, onOpenChange, drivers, formDriverId, formType, formSeverity, formDescription,
  onDriverChange, onTypeChange, onSeverityChange, onDescriptionChange, onCreate, isPending,
}: CreateIncidentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center"><Plus className="w-4 h-4 text-primary" /></div>
            Novo Incidente
          </DialogTitle>
          <DialogDescription>Registre um novo incidente de motorista</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select value={formDriverId} onValueChange={onDriverChange}>
            <SelectTrigger className="bg-secondary/30 border-border/50"><SelectValue placeholder="Selecione o motorista" /></SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-border/50">
              {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={formType} onValueChange={onTypeChange}>
            <SelectTrigger className="bg-secondary/30 border-border/50"><SelectValue placeholder="Tipo de incidente" /></SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-border/50">
              {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={formSeverity} onValueChange={onSeverityChange}>
            <SelectTrigger className="bg-secondary/30 border-border/50"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-xl border-border/50">
              {Object.entries(severityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Descrição do incidente" value={formDescription} onChange={(e) => onDescriptionChange(e.target.value)} rows={3} className="bg-secondary/30 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-background/50 border-border/50">Cancelar</Button>
          <Button onClick={onCreate} disabled={isPending} className="bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ResolveIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolutionNotes: string;
  onNotesChange: (v: string) => void;
  onResolve: () => void;
  isPending: boolean;
}

export function ResolveIncidentDialog({ open, onOpenChange, resolutionNotes, onNotesChange, onResolve, isPending }: ResolveIncidentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center border border-success/30"><CheckCircle2 className="w-4 h-4 text-success" /></div>
            Resolver Incidente
          </DialogTitle>
          <DialogDescription>Adicione notas sobre a resolução</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea placeholder="Notas de resolução..." value={resolutionNotes} onChange={(e) => onNotesChange(e.target.value)} rows={4} className="bg-secondary/30 border-border/50 focus:border-success/50 focus:ring-2 focus:ring-success/20" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-background/50 border-border/50">Cancelar</Button>
          <Button onClick={onResolve} disabled={isPending} className="bg-gradient-to-r from-success to-success/80 text-success-foreground shadow-lg shadow-success/20">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resolver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
