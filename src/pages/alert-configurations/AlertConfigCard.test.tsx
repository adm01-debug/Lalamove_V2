import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertConfigCard } from './AlertConfigCard';
import type { AlertConfiguration } from '@/hooks/useAlertConfigurations';

vi.mock('@/hooks/useAlertConfigurations', () => ({
  useUpdateAlertConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAlertConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useTestNotification', () => ({
  useTestNotification: () => ({ mutate: vi.fn(), isPending: false }),
}));

function makeConfig(over: Partial<AlertConfiguration> = {}): AlertConfiguration {
  return {
    id: 'cfg-1',
    alert_type: 'DRIVER_APPROACHING_PICKUP' as AlertConfiguration['alert_type'],
    name: null,
    channel: 'whatsapp',
    is_enabled: true,
    message_template: 'Olá {{pickup_contact_name}}, o motorista {{driver_name}} ({{driver_plate}}) chega em ~{{eta_min}} min.',
    notify_whatsapp: true,
    notify_email: false,
    notify_slack: false,
    notify_bitrix24_task: false,
    notify_n8n_webhook: false,
    whatsapp_numbers: null,
    email_addresses: null,
    slack_channels: null,
    bitrix24_user_ids: null,
    n8n_webhook_url: null,
    min_interval_seconds: 300,
    dedup_window_seconds: 300,
    escalation_enabled: false,
    escalation_after_seconds: 600,
    escalation_email_addresses: null,
    escalation_whatsapp_numbers: null,
    escalation_slack_channels: null,
    fallback_channel: null,
    fallback_recipients: null,
    conditions: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('AlertConfigCard — eventos geo (etapa 72)', () => {
  it('mostra rótulo em PT-BR para os 8 tipos geo, não o alert_type cru', () => {
    const cases: Array<[string, string]> = [
      ['DRIVER_APPROACHING_PICKUP', 'Motorista aproximando da coleta'],
      ['DRIVER_ARRIVED_PICKUP', 'Motorista chegou na coleta'],
      ['DRIVER_APPROACHING_DELIVERY', 'Motorista aproximando da entrega'],
      ['DRIVER_ARRIVED_DELIVERY', 'Motorista chegou na entrega'],
      ['ETA_DELAY', 'Atraso previsto pelo ETA'],
      ['SUPPLIER_DELAY_NOTICE', 'Aviso de atraso ao fornecedor'],
      ['MISSING_POD', 'POD não anexado'],
      ['GEO_BUDGET_WARNING', 'Orçamento geo próximo do limite'],
    ];
    for (const [type, label] of cases) {
      const { unmount } = render(
        <AlertConfigCard config={makeConfig({ alert_type: type as AlertConfiguration['alert_type'] })} index={0} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('renderiza o preview com os valores de exemplo, sem deixar {{ }} no texto', () => {
    render(<AlertConfigCard config={makeConfig()} index={0} />);
    fireEvent.click(screen.getByLabelText('Editar configuração'));
    const preview = document.querySelector('.whitespace-pre-wrap');
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain('João Silva');
    expect(preview!.textContent).toContain('ABC1D23');
    expect(preview!.textContent).not.toContain('{{');
  });

  it('preserva variável desconhecida no preview em vez de apagar', () => {
    render(<AlertConfigCard config={makeConfig({ message_template: 'Oi {{variavel_inexistente}}' })} index={0} />);
    fireEvent.click(screen.getByLabelText('Editar configuração'));
    const preview = document.querySelector('.whitespace-pre-wrap');
    expect(preview!.textContent).toContain('{{variavel_inexistente}}');
  });
});
