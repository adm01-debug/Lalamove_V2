import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FetchOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FetchOrderDialog({ open, onOpenChange, onSuccess }: FetchOrderDialogProps) {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFetch = async () => {
    const trimmed = orderId.trim();
    if (!trimmed) return;

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('lalamove-api', {
        body: { action: 'fetch-order', orderId: trimmed },
      });

      if (error) throw error;

      const response = typeof data === 'string' ? JSON.parse(data) : data;

      if (response.error) {
        setResult({ success: false, message: response.error });
        toast.error('Erro ao buscar corrida', { description: response.error });
      } else {
        setResult({ success: true, message: 'Corrida importada com sucesso!' });
        toast.success('Corrida importada!', { description: `ID: ${trimmed}` });
        onSuccess();
        setOrderId('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setResult({ success: false, message: msg });
      toast.error('Erro ao buscar corrida', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Buscar Corrida por ID
          </DialogTitle>
          <DialogDescription>
            Informe o ID do pedido Lalamove (orderId) para buscar e salvar no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ex: 3443160224863834408"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              className="font-mono text-sm"
              disabled={loading}
            />
            <Button onClick={handleFetch} disabled={loading || !orderId.trim()} variant="gradient">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg border ${
              result.success 
                ? 'bg-success/10 border-success/30 text-success' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span className="text-sm">{result.message}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            O ID do pedido pode ser encontrado no Partner Portal da Lalamove ou no link de compartilhamento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
