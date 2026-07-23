import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';

export type MarkerDensity = 'comfortable' | 'compact';

export type MapProvider =
  | 'mapbox-dark'
  | 'mapbox-sat'
  | 'osm'
  | 'esri-sat'
  | 'google-roadmap'
  | 'google-hybrid'
  | 'google-3d';

interface MapSettingsState {
  offRouteThreshold: number; // meters
  stoppedThreshold: number; // minutes
  geofenceRadius: number; // meters
  markerDensity: MarkerDensity; // visual density of driver markers
  preferredProvider: MapProvider;
  
  
  // Persistence by context (region/type)
  contextSettings: Record<string, {
    offRouteThreshold?: number;
    stoppedThreshold?: number;
    geofenceRadius?: number;
  }>;

  setMarkerDensity: (value: MarkerDensity) => void;
  setPreferredProvider: (value: MapProvider) => void;
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
      markerDensity: 'comfortable',
      contextSettings: {},

      setOffRouteThreshold: (value: number) => set({ offRouteThreshold: value }),
      setStoppedThreshold: (value: number) => set({ stoppedThreshold: value }),
      setGeofenceRadius: (value: number) => set({ geofenceRadius: value }),
      setMarkerDensity: (value: MarkerDensity) => set({ markerDensity: value }),

      saveContextSettings: async (contextKey: string) => {
        try {
          const { offRouteThreshold, stoppedThreshold, geofenceRadius } = get();
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (authError) throw authError;
          if (!user) throw new Error('User not authenticated');

          const { error } = await supabase
            .from('map_settings_overrides')
            .upsert({
              user_id: user.id,
              context_key: contextKey,
              off_route_threshold: offRouteThreshold,
              stopped_threshold: stoppedThreshold,
              geofence_radius: geofenceRadius
            }, { onConflict: 'user_id,context_key' });

          if (error) throw error;

          set(state => ({
            contextSettings: {
              ...state.contextSettings,
              [contextKey]: { offRouteThreshold, stoppedThreshold, geofenceRadius }
            }
          }));
        } catch (error) {
          console.error('Error saving context settings:', error);
          throw error;
        }
      },

      loadContextSettings: async (contextKey: string) => {
        try {
          const { data, error } = await supabase
            .from('map_settings_overrides')
            .select('*')
            .eq('context_key', contextKey)
            .maybeSingle();

          if (error) throw error;

          if (data) {
            set({
              offRouteThreshold: data.off_route_threshold ?? 500,
              stoppedThreshold: data.stopped_threshold ?? 15,
              geofenceRadius: data.geofence_radius ?? 300,
            });
          } else {
            // Fallback to defaults if no specific context found
            get().resetToDefaults();
          }
        } catch (error) {
          console.error('Error loading context settings:', error);
          // Fallback on error
          get().resetToDefaults();
          throw error;
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
