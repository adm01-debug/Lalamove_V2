import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

export function ImportCSVDialog({ open, onOpenChange, onSuccess }: ImportCSVDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Look for order ID column (common names)
        const idColumns = ['orderId', 'order_id', 'OrderID', 'ID', 'id', 'lalamove_id', 'Número do Pedido', 'Order Number'];
        const headers = results.meta.fields || [];
        const idCol = headers.find(h => idColumns.includes(h)) || headers[0];

        if (!idCol) {
          toast.error('Nenhuma coluna de ID encontrada no CSV');
          return;
        }

        const ids = (results.data as Record<string, string>[])
          .map(row => row[idCol]?.toString().trim())
          .filter((id): id is string => !!id && id.length > 5);

        setOrderIds([...new Set(ids)]); // Remove duplicates
        toast.info(`${ids.length} IDs encontrados`, { description: `Coluna: ${idCol}` });
      },
      error: (err) => {
        toast.error('Erro ao ler CSV', { description: err.message });
      }
    });
  };

  const handleImport = async () => {
    if (!orderIds.length) return;

    setImporting(true);
    setProgress(0);
    setResult(null);

    const batchSize = 20;
    let totalSuccess = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (let i = 0; i < orderIds.length; i += batchSize) {
      const batch = orderIds.slice(i, i + batchSize);

      try {
        const { data, error } = await supabase.functions.invoke('lalamove-api', {
          body: { action: 'fetch-orders-bulk', orderIds: batch },
        });

        if (error) throw error;

        const response = typeof data === 'string' ? JSON.parse(data) : data;
        const results = response.data?.results || [];

        for (const r of results) {
          if (r.success) {
            totalSuccess++;
          } else {
            totalFailed++;
            errors.push(`${r.orderId}: ${r.error}`);
          }
        }
      } catch (err) {
        totalFailed += batch.length;
        errors.push(`Batch error: ${err instanceof Error ? err.message : 'unknown'}`);
      }

      setProgress(Math.round(((i + batch.length) / orderIds.length) * 100));
    }

    setResult({
      total: orderIds.length,
      success: totalSuccess,
      failed: totalFailed,
      errors: errors.slice(0, 10),
    });

    if (totalSuccess > 0) {
      toast.success(`${totalSuccess} corridas importadas!`);
      onSuccess();
    }

    setImporting(false);
  };

  const reset = () => {
    setFile(null);
    setOrderIds([]);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Importar Histórico via CSV
          </DialogTitle>
          <DialogDescription>
            Exporte o histórico do Partner Portal Lalamove como CSV e importe aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div 
            className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
              disabled={importing}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {orderIds.length} IDs de corrida encontrados
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="ml-2" onClick={(e) => { e.stopPropagation(); reset(); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar arquivo CSV
                </p>
              </>
            )}
          </div>

          {/* Preview */}
          {orderIds.length > 0 && !result && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Prévia — {orderIds.length} corrida{orderIds.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {orderIds.slice(0, 20).map(id => (
                  <Badge key={id} variant="muted" className="font-mono text-xs">
                    {id.length > 12 ? `...${id.slice(-8)}` : id}
                  </Badge>
                ))}
                {orderIds.length > 20 && (
                  <Badge variant="muted">+{orderIds.length - 20} mais</Badge>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Importando corridas...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{progress}%</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3 p-4 rounded-lg border bg-secondary/30">
              <p className="font-medium text-foreground">Resultado da importação</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-foreground">{result.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="p-2 rounded-lg bg-success/10">
                  <p className="text-lg font-bold text-success">{result.success}</p>
                  <p className="text-xs text-muted-foreground">Sucesso</p>
                </div>
                <div className="p-2 rounded-lg bg-destructive/10">
                  <p className="text-lg font-bold text-destructive">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {result ? (
              <Button variant="outline" onClick={reset}>Nova Importação</Button>
            ) : (
              <Button 
                variant="gradient" 
                onClick={handleImport} 
                disabled={!orderIds.length || importing}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar {orderIds.length} corrida{orderIds.length > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
