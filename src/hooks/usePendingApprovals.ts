import { logger } from '@/utils/logger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DriverApproval, Order, Driver, VehicleType, DriverStatus, OrderStatus } from '@/types';

export { useApprovalActions } from './useApprovalActions';

interface ApprovalDataRow {
  id: string;
  driver_id: string;
  order_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  risk_score: number;
  risk_factors: string[] | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  approval_priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL' | null;
  drivers: {
    id: string; lalamove_id: string | null; name: string; phone: string | null;
    photo_url: string | null; vehicle_type: string; vehicle_plate: string | null;
    risk_score: number | null; status: string; total_deliveries: number | null;
    completed_deliveries: number | null; rating: number | null;
    last_active_at: string | null; created_at: string;
  } | null;
  lalamove_orders: {
    id: string; lalamove_id: string; internal_order_id: string | null;
    status: string; pickup_address: string; delivery_address: string;
    customer_name: string; customer_phone: string | null; scheduled_at: string | null;
    estimated_delivery: string | null; vehicle_type: string; total_cost: number;
    currency: string; tags: string[] | null; created_at: string; updated_at: string;
  } | null;
}

const SELECT_QUERY = `
  *,
  drivers:driver_id (
    id, lalamove_id, name, phone, photo_url, vehicle_type, vehicle_plate,
    risk_score, status, total_deliveries, completed_deliveries, rating,
    last_active_at, created_at
  ),
  lalamove_orders:order_id (
    id, lalamove_id, internal_order_id, status, pickup_address, delivery_address,
    customer_name, customer_phone, scheduled_at, estimated_delivery, vehicle_type,
    total_cost, currency, tags, created_at, updated_at
  )
`;

function mapApprovalData(data: ApprovalDataRow[]): DriverApproval[] {
  return data.map((approval): DriverApproval => {
    const d = approval.drivers;
    const o = approval.lalamove_orders;

    const driver: Driver = {
      id: d?.id ?? '', lalamoveId: d?.lalamove_id ?? '', name: d?.name ?? 'Motorista',
      phone: d?.phone ?? '', photoUrl: d?.photo_url ?? undefined,
      vehicleType: (d?.vehicle_type as VehicleType) ?? 'MOTORCYCLE',
      vehiclePlate: d?.vehicle_plate ?? '', riskScore: Number(d?.risk_score ?? 5),
      status: (d?.status as DriverStatus) ?? 'PENDING_APPROVAL',
      totalDeliveries: d?.total_deliveries ?? 0, completedDeliveries: d?.completed_deliveries ?? 0,
      rating: Number(d?.rating ?? 5), incidents: [],
      lastActiveAt: d?.last_active_at ? new Date(d.last_active_at) : new Date(),
      createdAt: d?.created_at ? new Date(d.created_at) : new Date(),
    };

    const order: Order = {
      id: o?.id ?? '', lalamoveId: o?.lalamove_id ?? '',
      internalOrderId: o?.internal_order_id ?? undefined,
      status: (o?.status as OrderStatus) ?? 'PENDING',
      pickupAddress: o?.pickup_address ?? '', deliveryAddress: o?.delivery_address ?? '',
      customerName: o?.customer_name ?? '', customerPhone: o?.customer_phone ?? '',
      scheduledAt: o?.scheduled_at ? new Date(o.scheduled_at) : new Date(),
      estimatedDelivery: o?.estimated_delivery ? new Date(o.estimated_delivery) : undefined,
      vehicleType: (o?.vehicle_type as VehicleType) ?? 'MOTORCYCLE',
      totalCost: Number(o?.total_cost ?? 0), currency: o?.currency ?? 'BRL',
      tags: o?.tags ?? [],
      createdAt: o?.created_at ? new Date(o.created_at) : new Date(),
      updatedAt: o?.updated_at ? new Date(o.updated_at) : new Date(),
    };

    return {
      id: approval.id, driverId: approval.driver_id, driver,
      orderId: approval.order_id, order, status: approval.status,
      riskScore: Number(approval.risk_score), riskFactors: approval.risk_factors ?? [],
      requestedAt: new Date(approval.requested_at),
      reviewedAt: approval.reviewed_at ? new Date(approval.reviewed_at) : undefined,
      reviewedBy: approval.reviewed_by ?? undefined,
      notes: approval.notes ?? undefined,
      approvalPriority: approval.approval_priority ?? undefined,
    };
  });
}

async function fetchPendingApprovals(): Promise<DriverApproval[]> {
  const { data, error } = await supabase
    .from('driver_approval_queue').select(SELECT_QUERY)
    .eq('status', 'PENDING').order('requested_at', { ascending: false }).limit(50);
  if (error) { logger.error('Error fetching approvals:', error); throw error; }
  return mapApprovalData(data || []);
}

async function fetchApprovalHistory(): Promise<DriverApproval[]> {
  const { data, error } = await supabase
    .from('driver_approval_queue').select(SELECT_QUERY)
    .in('status', ['APPROVED', 'REJECTED']).order('reviewed_at', { ascending: false }).limit(50);
  if (error) { logger.error('Error fetching approval history:', error); throw error; }
  return mapApprovalData(data || []);
}

async function fetchApprovalStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [pending, approved, rejected, pendingData] = await Promise.all([
    supabase.from('driver_approval_queue').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('driver_approval_queue').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED').gte('reviewed_at', todayIso),
    supabase.from('driver_approval_queue').select('*', { count: 'exact', head: true }).eq('status', 'REJECTED').gte('reviewed_at', todayIso),
    supabase.from('driver_approval_queue').select('risk_score').eq('status', 'PENDING'),
  ]);

  const avgRiskScore = pendingData.data?.length
    ? pendingData.data.reduce((acc, item) => acc + (typeof item.risk_score === 'number' ? item.risk_score : 0), 0) / pendingData.data.length
    : 0;

  return {
    pending: pending.count || 0,
    approvedToday: approved.count || 0,
    rejectedToday: rejected.count || 0,
    avgRiskScore,
  };
}

export function usePendingApprovals() {
  return useQuery({ queryKey: ['pending-approvals'], queryFn: fetchPendingApprovals, refetchInterval: 15000, staleTime: 5000 });
  refetchIntervalInBackground: false,
}

export function useApprovalHistory() {
  return useQuery({ queryKey: ['approval-history'], queryFn: fetchApprovalHistory, staleTime: 30000 });
}

export function useApprovalStats() {
  return useQuery({ queryKey: ['approval-stats'], queryFn: fetchApprovalStats, refetchInterval: 30000, staleTime: 10000 });
  refetchIntervalInBackground: false,
}
