import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, MapPin, User, Phone, Package, Truck, DollarSign, Zap, CheckCircle2, AlertTriangle, Weight, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddressAutocomplete } from './AddressAutocomplete';
import { CepQuickFill } from './CepQuickFill';
import { useQuotationExpiry } from '@/hooks/useQuotationExpiry';
import { validateBrazilianPhone, maskBrazilianPhone } from '@/lib/phone';
import { parseOrderError, type OrderErrorField } from '@/lib/orderErrors';


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

// Catálogo canônico de Special Requests (Lalamove v3 BR).
const specialRequestCatalog: Record<string, string> = {
  HELP_BUY: 'Comprar no local',
  TOLL_FEE: 'Pedágio incluso',
  ROUND_TRIP: 'Ida e volta',
  DOOR_TO_DOOR: 'Porta a porta',
  THERMAL_BAG_1: 'Bag térmica',
  PURCHASE_SERVICE_1: 'Serviço de compra',
  MOVING_SERVICE: 'Auxílio de mudança',
  LOADING_SERVICE: 'Auxílio de carregamento',
};

// Matriz de compatibilidade por tipo de veículo — Lalamove v3.
const specialRequestsByVehicle: Record<string, string[]> = {
  MOTORCYCLE: ['HELP_BUY', 'TOLL_FEE', 'DOOR_TO_DOOR', 'THERMAL_BAG_1', 'PURCHASE_SERVICE_1'],
  CAR: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR'],
  MPV: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR'],
  VAN: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
  UV_FIORINO: ['HELP_BUY', 'TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE'],
  TRUCK175: ['TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
  TRUCK330: ['TOLL_FEE', 'ROUND_TRIP', 'DOOR_TO_DOOR', 'MOVING_SERVICE', 'LOADING_SERVICE'],
};
const weightOptions = [
  { value: 'LESS_THAN_3_KG', label: '≤ 3 kg' },
  { value: 'BETWEEN_3_KG_AND_10_KG', label: '3 – 10 kg' },
  { value: 'BETWEEN_10_KG_AND_50_KG', label: '10 – 50 kg' },
  { value: 'MORE_THAN_50_KG', label: '> 50 kg' },
];

const itemCategoryOptions = [
  { value: 'FOOD_DELIVERY', label: 'Alimentos' },
  { value: 'OFFICE_ITEM', label: 'Material de escritório' },
  { value: 'FURNITURE', label: 'Móveis' },
  { value: 'FRAGILE_GOODS', label: 'Frágil' },
];

const handlingInstructionOptions = [
  { value: 'KEEP_UPRIGHT', label: 'Manter em pé' },
  { value: 'FRAGILE', label: 'Frágil — cuidado' },
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
  const [serverFieldError, setServerFieldError] = useState<{ field: OrderErrorField; message: string } | null>(null);
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
    // Scheduled pickup (Lalamove v3: ISO-8601 UTC; janela 30min–30dias)
    scheduleAt: '',
    // Item Information (Lalamove v3)
    itemQuantity: '1',
    itemWeight: 'LESS_THAN_3_KG',
    itemCategories: [] as string[],
    itemHandling: [] as string[],
    // Guardian fields
    autoNotifySupplier: false,
    supplierContact: '',
    stalledThreshold: 15,
    requiresPod: true,
  });

  const updateField = (field: string, value: string | boolean | string[] | number) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Ao trocar o veículo, remove Special Requests incompatíveis (Lalamove v3).
      if (field === 'vehicleType' && typeof value === 'string') {
        const allowed = specialRequestsByVehicle[value] ?? [];
        next.specialRequests = prev.specialRequests.filter(sr => allowed.includes(sr));
      }
      return next;
    });
  };

  const toggleSpecialRequest = (value: string) => {
    setForm(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.includes(value)
        ? prev.specialRequests.filter(v => v !== value)
        : [...prev.specialRequests, value],
    }));
  };

  // Opções válidas de Special Requests para o veículo atualmente selecionado.
  const availableSpecialRequests: { value: string; label: string }[] =
    (specialRequestsByVehicle[form.vehicleType] ?? []).map(v => ({
      value: v,
      label: specialRequestCatalog[v] ?? v,
    }));

  // Valida janela do agendamento: 30min a 30 dias no futuro.
  const scheduleValidation = (() => {
    if (!form.scheduleAt) return { valid: true as const, iso: '' as string, error: '' };
    const dt = new Date(form.scheduleAt);
    if (Number.isNaN(dt.getTime())) return { valid: false as const, iso: '', error: 'Data/hora inválida' };
    const diffMin = (dt.getTime() - Date.now()) / 60000;
    if (diffMin < 30) return { valid: false as const, iso: '', error: 'Agendamento mínimo: 30 minutos à frente' };
    if (diffMin > 30 * 24 * 60) return { valid: false as const, iso: '', error: 'Agendamento máximo: 30 dias' };
    return { valid: true as const, iso: dt.toISOString(), error: '' };
  })();

  // Validação E.164 dos telefones (Lalamove v3 exige celular BR válido).
  const senderPhoneValidation = validateBrazilianPhone(form.senderPhone);
  const recipientPhoneValidation = validateBrazilianPhone(form.recipientPhone);

  const isValid = Boolean(
    form.senderName.trim() &&
    form.recipientName.trim() &&
    form.pickupAddress.trim() &&
    form.deliveryAddress.trim() &&
    scheduleValidation.valid &&
    senderPhoneValidation.valid &&
    recipientPhoneValidation.valid,
  );

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
          ...(scheduleValidation.iso && { scheduleAt: scheduleValidation.iso }),
          item: {
            quantity: form.itemQuantity || '1',
            weight: form.itemWeight,
            ...(form.itemCategories.length > 0 && { categories: form.itemCategories }),
            ...(form.itemHandling.length > 0 && { handlingInstructions: form.itemHandling }),
          },
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
      const parsed = parseOrderError(msg);
      setError(parsed.description);
      setServerFieldError({ field: parsed.field, message: parsed.description });
      setStep('form');
      toast.error(parsed.title, { description: parsed.description });
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
            phone: senderPhoneValidation.valid ? senderPhoneValidation.e164 : '',
          },
          recipients: [{
            stopId: quotation.stopIds[1],
            name: form.recipientName.trim(),
            phone: recipientPhoneValidation.valid ? recipientPhoneValidation.e164 : '',
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
      scheduleAt: '',
      itemQuantity: '1',
      itemWeight: 'LESS_THAN_3_KG',
      itemCategories: [],
      itemHandling: [],
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
          <QuotedStep
            quotation={quotation}
            form={form}
            error={error}
            onBack={() => { setStep('form'); setQuotation(null); setError(null); }}
            onConfirm={handleCreateOrder}
            onRequote={() => { setQuotation(null); setError(null); handleGetQuotation(); }}
          />
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
                    inputMode="tel"
                    maxLength={16}
                    value={form.senderPhone}
                    onChange={e => updateField('senderPhone', maskBrazilianPhone(e.target.value))}
                    aria-invalid={form.senderPhone.length > 0 && !senderPhoneValidation.valid}
                  />
                  {form.senderPhone.length > 0 && !senderPhoneValidation.valid && (
                    <p className="text-[11px] text-destructive">{senderPhoneValidation.error}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3 text-info" /> Endereço de Coleta *</Label>
                <CepQuickFill
                  accent="info"
                  label="CEP da coleta"
                  onResolved={(formatted) => updateField('pickupAddress', formatted)}
                />
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
                    inputMode="tel"
                    maxLength={16}
                    value={form.recipientPhone}
                    onChange={e => updateField('recipientPhone', maskBrazilianPhone(e.target.value))}
                    aria-invalid={form.recipientPhone.length > 0 && !recipientPhoneValidation.valid}
                  />
                  {form.recipientPhone.length > 0 && !recipientPhoneValidation.valid && (
                    <p className="text-[11px] text-destructive">{recipientPhoneValidation.error}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3 text-success" /> Endereço de Entrega *</Label>
                <CepQuickFill
                  accent="success"
                  label="CEP da entrega"
                  onResolved={(formatted) => updateField('deliveryAddress', formatted)}
                />
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

            {/* Item Information (Lalamove v3) */}
            <div className="space-y-3 p-3 rounded-xl border border-border/50 bg-background/50">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-muted-foreground" />
                Informações da Carga
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.itemQuantity}
                    onChange={e => updateField('itemQuantity', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Weight className="w-3 h-3" /> Peso</Label>
                  <Select value={form.itemWeight} onValueChange={v => updateField('itemWeight', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {weightOptions.map(w => (
                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categorias</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {itemCategoryOptions.map(c => (
                    <label key={c.value} className="flex items-center gap-2 p-1.5 rounded border border-border/50 hover:bg-secondary/50 cursor-pointer text-xs">
                      <Checkbox
                        checked={form.itemCategories.includes(c.value)}
                        onCheckedChange={() => updateField('itemCategories',
                          form.itemCategories.includes(c.value)
                            ? form.itemCategories.filter(v => v !== c.value)
                            : [...form.itemCategories, c.value]
                        )}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instruções de Manuseio</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {handlingInstructionOptions.map(h => (
                    <label key={h.value} className="flex items-center gap-2 p-1.5 rounded border border-border/50 hover:bg-secondary/50 cursor-pointer text-xs">
                      <Checkbox
                        checked={form.itemHandling.includes(h.value)}
                        onCheckedChange={() => updateField('itemHandling',
                          form.itemHandling.includes(h.value)
                            ? form.itemHandling.filter(v => v !== h.value)
                            : [...form.itemHandling, h.value]
                        )}
                      />
                      {h.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>


            {/* Special Requests — filtrados por tipo de veículo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Solicitações Especiais</Label>
                <span className="text-[10px] text-muted-foreground">
                  {availableSpecialRequests.length} disponíveis para {form.vehicleType}
                </span>
              </div>
              {availableSpecialRequests.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma solicitação especial disponível para este veículo.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableSpecialRequests.map(sr => (
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
              )}
            </div>

            {/* Internal fields */}
            <div className="space-y-2">
              <Label className="text-xs">ID Interno (opcional)</Label>
              <Input
                placeholder="Ex: PED-12345"
                value={form.internalOrderId}
                onChange={e => updateField('internalOrderId', e.target.value)}
              />
            </div>

            {/* Scheduled pickup (Lalamove v3: opcional; janela 30min–30dias) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Agendamento (opcional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduleAt}
                onChange={e => updateField('scheduleAt', e.target.value)}
                min={new Date(Date.now() + 31 * 60000).toISOString().slice(0, 16)}
                max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
              />
              {form.scheduleAt && !scheduleValidation.valid && (
                <p className="text-[11px] text-destructive">{scheduleValidation.error}</p>
              )}
              {form.scheduleAt && scheduleValidation.valid && (
                <p className="text-[11px] text-muted-foreground">
                  Coleta agendada para {new Date(form.scheduleAt).toLocaleString('pt-BR')} — enviado como UTC ISO-8601 à Lalamove.
                </p>
              )}
            </div>


            {/* Guardian System Settings */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-fade-up">
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Zap className="w-4 h-4" />
                LALAMOVE GUARDIAN
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Notificar Fornecedor</Label>
                    <p className="text-[10px] text-muted-foreground">Aviso automático via WhatsApp/Bitrix</p>
                  </div>
                  <Checkbox 
                    checked={form.autoNotifySupplier}
                    onCheckedChange={(v) => updateField('autoNotifySupplier', !!v)}
                  />
                </div>

                {form.autoNotifySupplier && (
                  <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                    <Label className="text-xs">Contato Fornecedor (WhatsApp)</Label>
                    <Input 
                      placeholder="+55 11 9..."
                      value={form.supplierContact}
                      onChange={e => updateField('supplierContact', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Foto Obrigatória (POD)</Label>
                    <p className="text-[10px] text-muted-foreground">Alerta crítico se não houver foto</p>
                  </div>
                  <Checkbox 
                    checked={form.requiresPod}
                    onCheckedChange={(v) => updateField('requiresPod', !!v)}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Alerta Motorista Parado (minutos)</Label>
                  <Select 
                    value={form.stalledThreshold.toString()} 
                    onValueChange={(v) => updateField('stalledThreshold', parseInt(v))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutos (Rígido)</SelectItem>
                      <SelectItem value="10">10 minutos (Padrão)</SelectItem>
                      <SelectItem value="15">15 minutos (Flexível)</SelectItem>
                      <SelectItem value="30">30 minutos (Longo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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

// ---------------------------------------------------------------------------
// QuotedStep — displays the Lalamove quotation with a live expiry countdown.
// A quotation typically expires in ~5 minutes; we disable "Confirmar" once
// expired and offer a one-click re-quote using the same form payload.
// ---------------------------------------------------------------------------
interface QuotedStepProps {
  quotation: QuotationResult;
  form: {
    pickupAddress: string;
    deliveryAddress: string;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone: string;
  };
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
  onRequote: () => void;
}

function QuotedStep({ quotation, form, error, onBack, onConfirm, onRequote }: QuotedStepProps) {
  const expiry = useQuotationExpiry(quotation.expiresAt);

  const badgeTone = expiry.isExpired
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : expiry.isCritical
      ? 'bg-warning/15 text-warning border-warning/30'
      : 'bg-success/15 text-success border-success/30';

  return (
    <div className="space-y-4 pt-2">
      <div className="p-4 rounded-xl border bg-success/5 border-success/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Cotação</span>
          {quotation.expiresAt ? (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${badgeTone}`}
              aria-live="polite"
              aria-label={expiry.isExpired ? 'Cotação expirada' : `Expira em ${expiry.formatted}`}
            >
              <Clock className="w-3 h-3" />
              {expiry.isExpired ? 'Expirada' : `Expira em ${expiry.formatted}`}
            </span>
          ) : (
            <Badge variant="success">Aprovada</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-success" />
          <span className="text-2xl font-bold text-foreground">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: quotation.totalFeeCurrency }).format(parseFloat(quotation.totalFee))}
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>ID Cotação: <code className="font-mono">{quotation.quotationId}</code></p>
          {quotation.expiresAt && (
            <p>Expira em: {new Date(quotation.expiresAt).toLocaleString('pt-BR')}</p>
          )}
        </div>
      </div>

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

      {expiry.isExpired && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Esta cotação expirou. Solicite uma nova para prosseguir.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        {expiry.isExpired ? (
          <Button variant="gradient" onClick={onRequote}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Recotar
          </Button>
        ) : (
          <Button variant="gradient" onClick={onConfirm} disabled={expiry.isExpired}>
            <Zap className="w-4 h-4 mr-2" />
            Confirmar Pedido
          </Button>
        )}
      </div>
    </div>
  );
}
