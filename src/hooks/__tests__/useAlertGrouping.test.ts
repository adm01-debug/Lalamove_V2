import { describe, expect, it } from 'vitest';
import { alertIcons, alertTypeLabels } from '../useAlertGrouping';
import type { AlertType } from '@/types';

// Lista espelha o enum `alert_type` do banco. Se um tipo novo entrar no enum e
// ninguém completar os mapas, o agrupamento por tipo na tela de Alertas recebe
// ícone indefinido e o header quebra a página (React "Element type is invalid").
const TIPOS_DO_BANCO: AlertType[] = [
  'DRIVER_BLOCKED',
  'ROUTE_DEVIATION',
  'DRIVER_STOPPED',
  'LATE_DELIVERY',
  'APPROVAL_REQUIRED',
  'ORDER_CANCELLED',
  'INTEGRATION_FAILURE',
  'DRIVER_APPROACHING_PICKUP',
  'DRIVER_ARRIVED_PICKUP',
  'DRIVER_APPROACHING_DELIVERY',
  'DRIVER_ARRIVED_DELIVERY',
  'ETA_DELAY',
  'SUPPLIER_DELAY_NOTICE',
  'MISSING_POD',
  'GEO_BUDGET_WARNING',
  'DRIVER_ASSIGNED',
  'DRIVER_NO_CONFIRMATION',
];

describe('mapas de alerta', () => {
  it('todo tipo do banco tem rótulo e ícone', () => {
    const semRotulo = TIPOS_DO_BANCO.filter((tipo) => !alertTypeLabels[tipo]);
    const semIcone = TIPOS_DO_BANCO.filter((tipo) => !alertIcons[tipo]);
    expect(semRotulo).toEqual([]);
    expect(semIcone).toEqual([]);
  });

  it('cobre os tipos que já existem em produção', () => {
    expect(alertTypeLabels.MISSING_POD).toBeTruthy();
    expect(alertIcons.MISSING_POD).toBeTruthy();
    expect(alertTypeLabels.DRIVER_APPROACHING_PICKUP).toBeTruthy();
    expect(alertTypeLabels.DRIVER_NO_CONFIRMATION).toBeTruthy();
  });
});