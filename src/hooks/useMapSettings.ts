import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MapSettingsState {
  offRouteThreshold: number; // meters
  stoppedThreshold: number; // minutes
  geofenceRadius: number; // meters
  setOffRouteThreshold: (value: number) => void;
  setStoppedThreshold: (value: number) => void;
  setGeofenceRadius: (value: number) => void;
}

export const useMapSettings = create<MapSettingsState>()(
  persist(
    (set: any) => ({
      offRouteThreshold: 500,
      stoppedThreshold: 15,
      geofenceRadius: 300,
      setOffRouteThreshold: (value: number) => set({ offRouteThreshold: value }),
      setStoppedThreshold: (value: number) => set({ stoppedThreshold: value }),
      setGeofenceRadius: (value: number) => set({ geofenceRadius: value }),
    }),
    {
      name: 'map-settings-storage',
    }
  )
);
