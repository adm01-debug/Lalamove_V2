import { useRef, useState } from 'react';
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
import { resolveDeliveryPoint, type GeoAddress } from '@/hooks/useGeoSearch';
import { CepQuickFill } from './CepQuickFill';
import { useQuotationExpiry } from '@/hooks/useQuotationExpiry';
import { validateBrazilianPhone, maskBrazilianPhone } from '@/lib/phone';
import { parseOrderError, type OrderErrorField } from '@/lib/orderErrors';
import { ContactPicker } from './ContactPicker';
import { useContacts, type Contact } from '@/hooks/useContacts';
import {
  SERVICE_CATALOG,
  SPECIAL_REQUESTS_BY_SERVICE,
  SPECIAL_REQUEST_CITY_RESTRICTIONS,
  ITEM_WEIGHT_RANGES,
  isServiceType,
  serviceAcceptsItem,
  servicesForCity,
  serviceAvailableInCity,
  filterValidSpecialRequests,
  CITY_LABELS,
} from '@/lib/lalamoveCatalog';
import {
  SERVICE_EMOJI,
  ITEM_CATEGORY_LABELS,
  HANDLING_LABELS,
  humanizeSpecialRequest,
  humanizeWeightRange,
} from '@/lib/lalamoveLabels';
import {
  SERVICE_TYPES,
  CITY_CODES,
  ITEM_CATEGORIES,
  HANDLING_INSTRUCTIONS,
  type LalamoveServiceType,
  type LalamoveCityCode,
} from '@/types/lalamove';



interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Etapa 7 — a UI passa a consumir o catálogo canônico (docs/LALAMOVE_MASTER_ANALYSIS.md).
// A lista é por cidade: a Lalamove recusa com 422 ERR_INVALID_FIELD qualquer
// serviceType que a praça de coleta não ofereça (Curitiba tem 6 dos 14).
function vehicleTypesForCity(city: LalamoveCityCode) {
  return servicesForCity(city).map(value => ({
    value,
    label: `${SERVICE_EMOJI[value]} ${SERVICE_CATALOG[value].label}`,
    description:
      `até ${SERVICE_CATALOG[value].maxWeightKg} kg` +
      (SERVICE_CATALOG[value].cities === null
        ? ' — todas as cidades'
        : ` — ${SERVICE_CATALOG[value].cities!.length} cidades`),
  }));
}

const cityOptions = CITY_CODES.map(value => ({ value, label: CITY_LABELS[value] }));

const itemCategoryOptions = ITEM_CATEGORIES.map(value => ({
  value,
  label: ITEM_CATEGORY_LABELS[value],
}));

const handlingInstructionOptions = HANDLING_INSTRUCTIONS.map(value => ({
  value,
  label: HANDLING_LABELS[value],
}));

type Step = 'form' | 'quoting' | 'quoted' | 'creating' | 'done';

/**
 * Etapa 35: coordenada da parada para a cotação.
 *
 * A Lalamove aceita parada só com endereço (ela geocodifica para cobrar a distância) e
 * **rejeita** lat/lng 0,0 com `ERR_OUT_OF_SERVICE_AREA` — por isso este helper devolve
 * `{}` em vez de um placeholder quando não há ponto. Quando o operador escolheu uma
 * sugestão, mandamos o ponto exato: o que ele viu no mapa é o que a API cota.
 */
function stopCoordinates(address: GeoAddress | null): { coordinates?: { lat: string; lng: string } } {
  const point = address ? resolveDeliveryPoint(address) : null;
  if (!point) return {};
  return { coordinates: { lat: String(point.lat), lng: String(point.lng) } };
}

interface QuotationResult {  quotationId: string;
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
  // Etapa 10 — diferença de preço detectada na revalidação da cotação.
  const [priceChange, setPriceChange] = useState<{ from: string; to: string } | null>(null);
  // Guarda de idempotência contra duplo clique em "Confirmar Pedido".
  const submittingRef = useRef(false);
  const { upsertContact } = useContacts();


