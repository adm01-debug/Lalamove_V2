import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMapboxToken() {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (cancelled) return;
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError('Token Mapbox não configurado');
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Error fetching Mapbox token:', err);
        setError('Erro ao buscar token do Mapbox');
      }
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  return { mapboxToken, error };
}
