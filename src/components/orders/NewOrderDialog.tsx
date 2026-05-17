import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, MapPin, User, Phone, Package, Truck, DollarSign, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddressAutocomplete } from './AddressAutocomplete';

interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const vehicleTypes = [
  { value: 'MOTORCYCLE', label: '🏍️ Moto', description: 'Entregas rápidas e pequenas' },
  { value: 'CAR', label: '🚗 Carro', description: 'Pacotes médios' },
  { value: 'MPV', label: '🚙 MPV', description: 'Veículo multiuso' },
  { value: 'VAN', label: '🚐 Van', description: 'Cargas maiores' },
  { value: 'UV_FIORINO', label: '🚚 Fiorino', description: 'Utilitário pequeno' },
  { value: 'TRUCK330', label: '🚛 Caminhão 3.3t', description: 'Cargas até 3.300kg' },
  { value: 'TRUCK175', label: '🚛 Caminhão 1.75t', description: 'Cargas até 1.750kg' },
];

const specialRequestOptions = [
  { value: 'HELP_BUY', label: 'Comprar no local' },
  { value: 'TOLL_FEE', label: 'Pedágio incluso' },
  { value: 'ROUND_TRIP', label: 'Ida e volta' },
  { value: 'DOOR_TO_DOOR', label: 'Porta a porta' },
];

type Step = 'form' | 'quoting' | 'quoted' | 'creating' | 'done';

interface QuotationResult {
  quotationId: string;
  stopIds: string[];
  totalFee: string;
  totalFeeCurrency: string;
  expiresAt: string;
}