  const applyContact = (which: 'sender' | 'recipient', contact: Contact) => {
    // Reaproveita telefone já validado (E.164) mascarado para o input BR.
    const localDigits = contact.phone_e164.replace(/^\+55/, '');
    const maskedPhone = maskBrazilianPhone(localDigits);
    if (which === 'sender') {
      setForm(prev => ({
        ...prev,
        senderName: contact.name,
        senderPhone: maskedPhone,
        ...(contact.address ? { pickupAddress: contact.address } : {}),
      }));
    } else {
      setForm(prev => ({
        ...prev,
        recipientName: contact.name,
        recipientPhone: maskedPhone,
        ...(contact.address ? { deliveryAddress: contact.address } : {}),
      }));
    }
    setServerFieldError(null);
  };

  const [form, setForm] = useState({
    senderName: '',
    senderPhone: '',
    recipientName: '',
    recipientPhone: '',
    pickupAddress: '',
    deliveryAddress: '',
    // Praca da coleta: decide quais serviceType a Lalamove aceita (422 se errado).
    city: 'BR CWB' as LalamoveCityCode,
    vehicleType: 'LALAGO',
    remarks: '',
    specialRequests: [] as string[],
    isPODEnabled: true,
    internalOrderId: '',
    internalNotes: '',
    // Scheduled pickup (Lalamove v3: ISO-8601 UTC; janela 30min–30dias)
    scheduleAt: '',
    // Item Information (Lalamove v3)
    itemQuantity: '1',
    itemWeight: '',
    itemCategories: [] as string[],
    itemHandling: [] as string[],
    // Guardian fields
    autoNotifySupplier: false,
    supplierContact: '',
    stalledThreshold: 15,
    requiresPod: true,
  });

  // Etapa 35: coordenada escolhida no autocomplete. A cotação aceita só texto (a
  // Lalamove geocodifica para cobrar a distância), mas quando o operador já escolheu
  // uma sugestão nós mandamos a coordenada real: elimina divergência entre o ponto
  // que o operador viu e o que a API resolveu, e evita cair fora da área de serviço.
  const [pickupGeo, setPickupGeo] = useState<GeoAddress | null>(null);
  const [deliveryGeo, setDeliveryGeo] = useState<GeoAddress | null>(null);

