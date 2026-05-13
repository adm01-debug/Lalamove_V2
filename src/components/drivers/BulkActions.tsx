import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle2, 
  Ban, 
  Shield, 
  ShieldX, 
  Loader2,
  X,
  AlertTriangle,
  Download,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkActionsProps {
  selectedCount: number;
  onApprove: () => void;
  onBlock: (reason: string) => void;
  onWhitelist: (reason: string) => void;
  onBlacklist: (reason: string) => void;
  onExport: () => void;
  onClearSelection: () => void;
  isProcessing: boolean;
}

export function BulkActions({
  selectedCount,
  onApprove,
  onBlock,
  onWhitelist,
  onBlacklist,
  onExport,
  onClearSelection,
  isProcessing,
}: BulkActionsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'block' | 'whitelist' | 'blacklist'>('block');
  const [reason, setReason] = useState('');

  const openDialog = (type: 'block' | 'whitelist' | 'blacklist') => {
    setDialogType(type);
    setReason('');
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    if (dialogType === 'block') {
      onBlock(reason);
    } else if (dialogType === 'whitelist') {
      onWhitelist(reason);
    } else {
      onBlacklist(reason);
    }
    setDialogOpen(false);
  };

  const dialogConfig = {
    block: {
      title: 'Bloquear Motoristas',
      description: `Você está prestes a bloquear ${selectedCount} motorista(s). Esta ação pode ser revertida posteriormente.`,
      icon: Ban,
      iconColor: 'text-warning',
      buttonVariant: 'warning' as const,
      buttonText: 'Bloquear',
    },
    whitelist: {
      title: 'Adicionar à Whitelist',
      description: `Você está prestes a adicionar ${selectedCount} motorista(s) à whitelist. Eles serão aprovados automaticamente em entregas futuras.`,
      icon: Shield,
      iconColor: 'text-success',
      buttonVariant: 'gradient-success' as const,
      buttonText: 'Adicionar',
    },
    blacklist: {
      title: 'Adicionar à Blacklist',
      description: `Você está prestes a adicionar ${selectedCount} motorista(s) à blacklist. Eles serão bloqueados permanentemente.`,
      icon: ShieldX,
      iconColor: 'text-destructive',
      buttonVariant: 'destructive' as const,
      buttonText: 'Blacklist',
    },
  };

  const config = dialogConfig[dialogType];

  if (selectedCount === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/20">
            {/* Selection Info */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
              <Users className="w-4 h-4 text-primary" />
              <Badge variant="gradient" className="font-semibold">
                {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="w-px h-8 bg-border" />

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onApprove}
                disabled={isProcessing}
                className="gap-1.5 text-success hover:text-success hover:bg-success/10"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Aprovar</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDialog('whitelist')}
                disabled={isProcessing}
                className="gap-1.5 text-success hover:text-success hover:bg-success/10"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Whitelist</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDialog('block')}
                disabled={isProcessing}
                className="gap-1.5 text-warning hover:text-warning hover:bg-warning/10"
              >
                <Ban className="w-4 h-4" />
                <span className="hidden sm:inline">Bloquear</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDialog('blacklist')}
                disabled={isProcessing}
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <ShieldX className="w-4 h-4" />
                <span className="hidden sm:inline">Blacklist</span>
              </Button>

              <div className="w-px h-8 bg-border hidden sm:block" />

              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                disabled={isProcessing}
                className="gap-1.5 hidden sm:flex"
              >
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </div>

            <div className="w-px h-8 bg-border" />

            {/* Clear Selection */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <config.icon className={cn("w-5 h-5", config.iconColor)} />
              {config.title}
            </DialogTitle>
            <DialogDescription className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              {config.description}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Motivo (opcional para whitelist, obrigatório para block/blacklist)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="bg-secondary/50"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant={config.buttonVariant}
              onClick={handleConfirm}
              disabled={
                isProcessing || 
                (dialogType !== 'whitelist' && !reason.trim())
              }
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <config.icon className="w-4 h-4 mr-2" />
              )}
              {config.buttonText} ({selectedCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Selection Checkbox Component
export function SelectionCheckbox({
  checked,
  onCheckedChange,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn("relative", className)}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "h-5 w-5 rounded-md border-2 transition-all",
          checked 
            ? "border-primary bg-primary data-[state=checked]:bg-primary" 
            : "border-border hover:border-primary/50"
        )}
      />
      <AnimatePresence>
        {checked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute inset-0 rounded-md bg-primary/20 -z-10"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Select All Header
export function SelectAllHeader({
  allSelected,
  someSelected,
  onSelectAll,
  totalCount,
  selectedCount,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  totalCount: number;
  selectedCount: number;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
      <Checkbox
        checked={allSelected}
        onCheckedChange={onSelectAll}
        className={cn(
          "h-5 w-5 rounded-md border-2",
          someSelected && !allSelected && "data-[state=checked]:bg-muted"
        )}
      />
      <span className="text-sm text-muted-foreground">
        {selectedCount > 0 ? (
          <>
            <span className="font-semibold text-foreground">{selectedCount}</span> de {totalCount} selecionados
          </>
        ) : (
          'Selecionar todos'
        )}
      </span>
      {selectedCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectAll(false)}
          className="ml-auto h-7 text-xs"
        >
          Limpar seleção
        </Button>
      )}
    </div>
  );
}