export function NewOrderDialog({ open, onOpenChange, onSuccess }: NewOrderDialogProps) {
  const [step, setStep] = useState<Step>('form');
  const [quotation, setQuotation] = useState<QuotationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    recipientName: '',
    recipientPhone: '',
    pickupAddress: '',
    deliveryAddress: '',
    vehicleType: 'MOTORCYCLE',
    remarks: '',
    specialRequests: [] as string[],
    isPODEnabled: true,
    internalOrderId: '',
    internalNotes: '',
    // Guardian fields
    autoNotifySupplier: false,
    supplierContact: '',
    stalledThreshold: 15,
    requiresPod: true,
  });

  const updateField = (field: string, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleSpecialRequest = (value: string) => {
    setForm(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.includes(value)
        ? prev.specialRequests.filter(v => v !== value)
        : [...prev.specialRequests, value],
    }));
  };

  const isValid = form.senderName.trim() && form.senderPhone.trim() &&
    form.recipientName.trim() && form.recipientPhone.trim() &&
    form.pickupAddress.trim() && form.deliveryAddress.trim();

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55')) return `+${digits}`;
    return `+55${digits}`;
  };

  // Step 1: Get quotation from Lalamove
  const handleGetQuotation = async () => {
    if (!isValid) return;
    setStep('quoting');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('lalamove-api', {
        body: {
          action: 'quotation',
          serviceType: form.vehicleType,
          language: 'pt_BR',
          stops: [
            { coordinates: { lat: '0', lng: '0' }, address: form.pickupAddress.trim() },
            { coordinates: { lat: '0', lng: '0' }, address: form.deliveryAddress.trim() },
          ],
          ...(form.specialRequests.length > 0 && { specialRequests: form.specialRequests }),
        },
      });

      if (fnError) throw new Error(fnError.message);

      const response = typeof data === 'string' ? JSON.parse(data) : data;

      if (response.error) {
        throw new Error(response.error);
      }

      const quotData = response.data?.data || response.data;
      if (!quotData?.quotationId) {
        throw new Error('Resposta inválida da cotação');
      }

      const stops = quotData.stops || [];
      setQuotation({
        quotationId: quotData.quotationId,
        stopIds: stops.map((s: { stopId: string }) => s.stopId),
        totalFee: quotData.priceBreakdown?.total || '0',
        totalFeeCurrency: quotData.priceBreakdown?.currency || 'BRL',
        expiresAt: quotData.expiresAt || '',
      });
      setStep('quoted');
      toast.success('Cotação recebida!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na cotação';
      setError(msg);
      setStep('form');
      toast.error('Erro na cotação', { description: msg });
    }
  };

  // Step 2: Create order from quotation
  const handleCreateOrder = async () => {
    if (!quotation) return;
    setStep('creating');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('lalamove-api', {
        body: {
          action: 'order',
          quotationId: quotation.quotationId,
          isPODEnabled: form.isPODEnabled,
          sender: {
            stopId: quotation.stopIds[0],
            name: form.senderName.trim(),
            phone: formatPhone(form.senderPhone),
          },
          recipients: [{
            stopId: quotation.stopIds[1],
            name: form.recipientName.trim(),
            phone: formatPhone(form.recipientPhone),
            ...(form.remarks.trim() && { remarks: form.remarks.trim() }),
          }],
          serviceType: form.vehicleType,
          metadata: {
            ...(form.internalOrderId.trim() && { internalOrderId: form.internalOrderId.trim() }),
            // Guardian Metadata
            autoNotifySupplier: form.autoNotifySupplier,
            supplierContact: form.supplierContact.trim(),
            stalledThresholdMinutes: form.stalledThreshold,
            requiresPod: form.requiresPod
          },
        },
      });

      if (fnError) throw new Error(fnError.message);

      const response = typeof data === 'string' ? JSON.parse(data) : data;

      if (response.error) {
        throw new Error(response.error);
      }

      setStep('done');
      toast.success('Pedido criado com sucesso na Lalamove!');
      
      // Reset after delay
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
        onSuccess();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar pedido';
      setError(msg);
      setStep('quoted'); // Go back to quoted step to retry
      toast.error('Erro ao criar pedido', { description: msg });
    }
  };

  const resetForm = () => {
    setStep('form');
    setQuotation(null);
    setError(null);
    setForm({
      senderName: '',
      senderPhone: '',
      recipientName: '',
      recipientPhone: '',
      pickupAddress: '',
      deliveryAddress: '',
      vehicleType: 'MOTORCYCLE',
      remarks: '',
      specialRequests: [],
      isPODEnabled: true,
      internalOrderId: '',
      internalNotes: '',
      autoNotifySupplier: false,
      supplierContact: '',
      stalledThreshold: 15,
      requiresPod: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (step !== 'quoting' && step !== 'creating') { onOpenChange(v); if (!v) resetForm(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            Novo Pedido (Lalamove Guardian)
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'Preencha os dados para solicitar uma cotação.'}
            {step === 'quoting' && 'Obtendo cotação da Lalamove...'}
            {step === 'quoted' && 'Revise a cotação e confirme o pedido.'}
            {step === 'creating' && 'Criando pedido na Lalamove...'}
            {step === 'done' && 'Pedido criado com sucesso!'}
          </DialogDescription>
        </DialogHeader>

        {/* Success State */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <p className="text-lg font-semibold text-foreground">Pedido Criado!</p>
            <p className="text-sm text-muted-foreground">O pedido foi enviado para a Lalamove.</p>
          </div>
        )}

        {/* Quotation Result */}
        {step === 'quoted' && quotation && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl border bg-success/5 border-success/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Cotação</span>
                <Badge variant="success">Aprovada</Badge>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                <span className="text-2xl font-bold text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: quotation.totalFeeCurrency }).format(parseFloat(quotation.totalFee))}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>ID Cotação: <code className="font-mono">{quotation.quotationId}</code></p>
                {quotation.expiresAt && <p>Expira: {new Date(quotation.expiresAt).toLocaleString('pt-BR')}</p>}
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-info mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Coleta</p>
                  <p className="text-foreground">{form.pickupAddress}</p>
                  <p className="text-muted-foreground">{form.senderName} · {form.senderPhone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-success mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Entrega</p>
                  <p className="text-foreground">{form.deliveryAddress}</p>
                  <p className="text-muted-foreground">{form.recipientName} · {form.recipientPhone}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setStep('form'); setQuotation(null); }}>
                Voltar
              </Button>
              <Button variant="gradient" onClick={handleCreateOrder}>
                <Zap className="w-4 h-4 mr-2" />
                Confirmar Pedido
              </Button>
            </div>
          </div>
        )}

        {/* Loading States */}
        {(step === 'quoting' || step === 'creating') && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {step === 'quoting' ? 'Calculando cotação...' : 'Criando pedido...'}
            </p>
          </div>
        )}

        {/* Form */}
        {step === 'form' && (
          <div className="space-y-4 pt-2">
            {/* Remetente */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-info" />
                Remetente (Coleta)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    placeholder="Nome do remetente"
                    value={form.senderName}
                    onChange={e => updateField('senderName', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone *</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={form.senderPhone}
                    onChange={e => updateField('senderPhone', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3 text-info" /> Endereço de Coleta *</Label>
                <AddressAutocomplete
                  value={form.pickupAddress}
                  onChange={val => updateField('pickupAddress', val)}
                  placeholder="Endereço de coleta"
                />
              </div>
            </div>

            {/* Destinatário */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-success" />
                Destinatário (Entrega)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input
                    placeholder="Nome do destinatário"
                    value={form.recipientName}
                    onChange={e => updateField('recipientName', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone *</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={form.recipientPhone}
                    onChange={e => updateField('recipientPhone', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3 text-success" /> Endereço de Entrega *</Label>
                <AddressAutocomplete
                  value={form.deliveryAddress}
                  onChange={val => updateField('deliveryAddress', val)}
                  placeholder="Endereço de entrega"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações para o motorista</Label>
                <Input
                  placeholder="Ex: Entregar na portaria, bloco B"
                  value={form.remarks}
                  onChange={e => updateField('remarks', e.target.value)}
                />
              </div>
            </div>

            {/* Veículo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                Tipo de Veículo
              </Label>
              <Select value={form.vehicleType} onValueChange={v => updateField('vehicleType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map(vt => (
                    <SelectItem key={vt.value} value={vt.value}>
                      <span className="flex items-center gap-2">
                        {vt.label}
                        <span className="text-xs text-muted-foreground">— {vt.description}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Solicitações Especiais</Label>
              <div className="grid grid-cols-2 gap-2">
                {specialRequestOptions.map(sr => (
                  <label
                    key={sr.value}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:bg-secondary/50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={form.specialRequests.includes(sr.value)}
                      onCheckedChange={() => toggleSpecialRequest(sr.value)}
                    />
                    {sr.label}
                  </label>
                ))}
              </div>
            </div>

            {/* POD */}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isPODEnabled}
                onCheckedChange={(v) => updateField('isPODEnabled', !!v)}
              />
              Habilitar Prova de Entrega (POD)
            </label>

            {/* Internal fields */}
            <div className="space-y-2">
              <Label className="text-xs">ID Interno (opcional)</Label>
              <Input
                placeholder="Ex: PED-12345"
                value={form.internalOrderId}
                onChange={e => updateField('internalOrderId', e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="gradient" onClick={handleGetQuotation} disabled={!isValid}>
                <DollarSign className="w-4 h-4 mr-2" />
                Obter Cotação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
