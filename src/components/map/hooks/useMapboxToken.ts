import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMapboxToken() {
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError('Token Mapbox não configurado');
        }
      } catch (err) {
        logger.error('Error fetching Mapbox token:', err);
        setError('Erro ao buscar token do Mapbox');
      }
    };
    fetchToken();
  }, []);

  return { mapboxToken, error };
}
