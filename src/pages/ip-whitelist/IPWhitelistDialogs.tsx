import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface IPFormData {
  ip_address: string;
  description: string;
  cidr_range: string;
}

interface AddEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: IPFormData;
  setFormData: React.Dispatch<React.SetStateAction<IPFormData>>;
  errors: Record<string, string>;
  isEditing: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onReset: () => void;
}

export function AddEditIPDialog({
  open, onOpenChange, formData, setFormData, errors, isEditing, isPending, onSubmit, onReset,
}: AddEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) onReset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-success" />
            {isEditing ? 'Editar IP' : 'Adicionar IP à Whitelist'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize as informações do IP' : 'Adicione um novo IP à lista de permitidos'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ip_address">Endereço IP *</Label>
            <Input
              id="ip_address"
              placeholder="192.168.1.1 ou 2001:db8::1"
              value={formData.ip_address}
              onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
              className={errors.ip_address ? 'border-destructive' : ''}
            />
            {errors.ip_address && <p className="text-xs text-destructive">{errors.ip_address}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Textarea
              id="description"
              placeholder="Ex: Escritório principal, VPN corporativa..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cidr_range">CIDR Range (opcional)</Label>
            <Input
              id="cidr_range"
              placeholder="Ex: 192.168.1.0/24"
              value={formData.cidr_range}
              onChange={(e) => setFormData(prev => ({ ...prev, cidr_range: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Para permitir uma faixa de IPs, use notação CIDR</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isPending} className="bg-success hover:bg-success/90">
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipAddress?: string;
  isPending: boolean;
  onConfirm: () => void;
}

export function DeleteIPDialog({ open, onOpenChange, ipAddress, isPending, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirmar Remoção
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover o IP{' '}
            <code className="font-mono font-semibold">{ipAddress}</code>{' '}
            da whitelist? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            {isPending ? 'Removendo...' : 'Remover'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
