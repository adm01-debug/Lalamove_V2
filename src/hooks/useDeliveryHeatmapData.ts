import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

interface DeliveryStats {
  totalDeliveries: number;
  completedDeliveries: number;
  topRegions: { address: string; count: number }[];
}

async function fetchHeatmapData(days: number): Promise<{
  pickupPoints: HeatmapPoint[];
  deliveryPoints: HeatmapPoint[];
  stats: DeliveryStats;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: orders, error } = await supabase
    .from('lalamove_orders')
    .select('pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, delivery_address, status')
    .gte('created_at', startDate.toISOString());

  if (error) {
    logger.error('Error fetching heatmap data:', error);
    throw error;
  }

  // Aggregate pickup points
  const pickupMap = new Map<string, { lat: number; lng: number; count: number }>();
  const deliveryMap = new Map<string, { lat: number; lng: number; count: number }>();
  const regionCount = new Map<string, number>();

  (orders || []).forEach(order => {
    // Pickup points
    if (order.pickup_latitude && order.pickup_longitude) {
      const key = `${order.pickup_latitude.toFixed(3)},${order.pickup_longitude.toFixed(3)}`;
      const existing = pickupMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        pickupMap.set(key, { 
          lat: Number(order.pickup_latitude), 
          lng: Number(order.pickup_longitude), 
          count: 1 
        });
      }
    }

    // Delivery points
    if (order.delivery_latitude && order.delivery_longitude) {
      const key = `${order.delivery_latitude.toFixed(3)},${order.delivery_longitude.toFixed(3)}`;
      const existing = deliveryMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        deliveryMap.set(key, { 
          lat: Number(order.delivery_latitude), 
          lng: Number(order.delivery_longitude), 
          count: 1 
        });
      }
    }

    // Region counting (by first part of address)
    if (order.delivery_address) {
      const region = order.delivery_address.split(',').slice(0, 2).join(',').trim();
      regionCount.set(region, (regionCount.get(region) || 0) + 1);
    }
  });

  // Convert to arrays
  const pickupPoints: HeatmapPoint[] = Array.from(pickupMap.values()).map(p => ({
    latitude: p.lat,
    longitude: p.lng,
    weight: p.count
  }));

  const deliveryPoints: HeatmapPoint[] = Array.from(deliveryMap.values()).map(p => ({
    latitude: p.lat,
    longitude: p.lng,
    weight: p.count
  }));

  // Top regions
  const topRegions = Array.from(regionCount.entries())
    .map(([address, count]) => ({ address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const stats: DeliveryStats = {
    totalDeliveries: orders?.length || 0,
    completedDeliveries: orders?.filter(o => o.status === 'COMPLETED').length || 0,
    topRegions
  };

  return { pickupPoints, deliveryPoints, stats };
}

export function useDeliveryHeatmapData(days: number = 30) {
  return useQuery({
    queryKey: ['delivery-heatmap', days],
    queryFn: () => fetchHeatmapData(days),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
