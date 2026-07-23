import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Search, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { maskCep, validateCep, lookupCep, composeAddress, type ViaCepAddress } from '@/lib/cep';

interface CepQuickFillProps {
  /** Cor do ícone/label — segue o token semântico do fluxo (coleta/entrega). */
  accent?: 'info' | 'success';
  label?: string;
  /** Recebe o endereço formatado final e o CEP mascarado (para persistência). */
  onResolved: (formattedAddress: string, cep: string, base: ViaCepAddress) => void;
}

/**
 * Campo de CEP com máscara, validação e busca ViaCEP. Após localizar
 * o CEP, coleta número + complemento e devolve o endereço normalizado.
 */
export function CepQuickFill({ accent = 'info', label = 'CEP', onResolved }: CepQuickFillProps) {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [base, setBase] = useState<ViaCepAddress | null>(null);
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validation = validateCep(cep);
  const accentClass = accent === 'success' ? 'text-success' : 'text-info';

  const handleLookup = async () => {
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await lookupCep(validation.digits);
      setBase(result);
      onResolved(result.formatted, result.cep, result);
      toast.success('CEP localizado', { description: result.formatted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar CEP';
      setError(msg);
      setBase(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDetails = (nextNumber: string, nextComplement: string) => {
    setNumber(nextNumber);
    setComplement(nextComplement);
    if (base) {
      const formatted = composeAddress(base, { number: nextNumber, complement: nextComplement });
      onResolved(formatted, base.cep, base);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <Label className="text-xs flex items-center gap-1">
        <MapPin className={`w-3 h-3 ${accentClass}`} aria-hidden="true" />
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          value={cep}
          onChange={(e) => setCep(maskCep(e.target.value))}
          placeholder="00000-000"
          inputMode="numeric"
          maxLength={9}
          aria-invalid={cep.length > 0 && !validation.valid}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleLookup}
          disabled={!validation.valid || loading}
          aria-label="Buscar endereço por CEP"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {base && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {base.logradouro ? `${base.logradouro}, ` : ''}
            {base.bairro ? `${base.bairro}, ` : ''}
            {base.cidade} - {base.uf}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Número</Label>
              <Input
                value={number}
                onChange={(e) => handleDetails(e.target.value.replace(/[^\w\s\-/]/g, '').slice(0, 10), complement)}
                placeholder="123"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-[11px]">Complemento (opcional)</Label>
              <Input
                value={complement}
                onChange={(e) => handleDetails(number, e.target.value.slice(0, 60))}
                placeholder="Apto 42, Bloco B"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
