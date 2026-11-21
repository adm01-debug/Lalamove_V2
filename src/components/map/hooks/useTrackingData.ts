import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VehicleFilter, StatusFilter } from '../types';

export interface TrackingData {
  id: string;
  order_id: string;
  driver_id: string;
  current_latitude: number;
  current_longitude: number;
  heading: number | null;
  speed: number | null;
  is_on_route: boolean | null;
  is_stopped: boolean | null;
  eta_minutes: number | null;
  /**
   * Polyline calculada no servidor pelo job `route_plan`. Vem como `jsonb` do banco,
   * por isso `unknown` — normalizada por `parseExpectedRoute()` em `useMapMarkers`.
   * Evita chamar Directions no browser.
   */
  expected_route?: unknown;
  driver?: {
    name: string;
    vehicle_type: string;
    phone: string | null;
  };
  order?: {
    lalamove_id: string;
    internal_order_id: string | null;
    status: string;
    customer_name: string;
    pickup_address: string;
    delivery_address: string;
    pickup_latitude: number | null;
    pickup_longitude: number | null;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
  };
}

export function useTrackingData(vehicleFilter: VehicleFilter, statusFilter: StatusFilter) {
  const [trackingData, setTrackingData] = useState<TrackingData[]>([]);
  const [allTrackingData, setAllTrackingData] = useState<TrackingData[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchTrackingData = async () => {
      const { data, error } = await supabase
        .from('active_tracking')
        .select(`
          *,
          driver:drivers(name, vehicle_type, phone),
          order:lalamove_orders(
            lalamove_id, internal_order_id, status, customer_name, 
            pickup_address, delivery_address, pickup_latitude,
            pickup_longitude, delivery_latitude, delivery_longitude
          )
        `);

      // Descarta respostas de requisições obsoletas (troca de filtro / unmount).
      if (cancelled) return;

      if (error) {
        logger.error('Error fetching tracking data:', error);
        return;
      }

      setAllTrackingData(data || []);

      let filteredData = data || [];
      if (vehicleFilter !== 'ALL') {
        filteredData = filteredData.filter(t => t.driver?.vehicle_type === vehicleFilter);
      }
      if (statusFilter !== 'ALL') {
        filteredData = filteredData.filter(t => {
          if (statusFilter === 'STOPPED') return t.is_stopped === true;
          if (statusFilter === 'OFF_ROUTE') return t.is_on_route === false;
          if (statusFilter === 'IN_TRANSIT') return !t.is_stopped && t.is_on_route !== false;
          return true;
        });
      }
      setTrackingData(filteredData);
    };

    fetchTrackingData();

    const channel = supabase
      .channel('active-tracking-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_tracking' }, () => {
        fetchTrackingData();
      })
      .subscribe();

    const interval = setInterval(fetchTrackingData, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [vehicleFilter, statusFilter]);

  return { trackingData, allTrackingData };
}
