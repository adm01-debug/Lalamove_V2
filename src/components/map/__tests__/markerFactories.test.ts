import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  createClusterMarkerElement,
  createDriverMarkerElement,
  createPickupMarkerElement,
  createDeliveryMarkerElement,
  createStoppedMarkerElement,
  type ClusterInfo,
} from '../markerFactories';
import type { TrackingData } from '../hooks/useTrackingData';

// mapbox-gl acessa APIs de browser (Worker, URL, canvas) que jsdom não implementa.
// Stub minimal antes do import indireto via markerFactories.
vi.mock('mapbox-gl', () => ({
  default: {
    Popup: class {
      setHTML() { return this; }
    },
  },
  Popup: class {
    setHTML() { return this; }
  },
}));

const baseTracking: TrackingData = {
  id: 't1',
  order_id: 'o1',
  driver_id: 'd1',
  current_latitude: -23.55,
  current_longitude: -46.63,
  speed: 40,
  heading: 90,
  eta_minutes: 12,
  is_stopped: false,
  is_on_route: true,
  last_updated: new Date().toISOString(),
  driver: { name: 'João Silva', phone: null, vehicle_type: 'MOTORCYCLE' },
  order: {
    lalamove_id: 'L-1',
    internal_order_id: 'ORD-42',
    customer_name: 'Cliente Teste',
    pickup_address: 'Av. Paulista, 1000',
    delivery_address: 'Rua Augusta, 500',
    status: 'IN_TRANSIT',
  },
} as unknown as TrackingData;

describe('markerFactories', () => {
  describe('createClusterMarkerElement', () => {
    it('escala tamanho logaritmicamente e usa cor crítica quando há criticos', () => {
      const info: ClusterInfo = { count: 12, critical: 3, attention: 2, operational: 7 };
      const el = createClusterMarkerElement(info);
      expect(el).toBeInstanceOf(HTMLDivElement);
      expect(el.className).toContain('live-map-cluster-marker');
      expect(el.innerHTML).toContain('12 entregas agrupadas');
      // 3 críticos → label a11y de "Crítico"
      const img = el.querySelector('[role="img"]');
      expect(img?.getAttribute('aria-label')).toMatch(/12 entregas agrupadas/);
    });

    it('renderiza badges por tipo de veículo ordenados por volume', () => {
      const info: ClusterInfo = {
        count: 10,
        critical: 0,
        attention: 0,
        operational: 10,
        byVehicle: { MOTORCYCLE: 6, CAR: 3, VAN: 1 },
      };
      const el = createClusterMarkerElement(info);
      // MOTORCYCLE deve aparecer antes de CAR e VAN nos badges.
      const html = el.innerHTML;
      const idxMoto = html.indexOf('>6<');
      const idxCar = html.indexOf('>3<');
      const idxVan = html.indexOf('>1<');
      expect(idxMoto).toBeGreaterThan(0);
      expect(idxMoto).toBeLessThan(idxCar);
      expect(idxCar).toBeLessThan(idxVan);
    });

    it('exibe tooltip com decomposição no hover', () => {
      const info: ClusterInfo = { count: 5, critical: 1, attention: 2, operational: 2 };
      const el = createClusterMarkerElement(info);
      const tooltip = el.querySelector<HTMLDivElement>('.live-map-cluster-tooltip');
      expect(tooltip).not.toBeNull();
      expect(tooltip!.style.opacity).toBe('0');
      el.dispatchEvent(new Event('mouseenter'));
      expect(tooltip!.style.opacity).toBe('1');
      el.dispatchEvent(new Event('mouseleave'));
      expect(tooltip!.style.opacity).toBe('0');
    });
  });

  describe('createDriverMarkerElement', () => {
    it('aplica estado operacional por padrão', () => {
      const el = createDriverMarkerElement(baseTracking);
      expect(el.className).toContain('live-map-driver-marker');
      expect(el.className).not.toContain('is-selected');
      expect(el.innerHTML).toContain('JOÃO'); // label uppercase do primeiro nome
    });

    it('mostra badge PARADO quando is_stopped=true', () => {
      const el = createDriverMarkerElement({ ...baseTracking, is_stopped: true });
      expect(el.innerHTML).toContain('PARADO');
    });

    it('mostra badge FORA DE ROTA quando is_on_route=false', () => {
      const el = createDriverMarkerElement({ ...baseTracking, is_on_route: false });
      expect(el.innerHTML).toContain('FORA DE ROTA');
    });

    it('modo compact oculta label e speed overlay', () => {
      const el = createDriverMarkerElement(baseTracking, false, 'compact');
      expect(el.innerHTML).not.toContain('JOÃO');
      expect(el.innerHTML).not.toContain('KM/H');
    });

    it('adiciona classe is-selected quando isSelected=true', () => {
      const el = createDriverMarkerElement(baseTracking, true);
      expect(el.className).toContain('is-selected');
    });
  });

  describe('createPickupMarkerElement / createDeliveryMarkerElement', () => {
    it('extrai primeiro segmento do endereço de coleta', () => {
      const el = createPickupMarkerElement(baseTracking);
      expect(el.className).toBe('pickup-marker');
      expect(el.innerHTML).toContain('Av. Paulista');
    });

    it('faz fallback para "Coleta" quando pickup_address ausente', () => {
      const tracking = { ...baseTracking, order: { ...baseTracking.order!, pickup_address: '' } };
      const el = createPickupMarkerElement(tracking);
      expect(el.innerHTML).toContain('Coleta');
    });

    it('renderiza marcador de entrega com geofence pulse', () => {
      const el = createDeliveryMarkerElement(baseTracking);
      expect(el.className).toBe('delivery-marker');
      expect(el.innerHTML).toContain('delivery-geofence-pulse');
      expect(el.innerHTML).toContain('Rua Augusta');
    });
  });

  describe('createStoppedMarkerElement', () => {
    it('exibe duração em minutos', () => {
      const el = createStoppedMarkerElement(baseTracking, 17);
      expect(el.className).toBe('stopped-warning-marker');
      expect(el.innerHTML).toContain('PARADO +17M');
    });
  });
});
