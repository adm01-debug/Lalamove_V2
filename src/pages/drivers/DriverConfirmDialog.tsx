import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, ShieldX, Ban } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { DriverWithIncidents } from '@/hooks/useDrivers';

interface DriverConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogType: 'whitelist' | 'blacklist' | 'block';
  selectedDriver: DriverWithIncidents | null;
  reasonText: string;
  onReasonChange: (text: string) => void;
  onConfirm: () => void;
}

export function DriverConfirmDialog({
  open, onOpenChange, dialogType, selectedDriver, reasonText, onReasonChange, onConfirm,
}: DriverConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogType === 'whitelist' && <ShieldCheck className="w-5 h-5 text-success" />}
            {dialogType === 'blacklist' && <ShieldX className="w-5 h-5 text-destructive" />}
            {dialogType === 'block' && <Ban className="w-5 h-5 text-warning" />}
            {dialogType === 'whitelist' && 'Adicionar à Whitelist'}
            {dialogType === 'blacklist' && 'Adicionar à Blacklist'}
            {dialogType === 'block' && 'Bloquear Motorista'}
          </DialogTitle>
          <DialogDescription>
            {dialogType === 'whitelist' && `Motorista ${selectedDriver?.name} será adicionado à whitelist e aprovado automaticamente em futuras entregas.`}
            {dialogType === 'blacklist' && `Motorista ${selectedDriver?.name} será adicionado à blacklist e bloqueado permanentemente.`}
            {dialogType === 'block' && `Motorista ${selectedDriver?.name} será bloqueado temporariamente.`}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder={dialogType === 'whitelist' ? 'Motivo (opcional)' : 'Motivo do bloqueio/blacklist...'}
          value={reasonText}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={3}
          className="bg-secondary/50"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant={dialogType === 'whitelist' ? 'gradient' : 'destructive'} onClick={onConfirm}>
            {dialogType === 'whitelist' && 'Adicionar'}
            {dialogType === 'blacklist' && 'Blacklist'}
            {dialogType === 'block' && 'Bloquear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
