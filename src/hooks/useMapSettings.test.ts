import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMapSettings } from './useMapSettings';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('useMapSettings Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapSettings.getState().resetToDefaults();
    // Clear local cache if needed, though resetToDefaults handles most state
  });

  it('should load default values initially', () => {
    const state = useMapSettings.getState();
    expect(state.offRouteThreshold).toBe(500);
    expect(state.stoppedThreshold).toBe(15);
    expect(state.geofenceRadius).toBe(300);
  });

  it('should update state when setters are called', () => {
    const state = useMapSettings.getState();
    state.setOffRouteThreshold(1000);
    state.setStoppedThreshold(30);
    state.setGeofenceRadius(500);

    const updatedState = useMapSettings.getState();
    expect(updatedState.offRouteThreshold).toBe(1000);
    expect(updatedState.stoppedThreshold).toBe(30);
    expect(updatedState.geofenceRadius).toBe(500);
  });

  it('should load settings from supabase for a specific context (driver/delivery)', async () => {
    const contextKey = 'driver-123-delivery-456';
    const mockData = {
      off_route_threshold: 800,
      stopped_threshold: 20,
      geofence_radius: 400,
      context_key: contextKey
    };

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    await useMapSettings.getState().loadContextSettings(contextKey);

    const state = useMapSettings.getState();
    expect(state.offRouteThreshold).toBe(800);
    expect(state.stoppedThreshold).toBe(20);
    expect(state.geofenceRadius).toBe(400);
  });

  it('should persist settings to supabase with context key', async () => {
    const contextKey = 'driver-789';
    const mockUser = { id: 'user-123' };
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser }, error: null });
    
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({
      upsert: upsertMock,
    });

    const state = useMapSettings.getState();
    state.setOffRouteThreshold(750);
    state.setStoppedThreshold(25);
    
    await state.saveContextSettings(contextKey);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context_key: contextKey,
        off_route_threshold: 750,
        stopped_threshold: 25,
        user_id: 'user-123',
      }),
      { onConflict: 'user_id,context_key' }
    );
    
    // Check internal cache update
    expect(useMapSettings.getState().contextSettings[contextKey]).toEqual({
      offRouteThreshold: 750,
      stoppedThreshold: 25,
      geofenceRadius: 300
    });
  });

  it('should handle missing data by falling back to defaults during load', async () => {
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Set non-defaults first
    useMapSettings.getState().setOffRouteThreshold(1000);
    
    await useMapSettings.getState().loadContextSettings('empty-context');

    const state = useMapSettings.getState();
    // In current implementation, if no data, it keeps existing or falls back inside loadContextSettings
    // Looking at useMapSettings.ts:74, it uses ?? 500, etc.
    expect(state.offRouteThreshold).toBe(500);
  });

  it('should reset to defaults when resetToDefaults is called', () => {
    const state = useMapSettings.getState();
    state.setOffRouteThreshold(2000);
    state.resetToDefaults();
    
    const resetState = useMapSettings.getState();
    expect(resetState.offRouteThreshold).toBe(500);
  });
});
