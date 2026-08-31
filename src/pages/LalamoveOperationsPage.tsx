import { useEffect } from 'react';
import { Truck } from 'lucide-react';
import { UapiOrderHistoryPanel } from '@/components/lalamove/UapiOrderHistoryPanel';
import { UapiStatementPanel } from '@/components/lalamove/UapiStatementPanel';
import { UapiCouponsPanel } from '@/components/lalamove/UapiCouponsPanel';
import { UapiFleetPanel } from '@/components/lalamove/UapiFleetPanel';

/**
 * Bloco D (Etapas 20–23) — superfície de UI para as capacidades UAPI que já
 * existiam apenas no backend: histórico por cursor, extrato/comprovantes,
 * cupons e frota corporativa.
 */
export default function LalamoveOperationsPage() {
  useEffect(() => {
    document.title = 'Operações Lalamove | Lalamove Intelligence Hub';
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Truck className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operações Lalamove</h1>
          <p className="text-sm text-muted-foreground">
            Histórico, financeiro, cupons e frota diretamente da conta corporativa.
          </p>
        </div>
      </header>


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UapiOrderHistoryPanel />
        <UapiStatementPanel />
        <UapiCouponsPanel />
        <UapiFleetPanel />
      </div>
    </div>
  );
}
