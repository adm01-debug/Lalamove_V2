import type { Database } from '@/integrations/supabase/types';

export interface Order {
  id: string;
  lalamoveId: string;
  internalOrderId?: string;
  status: OrderStatus;
  pickupAddress: string;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
  scheduledAt: Date;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType: VehicleType;
  totalCost: number;
  currency: string;
  tags: string[];
  supplier_contact?: string;
  auto_notify_supplier?: boolean;
  stalled_threshold_minutes?: number;
  route_deviation_threshold_minutes?: number;
  pod_required?: boolean;
  pod_url?: string;
  shareLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus =
  | 'PENDING'
  | 'MATCHED'
  | 'ON_GOING'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'QUOTED'
  | 'ASSIGNING_DRIVER'
  | 'DELIVERING';

export type VehicleType = 
  | 'MOTORCYCLE'
  | 'CAR'
  | 'VAN'
  | 'TRUCK';

export interface Driver {
  id: string;
  lalamoveId: string;
  name: string;
  phone: string;
  photoUrl?: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  riskScore: number;
  status: DriverStatus;
  totalDeliveries: number;
  completedDeliveries: number;
  rating: number;
  incidents: DriverIncident[];
  lastActiveAt: Date;
  createdAt: Date;
}

export type DriverStatus = 
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'BLOCKED'
  | 'WHITELIST'
  | 'BLACKLIST';

export interface DriverIncident {
  id: string;
  driverId: string;
  type: IncidentType;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  orderId?: string;
  createdAt: Date;
}

export type IncidentType = 
  | 'ROUTE_DEVIATION'
  | 'LONG_STOP'
  | 'LATE_DELIVERY'
  | 'CUSTOMER_COMPLAINT'
  | 'DAMAGE'
  | 'OTHER';

export type ApprovalPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';

export interface DriverApproval {
  id: string;
  driverId: string;
  driver?: Driver;
  orderId: string;
  order?: Order;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  riskScore: number;
  riskFactors: string[];
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  notes?: string;
  approvalPriority?: ApprovalPriority;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  orderId?: string;
  driverId?: string;
  isRead: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
}

// Espelha o enum `alert_type` do banco (src/integrations/supabase/types.ts). Antes era uma
// lista local de 7 valores e ficou defasado: alertas reais de produção (MISSING_POD,
// DRIVER_APPROACHING_PICKUP, DRIVER_NO_CONFIRMATION...) chegavam sem rótulo e sem ícone.
export type AlertType = Database['public']['Enums']['alert_type'];

export interface TrackingPoint {
  orderId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  timestamp: Date;
}

export interface DashboardStats {
  totalOrders: number;
  activeDeliveries: number;
  completedToday: number;
  pendingApprovals: number;
  alertsCount: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  activeDrivers: number;
}
