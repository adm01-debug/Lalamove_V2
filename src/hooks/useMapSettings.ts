import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

interface MapSettingsState {
  offRouteThreshold: number; // meters
  stoppedThreshold: number; // minutes
  geofenceRadius: number; // meters
  
  // Persistence by context (region/type)
  contextSettings: Record<string, {
    offRouteThreshold?: number;
    stoppedThreshold?: number;
    geofenceRadius?: number;
  }>;

  setOffRouteThreshold: (value: number) => void;
  setStoppedThreshold: (value: number) => void;
  setGeofenceRadius: (value: number) => void;
  
  // Context-specific actions
  saveContextSettings: (contextKey: string) => Promise<void>;
  loadContextSettings: (contextKey: string) => Promise<void>;
  resetToDefaults: () => void;
}

export const useMapSettings = create<MapSettingsState>()(
  persist(
    (set, get) => ({
      offRouteThreshold: 500,
      stoppedThreshold: 15,
      geofenceRadius: 300,
      contextSettings: {},

      setOffRouteThreshold: (value: number) => set({ offRouteThreshold: value }),
      setStoppedThreshold: (value: number) => set({ stoppedThreshold: value }),
      setGeofenceRadius: (value: number) => set({ geofenceRadius: value }),

      saveContextSettings: async (contextKey: string) => {
        const { offRouteThreshold, stoppedThreshold, geofenceRadius } = get();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        const { error } = await supabase
          .from('map_settings_overrides')
          .upsert({
            user_id: user.id,
            context_key: contextKey,
            off_route_threshold: offRouteThreshold,
            stopped_threshold: stoppedThreshold,
            geofence_radius: geofenceRadius
          }, { onConflict: 'user_id,context_key' });

        if (!error) {
          set(state => ({
            contextSettings: {
              ...state.contextSettings,
              [contextKey]: { offRouteThreshold, stoppedThreshold, geofenceRadius }
            }
          }));
        }
      },

      loadContextSettings: async (contextKey: string) => {
        const { data, error } = await supabase
          .from('map_settings_overrides')
          .select('*')
          .eq('context_key', contextKey)
          .maybeSingle();

        if (data && !error) {
          set({
            offRouteThreshold: data.off_route_threshold ?? 500,
            stoppedThreshold: data.stopped_threshold ?? 15,
            geofenceRadius: data.geofence_radius ?? 300,
          });
        }
      },

      resetToDefaults: () => set({
        offRouteThreshold: 500,
        stoppedThreshold: 15,
        geofenceRadius: 300,
      }),
    }),
    {
      name: 'map-settings-storage',
    }
  )
);
