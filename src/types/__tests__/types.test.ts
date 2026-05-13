import { describe, it, expect } from 'vitest';
import type {
  Order, OrderStatus, VehicleType, Driver, DriverStatus,
  DriverIncident, IncidentType, DriverApproval, ApprovalPriority,
  Alert, AlertType, TrackingPoint, DashboardStats,
} from '../index';

describe('Type Contracts - Order', () => {
  const validOrder: Order = {
    id: 'uuid-1',
    lalamoveId: 'LLM-001',
    status: 'PENDING',
    pickupAddress: 'Rua A',
    deliveryAddress: 'Rua B',
    customerName: 'João',
    customerPhone: '11999999999',
    scheduledAt: new Date(),
    vehicleType: 'MOTORCYCLE',
    totalCost: 25.50,
    currency: 'BRL',
    tags: ['urgente'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('deve aceitar todas as propriedades obrigatórias', () => {
    expect(validOrder.id).toBeDefined();
    expect(validOrder.lalamoveId).toBeDefined();
    expect(validOrder.status).toBe('PENDING');
  });

  it('deve aceitar propriedades opcionais', () => {
    const orderFull: Order = {
      ...validOrder,
      internalOrderId: 'INT-001',
      estimatedDelivery: new Date(),
      actualDelivery: new Date(),
      driverId: 'drv-1',
      driverName: 'Carlos',
      driverPhone: '11888888888',
    };
    expect(orderFull.driverName).toBe('Carlos');
    expect(orderFull.internalOrderId).toBe('INT-001');
  });

  it('deve validar todos os OrderStatus', () => {
    const statuses: OrderStatus[] = ['PENDING', 'MATCHED', 'ON_GOING', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
    expect(statuses).toHaveLength(8);
    statuses.forEach(s => expect(typeof s).toBe('string'));
  });

  it('deve validar todos os VehicleType', () => {
    const types: VehicleType[] = ['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK'];
    expect(types).toHaveLength(4);
  });

  it('totalCost deve ser numérico', () => {
    expect(typeof validOrder.totalCost).toBe('number');
    expect(validOrder.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('tags deve ser array de strings', () => {
    expect(Array.isArray(validOrder.tags)).toBe(true);
    validOrder.tags.forEach(tag => expect(typeof tag).toBe('string'));
  });

  it('scheduledAt deve ser Date', () => {
    expect(validOrder.scheduledAt).toBeInstanceOf(Date);
  });
});

describe('Type Contracts - Driver', () => {
  const validDriver: Driver = {
    id: 'drv-1',
    lalamoveId: 'LLM-DRV-001',
    name: 'Carlos Silva',
    phone: '11999999999',
    vehicleType: 'MOTORCYCLE',
    vehiclePlate: 'ABC1234',
    riskScore: 3.5,
    status: 'APPROVED',
    totalDeliveries: 100,
    completedDeliveries: 95,
    rating: 4.8,
    incidents: [],
    lastActiveAt: new Date(),
    createdAt: new Date(),
  };

  it('deve aceitar todas as propriedades obrigatórias', () => {
    expect(validDriver.name).toBe('Carlos Silva');
    expect(validDriver.riskScore).toBe(3.5);
  });

  it('deve validar todos os DriverStatus', () => {
    const statuses: DriverStatus[] = ['APPROVED', 'PENDING_APPROVAL', 'BLOCKED', 'WHITELIST', 'BLACKLIST'];
    expect(statuses).toHaveLength(5);
  });

  it('riskScore deve estar entre 0 e 10', () => {
    expect(validDriver.riskScore).toBeGreaterThanOrEqual(0);
    expect(validDriver.riskScore).toBeLessThanOrEqual(10);
  });

  it('completedDeliveries não deve exceder totalDeliveries', () => {
    expect(validDriver.completedDeliveries).toBeLessThanOrEqual(validDriver.totalDeliveries);
  });

  it('rating deve ser numérico positivo', () => {
    expect(typeof validDriver.rating).toBe('number');
    expect(validDriver.rating).toBeGreaterThan(0);
  });
});

describe('Type Contracts - DriverIncident', () => {
  it('deve validar todos os IncidentType', () => {
    const types: IncidentType[] = ['ROUTE_DEVIATION', 'LONG_STOP', 'LATE_DELIVERY', 'CUSTOMER_COMPLAINT', 'DAMAGE', 'OTHER'];
    expect(types).toHaveLength(6);
  });

  it('deve validar todas as severidades', () => {
    const severities: DriverIncident['severity'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    expect(severities).toHaveLength(4);
  });
});

describe('Type Contracts - DriverApproval', () => {
  it('deve validar todas as prioridades', () => {
    const priorities: ApprovalPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];
    expect(priorities).toHaveLength(5);
  });

  it('deve validar status da aprovação', () => {
    const statuses: DriverApproval['status'][] = ['PENDING', 'APPROVED', 'REJECTED'];
    expect(statuses).toHaveLength(3);
  });
});

describe('Type Contracts - Alert', () => {
  it('deve validar todos os AlertType', () => {
    const types: AlertType[] = ['DRIVER_BLOCKED', 'ROUTE_DEVIATION', 'DRIVER_STOPPED', 'LATE_DELIVERY', 'APPROVAL_REQUIRED', 'ORDER_CANCELLED'];
    expect(types).toHaveLength(6);
  });

  it('deve validar severidades de alerta', () => {
    const severities: Alert['severity'][] = ['INFO', 'WARNING', 'CRITICAL'];
    expect(severities).toHaveLength(3);
  });
});

describe('Type Contracts - TrackingPoint', () => {
  it('deve ter coordenadas válidas', () => {
    const point: TrackingPoint = {
      orderId: 'ord-1',
      driverId: 'drv-1',
      latitude: -23.5505,
      longitude: -46.6333,
      heading: 180,
      speed: 40,
      timestamp: new Date(),
    };
    expect(point.latitude).toBeGreaterThanOrEqual(-90);
    expect(point.latitude).toBeLessThanOrEqual(90);
    expect(point.longitude).toBeGreaterThanOrEqual(-180);
    expect(point.longitude).toBeLessThanOrEqual(180);
    expect(point.heading).toBeGreaterThanOrEqual(0);
    expect(point.heading).toBeLessThanOrEqual(360);
    expect(point.speed).toBeGreaterThanOrEqual(0);
  });
});

describe('Type Contracts - DashboardStats', () => {
  it('deve ter todos os campos numéricos', () => {
    const stats: DashboardStats = {
      totalOrders: 150,
      activeDeliveries: 12,
      completedToday: 45,
      pendingApprovals: 3,
      alertsCount: 7,
      avgDeliveryTime: 42,
      onTimeRate: 93.5,
      activeDrivers: 25,
    };
    Object.values(stats).forEach(v => expect(typeof v).toBe('number'));
  });

  it('onTimeRate deve estar entre 0 e 100', () => {
    const stats: DashboardStats = {
      totalOrders: 0, activeDeliveries: 0, completedToday: 0,
      pendingApprovals: 0, alertsCount: 0, avgDeliveryTime: 0,
      onTimeRate: 95, activeDrivers: 0,
    };
    expect(stats.onTimeRate).toBeGreaterThanOrEqual(0);
    expect(stats.onTimeRate).toBeLessThanOrEqual(100);
  });

  it('contagens não devem ser negativas', () => {
    const stats: DashboardStats = {
      totalOrders: 0, activeDeliveries: 0, completedToday: 0,
      pendingApprovals: 0, alertsCount: 0, avgDeliveryTime: 0,
      onTimeRate: 0, activeDrivers: 0,
    };
    Object.values(stats).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });
});
