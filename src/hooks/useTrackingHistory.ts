import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrackingEvent {
  id: string;
  order_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  created_at: string;
  event_type: string | null;
}

interface UseTrackingHistoryReturn {
  history: TrackingEvent[];
  loading: boolean;
  error: string | null;
  fetchHistory: (driverId: string, orderId?: string, limit?: number) => Promise<void>;
  clearHistory: () => void;
}

export function useTrackingHistory(): UseTrackingHistoryReturn {
  const [history, setHistory] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (driverId: string, orderId?: string, limit: number = 100) => {
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('tracking_events')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching tracking history:', err);
      setError('Erro ao buscar histórico de rastreamento');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setError(null);
  }, []);

  return {
    history,
    loading,
    error,
    fetchHistory,
    clearHistory,
  };
}
