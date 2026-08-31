import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  rules: Record<string, unknown>;
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*');
      
      if (error) {
        logger.error('Error fetching feature flags:', error);
        throw error;
      }
      
      return data as FeatureFlag[];
    },
    staleTime: 60000, // 1 minute
  });
}

export function useFeatureFlag(name: string) {
  const { data: flags, isLoading } = useFeatureFlags();
  
  const flag = flags?.find(f => f.name === name);
  
  return {
    isEnabled: flag?.is_enabled ?? false,
    isLoading,
    flag
  };
}
