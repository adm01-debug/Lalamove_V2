import { logger } from '@/utils/logger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types';

const PAGE_SIZE = 20;

interface OrdersResult {
  orders: Order[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchOrders(page: number): Promise<OrdersResult> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from('lalamove_orders')
    .select(`
      *,
      drivers:driver_id (
        name,
        phone
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    logger.error('Error fetching orders:', error);
    throw error;
  }

  const totalCount = count ?? 0;
  const orders = (data || []).map((order): Order => ({
    id: order.id,
    lalamoveId: order.lalamove_id,
    internalOrderId: order.internal_order_id ?? undefined,
    status: order.status,
    pickupAddress: order.pickup_address,
    deliveryAddress: order.delivery_address,
    customerName: order.customer_name,
    customerPhone: order.customer_phone ?? '',
    scheduledAt: new Date(order.scheduled_at),
    estimatedDelivery: order.estimated_delivery ? new Date(order.estimated_delivery) : undefined,
    actualDelivery: order.actual_delivery ? new Date(order.actual_delivery) : undefined,
    driverId: order.driver_id ?? undefined,
    driverName: order.drivers?.name ?? undefined,
    driverPhone: order.drivers?.phone ?? undefined,
    vehicleType: order.vehicle_type,
    totalCost: Number(order.total_cost),
    currency: order.currency,
    tags: order.tags ?? [],
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
  }));

  return {
    orders,
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
  };
}

export function useRecentOrders(page = 1, status?: string, query?: string) {
  return useQuery({
    queryKey: ['recent-orders', page, status, query],
    queryFn: () => fetchOrders(page, status, query),
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
