import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Ban, Shield } from 'lucide-react';

interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockData: { ip: string; reason: string; duration: string; isPermanent: boolean };
  setBlockData: (data: { ip: string; reason: string; duration: string; isPermanent: boolean }) => void;
  onSubmit: () => void;
  isBlocking: boolean;
}

export function BlockIPDialog({ open, onOpenChange, blockData, setBlockData, onSubmit, isBlocking }: BlockDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Bloquear IP
          </DialogTitle>
          <DialogDescription>
            O IP será impedido de acessar a API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ip">Endereço IP</Label>
            <Input
              id="ip"
              placeholder="192.168.1.1"
              value={blockData.ip}
              onChange={(e) => setBlockData({ ...blockData, ip: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo do bloqueio..."
              value={blockData.reason}
              onChange={(e) => setBlockData({ ...blockData, reason: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="permanent">Bloqueio permanente</Label>
            <Switch
              id="permanent"
              checked={blockData.isPermanent}
              onCheckedChange={(checked) => setBlockData({ ...blockData, isPermanent: checked })}
            />
          </div>

          {!blockData.isPermanent && (
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select
                value={blockData.duration}
                onValueChange={(value) => setBlockData({ ...blockData, duration: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hora</SelectItem>
                  <SelectItem value="6h">6 horas</SelectItem>
                  <SelectItem value="24h">24 horas</SelectItem>
                  <SelectItem value="7d">7 dias</SelectItem>
                  <SelectItem value="30d">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={isBlocking || !blockData.ip || !blockData.reason}
          >
            {isBlocking ? 'Bloqueando...' : 'Bloquear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WhitelistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whitelistData: { ip: string; description: string; cidrRange: string };
  setWhitelistData: (data: { ip: string; description: string; cidrRange: string }) => void;
  onSubmit: () => void;
  isAdding: boolean;
}

export function WhitelistDialog({ open, onOpenChange, whitelistData, setWhitelistData, onSubmit, isAdding }: WhitelistDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-success" />
            Adicionar à Whitelist
          </DialogTitle>
          <DialogDescription>
            O IP será permitido sem rate limiting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wl-ip">Endereço IP</Label>
            <Input
              id="wl-ip"
              placeholder="192.168.1.1"
              value={whitelistData.ip}
              onChange={(e) => setWhitelistData({ ...whitelistData, ip: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-desc">Descrição</Label>
            <Input
              id="wl-desc"
              placeholder="Ex: Servidor de produção"
              value={whitelistData.description}
              onChange={(e) => setWhitelistData({ ...whitelistData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-cidr">CIDR Range (opcional)</Label>
            <Input
              id="wl-cidr"
              placeholder="Ex: 192.168.1.0/24"
              value={whitelistData.cidrRange}
              onChange={(e) => setWhitelistData({ ...whitelistData, cidrRange: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isAdding || !whitelistData.ip || !whitelistData.description}
          >
            {isAdding ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