  const updateField = (field: string, value: string | boolean | string[] | number) => {
    // Limpa o erro específico do servidor quando o campo relacionado é editado.
    if (serverFieldError) {
      const relatedByField: Record<string, OrderErrorField> = {
        senderPhone: 'senderPhone',
        recipientPhone: 'recipientPhone',
        scheduleAt: 'schedule',
        pickupAddress: 'address',
        deliveryAddress: 'address',
      };
      if (relatedByField[field] === serverFieldError.field) {
        setServerFieldError(null);
      }
    }
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Ao trocar o serviço, remove Special Requests e faixas de peso incompatíveis.
      if (field === 'vehicleType' && isServiceType(String(value))) {
        const service = String(value) as LalamoveServiceType;
        next.specialRequests = filterValidSpecialRequests(prev.specialRequests, service, prev.city);
        const ranges = ITEM_WEIGHT_RANGES[service];
        next.itemWeight = ranges && ranges.length > 0 ? ranges[0] : '';
      }
      // Ao trocar de praça, o serviço selecionado pode não existir lá: cai no
      // primeiro disponível em vez de deixar o operador enviar e tomar 422.
      if (field === 'city') {
        const city = String(value) as LalamoveCityCode;
        const current = prev.vehicleType;
        const needsFallback = !isServiceType(current) || !serviceAvailableInCity(current, city);
        const service = needsFallback ? servicesForCity(city)[0] : current;
        if (service) {
          if (needsFallback) {
            next.vehicleType = service;
            const ranges = ITEM_WEIGHT_RANGES[service];
            next.itemWeight = ranges && ranges.length > 0 ? ranges[0] : '';
          }
          // Reaplica as DUAS restrições (serviço + cidade): mesmo quando o
          // serviço continua válido na nova praça, um special request como
          // REFRIGERATED_VEHICLE pode estar restrito a outra cidade
          // (SPECIAL_REQUEST_CITY_RESTRICTIONS) e ficava esquecido no payload.
          next.specialRequests = filterValidSpecialRequests(prev.specialRequests, service, city);
        }
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

  const activeService: LalamoveServiceType = isServiceType(form.vehicleType)
    ? form.vehicleType
    : 'LALAGO';

  // Só os veículos que a praça de coleta realmente atende.
  const availableVehicleTypes = vehicleTypesForCity(form.city);

  // Opções válidas de Special Requests para o serviço atualmente selecionado.
  const availableSpecialRequests: { value: string; label: string; restriction: string | null }[] =
    SPECIAL_REQUESTS_BY_SERVICE[activeService].map(code => ({
      value: code,
      label: humanizeSpecialRequest(code),
      restriction: SPECIAL_REQUEST_CITY_RESTRICTIONS[code]
        ? `Somente ${SPECIAL_REQUEST_CITY_RESTRICTIONS[code].join(', ')}`
        : null,
    }));

  // `deliveryItemSpecification` só é processado por alguns serviços (errata BR).
  const acceptsItem = serviceAcceptsItem(activeService);
  const weightOptions = (ITEM_WEIGHT_RANGES[activeService] ?? []).map(value => ({    value,
    label: humanizeWeightRange(value),
  }));


  // Valida janela do agendamento: 30min a 30 dias no futuro.
  const scheduleValidation = (() => {
    if (!form.scheduleAt) return { valid: true as const, iso: '' as string, error: '' };
    const dt = new Date(form.scheduleAt);
    if (Number.isNaN(dt.getTime())) return { valid: false as const, iso: '', error: 'Data/hora inválida' };
    // eslint-disable-next-line react-hooks/purity
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

  // Etapa 10 — margem mínima de validade antes de enviar o pedido.
  // Cotações Lalamove v3 duram ~5 min; abaixo desta margem revalidamos.
  const QUOTE_SAFETY_MARGIN_MS = 45_000;

  const isQuotationFresh = (q: QuotationResult | null): boolean => {
    if (!q) return false;
    if (!q.expiresAt) return false;
    const target = Date.parse(q.expiresAt);
    if (Number.isNaN(target)) return false;
    // eslint-disable-next-line react-hooks/purity
    return target - Date.now() > QUOTE_SAFETY_MARGIN_MS;
  };

  // Cotação bruta — usada tanto pelo passo 1 quanto pela revalidação automática.
  const requestQuotation = async (): Promise<QuotationResult> => {
    const { data, error: fnError } = await supabase.functions.invoke('lalamove-api', {
      body: {
        action: 'quotation',
        serviceType: form.vehicleType,
        language: 'pt_BR',
        // NUNCA enviar coordenadas placeholder: a Lalamove responde 422
        // ERR_OUT_OF_SERVICE_AREA para lat/lng 0,0 (verificado em producao
        // 21/11/2026) e nenhuma cotacao da interface era concluida. Sem
        // geocodificacao no formulario, enviamos apenas o endereco — a API
        // resolve e devolve as coordenadas reais na cotacao.
        stops: [
          { address: form.pickupAddress.trim(), ...stopCoordinates(pickupGeo) },
          { address: form.deliveryAddress.trim(), ...stopCoordinates(deliveryGeo) },
        ],
        ...(form.specialRequests.length > 0 && { specialRequests: form.specialRequests }),
        ...(scheduleValidation.iso && { scheduleAt: scheduleValidation.iso }),
        // Errata BR: `item` só é processado pelos serviços do catálogo.
        ...(acceptsItem && {
          item: {
            quantity: form.itemQuantity || '1',
            ...(form.itemWeight ? { weight: form.itemWeight } : {}),
            ...(form.itemCategories.length > 0 && { categories: form.itemCategories }),
            ...(form.itemHandling.length > 0 && { handlingInstructions: form.itemHandling }),
          },
        }),

      },
    });

    if (fnError) throw new Error(fnError.message);

    const response = typeof data === 'string' ? JSON.parse(data) : data;
    if (response.error) throw new Error(response.error);

    const quotData = response.data?.data || response.data;
    if (!quotData?.quotationId) throw new Error('Resposta inválida da cotação');

    const stops = quotData.stops || [];
    return {
      quotationId: quotData.quotationId,
      stopIds: stops.map((s: { stopId: string }) => s.stopId),
      totalFee: quotData.priceBreakdown?.total || '0',
      totalFeeCurrency: quotData.priceBreakdown?.currency || 'BRL',
      expiresAt: quotData.expiresAt || '',
    };
  };

  // Step 1: Get quotation from Lalamove
  const handleGetQuotation = async () => {
    if (!isValid) return;
    setStep('quoting');
    setError(null);
    setPriceChange(null);

    try {
      const result = await requestQuotation();
      setQuotation(result);
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
    // Guarda de idempotência: evita duplo clique criando dois pedidos.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStep('creating');
    setError(null);

    try {
      // Etapa 10 — revalidação automática da cotação antes de criar o pedido.
      let activeQuotation = quotation;
      if (!isQuotationFresh(activeQuotation)) {
        const refreshed = await requestQuotation();
        setQuotation(refreshed);

        const previousFee = Number.parseFloat(activeQuotation.totalFee);
        const newFee = Number.parseFloat(refreshed.totalFee);
        const feeChanged =
          Number.isFinite(previousFee) && Number.isFinite(newFee) && previousFee !== newFee;

        if (feeChanged) {
          // Preço mudou: exige confirmação explícita do novo valor.
          setPriceChange({ from: activeQuotation.totalFee, to: refreshed.totalFee });
          setStep('quoted');
          toast.warning('O preço da cotação mudou', {
            description: 'Revise o novo valor e confirme novamente para criar o pedido.',
          });
          submittingRef.current = false;
          return;
        }

        setPriceChange(null);
        activeQuotation = refreshed;
      }

      const { data, error: fnError } = await supabase.functions.invoke('lalamove-api', {
        body: {
          action: 'order',
          quotationId: activeQuotation.quotationId,
          isPODEnabled: form.isPODEnabled,
          sender: {
            stopId: activeQuotation.stopIds[0],
            name: form.senderName.trim(),
            phone: senderPhoneValidation.valid ? senderPhoneValidation.e164 : '',
          },
          recipients: [{
            stopId: activeQuotation.stopIds[1],
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
      setPriceChange(null);
      toast.success('Pedido criado com sucesso na Lalamove!');

      // Salva/atualiza contatos reutilizáveis (dedup por telefone E.164).
      if (senderPhoneValidation.valid && form.senderName.trim()) {
        void upsertContact({
          name: form.senderName.trim(),
          phoneE164: senderPhoneValidation.e164,
          address: form.pickupAddress.trim() || null,
          kind: 'sender',
        }).catch(() => {/* silencioso: não deve bloquear o fluxo do pedido */});
      }
      if (recipientPhoneValidation.valid && form.recipientName.trim()) {
        void upsertContact({
          name: form.recipientName.trim(),
          phoneE164: recipientPhoneValidation.e164,
          address: form.deliveryAddress.trim() || null,
          kind: 'recipient',
        }).catch(() => {/* silencioso */});
      }

      // Reset after delay
      setTimeout(() => {
        resetForm();
        onOpenChange(false);
        onSuccess();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar pedido';
      const parsed = parseOrderError(msg);
      setError(parsed.description);
      setServerFieldError({ field: parsed.field, message: parsed.description });
      // Se o problema for corrigível no formulário, volta para o form; caso contrário mantém no quoted.
      const backToForm = parsed.field === 'senderPhone' || parsed.field === 'recipientPhone' || parsed.field === 'schedule' || parsed.field === 'address';
      setStep(backToForm ? 'form' : 'quoted');
      toast.error(parsed.title, { description: parsed.description });
    } finally {
      submittingRef.current = false;
    }
  };


  const resetForm = () => {
    setStep('form');
    setQuotation(null);
    setError(null);
    setServerFieldError(null);
    setPickupGeo(null);
    setDeliveryGeo(null);
    setForm({
      senderName: '',
      senderPhone: '',
      recipientName: '',
      recipientPhone: '',
      pickupAddress: '',
      deliveryAddress: '',
      city: 'BR CWB' as LalamoveCityCode,
      vehicleType: 'LALAGO',
      remarks: '',
      specialRequests: [],
      isPODEnabled: true,
      internalOrderId: '',
      internalNotes: '',
      scheduleAt: '',
      itemQuantity: '1',
      itemWeight: '',
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
            priceChange={priceChange}
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
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-info" />
                  Remetente (Coleta)
                </p>
                <ContactPicker
                  kind="sender"
                  label="Buscar remetente"
                  onSelect={contact => applyContact('sender', contact)}
                />
              </div>
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
                    aria-invalid={
                      (form.senderPhone.length > 0 && !senderPhoneValidation.valid) ||
                      serverFieldError?.field === 'senderPhone'
                    }
                  />
                  {form.senderPhone.length > 0 && !senderPhoneValidation.valid && (
                    <p className="text-[11px] text-destructive">{senderPhoneValidation.error}</p>
                  )}
                  {serverFieldError?.field === 'senderPhone' && (
                    <p className="text-[11px] text-destructive" role="alert">
                      Servidor rejeitou este número: {serverFieldError.message}
                    </p>
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
                  onChange={val => {
                    updateField('pickupAddress', val);
                    // Texto editado à mão invalida a coordenada que veio do provedor:
                    // manter o ponto antigo faria a cotação usar outro endereço.
                    if (pickupGeo && val !== pickupGeo.formatted) setPickupGeo(null);
                  }}
                  onAddressSelected={setPickupGeo}
                  placeholder="Endereço de coleta"
                />
              </div>
            </div>

            {/* Destinatário */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-success" />
                  Destinatário (Entrega)
                </p>
                <ContactPicker
                  kind="recipient"
                  label="Buscar destinatário"
                  onSelect={contact => applyContact('recipient', contact)}
                />
              </div>
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
                    aria-invalid={
                      (form.recipientPhone.length > 0 && !recipientPhoneValidation.valid) ||
                      serverFieldError?.field === 'recipientPhone'
                    }
                  />
                  {form.recipientPhone.length > 0 && !recipientPhoneValidation.valid && (
                    <p className="text-[11px] text-destructive">{recipientPhoneValidation.error}</p>
                  )}
                  {serverFieldError?.field === 'recipientPhone' && (
                    <p className="text-[11px] text-destructive" role="alert">
                      Servidor rejeitou este número: {serverFieldError.message}
                    </p>
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
                  onChange={val => {
                    updateField('deliveryAddress', val);
                    if (deliveryGeo && val !== deliveryGeo.formatted) setDeliveryGeo(null);
                  }}
                  onAddressSelected={setDeliveryGeo}
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

            {/* Praça da coleta — define os veículos disponíveis */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-semibold">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Cidade da coleta
              </Label>
              <Select value={form.city} onValueChange={v => updateField('city', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cityOptions.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {availableVehicleTypes.length} de {SERVICE_TYPES.length} veículos atendem{' '}
                {CITY_LABELS[form.city]}
              </p>
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
                  {availableVehicleTypes.map(vt => (
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

            {/* Item Information (Lalamove v3) — apenas serviços que aceitam `item` */}
            {acceptsItem && (
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
                    <SelectTrigger><SelectValue placeholder="Selecione a faixa" /></SelectTrigger>
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
            )}


            {/* Special Requests — filtrados por tipo de veículo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Solicitações Especiais</Label>
                <span className="text-[10px] text-muted-foreground">
                  {availableSpecialRequests.length} disponíveis para {SERVICE_CATALOG[activeService].label}
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
                      <span className="flex flex-col">
                        {sr.label}
                        {sr.restriction && (
                          <span className="text-[10px] text-muted-foreground">{sr.restriction}</span>
                        )}
                      </span>
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
                // eslint-disable-next-line react-hooks/purity
                min={new Date(Date.now() + 31 * 60000).toISOString().slice(0, 16)}
                // eslint-disable-next-line react-hooks/purity
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
  /** Diferença de preço detectada na revalidação automática (Etapa 10). */
  priceChange: { from: string; to: string } | null;
  onBack: () => void;
  onConfirm: () => void;
  onRequote: () => void;
}

function QuotedStep({ quotation, form, error, priceChange, onBack, onConfirm, onRequote }: QuotedStepProps) {
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
          Esta cotação expirou. Ao confirmar, uma nova cotação será solicitada automaticamente.
        </div>
      )}

      {priceChange && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          O preço mudou na revalidação: de {priceChange.from} para {priceChange.to}. Confirme novamente para prosseguir com o novo valor.
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
        <Button variant="outline" onClick={onRequote}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Recotar
        </Button>
        <Button variant="gradient" onClick={onConfirm}>
          <Zap className="w-4 h-4 mr-2" />
          {expiry.isExpired ? 'Revalidar e confirmar' : 'Confirmar Pedido'}
        </Button>
      </div>
    </div>
  );
}
