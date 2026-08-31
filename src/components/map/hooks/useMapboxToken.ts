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
        if (error) {
          // Silently fail - mapbox is optional
          return;
        }
        if (data?.token && !data.token.includes('placeholder')) {
          setMapboxToken(data.token);
        } else {
          setError('Token Mapbox não configurado');
        }
      } catch (err) {
        if (cancelled) return;
        // Silently fail - mapbox is optional
        setError('Token Mapbox não disponível');
      }
    };
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  return { mapboxToken, error };
}
