import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { MapHistoryPanel } from '../MapHistoryPanel';
import { MapSearchPanel } from '../MapSearchPanel';
import { MapHUD } from '../MapHUD';

// Etapa 82: os controles de ícone do bloco de mapas precisam de nome acessível vindo do
// i18n, não de string fixa em português. Traduzir de verdade no teste prova que a chave
// existe nos três locales e que o aria-label acompanha o idioma.

const tracking = {
  id: 't1',
  driver: { name: 'João' },
  order: { lalamove_id: 'L1', internal_order_id: 'I1', customer_name: 'Cliente' },
  current_latitude: -23.55,
  current_longitude: -46.63,
  last_updated: new Date().toISOString(),
  eta_minutes: 12,
  is_on_route: true,
  is_stopped: false,
  speed: 30,
  heading: 90,
} as never;

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('pt-BR');
});

describe('etapa 82 — aria-label dos controles de mapa vem do i18n', () => {
  it('MapHistoryPanel: botão fechar usa map.actions.closeHistory', async () => {
    await i18n.changeLanguage('pt-BR');
    render(<MapHistoryPanel show driverName="Motorista X" history={[]} loading={false} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Fechar histórico do motorista' })).toBeTruthy();
  });

  it('MapHistoryPanel: em inglês o aria-label muda de idioma', async () => {
    await i18n.changeLanguage('en');
    render(<MapHistoryPanel show driverName="Driver X" history={[]} loading={false} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close driver history' })).toBeTruthy();
  });

  it('MapHUD: as três ações expõem nome acessível traduzido', async () => {
    await i18n.changeLanguage('pt-BR');
    render(<MapHUD selectedTracking={tracking} offRoute={false} stoppedTime={0} />);
    expect(screen.getByRole('button', { name: 'Abrir Street View' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar WhatsApp ao motorista' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Disparar alerta crítico' })).toBeTruthy();
  });

  it('MapHUD: sem motorista selecionado não renderiza nada (guard preservado)', () => {
    const { container } = render(<MapHUD selectedTracking={null} offRoute={false} stoppedTime={0} />);
    expect(container.childElementCount).toBe(0);
  });

  it('MapSearchPanel: com busca ativa os dois controles têm nome traduzido', async () => {
    await i18n.changeLanguage('pt-BR');
    render(<MapSearchPanel allTrackingData={[]} trackingCount={0} onFocusTracking={() => {}} />);
    // O botão de limpar só existe com texto digitado; o de centralizar é sempre visível.
    expect(screen.getByRole('button', { name: 'Centralizar no alvo' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Buscar ID ou Motorista...'), { target: { value: 'abc' } });
    expect(screen.getByRole('button', { name: 'Limpar busca' })).toBeTruthy();
  });

  it('as chaves usadas existem e são diferentes nos três locales', () => {
    const chaves = [
      'map.actions.closeHistory',
      'map.actions.streetView',
      'map.actions.whatsapp',
      'map.actions.criticalAlert',
      'map.actions.clearSearch',
      'map.actions.centerOnTarget',
      'map.actions.settings',
      'map.actions.styleDark',
      'map.actions.styleSatellite',
      'map.actions.traffic',
      'map.actions.followDriver',
      'map.actions.focusDriver',
    ];
    for (const idioma of ['pt-BR', 'en', 'es']) {
      for (const chave of chaves) {
        expect(i18n.getFixedT(idioma)(chave), `${idioma} → ${chave}`).not.toBe(chave);
      }
    }
    expect(i18n.getFixedT('en')('map.actions.whatsapp')).not.toBe(i18n.getFixedT('es')('map.actions.whatsapp'));
  });
});
